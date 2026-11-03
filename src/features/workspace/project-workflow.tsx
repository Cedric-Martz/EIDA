"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EidaIcon } from "@/components/ui/eida-icon";
import {
  diagnoseAssembly,
  type AssemblyDiagnostic,
  type AssemblyManifest,
  type DimensionsMm,
} from "@/domain/assembly";
import type { PhotoObservation } from "@/domain/inference/observation";
import type {
  LocalGeometryPlan,
  LocalPartInventory,
} from "@/domain/local-reconstruction";
import type { ReconstructionGraph } from "@/domain/reconstruction-graph";
import { inferDeviceDimensions } from "@/domain/reconstruction/estimated-assembly";
import type { SelectedSource, WebEvidenceBundle } from "@/domain/research";
import { PhotoIntake } from "@/features/capture/photo-intake";
import {
  TechnicalFileIntake,
  type TechnicalFileRecord,
} from "@/features/capture/technical-file-intake";
import {
  checkLocalMeta,
  createLocalGeometryPlan,
  createLocalInventory,
  downloadSourceImage,
  segmentLocalPart,
  type LocalMetaStatus,
  type SourceVisualInput,
} from "@/features/local-reconstruction/local-meta-client";
import {
  buildReconstructionGraphAssembly,
  type PrimaryCadGeometry,
  type SegmentedPart,
} from "@/features/local-reconstruction/silhouette-geometry";
import { extractApprovedSources } from "@/features/research/evidence-extractor-client";
import { db } from "@/storage/indexed-db/db";
import {
  MAX_SOURCE_IMAGES,
  MAX_USER_PHOTOS,
  META_MODEL_LABELS,
  META_MODELS,
  MIN_USER_PHOTOS,
} from "@/config/meta-models";
import styles from "./project-workflow.module.css";
import {
  selectDimensionAuthority,
  type DimensionAuthority,
} from "./evidence-priority";

export type ProjectWorkflowProps = {
  projectId: string;
  deviceLabel: string;
  selectedSources: SelectedSource[];
  excludedSourceCount: number;
  photoCount: number;
  observedParts?: readonly PhotoObservation[];
  onPhotoCountChange: (count: number) => void;
  onManageSources: () => void;
  onOpenDemo: () => void;
  onApplyManifest: (
    manifest: AssemblyManifest,
    diagnostics: readonly AssemblyDiagnostic[],
    activateViewer?: boolean,
    graph?: ReconstructionGraph,
  ) => void;
  onClose: () => void;
};

const SESSION_KEY = "eida:local-meta-key";

type Stage =
  | "idle"
  | "evidence"
  | "inventory"
  | "segmentation"
  | "reconciliation"
  | "geometry"
  | "done";
type RunnableStage = Exclude<Stage, "idle" | "done">;
type StageState = "queued" | "ready" | "running" | "complete" | "failed";

const stageDefinitions = [
  {
    id: "evidence",
    model: "Evidence extractor",
    title: "Read the approved sources",
    detail:
      "Analyses local CAD first, then approved pages and linked files, with explicit provenance and confidence.",
    output: "Extracted sources",
  },
  {
    id: "inventory",
    model: META_MODEL_LABELS.inventory,
    title: "Understand the parts",
    detail:
      "Uses user photos plus public source images to create the broadest evidence-supported part inventory.",
    output: "Part inventory",
  },
  {
    id: "segmentation",
    model: META_MODEL_LABELS.segmentation,
    title: "Extract the real outlines",
    detail:
      "Returns pixel-accurate masks from the clearest user or public-source image of every part.",
    output: "Masks and contours",
  },
  {
    id: "reconciliation",
    model: `${META_MODEL_LABELS.inventory} geometry`,
    title: "Recover canonical geometry",
    detail:
      "Compares viewpoints and mask proportions to replace perspective-distorted silhouettes with canonical primitives or corrected profiles.",
    output: "Corrected geometries",
  },
  {
    id: "geometry",
    model: "EIDA Graph Compiler",
    title: "Write and compile .eida.json",
    detail:
      "Links every contour, dimension, depth and transform to evidence before compiling deterministic GLB assets.",
    output: "Graph parts",
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
    "reconciliation",
    "geometry",
    "done",
  ].indexOf(stage);
}

function stageState(
  id: Exclude<Stage, "idle">,
  active: Stage,
  failed: RunnableStage | null,
  ready: boolean,
): StageState {
  if (failed) {
    const failedIndex = stageIndex(failed);
    const target = stageIndex(id);
    if (target < failedIndex) return "complete";
    if (target === failedIndex) return "failed";
    return "queued";
  }
  if (active === "idle" && id === "evidence" && ready) return "ready";
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("The local CAD file could not be read."));
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("The local CAD file could not be encoded."));
    reader.readAsDataURL(blob);
  });
}

async function primaryCadGeometry(
  files: readonly TechnicalFileRecord[],
): Promise<PrimaryCadGeometry | null> {
  const file = files
    .filter(
      (candidate) =>
        candidate.cadAnalysis.status === "parsed" &&
        candidate.cadAnalysis.format === "glb" &&
        candidate.cadAnalysis.boundsMm !== undefined,
    )
    .sort(
      (left, right) =>
        right.cadAnalysis.confidence - left.cadAnalysis.confidence,
    )[0];
  if (!file?.cadAnalysis.boundsMm) return null;
  const evidenceId = `document:${file.id}`;
  return {
    evidence: {
      id: evidenceId,
      kind: "document",
      label: `${file.name} - imported primary CAD`,
      locator: file.id,
      confidence: file.cadAnalysis.confidence,
    },
    asset: {
      id: `local-cad-${file.id}`,
      label: `${file.name} - primary CAD geometry`,
      uri: await blobToDataUrl(file.blob),
      format: "glb",
      millimetresPerAssetUnit: 1_000,
      boundsMm: {
        minMm: file.cadAnalysis.boundsMm.min,
        maxMm: file.cadAnalysis.boundsMm.max,
      },
      evidenceIds: [evidenceId],
    },
  };
}

function collectSourceImages(
  sources: WebEvidenceBundle["sources"],
): SourceVisualInput[] {
  const selected: SourceVisualInput[] = [];
  const seen = new Set<string>();
  for (
    let imageIndex = 0;
    selected.length < MAX_SOURCE_IMAGES;
    imageIndex += 1
  ) {
    let foundAtThisDepth = false;
    for (const source of sources) {
      const image = source.images[imageIndex];
      if (!image) continue;
      foundAtThisDepth = true;
      if (!image.url.startsWith("https://") || seen.has(image.url)) continue;
      seen.add(image.url);
      selected.push({
        sourceId: image.sourceId,
        url: image.url,
        alt: image.alt,
      });
      if (selected.length >= MAX_SOURCE_IMAGES) break;
    }
    if (!foundAtThisDepth) break;
  }
  return selected;
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
  onOpenDemo,
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
  const [model, setModel] = useState<string>(META_MODELS.inventory);
  const [status, setStatus] = useState<LocalMetaStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [consent, setConsent] = useState(false);
  const [activeStage, setActiveStage] = useState<Stage>("idle");
  const [failedStage, setFailedStage] = useState<RunnableStage | null>(null);
  const [evidence, setEvidence] = useState<WebEvidenceBundle | null>(null);
  const [inventory, setInventory] = useState<LocalPartInventory | null>(null);
  const [segmented, setSegmented] = useState<SegmentedPart[]>([]);
  const [geometryPlan, setGeometryPlan] = useState<LocalGeometryPlan | null>(
    null,
  );
  const [technicalFiles, setTechnicalFiles] = useState<TechnicalFileRecord[]>(
    [],
  );
  const [dimensionAuthority, setDimensionAuthority] =
    useState<DimensionAuthority | null>(null);
  const [segmentProgress, setSegmentProgress] = useState(0);
  const [manifest, setManifest] = useState<AssemblyManifest | null>(null);
  const [graph, setGraph] = useState<ReconstructionGraph | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const running = activeStage !== "idle" && activeStage !== "done";
  const requiredModels = [model, META_MODELS.segmentation];
  const missingModels =
    status?.connected === true
      ? requiredModels.filter((required) => !status.models.includes(required))
      : requiredModels;
  const connected = status?.connected === true && missingModels.length === 0;
  const ready =
    connected &&
    photoCount >= MIN_USER_PHOTOS &&
    (selectedSources.length > 0 || technicalFiles.length > 0) &&
    consent;
  const canRetryLocalCompilation =
    failedStage === "geometry" && geometryPlan !== null && segmented.length > 0;

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
    setGraph(null);
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
        const unavailable = [model, META_MODELS.segmentation].filter(
          (required) => !next.models.includes(required),
        );
        if (unavailable.length > 0) {
          setError(
            `This Meta project cannot access: ${unavailable.join(", ")}.`,
          );
          return;
        }
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

  async function compileSegmentedParts(
    results: readonly SegmentedPart[],
    runDimensions: DimensionsMm,
    plan: LocalGeometryPlan | null,
  ) {
    const build = await buildReconstructionGraphAssembly({
      projectId,
      label: deviceLabel,
      dimensionsMm: runDimensions,
      parts: results,
      geometryPlan: plan,
      primaryCad: await primaryCadGeometry(technicalFiles),
    });
    const nextGraph: ReconstructionGraph = build.graph;
    const nextManifest = build.manifest;
    const diagnostics = diagnoseAssembly(nextManifest);
    setGraph(nextGraph);
    setManifest(nextManifest);
    await db.metaJobs.put({
      id: nextGraph.id,
      projectId,
      status: "succeeded",
      updatedAt: Date.now(),
      data: nextGraph,
    });
    setActiveStage("done");
    setFailedStage(null);
    setMessage(
      `${nextGraph.parts.length} graph part${nextGraph.parts.length === 1 ? "" : "s"} validated and compiled from canonical primitives and corrected GLB profiles. ${diagnostics.length} spatial warning${diagnostics.length === 1 ? "" : "s"} retained for review.`,
    );
    onApplyManifest(nextManifest, diagnostics, false, nextGraph);
    setConsent(false);
  }

  async function retryLocalCompilation() {
    if (!canRetryLocalCompilation) return;
    setError("");
    setFailedStage(null);
    setActiveStage("geometry");
    setMessage(
      `${segmented.length} existing masks retained. Retrying the local graph compilation without a new Meta request…`,
    );
    try {
      await compileSegmentedParts(segmented, dimensions, geometryPlan);
    } catch (compileError) {
      setError(errorText(compileError));
      setFailedStage("geometry");
      setActiveStage("idle");
    }
  }

  async function runWorkflow() {
    let currentStage: RunnableStage = "evidence";
    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    setMessage("Fetching and reading the approved web sources…");
    setEvidence(null);
    setInventory(null);
    setSegmented([]);
    setGeometryPlan(null);
    setManifest(null);
    setGraph(null);
    setSegmentProgress(0);
    setFailedStage(null);
    setActiveStage("evidence");
    try {
      const photos = (
        await db.assets
          .where("projectId")
          .equals(projectId)
          .filter((asset) => asset.kind === "photo")
          .sortBy("createdAt")
      ).slice(0, MAX_USER_PHOTOS);
      if (photos.length < MIN_USER_PHOTOS) {
        throw new Error(`Add at least ${MIN_USER_PHOTOS} photos.`);
      }

      const extractedEvidence: WebEvidenceBundle = selectedSources.length
        ? await extractApprovedSources(selectedSources, controller.signal)
        : { schemaVersion: 1, extractedAt: Date.now(), sources: [] };
      setEvidence(extractedEvidence);
      const usableSources = extractedEvidence.sources.filter(
        (source) => source.status !== "failed",
      );
      if (usableSources.length === 0 && technicalFiles.length === 0) {
        throw new Error(
          "No approved web source or local technical file is available.",
        );
      }
      const authority = selectDimensionAuthority({
        manualDimensions: dimensions,
        localFiles: technicalFiles,
        webSources: usableSources,
      });
      const runDimensions = authority.dimensionsMm;
      setDimensionAuthority(authority);
      setDimensions(runDimensions);

      const sourceImages = collectSourceImages(usableSources);

      currentStage = "inventory";
      setActiveStage(currentStage);
      setMessage(
        `${technicalFiles.length} local technical file${technicalFiles.length === 1 ? "" : "s"}, ${usableSources.length} web source${usableSources.length === 1 ? "" : "s"}, and ${sourceImages.length} public image${sourceImages.length === 1 ? "" : "s"}. ${authority.label} is the scale authority; Muse is building the complementary part set…`,
      );

      const nextInventory = await createLocalInventory({
        key: apiKey,
        model,
        photos,
        sourceImages,
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
              images: source.images,
              artifacts: source.artifacts,
            })),
          },
          localTechnicalFiles: technicalFiles.map((file) => ({
            sourceId: file.id,
            name: file.name,
            role:
              file.cadAnalysis.status === "parsed" &&
              file.cadAnalysis.format === "glb"
                ? "primary-exact-geometry"
                : "scale-and-dimensional-evidence",
            analysis: file.cadAnalysis,
          })),
          evidencePriority: [
            "exact local CAD geometry",
            "reliable CAD dimensions",
            "documented dimensions",
            "reviewed images",
            "AI inference",
          ],
        },
        signal: controller.signal,
      });
      setInventory(nextInventory);
      currentStage = "segmentation";
      setActiveStage(currentStage);
      setMessage(
        `Muse found ${nextInventory.items.length} evidence-supported part${nextInventory.items.length === 1 ? "" : "s"}. ${META_MODEL_LABELS.segmentation} is extracting their outlines from user and public-source images…`,
      );

      const results: SegmentedPart[] = [];
      const sourcePhotoCache = new Map<
        number,
        Awaited<ReturnType<typeof downloadSourceImage>>
      >();
      for (const [index, item] of nextInventory.items.entries()) {
        try {
          const visualIndex = item.imageIndex - 1;
          const localPhoto = photos[visualIndex];
          const sourceImage = sourceImages[visualIndex - photos.length];
          let photo: (typeof photos)[number] | undefined = localPhoto;
          if (!photo && sourceImage) {
            photo = sourcePhotoCache.get(visualIndex);
            if (!photo) {
              photo = await downloadSourceImage(
                sourceImage,
                projectId,
                controller.signal,
              );
              sourcePhotoCache.set(visualIndex, photo);
            }
          }
          photo ??= photos[0]!;
          const segmentation = await segmentLocalPart({
            key: apiKey,
            photo,
            prompt: item.samPrompt,
            signal: controller.signal,
          });
          if (segmentation.masks.length > 0) {
            results.push({
              item,
              segmentation,
              photo,
              origin: sourceImage
                ? {
                    kind: "web-source",
                    locator: sourceImage.url,
                    sourceId: sourceImage.sourceId,
                  }
                : { kind: "user-photo", locator: photo.id },
            });
            setSegmented([...results]);
          }
        } catch {
          // One inaccessible public image must not discard the rest of the run.
        }
        setSegmentProgress((index + 1) / nextInventory.items.length);
      }
      if (results.length === 0) {
        throw new Error(
          `${META_MODEL_LABELS.segmentation} did not return a usable mask for these views.`,
        );
      }

      currentStage = "reconciliation";
      setActiveStage(currentStage);
      setMessage(
        `${results.length} masks accepted. Muse is comparing the available viewpoints and recovering canonical, perspective-corrected geometry…`,
      );
      const nextGeometryPlan = await createLocalGeometryPlan({
        key: apiKey,
        model,
        photos,
        sourceImages,
        analysis: {
          deviceLabel,
          dimensionsMm: runDimensions,
          items: results.map((result) => {
            const mask = result.segmentation.masks[0]!;
            return {
              id: result.item.id,
              label: result.item.label,
              category: result.item.category,
              description: result.item.description,
              imageIndex: result.item.imageIndex,
              documentedDimensionsMm: result.item.dimensionsMm,
              mask: {
                bounds: mask.bounds,
                width: mask.width,
                height: mask.height,
                confidence: mask.confidence,
              },
            };
          }),
        },
        signal: controller.signal,
      });
      setGeometryPlan(nextGeometryPlan);

      currentStage = "geometry";
      setActiveStage(currentStage);
      setMessage(
        `${nextGeometryPlan.items.length} canonical geometries reconciled. Writing the evidence-linked EIDA reconstruction graph…`,
      );
      await compileSegmentedParts(results, runDimensions, nextGeometryPlan);
    } catch (workflowError) {
      if (!controller.signal.aborted) {
        controller.abort();
        setError(errorText(workflowError));
        setFailedStage(currentStage);
      }
      setActiveStage("idle");
    } finally {
      abortRef.current = null;
    }
  }

  function cancelWorkflow() {
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveStage("idle");
    setFailedStage(null);
    setMessage("Reconstruction stopped. Existing results were kept locally.");
  }

  function downloadGraph() {
    if (!graph) return;
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(graph, null, 2)}\n`], {
        type: "application/vnd.eida.reconstruction+json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${graph.id}.eida.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
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
              Muse and SAM process the selected inputs. EIDA writes a validated
              reconstruction graph, then compiles the geometry locally.
            </span>
          </div>
          <div className={styles.headerActions}>
            <strong>
              {activeStage === "done"
                ? `${stageDefinitions.length} / ${stageDefinitions.length}`
                : "LOCAL"}
            </strong>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              disabled={running}
              aria-label="Close workflow"
            >
              <EidaIcon name="close" size={16} />
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
                Paste a Meta Model API key for this session, or leave it empty
                when
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
                  <option value={META_MODELS.inventory}>
                    Standard - private inputs
                  </option>
                  <option value={META_MODELS.inventoryContributor}>
                    Contributor - training permitted
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
              <div className={styles.inputDivider}>
                <span>Visual evidence</span>
              </div>
              <PhotoIntake
                projectId={projectId}
                onCountChange={onPhotoCountChange}
              />
              <div className={styles.inputDivider}>
                <span>Technical geometry</span>
              </div>
              <TechnicalFileIntake
                projectId={projectId}
                disabled={running}
                onChange={setTechnicalFiles}
              />
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
                {dimensionAuthority
                  ? `${dimensionAuthority.label} supplied the active ${dimensionAuthority.dimensionsMm.join(" × ")} mm envelope (${Math.round(dimensionAuthority.confidence * 100)}% confidence).`
                  : "These values are the fallback. A reliable local CAD envelope, then remote CAD and documented specifications, take precedence when the run starts."}
              </p>
              <ol className={styles.priorityList}>
                <li
                  data-active={technicalFiles.some(
                    (file) =>
                      file.cadAnalysis.status === "parsed" &&
                      file.cadAnalysis.format === "glb",
                  )}
                >
                  <b>1</b>
                  <span>
                    Exact CAD geometry
                    <small>Imported GLB replaces inferred outer geometry</small>
                  </span>
                </li>
                <li
                  data-active={technicalFiles.some(
                    (file) =>
                      file.cadAnalysis.status === "parsed" &&
                      file.cadAnalysis.boundsMm !== undefined,
                  )}
                >
                  <b>2</b>
                  <span>
                    CAD dimensions
                    <small>STEP/STP and other parsed envelopes set scale</small>
                  </span>
                </li>
                <li>
                  <b>3</b>
                  <span>
                    Documents and images
                    <small>Complete, validate and texture missing parts</small>
                  </span>
                </li>
                <li>
                  <b>4</b>
                  <span>
                    AI inference
                    <small>Only fills evidence gaps</small>
                  </span>
                </li>
              </ol>
            </section>
          </aside>

          <main className={styles.runColumn}>
            <div className={styles.pipelineIntro}>
              <div>
                <span className={styles.eyebrow}>04 - Reconstruction</span>
                <h2>From evidence to an editable 3D recipe</h2>
                <p>
                  Every Meta result remains reviewable. The local geometry never
                  claims measured accuracy without a measurement.
                </p>
              </div>
              <span className={styles.costBadge}>
                Canonical geometry - local graph
              </span>
            </div>

            <div className={styles.content}>
              {stageDefinitions.map((definition, index) => {
                const state = stageState(
                  definition.id,
                  activeStage,
                  failedStage,
                  ready,
                );
                const count =
                  definition.id === "evidence"
                    ? evidence?.sources.filter(
                        (source) => source.status !== "failed",
                      ).length
                    : definition.id === "inventory"
                      ? inventory?.items.length
                      : definition.id === "segmentation"
                        ? segmented.length
                        : definition.id === "reconciliation"
                          ? geometryPlan?.items.length
                          : definition.id === "geometry"
                            ? graph?.parts.length
                            : manifest?.parts.length;
                return (
                  <article
                    className={styles.step}
                    data-complete={state === "complete"}
                    data-running={state === "running"}
                    data-ready={state === "ready"}
                    data-failed={state === "failed"}
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
                              : state === "ready"
                                ? "Ready"
                                : state === "failed"
                                  ? "Failed"
                                  : activeStage === "idle"
                                    ? "Waiting to start"
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
                    {technicalFiles.filter(
                      (file) => file.cadAnalysis.status === "parsed",
                    ).length +
                      evidence.sources.reduce(
                        (total, source) =>
                          total +
                          source.artifacts.filter(
                            (artifact) =>
                              artifact.cadAnalysis?.status === "parsed",
                          ).length,
                        0,
                      )}
                  </strong>
                  <span>CAD files parsed</span>
                </div>
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
                    {technicalFiles.length +
                      evidence.sources.reduce(
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
                          <EidaIcon name="info" size={18} />
                        )}
                        <p>
                          <strong>{item.label}</strong>
                          <small>
                            {item.dimensionsMm
                              ? `${item.dimensionsMm.join(" × ")} mm - CAD constrained`
                              : item.samPrompt}
                          </small>
                        </p>
                        <b>
                          {mask
                            ? "Mask"
                            : segmentProgress >= 1
                              ? "No mask"
                              : "Waiting"}
                        </b>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {graph && (
              <section className={styles.graphSummary}>
                <div>
                  <span className={styles.eyebrow}>
                    EIDA reconstruction graph
                  </span>
                  <h2>{graph.parts.length} editable part recipes</h2>
                  <p>
                    {graph.evidence.length} evidence records and{" "}
                    {graph.relations.length} spatial relations are preserved
                    before GLB compilation.
                  </p>
                </div>
                <button type="button" onClick={downloadGraph}>
                  Download .eida.json
                </button>
              </section>
            )}

            {(message || error) && (
              <div
                className={error ? styles.errorMessage : styles.message}
                role={error ? "alert" : "status"}
              >
                <span>{error || message}</span>
                {error && (
                  <button type="button" onClick={onOpenDemo}>
                    Open the reference demo
                  </button>
                )}
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
                    Analyse local technical files, read approved sources, and
                    send only the selected images to the configured models
                    <small>
                      Local CAD remains in this browser and is parsed by the
                      local server. Its metadata—not the CAD binary—is included
                      in the Muse context. Up to 16 selected photos and 32
                      public images can be inspected; final graph compilation
                      and imported GLB geometry remain local.
                    </small>
                  </span>
                </label>
              )}
              {manifest ? (
                <button
                  className={styles.reconstructButton}
                  type="button"
                  onClick={() =>
                    onApplyManifest(
                      manifest,
                      diagnoseAssembly(manifest),
                      true,
                      graph ?? undefined,
                    )
                  }
                >
                  <span>
                    <small>{manifest.parts.length} compiled graph parts</small>
                    Open reconstructed assembly
                  </span>
                  <EidaIcon name="arrow-right" size={20} />
                </button>
              ) : (
                <button
                  className={styles.reconstructButton}
                  type="button"
                  onClick={() =>
                    void (canRetryLocalCompilation
                      ? retryLocalCompilation()
                      : runWorkflow())
                  }
                  disabled={!ready || running}
                >
                  <span>
                    <small>
                      {canRetryLocalCompilation
                        ? "Local graph compiler - no new Meta request"
                        : `${META_MODEL_LABELS.inventory} vision + ${META_MODEL_LABELS.segmentation} + local CPU`}
                    </small>
                    {running
                      ? "Reconstruction in progress…"
                      : !connected
                        ? "Connect Meta first"
                        : photoCount < MIN_USER_PHOTOS
                          ? `Add ${MIN_USER_PHOTOS - photoCount} more view${MIN_USER_PHOTOS - photoCount === 1 ? "" : "s"}`
                          : selectedSources.length === 0 &&
                              technicalFiles.length === 0
                            ? "Add a source or CAD file first"
                            : !consent
                              ? "Confirm data use above"
                              : canRetryLocalCompilation
                                ? "Retry local compilation"
                                : "Start reconstruction"}
                  </span>
                  <EidaIcon name="arrow-right" size={20} />
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
              {connected &&
                photoCount >= 3 &&
                selectedSources.length > 0 &&
                !consent && (
                  <p className={styles.requirement}>
                    Check the authorization above to enable reconstruction.
                    Preparing sources and views does not send them to Meta
                    automatically.
                  </p>
                )}
            </section>
          </main>
        </div>
      </section>
    </div>
  );
}
