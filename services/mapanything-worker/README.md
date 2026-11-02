# EIDA MapAnything worker

This optional worker runs Meta's official Apache-licensed MapAnything checkpoint
outside the browser. It accepts 3-8 views, queues one reconstruction and returns
a metric scene GLB plus a small run report. EIDA keeps using its editable graph
for component geometry; the MapAnything scene is stored as spatial evidence.

## Install

Use Python 3.12. Install PyTorch for the machine first, then clone and install
the official repository:

```bash
git clone https://github.com/facebookresearch/map-anything.git
cd map-anything
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e .
pip install -r /absolute/path/to/EIDA/services/mapanything-worker/requirements.txt
```

Configure and start the EIDA wrapper from the repository root:

```bash
export MAPANYTHING_REPO=/absolute/path/to/map-anything
export EIDA_PUBLIC_BASE_URL=http://localhost:8001
export EIDA_ALLOWED_ORIGINS=http://localhost:3000
uvicorn services.mapanything-worker.app:app --host 127.0.0.1 --port 8001
```

Because the directory name contains a hyphen, the most portable launch command
is to enter this directory first:

```bash
cd services/mapanything-worker
uvicorn app:app --host 127.0.0.1 --port 8001
```

Open `http://localhost:8001/health`. A CUDA device is preferred. CPU fallback
is deliberately allowed for zero-budget experiments but can take much longer.

## Security

Keep the service on loopback for local use. For a remote free GPU, expose it
through HTTPS, set `EIDA_PUBLIC_BASE_URL`, restrict `EIDA_ALLOWED_ORIGINS`, and
set `EIDA_WORKER_TOKEN`. Photos are deleted from the working directory after
each job; generated GLB/report artifacts remain under `.data/artifacts` until
the operator removes them.
