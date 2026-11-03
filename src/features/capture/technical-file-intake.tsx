"use client";

import { useEffect, useRef, useState } from "react";
import { EidaIcon } from "@/components/ui/eida-icon";
import { cadAnalysisSchema } from "@/domain/research";
import { createLocalId } from "@/shared/create-local-id";
import { db, type LocalAssetRecord } from "@/storage/indexed-db/db";
import styles from "./technical-file-intake.module.css";

const MAX_FILES = 6;
const MAX_BYTES = 12_000_000;
const ACCEPTED_EXTENSIONS = new Set([
  "step",
  "stp",
  "dxf",
  "stl",
  "obj",
  "gltf",
  "glb",
  "iges",
  "igs",
  "prt",
]);

export type TechnicalFileRecord = LocalAssetRecord & {
  cadAnalysis: NonNullable<LocalAssetRecord["cadAnalysis"]>;
};

function extension(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.at(-1) ?? "";
}

function isAcceptedFileName(name: string): boolean {
  return ACCEPTED_EXTENSIONS.has(extension(name)) || /\.prt\.\d+$/i.test(name);
}

function dimensionsLabel(file: TechnicalFileRecord): string | null {
  const dimensions = file.cadAnalysis.boundsMm?.dimensions;
  return dimensions
    ? `${dimensions.map((value) => Number(value.toFixed(2))).join(" × ")} mm`
    : null;
}

function roleLabel(file: TechnicalFileRecord): string {
  if (file.cadAnalysis.status !== "parsed") return "Needs review";
  return file.cadAnalysis.format === "glb"
    ? "Exact geometry"
    : "Scale authority";
}

export function TechnicalFileIntake({
  projectId,
  disabled = false,
  onChange,
}: {
  projectId: string;
  disabled?: boolean;
  onChange: (files: TechnicalFileRecord[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<TechnicalFileRecord[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void db.assets
      .where("projectId")
      .equals(projectId)
      .filter(
        (asset): asset is TechnicalFileRecord =>
          asset.kind === "document" && asset.cadAnalysis !== undefined,
      )
      .sortBy("createdAt")
      .then((records) => {
        if (!active) return;
        setFiles(records);
        onChange(records);
      })
      .catch(() => {
        if (active) setError("Saved technical files could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [onChange, projectId]);

  async function analyze(file: File) {
    const form = new FormData();
    form.set("file", file, file.name);
    const response = await fetch("/api/research/analyze-cad", {
      method: "POST",
      body: form,
    });
    const body = (await response.json()) as {
      analysis?: unknown;
      error?: unknown;
    };
    if (!response.ok) {
      throw new Error(
        typeof body.error === "string"
          ? body.error
          : `CAD analysis returned HTTP ${response.status}.`,
      );
    }
    return cadAnalysisSchema.parse(body.analysis);
  }

  async function addFiles(incoming: FileList | File[]) {
    if (disabled || busy) return;
    setError("");
    const available = MAX_FILES - files.length;
    const candidates = Array.from(incoming).slice(0, available);
    if (incoming.length > available) {
      setError(`A project can contain up to ${MAX_FILES} technical files.`);
    }
    setBusy(true);
    const accepted: TechnicalFileRecord[] = [];
    for (const file of candidates) {
      if (!isAcceptedFileName(file.name)) {
        setError(`${file.name}: unsupported technical format.`);
        continue;
      }
      if (file.size === 0 || file.size > MAX_BYTES) {
        setError(`${file.name}: files must be smaller than 12 MB.`);
        continue;
      }
      try {
        const cadAnalysis = await analyze(file);
        const record: TechnicalFileRecord = {
          id: createLocalId("technical"),
          projectId,
          kind: "document",
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          createdAt: Date.now() + accepted.length,
          blob: file,
          cadAnalysis,
        };
        await db.assets.put(record);
        accepted.push(record);
      } catch (analysisError) {
        setError(
          analysisError instanceof Error
            ? `${file.name}: ${analysisError.message}`
            : `${file.name}: analysis failed.`,
        );
      }
    }
    const next = [...files, ...accepted];
    setFiles(next);
    onChange(next);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function removeFile(file: TechnicalFileRecord) {
    await db.assets.delete(file.id);
    const next = files.filter((candidate) => candidate.id !== file.id);
    setFiles(next);
    onChange(next);
  }

  return (
    <div className={styles.root}>
      <input
        ref={inputRef}
        className={styles.input}
        type="file"
        multiple
        onChange={(event) => void addFiles(event.target.files ?? [])}
      />
      <button
        className={styles.dropzone}
        type="button"
        data-dragging={dragging}
        disabled={disabled || busy || files.length >= MAX_FILES}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void addFiles(event.dataTransfer.files);
        }}
      >
        <span className={styles.icon}>
          <EidaIcon name="paper" size={18} />
        </span>
        <span className={styles.copy}>
          <strong>{busy ? "Analysing locally…" : "Add CAD or 3D files"}</strong>
          <small>Drop STEP/STP, GLB, glTF, STL, OBJ or DXF · 12 MB each</small>
        </span>
        <span className={styles.count}>
          {files.length} / {MAX_FILES}
        </span>
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {files.length > 0 && (
        <ul className={styles.list}>
          {files.map((file) => (
            <li className={styles.item} key={file.id}>
              <span className={styles.itemMain}>
                <strong>{file.name}</strong>
                <span className={styles.meta}>
                  <span
                    className={styles.badge}
                    data-status={
                      file.cadAnalysis.status === "parsed" ? "ready" : "warning"
                    }
                  >
                    {roleLabel(file)}
                  </span>
                  <span>
                    {dimensionsLabel(file) ??
                      file.cadAnalysis.format.toUpperCase()}
                  </span>
                </span>
              </span>
              <button
                className={styles.remove}
                type="button"
                onClick={() => void removeFile(file)}
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
              >
                <EidaIcon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
