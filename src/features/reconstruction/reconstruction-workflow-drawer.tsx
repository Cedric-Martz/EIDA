"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  diagnoseAssembly,
  type AssemblyDiagnostic,
  type AssemblyManifest,
  type DimensionsMm,
} from "@/domain/assembly";
import type { PhotoObservation } from "@/domain/inference/observation";
import {
  buildEstimatedAssembly,
  inferDeviceDimensions,
} from "@/domain/reconstruction/estimated-assembly";
import {
  buildReconstructionPlan,
  type ReconstructionStage,
} from "@/domain/reconstruction/reconstruction-plan";
import type { SelectedSource } from "@/domain/research/schema";
import { AssemblyImport } from "@/features/assembly/assembly-import";
import { createIfixitClient } from "@/features/research/ifixit-client";
import styles from "./reconstruction-workflow-drawer.module.css";

export type ReconstructionWorkflowDrawerProps = {
  projectId: string;
  deviceLabel: string;
  selectedSources: SelectedSource[];
  photoCount: number;
  observedParts?: readonly PhotoObservation[];
  onClose: () => void;
  onManifestValidated: (
    manifest: AssemblyManifest,
    diagnostics: readonly AssemblyDiagnostic[],
  ) => void;
};

const statusLabels: Record<ReconstructionStage["status"], string> = {
  complete: "Reviewed",
  ready: "Ready",
  waiting: "Waiting",
};

function sourceTypeLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "External source";
  }
}

function safeFileFragment(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "device"
  );
}

/**
 * Review and export the browser-side reconstruction hand-off, then validate a
 * returned assembly manifest before it reaches the project.
 */
export function ReconstructionWorkflowDrawer({
  projectId,
  deviceLabel,
  selectedSources,
  photoCount,
  observedParts = [],
  onClose,
  onManifestValidated,
}: ReconstructionWorkflowDrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const progressId = useId();
  const warningTitleId = useId();
  const sourceTitleId = useId();
  const boundaryTitleId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const defaultDimensions = useMemo(
    () => inferDeviceDimensions(deviceLabel),
    [deviceLabel],
  );
  const [dimensions, setDimensions] = useState<DimensionsMm>(defaultDimensions);
  const [generating, setGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("");
  const plan = useMemo(
    () =>
      buildReconstructionPlan({
        projectId,
        sources: selectedSources,
        photoCount,
      }),
    [photoCount, projectId, selectedSources],
  );

  const preparedStageCount = plan.stages.filter(
    (stage) => stage.status !== "waiting",
  ).length;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const drawer = drawerRef.current;
      if (!drawer) return;

      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (!drawer.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  function downloadRequest() {
    const json = `${JSON.stringify(plan, null, 2)}\n`;
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileFragment(deviceLabel)}-reconstruction-request.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function updateDimension(index: number, value: string) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return;
    setDimensions(
      (current) =>
        current.map((item, itemIndex) =>
          itemIndex === index ? numericValue : item,
        ) as DimensionsMm,
    );
  }

  async function generateEstimatedAssembly() {
    if (generating || selectedSources.length === 0) return;
    setGenerating(true);
    setGenerationMessage("Reading approved guide steps…");

    try {
      const ifixitSources = selectedSources
        .map((source) => ({
          source,
          guideId: /^ifixit-guide-(\d+)$/.exec(source.id)?.[1],
        }))
        .filter((item) => item.guideId)
        .slice(0, 12);
      const client = createIfixitClient();
      const results = await Promise.all(
        ifixitSources.map((item) => client.getGuide(Number(item.guideId))),
      );
      const guides = results.flatMap((result) =>
        result.ok ? [result.value.guide] : [],
      );
      const guideText = guides.map((guide) =>
        [
          guide.title,
          guide.summary ?? "",
          ...guide.steps.flatMap((step) => [step.title ?? "", ...step.lines]),
        ].join("\n"),
      );

      setGenerationMessage(
        `Building an estimated assembly from ${guides.length} fetched guide${guides.length === 1 ? "" : "s"}…`,
      );
      const manifest = buildEstimatedAssembly({
        projectId,
        deviceLabel,
        dimensionsMm: dimensions,
        sources: selectedSources,
        guideText,
        photoCount,
        observedParts,
      });
      onManifestValidated(manifest, diagnoseAssembly(manifest));
    } catch (error) {
      setGenerationMessage(
        error instanceof Error
          ? `Generation stopped: ${error.message}`
          : "Generation stopped unexpectedly.",
      );
      setGenerating(false);
    }
  }

  return (
    <div className={styles.backdrop} onMouseDown={closeFromBackdrop}>
      <section
        ref={drawerRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <p className={styles.eyebrow}>Reconstruction hand-off</p>
            <h1 id={titleId}>{deviceLabel}</h1>
            <p id={descriptionId}>
              Review what is ready, export a traceable request, then validate
              the resulting assembly before it enters the 3D workspace.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            className={styles.closeButton}
            type="button"
            onClick={onClose}
            aria-label="Close reconstruction workflow"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className={styles.content}>
          <section className={styles.readiness} aria-labelledby={progressId}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.sectionIndex}>01 / Readiness</p>
                <h2 id={progressId}>Six-stage reconstruction plan</h2>
              </div>
              <strong className={styles.progressValue}>
                {preparedStageCount} / {plan.stages.length}
              </strong>
            </div>
            <p className={styles.progressSummary}>
              {preparedStageCount} of {plan.stages.length} stages are reviewed
              or ready to begin. Later stages stay locked until their evidence
              and geometry inputs exist.
            </p>
            <progress
              className={styles.progress}
              value={preparedStageCount}
              max={plan.stages.length}
              aria-label={`${preparedStageCount} of ${plan.stages.length} reconstruction stages ready`}
            />

            <ol className={styles.stageList}>
              {plan.stages.map((stage, index) => (
                <li
                  className={styles.stage}
                  data-status={stage.status}
                  key={stage.id}
                >
                  <span className={styles.stageNumber} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className={styles.stageCopy}>
                    <div>
                      <h3>{stage.label}</h3>
                      <span className={styles.stageStatus}>
                        {statusLabels[stage.status]}
                      </span>
                    </div>
                    <p>{stage.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section
            className={styles.warningPanel}
            aria-labelledby={warningTitleId}
          >
            <div className={styles.sectionHeadingCompact}>
              <div>
                <p className={styles.sectionIndex}>02 / Guardrails</p>
                <h2 id={warningTitleId}>Evidence checks</h2>
              </div>
              <span className={styles.warningCount}>
                {plan.warnings.length}
              </span>
            </div>
            {plan.warnings.length > 0 ? (
              <ul className={styles.warningList}>
                {plan.warnings.map((warning) => (
                  <li key={warning}>
                    <span aria-hidden="true">!</span>
                    <p>{warning}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.clearState}>
                The approved set includes dimensional and CAD evidence with no
                unknown licences. Source claims still require human review.
              </p>
            )}
          </section>

          <section className={styles.sources} aria-labelledby={sourceTitleId}>
            <div className={styles.sectionHeadingCompact}>
              <div>
                <p className={styles.sectionIndex}>03 / Inputs</p>
                <h2 id={sourceTitleId}>Approved source snapshot</h2>
              </div>
              <span className={styles.sourceCount}>
                {plan.sourceSnapshot.length} approved
              </span>
            </div>

            {plan.sourceSnapshot.length > 0 ? (
              <ul className={styles.sourceList}>
                {plan.sourceSnapshot.map((source) => (
                  <li key={source.id}>
                    <div className={styles.sourceMain}>
                      <span className={styles.sourceHost}>
                        {sourceHost(source.url)}
                      </span>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        title={source.title}
                      >
                        {source.title}
                        <span aria-hidden="true">↗</span>
                      </a>
                    </div>
                    <div className={styles.sourceMeta}>
                      <span>{sourceTypeLabel(source.sourceType)}</span>
                      <span
                        className={styles.license}
                        data-unknown={source.licenseCode === "unknown"}
                      >
                        {source.licenseCode}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyState}>
                No source is approved yet. Return to research and select at
                least one reviewable link before treating reconstruction as
                ready.
              </p>
            )}
          </section>

          <section
            className={styles.boundaries}
            aria-labelledby={boundaryTitleId}
          >
            <div className={styles.sectionHeadingCompact}>
              <div>
                <p className={styles.sectionIndex}>04 / Execution boundary</p>
                <h2 id={boundaryTitleId}>What runs where</h2>
              </div>
            </div>
            <div className={styles.boundaryGrid}>
              <article>
                <span className={styles.boundaryBadge}>This browser</span>
                <h3>Local and available now</h3>
                <ul>
                  <li>Build the source snapshot and readiness plan</li>
                  <li>Read approved iFixit guide steps in the browser</li>
                  <li>Generate an estimated parametric assembly</li>
                  <li>Parse, validate and diagnose an assembly manifest</li>
                </ul>
              </article>
              <article>
                <span className={styles.boundaryBadge}>Optional worker</span>
                <h3>External compute when configured</h3>
                <ul>
                  <li>Fetch approved documents and extract cited claims</li>
                  <li>Convert or generate geometry with controlled tooling</li>
                  <li>Return a versioned manifest and referenced assets</li>
                </ul>
              </article>
            </div>
            <p className={styles.boundaryNote}>
              The JSON request is a hand-off, not an automatic claim of CAD
              accuracy. A worker remains optional and must preserve licences,
              citations and fidelity labels in every result.
            </p>
          </section>

          <section className={styles.handoff}>
            <div className={styles.handoffCopy}>
              <p className={styles.sectionIndex}>05 / Hand-off</p>
              <h2>Generate an evidence-limited draft</h2>
              <p id={`${progressId}-download-detail`}>
                Review the overall device dimensions. EIDA will read approved
                iFixit steps, combine documented parts with available photo
                observations, and build a clearly labelled parametric estimate.
              </p>
              <div className={styles.dimensionGrid}>
                {(["Length", "Width", "Thickness"] as const).map(
                  (label, index) => (
                    <label key={label}>
                      <span>{label}</span>
                      <span>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={dimensions[index]}
                          onChange={(event) =>
                            updateDimension(index, event.target.value)
                          }
                        />
                        <b>mm</b>
                      </span>
                    </label>
                  ),
                )}
              </div>
              <p className={styles.dimensionNote}>
                Defaults are device-family estimates. Measure the device for a
                correctly scaled result; internal outlines remain estimated
                until dimensional evidence or CAD is available.
              </p>
              {generationMessage && (
                <p className={styles.generationMessage} role="status">
                  {generationMessage}
                </p>
              )}
            </div>
            <div className={styles.handoffActions}>
              <button
                className={styles.generateButton}
                type="button"
                onClick={() => void generateEstimatedAssembly()}
                disabled={generating || selectedSources.length === 0}
                aria-describedby={`${progressId}-download-detail`}
              >
                <span>
                  <small>Local · estimated</small>
                  {generating ? "Generating…" : "Generate 3D draft"}
                </span>
                <b aria-hidden="true">→</b>
              </button>
              <button
                className={styles.exportButton}
                type="button"
                onClick={downloadRequest}
              >
                Export JSON request
              </button>
            </div>
          </section>

          <section className={styles.importSection}>
            <p className={styles.sectionIndex}>06 / Return path</p>
            <AssemblyImport
              title="Import an external assembly (advanced)"
              onManifestValidated={onManifestValidated}
            />
          </section>
        </div>
      </section>
    </div>
  );
}

export { ReconstructionWorkflowDrawer as ReconstructionDrawer };
