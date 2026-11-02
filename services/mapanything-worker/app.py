"""Small asynchronous HTTP boundary around Meta's MapAnything demo script.

The worker intentionally delegates inference and GLB export to the official
MapAnything repository. EIDA owns upload validation, job state and artifact
delivery; it does not reimplement the model.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError


ROOT = Path(__file__).resolve().parent
MAPANYTHING_REPO = Path(os.getenv("MAPANYTHING_REPO", "/opt/map-anything")).resolve()
MAPANYTHING_SCRIPT = MAPANYTHING_REPO / "scripts" / "demo_images_only_inference.py"
DATA_ROOT = Path(os.getenv("EIDA_MAPANYTHING_DATA", str(ROOT / ".data"))).resolve()
PUBLIC_BASE_URL = os.getenv("EIDA_PUBLIC_BASE_URL", "http://localhost:8001").rstrip("/")
WORKER_TOKEN = os.getenv("EIDA_WORKER_TOKEN", "").strip()
MAX_PHOTO_BYTES = int(os.getenv("EIDA_MAX_PHOTO_BYTES", str(15 * 1024 * 1024)))
JOB_TIMEOUT_SECONDS = int(os.getenv("EIDA_JOB_TIMEOUT_SECONDS", "1800"))
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "EIDA_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

DATA_ROOT.mkdir(parents=True, exist_ok=True)
(DATA_ROOT / "artifacts").mkdir(exist_ok=True)

app = FastAPI(title="EIDA MapAnything worker", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
app.mount("/artifacts", StaticFiles(directory=DATA_ROOT / "artifacts"), name="artifacts")

jobs: dict[str, dict[str, Any]] = {}
jobs_lock = asyncio.Lock()


def now_ms() -> int:
    return int(time.time() * 1000)


def runtime_device() -> str:
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "unavailable"


def worker_ready() -> tuple[bool, str]:
    if not MAPANYTHING_SCRIPT.is_file():
        return False, f"MapAnything script not found at {MAPANYTHING_SCRIPT}."
    device = runtime_device()
    if device == "unavailable":
        return False, "PyTorch is not installed in this environment."
    if device == "cpu":
        return True, "Ready in CPU fallback mode; reconstruction may be slow."
    return True, "Ready for GPU metric reconstruction."


async def authorize(authorization: str | None = Header(default=None)) -> None:
    if not WORKER_TOKEN:
        return
    if authorization != f"Bearer {WORKER_TOKEN}":
        raise HTTPException(status_code=401, detail="Invalid worker token.")


def public_job(job: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in job.items() if not key.startswith("_")}


async def update_job(job_id: str, **changes: Any) -> None:
    async with jobs_lock:
        job = jobs[job_id]
        job.update(changes)
        job["updatedAt"] = now_ms()


def run_official_mapanything(image_dir: Path, output_path: Path) -> subprocess.CompletedProcess[str]:
    command = [
        sys.executable,
        str(MAPANYTHING_SCRIPT),
        "--image_folder",
        str(image_dir),
        "--save_glb",
        "--output_path",
        str(output_path),
        "--apache",
    ]
    environment = os.environ.copy()
    environment.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
    return subprocess.run(
        command,
        cwd=MAPANYTHING_REPO,
        env=environment,
        capture_output=True,
        text=True,
        timeout=JOB_TIMEOUT_SECONDS,
        check=False,
    )


async def reconstruct(job_id: str, request_data: dict[str, Any], work_dir: Path) -> None:
    image_dir = work_dir / "images"
    artifact_dir = DATA_ROOT / "artifacts" / job_id
    artifact_dir.mkdir(parents=True, exist_ok=True)
    output_path = artifact_dir / "scene.glb"
    report_path = artifact_dir / "report.json"
    try:
        await update_job(
            job_id,
            status="running",
            progress=0.12,
            message="Loading the Apache MapAnything checkpoint.",
        )
        result = await asyncio.to_thread(run_official_mapanything, image_dir, output_path)
        if result.returncode != 0 or not output_path.is_file():
            detail = (result.stderr or result.stdout or "MapAnything did not export a GLB.")[-2000:]
            raise RuntimeError(detail)

        report = {
            "schemaVersion": 1,
            "model": "facebook/map-anything-apache",
            "device": runtime_device(),
            "photoCount": len(list(image_dir.iterdir())),
            "projectId": request_data.get("projectId"),
            "deviceLabel": request_data.get("deviceLabel"),
            "generatedAt": now_ms(),
            "artifact": "scene.glb",
            "purpose": "Metric scene and camera registration evidence for EIDA.",
        }
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        await update_job(
            job_id,
            status="succeeded",
            progress=1,
            message="Metric scene and camera registration are ready.",
            artifacts=[
                {
                    "id": f"{job_id}-scene",
                    "kind": "scene-glb",
                    "label": "MapAnything metric scene",
                    "url": f"{PUBLIC_BASE_URL}/artifacts/{job_id}/scene.glb",
                    "mimeType": "model/gltf-binary",
                },
                {
                    "id": f"{job_id}-report",
                    "kind": "report",
                    "label": "MapAnything run report",
                    "url": f"{PUBLIC_BASE_URL}/artifacts/{job_id}/report.json",
                    "mimeType": "application/json",
                },
            ],
            error=None,
        )
    except subprocess.TimeoutExpired:
        await update_job(
            job_id,
            status="failed",
            progress=1,
            message="Metric reconstruction timed out; EIDA can continue with its local fallback.",
            error={"code": "timeout", "message": "MapAnything exceeded the worker timeout."},
        )
    except Exception as error:  # The public error is deliberately bounded.
        await update_job(
            job_id,
            status="failed",
            progress=1,
            message="Metric reconstruction failed; EIDA can continue with its local fallback.",
            error={"code": "inference_failed", "message": str(error)[-2000:]},
        )
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@app.get("/health")
async def health() -> dict[str, Any]:
    ready, detail = worker_ready()
    return {
        "ok": True,
        "service": "eida-mapanything-worker",
        "model": "facebook/map-anything-apache",
        "device": runtime_device(),
        "ready": ready,
        "maxPhotos": 8,
        "detail": detail,
    }


@app.post("/v1/maps", status_code=202, dependencies=[Depends(authorize)])
async def create_map(
    background_tasks: BackgroundTasks,
    request: UploadFile = File(...),
    photos: list[UploadFile] = File(...),
) -> JSONResponse:
    ready, detail = worker_ready()
    if not ready:
        raise HTTPException(status_code=503, detail=detail)
    if not 3 <= len(photos) <= 8:
        raise HTTPException(status_code=422, detail="Upload between three and eight photos.")

    request_bytes = await request.read(65_537)
    if len(request_bytes) > 65_536:
        raise HTTPException(status_code=413, detail="Request metadata is too large.")
    try:
        request_data = json.loads(request_bytes)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise HTTPException(status_code=422, detail="Request must contain valid JSON.") from error
    project_id = request_data.get("projectId")
    if not isinstance(project_id, str) or not project_id.strip():
        raise HTTPException(status_code=422, detail="projectId is required.")

    job_id = f"map-{uuid.uuid4().hex}"
    work_dir = DATA_ROOT / "work" / job_id
    image_dir = work_dir / "images"
    image_dir.mkdir(parents=True, exist_ok=False)
    try:
        for index, photo in enumerate(photos, start=1):
            payload = await photo.read(MAX_PHOTO_BYTES + 1)
            if len(payload) > MAX_PHOTO_BYTES:
                raise HTTPException(status_code=413, detail="A photo exceeds the upload limit.")
            suffix = ".png" if photo.content_type == "image/png" else ".jpg"
            target = image_dir / f"view-{index:02d}{suffix}"
            target.write_bytes(payload)
            try:
                with Image.open(target) as image:
                    image.verify()
            except (UnidentifiedImageError, OSError) as error:
                raise HTTPException(status_code=422, detail="Every upload must be a valid image.") from error
    except Exception:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise

    created_at = now_ms()
    job = {
        "schemaVersion": 1,
        "id": job_id,
        "projectId": project_id,
        "status": "queued",
        "createdAt": created_at,
        "updatedAt": created_at,
        "photoCount": len(photos),
        "progress": 0,
        "message": "Queued for metric reconstruction.",
        "artifacts": [],
        "error": None,
    }
    async with jobs_lock:
        jobs[job_id] = job
    background_tasks.add_task(reconstruct, job_id, request_data, work_dir)
    return JSONResponse(public_job(job), status_code=202)


@app.get("/v1/maps/{job_id}", dependencies=[Depends(authorize)])
async def get_map(job_id: str) -> dict[str, Any]:
    async with jobs_lock:
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="MapAnything job not found.")
        return public_job(job)
