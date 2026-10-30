"use client";

import React, { useId, useRef, useState, type ChangeEvent } from "react";
import { ZodError } from "zod";
import {
  AssemblyManifestValidationError,
  diagnoseAssembly,
  validateAssemblyManifest,
  type AssemblyDiagnostic,
  type AssemblyManifest,
} from "@/domain/assembly";
import styles from "./assembly-import.module.css";

export type ParsedAssemblyManifest = {
  manifest: AssemblyManifest;
  diagnostics: readonly AssemblyDiagnostic[];
};

export type AssemblyImportProps = {
  onManifestValidated: (
    manifest: AssemblyManifest,
    diagnostics: readonly AssemblyDiagnostic[],
  ) => void;
  onImportError?: (message: string) => void;
  title?: string;
  disabled?: boolean;
  maxFileBytes?: number;
  className?: string;
};

export function parseAssemblyManifestJson(
  json: string,
): ParsedAssemblyManifest {
  const input: unknown = JSON.parse(json);
  const manifest = validateAssemblyManifest(input);
  return { manifest, diagnostics: diagnoseAssembly(manifest) };
}

export function formatAssemblyImportError(error: unknown): string {
  if (error instanceof SyntaxError) {
    return "The selected file is not valid JSON.";
  }
  if (error instanceof AssemblyManifestValidationError) {
    const issue = error.issues[0];
    return issue
      ? `Invalid assembly manifest at ${issue.path}: ${issue.message}`
      : "The assembly manifest contains invalid references.";
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "manifest";
    return issue
      ? `Invalid assembly manifest at ${path}: ${issue.message}`
      : "The assembly manifest does not match schema version 1.";
  }
  return error instanceof Error
    ? error.message
    : "The assembly manifest could not be imported.";
}

type ImportState =
  | { status: "idle" }
  | { status: "reading"; fileName: string }
  | { status: "error"; message: string }
  | {
      status: "success";
      fileName: string;
      manifest: AssemblyManifest;
      diagnostics: readonly AssemblyDiagnostic[];
    };

const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024;

export function AssemblyImport({
  onManifestValidated,
  onImportError,
  title = "Import an assembly manifest",
  disabled = false,
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  className = "",
}: AssemblyImportProps) {
  const inputId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const requestId = useRef(0);
  const [state, setState] = useState<ImportState>({ status: "idle" });

  function reportError(error: unknown) {
    const message = formatAssemblyImportError(error);
    setState({ status: "error", message });
    onImportError?.(message);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    const currentRequestId = requestId.current + 1;
    requestId.current = currentRequestId;
    setState({ status: "reading", fileName: file.name });

    if (
      !Number.isFinite(maxFileBytes) ||
      maxFileBytes <= 0 ||
      file.size > maxFileBytes
    ) {
      reportError(
        new Error(
          `The manifest is too large. Choose a JSON file smaller than ${Math.max(
            1,
            Math.floor(maxFileBytes / 1024 / 1024),
          )} MB.`,
        ),
      );
      return;
    }

    try {
      const text = await file.text();
      if (requestId.current !== currentRequestId) return;
      if (!text.trim()) throw new Error("The selected JSON file is empty.");

      const result = parseAssemblyManifestJson(text);
      if (requestId.current !== currentRequestId) return;
      setState({
        status: "success",
        fileName: file.name,
        ...result,
      });
      onManifestValidated(result.manifest, result.diagnostics);
    } catch (error) {
      if (requestId.current === currentRequestId) reportError(error);
    }
  }

  const classes = [styles.root, className].filter(Boolean).join(" ");

  return (
    <section
      className={classes}
      aria-labelledby={titleId}
      aria-busy={state.status === "reading"}
    >
      <div className={styles.heading}>
        <div>
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>
            Select a version 1 JSON manifest. Validation happens locally in your
            browser before it is handed to the project.
          </p>
        </div>
        <span className={styles.format} aria-label="Accepted format: JSON">
          JSON · v1
        </span>
      </div>

      <div className={styles.picker}>
        <input
          className={styles.fileInput}
          id={inputId}
          type="file"
          accept="application/json,.json"
          aria-describedby={descriptionId}
          disabled={disabled || state.status === "reading"}
          onChange={importFile}
        />
        <label
          className={styles.fileButton}
          htmlFor={inputId}
          aria-disabled={disabled || state.status === "reading"}
        >
          {state.status === "reading" ? "Validating…" : "Choose manifest"}
        </label>
        <span className={styles.fileName}>
          {state.status === "reading" || state.status === "success"
            ? state.fileName
            : "No file selected"}
        </span>
      </div>

      <div className={styles.feedback} aria-live="polite">
        {state.status === "idle" && (
          <p>Nothing is imported until the manifest passes validation.</p>
        )}
        {state.status === "reading" && (
          <p role="status">Reading and validating {state.fileName}…</p>
        )}
        {state.status === "error" && (
          <p className={styles.error} role="alert">
            {state.message}
          </p>
        )}
        {state.status === "success" && (
          <div className={styles.success} role="status">
            <strong>Manifest validated</strong>
            <span>
              {state.manifest.parts.length} part
              {state.manifest.parts.length === 1 ? "" : "s"} ·{" "}
              {state.diagnostics.length} spatial warning
              {state.diagnostics.length === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>

      {state.status === "success" && state.diagnostics.length > 0 && (
        <div className={styles.diagnostics}>
          <h3>Spatial warnings</h3>
          <p>
            These broad-phase checks do not block import; inspect the affected
            parts before treating their placement as verified.
          </p>
          <ul>
            {state.diagnostics.map((diagnostic) => (
              <li key={`${diagnostic.code}:${diagnostic.partIds.join(":")}`}>
                <code>{diagnostic.code}</code>
                <span>{diagnostic.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
