"use client";

import { useEffect, useRef, useState } from "react";
import { createLocalId } from "@/shared/create-local-id";
import {
  hasMatchingImageSignature,
  isSupportedImageType,
} from "@/shared/image-file";
import { db, type LocalAssetRecord } from "@/storage/indexed-db/db";

const PROJECT_ID = "eida-sm-t530-local";
const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

type PhotoView = LocalAssetRecord & { url: string };

export function PhotoIntake({
  onCountChange,
}: {
  onCountChange: (count: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());
  const [photos, setPhotos] = useState<PhotoView[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const allocatedUrls = objectUrls.current;
    void db.assets
      .where("projectId")
      .equals(PROJECT_ID)
      .filter((asset) => asset.kind === "photo")
      .sortBy("createdAt")
      .then((records) => {
        if (!active) return;
        const restored = records.map((record) => {
          const url = URL.createObjectURL(record.blob);
          allocatedUrls.add(url);
          return { ...record, url };
        });
        setPhotos(restored);
        onCountChange(restored.length);
      })
      .catch(() => {
        if (active) {
          setError("Saved photos could not be loaded.");
        }
      });

    return () => {
      active = false;
      allocatedUrls.forEach((url) => URL.revokeObjectURL(url));
      allocatedUrls.clear();
    };
  }, [onCountChange]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setError(null);
    const available = MAX_PHOTOS - photos.length;
    const candidates = Array.from(files).slice(0, available);

    if (files.length > available) {
      setError(`A project can contain up to ${MAX_PHOTOS} photos.`);
    }

    const accepted: PhotoView[] = [];
    for (const file of candidates) {
      if (!isSupportedImageType(file.type)) {
        setError("Unsupported format. Use JPG, PNG, or WebP.");
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setError("An image exceeds the 12 MB limit.");
        continue;
      }
      if (!(await hasMatchingImageSignature(file))) {
        setError("The file contents do not match a valid image.");
        continue;
      }
      const id = createLocalId("photo");
      const record: LocalAssetRecord = {
        id,
        projectId: PROJECT_ID,
        kind: "photo",
        name: file.name || `capture-${id.slice(0, 6)}.jpg`,
        mimeType: file.type,
        size: file.size,
        createdAt: Date.now() + accepted.length,
        blob: file,
      };
      try {
        await db.assets.put(record);
      } catch {
        setError("This photo could not be saved.");
        continue;
      }
      const url = URL.createObjectURL(file);
      objectUrls.current.add(url);
      accepted.push({ ...record, url });
    }

    const next = [...photos, ...accepted];
    setPhotos(next);
    onCountChange(next.length);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function removePhoto(photo: PhotoView) {
    try {
      await db.assets.delete(photo.id);
    } catch {
      setError("This photo could not be deleted.");
      return;
    }
    URL.revokeObjectURL(photo.url);
    objectUrls.current.delete(photo.url);
    const next = photos.filter((item) => item.id !== photo.id);
    setPhotos(next);
    onCountChange(next.length);
  }

  return (
    <div>
      <input
        ref={inputRef}
        className="visually-hidden"
        id="photo-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        multiple
        onChange={(event) => void addPhotos(event.target.files)}
      />
      <button
        className="upload-zone"
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={photos.length >= MAX_PHOTOS}
      >
        <span className="upload-icon" aria-hidden="true">
          +
        </span>
        <span>
          <strong>Add views</strong>
          <small>Whole device, back, connectors : JPG, PNG, or WebP</small>
        </span>
        <b>
          {photos.length} / {MAX_PHOTOS}
        </b>
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((photo, index) => (
            <figure key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={`Imported view ${index + 1}`} />
              <figcaption>View {String(index + 1).padStart(2, "0")}</figcaption>
              <button
                type="button"
                onClick={() => void removePhoto(photo)}
                aria-label={`Delete view ${index + 1}`}
              >
                ×
              </button>
            </figure>
          ))}
        </div>
      )}
      <p className={photos.length >= 3 ? "requirement is-ok" : "requirement"}>
        <span>{photos.length >= 3 ? "✓" : "○"}</span>
        {photos.length >= 3
          ? "Enough views are available to prepare an analysis"
          : `${3 - photos.length} more view${3 - photos.length > 1 ? "s" : ""} required`}
      </p>
    </div>
  );
}
