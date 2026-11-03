"use client";

import { useEffect, useRef, useState } from "react";
import { EidaIcon } from "@/components/ui/eida-icon";
import { createLocalId } from "@/shared/create-local-id";
import {
  hasMatchingImageSignature,
  isSupportedImageType,
} from "@/shared/image-file";
import { db, type LocalAssetRecord } from "@/storage/indexed-db/db";
import { MAX_USER_PHOTOS, MIN_USER_PHOTOS } from "@/config/meta-models";

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

type PhotoView = LocalAssetRecord & { url: string };

export function PhotoIntake({
  projectId,
  onCountChange,
}: {
  projectId: string;
  onCountChange: (count: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());
  const [photos, setPhotos] = useState<PhotoView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let active = true;
    const allocatedUrls = objectUrls.current;
    void db.assets
      .where("projectId")
      .equals(projectId)
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
  }, [onCountChange, projectId]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    setError(null);
    const available = MAX_USER_PHOTOS - photos.length;
    const candidates = Array.from(files).slice(0, available);

    if (files.length > available) {
      setError(`A project can contain up to ${MAX_USER_PHOTOS} photos.`);
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
        projectId,
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
        multiple
        onChange={(event) => void addPhotos(event.target.files)}
      />
      <button
        className="upload-zone"
        type="button"
        data-dragging={dragging}
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
          void addPhotos(event.dataTransfer.files);
        }}
        disabled={photos.length >= MAX_USER_PHOTOS}
      >
        <span className="upload-icon">
          <EidaIcon name="gallery" size={22} />
        </span>
        <span>
          <strong>
            {dragging ? "Drop to add views" : "Add or drop views"}
          </strong>
          <small>Whole device, back, connectors · JPG, PNG, or WebP</small>
        </span>
        <b>
          {photos.length} / {MAX_USER_PHOTOS}
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
                <EidaIcon name="close" size={14} />
              </button>
            </figure>
          ))}
        </div>
      )}
      <p
        className={
          photos.length >= MIN_USER_PHOTOS ? "requirement is-ok" : "requirement"
        }
      >
        <span>
          <EidaIcon
            name={photos.length >= MIN_USER_PHOTOS ? "check" : "info"}
            size={15}
          />
        </span>
        {photos.length >= MIN_USER_PHOTOS
          ? "Strong multi-view coverage is available"
          : `Add ${MIN_USER_PHOTOS - photos.length} more view${MIN_USER_PHOTOS - photos.length === 1 ? "" : "s"} to start the reconstruction`}
      </p>
    </div>
  );
}
