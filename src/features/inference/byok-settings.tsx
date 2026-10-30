"use client";

import { useEffect, useId, useState } from "react";
import { resolvePhotoObservations } from "@/domain/evidence/resolve-photo-observations";
import type { Project } from "@/domain/evidence/schema";
import { inferenceRunSchema, type InferenceRun } from "@/domain/inference/run";
import { createLocalId } from "@/shared/create-local-id";
import { db } from "@/storage/indexed-db/db";
import {
  analyzeMetaPhotos,
  META_MODEL_OPTIONS,
  testMetaConnection,
} from "./meta-model-api";

const SESSION_KEY = "eida:meta-api-key";
const MODEL_KEY = "eida:meta-model";
const CUSTOM_MODEL = "__custom__";

export type ByokState = {
  configured: boolean;
  model: string;
  verified: boolean;
};

type ConnectionState = "idle" | "testing" | "valid" | "invalid";

export function ByokSettings({
  open,
  onClose,
  onStateChange,
  photoCount,
  device,
  onRunCompleted,
}: {
  open: boolean;
  onClose: () => void;
  onStateChange: (state: ByokState) => void;
  photoCount: number;
  device: Project["device"];
  onRunCompleted: (run: InferenceRun) => void;
}) {
  const titleId = useId();
  const keyId = useId();
  const modelId = useId();
  const customModelId = useId();
  const rememberId = useId();
  const consentId = useId();
  const [apiKey, setApiKey] = useState("");
  const [modelChoice, setModelChoice] = useState<string>(
    META_MODEL_OPTIONS[0].id,
  );
  const [customModel, setCustomModel] = useState("");
  const [rememberForSession, setRememberForSession] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const model = modelChoice === CUSTOM_MODEL ? customModel.trim() : modelChoice;
  const missingPhotoCount = Math.max(0, 3 - photoCount);
  const readyToAnalyze =
    Boolean(apiKey.trim() && model) &&
    consent &&
    byokStateIsVerified(connection) &&
    photoCount >= 3;

  useEffect(() => {
    const savedKey = window.sessionStorage.getItem(SESSION_KEY) ?? "";
    const savedModel = window.localStorage.getItem(MODEL_KEY) ?? "";

    if (savedKey) {
      setApiKey(savedKey);
      setRememberForSession(true);
    }
    if (savedModel) {
      const known = META_MODEL_OPTIONS.some(
        (option) => option.id === savedModel,
      );
      setModelChoice(known ? savedModel : CUSTOM_MODEL);
      if (!known) setCustomModel(savedModel);
    }
  }, []);

  useEffect(() => {
    onStateChange({
      configured: Boolean(apiKey.trim() && model),
      model,
      verified: connection === "valid",
    });
  }, [apiKey, connection, model, onStateChange]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  function updateKey(value: string) {
    setApiKey(value);
    setConnection("idle");
    setMessage("");
    if (rememberForSession) {
      if (value) window.sessionStorage.setItem(SESSION_KEY, value);
      else window.sessionStorage.removeItem(SESSION_KEY);
    }
  }

  function updateRemember(value: boolean) {
    setRememberForSession(value);
    if (value && apiKey) window.sessionStorage.setItem(SESSION_KEY, apiKey);
    else window.sessionStorage.removeItem(SESSION_KEY);
  }

  function saveModel(nextModel: string) {
    if (nextModel) window.localStorage.setItem(MODEL_KEY, nextModel);
    else window.localStorage.removeItem(MODEL_KEY);
  }

  async function verifyConnection() {
    setConnection("testing");
    setMessage("Testing the connection…");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    const result = await testMetaConnection(apiKey, controller.signal);
    window.clearTimeout(timeout);
    setConnection(result.ok ? "valid" : "invalid");
    setMessage(
      result.ok
        ? "Connected. The key remains in this browser."
        : result.message,
    );
    if (result.ok) saveModel(model);
  }

  async function analyzePhotos() {
    setAnalyzing(true);
    setMessage("Preparing a traceable analysis run…");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45_000);
    try {
      const photos = (
        await db.assets
          .where("projectId")
          .equals("eida-sm-t530-local")
          .filter((asset) => asset.kind === "photo")
          .sortBy("createdAt")
      ).slice(0, 3);
      if (photos.length < 3) {
        setMessage("Add at least 3 photos before analysis.");
        return;
      }

      const runId = createLocalId("run");
      const createdAt = Date.now();
      const photoReferences = photos.map((photo, index) => ({
        id: photo.id,
        index: index + 1,
        locator: `asset:${photo.id}`,
      }));
      const pendingRun: InferenceRun = inferenceRunSchema.parse({
        schemaVersion: 1,
        id: runId,
        projectId: "eida-sm-t530-local",
        device,
        model,
        createdAt,
        status: "pending",
        consent: {
          approvedAt: createdAt,
          photoIds: photos.map((photo) => photo.id),
        },
        photos: photoReferences,
        observations: null,
        resolvedProject: null,
        usage: null,
        error: null,
      });
      await db.inferenceRuns.put(pendingRun);
      setMessage("Sending three approved photos to Meta…");
      const result = await analyzeMetaPhotos(
        apiKey,
        model,
        photos,
        controller.signal,
        { device },
      );
      if (result.ok) {
        const resolvedProject = resolvePhotoObservations({
          runId,
          analysis: result.result,
          photos: photoReferences,
          device,
        });
        const completedRun: InferenceRun = inferenceRunSchema.parse({
          ...pendingRun,
          completedAt: Date.now(),
          status: "succeeded",
          observations: result.result,
          resolvedProject,
          usage: result.usage,
        });
        await db.inferenceRuns.put(completedRun);
        onRunCompleted(completedRun);
        setMessage(
          `Analysis complete: ${resolvedProject.components.length} physical candidate(s) added to the workspace.`,
        );
        onClose();
      } else {
        const failedRun: InferenceRun = inferenceRunSchema.parse({
          ...pendingRun,
          completedAt: Date.now(),
          status: "failed",
          error: {
            code: result.code,
            message: result.message,
            ...(result.httpStatus === undefined
              ? {}
              : { httpStatus: result.httpStatus }),
          },
        });
        await db.inferenceRuns.put(failedRun);
        setMessage(result.message);
      }
    } catch {
      setMessage("The local analysis run could not be prepared or saved.");
    } finally {
      window.clearTimeout(timeout);
      setAnalyzing(false);
      setConsent(false);
    }
  }

  function forgetKey() {
    setApiKey("");
    setConnection("idle");
    setMessage("The key was removed from this session.");
    setRememberForSession(false);
    window.sessionStorage.removeItem(SESSION_KEY);
  }

  if (!open) return null;

  return (
    <div
      className="capture-overlay byok-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        className="capture-backdrop"
        onClick={onClose}
        aria-label="Close"
      />
      <section className="byok-dialog glass-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Optional Meta preview</span>
            <h3 id={titleId}>Create a quick visual inventory</h3>
          </div>
          <button
            type="button"
            className="panel-close"
            onClick={onClose}
            aria-label="Close"
          >
            x
          </button>
        </div>

        <p className="byok-intro">
          Connect your own Meta Model API key for a semantic preview. This
          identifies visible parts; real meshes are produced separately by the
          SAM 3D reconstruction workflow. EIDA never stores this key in the
          project.
        </p>

        <section className="byok-step">
          <div className="byok-step__heading">
            <span>1</span>
            <div>
              <strong>Connect your Meta key</strong>
              <small>Testing the key does not upload your photos.</small>
            </div>
          </div>

          <label className="byok-field" htmlFor={keyId}>
            <span>API key</span>
            <input
              id={keyId}
              name="meta-model-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => updateKey(event.target.value)}
              placeholder="Paste your Meta API key"
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <label className="byok-field" htmlFor={modelId}>
            <span>Model</span>
            <select
              id={modelId}
              name="meta-analysis-model"
              value={modelChoice}
              onChange={(event) => {
                setModelChoice(event.target.value);
                setConnection("idle");
                if (event.target.value !== CUSTOM_MODEL)
                  saveModel(event.target.value);
              }}
            >
              {META_MODEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
              <option value={CUSTOM_MODEL}>Use another model…</option>
            </select>
          </label>

          {modelChoice === CUSTOM_MODEL && (
            <label className="byok-field" htmlFor={customModelId}>
              <span>Model identifier</span>
              <input
                id={customModelId}
                name="meta-custom-model"
                type="text"
                value={customModel}
                onChange={(event) => {
                  setCustomModel(event.target.value);
                  setConnection("idle");
                  saveModel(event.target.value.trim());
                }}
                placeholder="e.g. muse-spark-1.3"
                spellCheck={false}
              />
            </label>
          )}

          <label className="byok-remember">
            <input
              id={rememberId}
              name="remember-meta-key"
              type="checkbox"
              checked={rememberForSession}
              onChange={(event) => updateRemember(event.target.checked)}
            />
            <span>
              Remember for this tab
              <small>The key is deleted when this browser tab closes.</small>
            </span>
          </label>

          <div
            className={`byok-status byok-status--${connection}`}
            aria-live="polite"
          >
            <i aria-hidden="true" />
            <span>{message || "Paste a key, then check the connection."}</span>
          </div>

          <div className="byok-actions">
            <button
              type="button"
              className="byok-primary"
              onClick={() => void verifyConnection()}
              disabled={!apiKey.trim() || !model || connection === "testing"}
            >
              {connection === "testing" ? "Checking…" : "Check connection"}
            </button>
            <button type="button" onClick={forgetKey} disabled={!apiKey}>
              Remove key
            </button>
          </div>
        </section>

        <section className="byok-step byok-analysis-step">
          <div className="byok-step__heading">
            <span>2</span>
            <div>
              <strong>Inventory visible parts</strong>
              <small>
                {missingPhotoCount > 0
                  ? `Add ${missingPhotoCount} more photo${missingPhotoCount > 1 ? "s" : ""} to continue.`
                  : "Three photos are ready for analysis."}
              </small>
            </div>
          </div>

          <div className="byok-analysis-summary">
            <span>
              <small>Photos</small>
              <strong>{Math.min(photoCount, 3)} / 3 ready</strong>
            </span>
            <span>
              <small>Connection</small>
              <strong>
                {connection === "valid" ? "Ready" : "Check key first"}
              </strong>
            </span>
          </div>

          <label className="byok-consent">
            <input
              id={consentId}
              name="consent-meta-photo-analysis"
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>
              I agree to send these 3 photos to Meta for this analysis.
              <small>This may use credits from your Meta account.</small>
            </span>
          </label>

          <button
            type="button"
            className="byok-analyze-button"
            onClick={() => void analyzePhotos()}
            disabled={!readyToAnalyze || analyzing}
          >
            <span aria-hidden="true">✦</span>
            {analyzing ? "Analyzing photos…" : "Create visual inventory"}
          </button>
          <p className="byok-disclosure">
            Only this button uploads the three selected photos. Approval resets
            after every analysis.
          </p>
        </section>
      </section>
    </div>
  );
}

function byokStateIsVerified(connection: ConnectionState) {
  return connection === "valid";
}
