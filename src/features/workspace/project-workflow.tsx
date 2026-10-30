"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  diagnoseAssembly,
  type AssemblyDiagnostic,
  type AssemblyManifest,
  type DimensionsMm,
} from "@/domain/assembly";
import type { PhotoObservation } from "@/domain/inference/observation";
import type { LocalPartInventory } from "@/domain/local-reconstruction";
import { inferDeviceDimensions } from "@/domain/reconstruction/estimated-assembly";
import type { SelectedSource, WebEvidenceBundle } from "@/domain/research";
import { PhotoIntake } from "@/features/capture/photo-intake";
import {
  checkLocalMeta,
  createLocalInventory,
  segmentLocalPart,
  type LocalMetaStatus,
} from "@/features/local-reconstruction/local-meta-client";
import {
  buildSilhouetteAssembly,
  type SegmentedPart,
} from "@/features/local-reconstruction/silhouette-geometry";
import { extractApprovedSources } from "@/features/research/evidence-extractor-client";
import { db } from "@/storage/indexed-db/db";
import styles from "./project-workflow.module.css";

export type ProjectWorkflowProps = {
  projectId: string;
  deviceLabel: string;
  selectedSources: SelectedSource[];
  excludedSourceCount: number;
  photoCount: number;
  observedParts?: readonly PhotoObservation[];
  onPhotoCountChange: (count: number) => void;
  onManageSources: () => void;
  onApplyManifest: (
    manifest: AssemblyManifest,
    diagnostics: readonly AssemblyDiagnostic[],
    activateViewer?: boolean,
  ) => void;
  onClose: () => void;
};

const SESSION_KEY = "eida:local-meta-key";

type Stage =
  "idle" | "evidence" | "inventory" | "segmentation" | "geometry" | "done";

const stageDefinitions = [
  {
    id: "evidence",
    model: "Evidence extractor",
    title: "Read the approved sources",
    detail:
      "Fetches page text, documented dimensions, teardown images and technical files.",
    output: "Extracted sources",
  },
  {
    id: "inventory",
    model: "Muse Spark 1.3",
    title: "Understand the parts",
    detail:
      "Creates a conservative inventory and one short SAM prompt per part.",
    output: "Part inventory",
  },
  {
    id: "segmentation",
    model: "SAM 3.1",
    title: "Extract the real outlines",
    detail:
      "Returns pixel-accurate masks from the clearest photo of every part.",
    output: "Masks and contours",
  },
  {
    id: "geometry",
    model: "Local CPU",
    title: "Build the geometry",
    detail:
      "Simplifies and extrudes each SAM contour, then exports local GLB assets.",
    output: "Editable GLB parts",
  },
  {
    id: "done",
    model: "EIDA",
    title: "Validate the assembly",
    detail:
      "Applies scale, relative placement and spatial diagnostics before display.",
    output: "Interactive assembly",
  },
] as const;

function stageIndex(stage: Stage): number {
  return [
    "idle",
    "evidence",
    "inventory",
    "segmentation",
    "geometry",
    "done",
  ].indexOf(stage);
}

function stageState(id: Exclude<Stage, "idle">, active: Stage) {
  const current = stageIndex(active);
  const target = stageIndex(id);
  if (current > target || active === "done") return "complete";
  if (current === target) return "running";
  return "queued";
}

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unexpected reconstruction error.";
}

export function ProjectWorkflow({
  projectId,
  deviceLabel,
  selectedSources,
  excludedSourceCount,
  photoCount,
  observedParts = [],
  onPhotoCountChange,
  onManageSources,
  onApplyManifest,
  onClose,
}: ProjectWorkflowProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const defaultDimensions = useMemo(
    () => inferDeviceDimensions(deviceLabel),
    [deviceLabel],
  );
  const [dimensions, setDimensions] = useState<DimensionsMm>(defaultDimensions);
  const [apiKey, setApiKey] = useState("");
  const [rememberKey, setRememberKey] = useState(false);
  const [model, setModel] = useState("muse-spark-1.3");
  const [status, setStatus] = useState<LocalMetaStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [consent, setConsent] = useState(false);
  const [activeStage, setActiveStage] = useState<Stage>("idle");
  const [evidence, setEvidence] = useState<WebEvidenceBundle | null>(null);
  const [inventory, setInventory] = useState<LocalPartInventory | null>(null);
  const [segmented, setSegmented] = useState<SegmentedPart[]>([]);
  const [segmentProgress, setSegmentProgress] = useState(0);
  const [manifest, setManifest] = useState<AssemblyManifest | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const running = activeStage !== "idle" && activeStage !== "done";
  const connected = status?.connected === true;
  const ready =
    connected && photoCount >= 3 && selectedSources.length > 0 && consent;

  useEffect(() => {
    closeRef.current?.focus();
    const saved = window.sessionStorage.getItem(SESSION_KEY) ?? "";
    if (saved) {
      setApiKey(saved);
      setRememberKey(true);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !running) onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, running]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  function updateKey(value: string) {
    setApiKey(value);
    setStatus(null);
    setError("");
    if (rememberKey) {
      if (value) window.sessionStorage.setItem(SESSION_KEY, value);
      else window.sessionStorage.removeItem(SESSION_KEY);
    }
  }

  function updateRemember(value: boolean) {
    setRememberKey(value);
    if (value && apiKey) window.sessionStorage.setItem(SESSION_KEY, apiKey);
    else window.sessionStorage.removeItem(SESSION_KEY);
  }

  function updateDimension(index: number, value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setDimensions(
      (current) =>
        current.map((dimension, dimensionIndex) =>
          dimensionIndex === index ? parsed : dimension,
        ) as DimensionsMm,
    );
    setManifest(null);
    if (activeStage === "done") setActiveStage("idle");
  }

  async function verifyMeta() {
    setChecking(true);
    setError("");
    try {
      const next = await checkLocalMeta(apiKey);
      setStatus(next);
      if (!next.connected) {
        setError(
          next.error ??
            "Add a Meta key here or configure MODEL_API_KEY in .env.local.",
        );
      } else {
        setMessage(
          `Connected through the ${next.source === "environment" ? "local server" : "current browser session"}.`,
        );
      }
    } catch (connectionError) {
      setStatus(null);
      setError(errorText(connectionError));
    } finally {
      setChecking(false);
    }
  }

  async function runWorkflow() {
    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    setMessage("Fetching and reading the approved web sources…");
    setEvidence(null);
    setInventory(null);
    setSegmented([]);
    setManifest(null);
    setSegmentProgress(0);
    setActiveStage("evidence");
    try {
      const photos = (
        await db.assets
          .where("projectId")
          .equals(projectId)
          .filter((asset) => asset.kind === "photo")
          .sortBy("createdAt")
      ).slice(0, 6);
      if (photos.length < 3) throw new Error("Add at least three photos.");

      const extractedEvidence = await extractApprovedSources(
        selectedSources,
        controller.signal,
      );
      setEvidence(extractedEvidence);
      const usableSources = extractedEvidence.sources.filter(
        (source) => source.status !== "failed",
      );
      if (usableSources.length === 0) {
        throw new Error(
          "None of the approved sources could be extracted. Review the links or try again.",
        );
      }
      const documentedEnvelope = usableSources
        .flatMap((source) => source.dimensions)
        .find(
          (dimension) =>
            dimension.valuesMm.length === 3 && dimension.confidence >= 0.9,
        );
      const runDimensions = documentedEnvelope
        ? ([...documentedEnvelope.valuesMm].sort(
            (left, right) => right - left,
          ) as DimensionsMm)
        : dimensions;
      if (documentedEnvelope) setDimensions(runDimensions);

      setActiveStage("inventory");
      setMessage(
        `${usableSources.length} source${usableSources.length === 1 ? "" : "s"} extracted. Muse is grounding the part inventory in their contents…`,
      );

      const nextInventory = await createLocalInventory({
        key: apiKey,
        model,
        photos,
        context: {
          deviceLabel,
          dimensionsMm: runDimensions,
          sources: selectedSources.map((source) => ({
            title: source.title,
            url: source.url,
            type: source.sourceType,
          })),
          priorObservations: observedParts,
          webEvidence: {
            sources: usableSources.map((source) => ({
              sourceId: source.sourceId,
              title: source.title,
              url: source.url,
              sourceType: source.sourceType,
              excerpt: source.excerpt.slice(0, 3_500),
              dimensions: source.dimensions,
              images: source.images.slice(0, 8),
              artifacts: source.artifacts,
            })),
          },
        },
        signal: controller.signal,
      });
      setInventory(nextInventory);
      setActiveStage("segmentation");
      setMessage(
        `Muse found ${nextInventory.items.length} useful part${nextInventory.items.length === 1 ? "" : "s"}. SAM 3.1 is extracting their outlines…`,
      );

      const results: SegmentedPart[] = [];
      for (const [index, item] of nextInventory.items.entries()) {
        const photo = photos[item.photoIndex - 1] ?? photos[0]!;
        const segmentation = await segmentLocalPart({
          key: apiKey,
          photo,
          prompt: item.samPrompt,
          signal: controller.signal,
        });
        if (segmentation.masks.length > 0) {
          results.push({ item, segmentation, photo });
          setSegmented([...results]);
        }
        setSegmentProgress((index + 1) / nextInventory.items.length);
      }
      if (results.length === 0) {
        throw new Error(
          "SAM 3.1 did not return a usable mask for these views.",
        );
      }

      setActiveStage("geometry");
      setMessage(
        `${results.length} masks accepted. Building GLB silhouettes locally on this computer…`,
      );
      const nextManifest = await buildSilhouetteAssembly({
        projectId,
        label: deviceLabel,
        dimensionsMm: runDimensions,
        parts: results,
      });
      const diagnostics = diagnoseAssembly(nextManifest);
      setManifest(nextManifest);
      setActiveStage("done");
      setMessage(
        `${nextManifest.parts.length} real SAM outlines converted to GLB. ${diagnostics.length} spatial warning${diagnostics.length === 1 ? "" : "s"} retained for review.`,
      );
      onApplyManifest(nextManifest, diagnostics, false);
      setConsent(false);
    } catch (workflowError) {
      if (!controller.signal.aborted) setError(errorText(workflowError));
      setActiveStage("idle");
    } finally {
      abortRef.current = null;
    }
  }

  function cancelWorkflow() {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveStage("idle");
    setMessage("Reconstruction stopped. Existing results were kept locally.");
  }

  return (
    <div className={styles.overlay} role="presentation">
      <button
        className={styles.backdrop}
        type="button"
        onClick={running ? undefined : onClose}
        aria-label="Close reconstruction studio"
      />
      <section
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={styles.header}>
          <div>
            <p>Local Meta reconstruction studio</p>
            <h1 id={titleId}>Configure and run everything here</h1>
            <span>
              Muse and SAM run on your Meta credits. Geometry is generated on
              this computer—no pod, worker URL or extra service.
            </span>
          </div>
          <div className={styles.headerActions}>
            <strong>{activeStage === "done" ? "5 / 5" : "LOCAL"}</strong>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              disabled={running}
              aria-label="Close workflow"
            >
              ×
            </button>
          </div>
        </header>

        <div className={styles.studioGrid}>
          <aside className={styles.setupColumn}>
            <section className={styles.setupCard}>
              <div className={styles.sectionHeading}>
                <span>01</span>
                <div>
                  <p>Meta access</p>
                  <h2>One private connection</h2>
                </div>
                <i data-ready={connected}>{connected ? "Ready" : "Required"}</i>
              </div>
              <p className={styles.helpText}>
                Paste the hackathon key for this session, or leave it empty when
                <code> MODEL_API_KEY </code> exists in <code>.env.local</code>.
              </p>
              <label className={styles.fullField}>
                Meta Model API key
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => updateKey(event.target.value)}
                  placeholder="Uses .env.local when left empty"
                  autoComplete="off"
                />
              </label>
              <label className={styles.checkboxField}>
                <input
                  type="checkbox"
                  checked={rememberKey}
                  onChange={(event) => updateRemember(event.target.checked)}
                />
                Keep the key until this browser tab closes
              </label>
              <label className={styles.fullField}>
                Muse mode
                <select
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                >
                  <option value="muse-spark-1.3">
                    Standard · private inputs
                  </option>
                  <option value="muse-spark-1.3-contributor">
                    Contributor · training permitted
                  </option>
                </select>
              </label>
              <button
                className={styles.connectionButton}
                type="button"
                onClick={() => void verifyMeta()}
                disabled={checking || running}
              >
                {checking
                  ? "Checking Meta…"
                  : connected
                    ? "Check again"
                    : "Connect Meta"}
              </button>
            </section>

            <section className={styles.setupCard}>
              <div className={styles.sectionHeading}>
                <span>02</span>
                <div>
                  <p>Evidence</p>
                  <h2>Sources and views</h2>
                </div>
              </div>
              <div className={styles.sourceSummary}>
                <div>
                  <strong>{selectedSources.length}</strong>
                  <span>approved sources</span>
                </div>
                <button
                  type="button"
                  onClick={onManageSources}
                  disabled={running}
                >
                  Review
                </button>
              </div>
              {selectedSources.length > 0 && (
                <ul className={styles.sourceList}>
                  {selectedSources.slice(0, 3).map((source) => (
                    <li key={source.id}>{source.title}</li>
                  ))}
                </ul>
              )}
              {excludedSourceCount > 0 && (
                <p className={styles.warning}>
                  {excludedSourceCount} mismatched variant source
                  {excludedSourceCount === 1 ? "" : "s"} excluded.
                </p>
              )}
              <PhotoIntake onCountChange={onPhotoCountChange} />
            </section>

            <section className={styles.setupCard}>
              <div className={styles.sectionHeading}>
                <span>03</span>
                <div>
                  <p>Scale</p>
                  <h2>Reference dimensions</h2>
                </div>
              </div>
              <div className={styles.dimensionGrid}>
                {(["Length", "Width", "Thickness"] as const).map(
                  (label, index) => (
                    <label key={label}>
                      {label}
                      <span>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={dimensions[index]}
                          onChange={(event) =>
                            updateDimension(index, event.target.value)
                          }
                          disabled={running}
                        />
                        mm
                      </span>
                    </label>
                  ),
                )}
              </div>
              <p className={styles.helpText}>
                A ruler or one known dimension materially improves the result.
              </p>
            </section>
          </aside>

          <main className={styles.runColumn}>
            <div className={styles.pipelineIntro}>
              <div>
                <span className={styles.eyebrow}>04 · Reconstruction</span>
                <h2>One launch, five visible stages</h2>
                <p>
                  Every Meta result remains reviewable. The local geometry never
                  claims measured accuracy without a measurement.
                </p>
              </div>
              <span className={styles.costBadge}>Meta credits only</span>
            </div>

            <div className={styles.content}>
              {stageDefinitions.map((definition, index) => {
                const state = stageState(definition.id, activeStage);
                const count =
                  definition.id === "evidence"
                    ? evidence?.sources.filter(
                        (source) => source.status !== "failed",
                      ).length
                    : definition.id === "inventory"
                      ? inventory?.items.length
                      : definition.id === "segmentation"
                        ? segmented.length
                        : definition.id === "geometry"
                          ? manifest?.assets.length
                          : manifest?.parts.length;
                return (
                  <article
                    className={styles.step}
                    data-complete={state === "complete"}
                    data-running={state === "running"}
                    key={definition.id}
                  >
                    <div className={styles.stepIndex}>
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className={styles.stepBody}>
                      <div className={styles.stepHeading}>
                        <div>
                          <span className={styles.modelName}>
                            {definition.model}
                          </span>
                          <h3>{definition.title}</h3>
                          <p>{definition.detail}</p>
                        </div>
                        <span data-state={state}>
                          {state === "complete"
                            ? "Complete"
                            : state === "running"
                              ? "Running"
                              : "Queued"}
                        </span>
                      </div>
                      <div className={styles.stageOutput}>
                        <span>{definition.output}</span>
                        <b>{count ?? 0}</b>
                      </div>
                      {definition.id === "segmentation" &&
                        state === "running" && (
                          <progress value={segmentProgress} max={1} />
                        )}
                    </div>
                  </article>
                );
              })}
            </div>

            {evidence && (
              <section className={styles.evidenceSummary}>
                <div>
                  <strong>
                    {evidence.sources.reduce(
                      (total, source) => total + source.dimensions.length,
                      0,
                    )}
                  </strong>
                  <span>documented dimensions</span>
                </div>
                <div>
                  <strong>
                    {evidence.sources.reduce(
                      (total, source) => total + source.images.length,
                      0,
                    )}
                  </strong>
                  <span>source images indexed</span>
                </div>
                <div>
                  <strong>
                    {evidence.sources.reduce(
                      (total, source) => total + source.artifacts.length,
                      0,
                    )}
                  </strong>
                  <span>CAD/PDF artifacts</span>
                </div>
              </section>
            )}

            {inventory && (
              <section className={styles.artifactReview}>
                <div className={styles.sectionHeading}>
                  <span>AI</span>
                  <div>
                    <p>Live artifacts</p>
                    <h2>Parts and accepted masks</h2>
                  </div>
                </div>
                <div className={styles.partChips}>
                  {inventory.items.map((item) => {
                    const result = segmented.find(
                      (part) => part.item.id === item.id,
                    );
                    const mask = result?.segmentation.masks[0];
                    return (
                      <div key={item.id} data-ready={Boolean(mask)}>
                        {mask?.svgPath ? (
                          <svg
                            viewBox={`0 0 ${mask.width} ${mask.height}`}
                            role="img"
                            aria-label={`${item.label} mask`}
                          >
                            <path d={mask.svgPath} />
                          </svg>
                        ) : (
                          <span aria-hidden="true">○</span>
                        )}
                        <p>
                          <strong>{item.label}</strong>
                          <small>{item.samPrompt}</small>
                        </p>
                        <b>{mask ? "Mask" : "Waiting"}</b>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {(message || error) && (
              <div
                className={error ? styles.errorMessage : styles.message}
                role={error ? "alert" : "status"}
              >
                {error || message}
              </div>
            )}

            <section className={styles.launchArea}>
              {!manifest && (
                <label className={styles.consentField}>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    disabled={running}
                  />
                  <span>
                    Send the first three local photos to Meta for this run
                    <small>
                      Muse creates prompts; SAM 3.1 creates masks. The generated
                      geometry remains local.
                    </small>
                  </span>
                </label>
              )}
              {manifest ? (
                <button
                  className={styles.reconstructButton}
                  type="button"
                  onClick={() =>
                    onApplyManifest(manifest, diagnoseAssembly(manifest), true)
                  }
                >
                  <span>
                    <small>{manifest.parts.length} local GLB parts</small>
                    Open reconstructed assembly
                  </span>
                  <b aria-hidden="true">→</b>
                </button>
              ) : (
                <button
                  className={styles.reconstructButton}
                  type="button"
                  onClick={() => void runWorkflow()}
                  disabled={!ready || running}
                >
                  <span>
                    <small>Muse Spark + SAM 3.1 + local CPU</small>
                    {running
                      ? "Reconstruction in progress…"
                      : "Start reconstruction"}
                  </span>
                  <b aria-hidden="true">→</b>
                </button>
              )}
              {running && (
                <button
                  className={styles.cancelButton}
                  type="button"
                  onClick={cancelWorkflow}
                >
                  Stop safely
                </button>
              )}
              {!connected && (
                <p className={styles.requirement}>
                  Connect Meta in section 01.
                </p>
              )}
              {photoCount < 3 && (
                <p className={styles.requirement}>
                  Add {3 - photoCount} more photo
                  {3 - photoCount === 1 ? "" : "s"}.
                </p>
              )}
              {selectedSources.length === 0 && (
                <p className={styles.requirement}>
                  Approve at least one source.
                </p>
              )}
            </section>
          </main>
        </div>
      </section>
    </div>
  );
}
