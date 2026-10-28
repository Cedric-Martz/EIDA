"use client";

import { useEffect, useId, useState } from "react";
import { META_MODEL_OPTIONS, testMetaConnection } from "./meta-model-api";

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
}: {
  open: boolean;
  onClose: () => void;
  onStateChange: (state: ByokState) => void;
}) {
  const titleId = useId();
  const [apiKey, setApiKey] = useState("");
  const [modelChoice, setModelChoice] = useState<string>(
    META_MODEL_OPTIONS[0].id,
  );
  const [customModel, setCustomModel] = useState("");
  const [rememberForSession, setRememberForSession] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("idle");
  const [message, setMessage] = useState("");

  const model = modelChoice === CUSTOM_MODEL ? customModel.trim() : modelChoice;

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
            <span className="panel-kicker">Direct connection: BYOK</span>
            <h3 id={titleId}>Your model, your key</h3>
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
          EIDA calls Meta directly from your browser. The key is never sent to
          EIDA or included in the GitHub repository.
        </p>

        <label className="byok-field">
          <span>Meta Model API key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => updateKey(event.target.value)}
            placeholder="Enter your key"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="byok-field">
          <span>Analysis model</span>
          <select
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
            <option value={CUSTOM_MODEL}>Custom model identifier…</option>
          </select>
        </label>

        {modelChoice === CUSTOM_MODEL && (
          <label className="byok-field">
            <span>Model identifier</span>
            <input
              type="text"
              value={customModel}
              onChange={(event) => {
                setCustomModel(event.target.value);
                setConnection("idle");
                saveModel(event.target.value.trim());
              }}
              placeholder="ex. muse-spark-1.3"
              spellCheck={false}
            />
          </label>
        )}

        <label className="byok-remember">
          <input
            type="checkbox"
            checked={rememberForSession}
            onChange={(event) => updateRemember(event.target.checked)}
          />
          <span>
            Keep until this tab is closed
            <small>
              Otherwise, the key only remains in this tab&apos;s memory.
            </small>
          </span>
        </label>

        <div
          className={`byok-status byok-status--${connection}`}
          aria-live="polite"
        >
          <i aria-hidden="true" />
          <span>
            {message || "No request is sent without an explicit action."}
          </span>
        </div>

        <div className="byok-actions">
          <button
            type="button"
            className="byok-primary"
            onClick={() => void verifyConnection()}
            disabled={!apiKey.trim() || !model || connection === "testing"}
          >
            {connection === "testing" ? "Testing…" : "Test connection"}
          </button>
          <button type="button" onClick={forgetKey} disabled={!apiKey}>
            Forget key
          </button>
        </div>

        <p className="byok-disclosure">
          During a future analysis, approved media will be sent directly to Meta
          and may incur charges on your account.
        </p>
      </section>
    </div>
  );
}
