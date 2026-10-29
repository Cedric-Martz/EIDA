"use client";

import { useEffect, useState } from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  projectSchema,
  type ComponentNode,
  type Project,
} from "@/domain/evidence/schema";
import { resolvePhotoObservations } from "@/domain/evidence/resolve-photo-observations";
import { inferenceRunSchema, type InferenceRun } from "@/domain/inference/run";
import { demoProject } from "@/domain/reconstruction/demo-project";
import { PhotoIntake } from "@/features/capture/photo-intake";
import {
  ByokSettings,
  type ByokState,
} from "@/features/inference/byok-settings";
import { DeviceSetup } from "@/features/workspace/device-setup";
import { db } from "@/storage/indexed-db/db";
import { DeviceViewer, type SceneMode } from "./device-viewer";
import { EvidenceBadge, EvidenceLegend } from "./evidence-badge";
import { ExplodeSlider } from "./explode-slider";
import { ViewerToolbar, type Tool } from "./viewer-toolbar";

const PROJECT_ID = "eida-sm-t530-local";

function emptyProject(device: Project["device"]): Project {
  return {
    schemaVersion: 1,
    id: PROJECT_ID,
    device,
    components: [],
    evidence: [],
  };
}

export function ViewerPanel({ onExit }: { onExit: () => void }) {
  const [explode, setExplode] = useState(0.58);
  const [selected, setSelected] = useState<string | null>(null);
  const [isolated, setIsolated] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [reducedGraphics, setReducedGraphics] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [byokOpen, setByokOpen] = useState(false);
  const [byokState, setByokState] = useState<ByokState>({
    configured: false,
    model: "muse-spark-1.3",
    verified: false,
  });
  const [photoCount, setPhotoCount] = useState(0);
  const [activeRun, setActiveRun] = useState<InferenceRun | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [baseProject, setBaseProject] = useState<Project | null>(null);
  const [viewSource, setViewSource] = useState<"project" | "demo">("project");
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [restoringProject, setRestoringProject] = useState(true);
  const [sceneMode, setSceneMode] = useState<SceneMode>("bench");
  const [arrangeKey, setArrangeKey] = useState(0);
  const resolvedProject = activeRun?.resolvedProject ?? null;
  const project: Project =
    viewSource === "demo"
      ? demoProject
      : (resolvedProject ??
        baseProject ??
        emptyProject({ confirmedByUser: false }));
  const isDemo = viewSource === "demo";
  const component = project.components.find((item) => item.id === selected);
  const componentStatuses: Array<ComponentNode["claims"][number]["status"]> =
    Array.from(
      new Set(component?.claims.map((claim) => claim.status) ?? ["unknown"]),
    );
  const status = componentStatuses.includes("observed")
    ? "observed"
    : componentStatuses.includes("documented")
      ? "documented"
      : componentStatuses.includes("inferred")
        ? "inferred"
        : "unknown";
  const componentEvidenceIds = new Set(
    component?.claims.flatMap((claim) => claim.evidenceIds) ?? [],
  );
  const componentEvidence = project.evidence.filter((item) =>
    componentEvidenceIds.has(item.id),
  );
  const analysis = activeRun?.observations ?? null;

  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      setPartsOpen(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      db.projects.get(PROJECT_ID),
      db.inferenceRuns.where("projectId").equals(PROJECT_ID).toArray(),
      db.assets
        .where("projectId")
        .equals(PROJECT_ID)
        .filter((asset) => asset.kind === "photo")
        .count(),
    ])
      .then(([projectRecord, records, savedPhotoCount]) => {
        if (!active) return;
        const savedProject = projectSchema.safeParse(projectRecord?.data);
        const latestRun = records
          .map((record) => inferenceRunSchema.safeParse(record))
          .filter((result) => result.success)
          .map((result) => result.data)
          .filter(
            (run) => run.status === "succeeded" && run.resolvedProject !== null,
          )
          .sort((left, right) => right.createdAt - left.createdAt)[0];
        let restoredRun = latestRun;
        if (latestRun?.observations) {
          try {
            restoredRun = {
              ...latestRun,
              resolvedProject: resolvePhotoObservations({
                runId: latestRun.id,
                analysis: latestRun.observations,
                photos: latestRun.photos,
                device: latestRun.device,
              }),
            };
            void db.inferenceRuns.put(restoredRun).catch(() => undefined);
          } catch {
            // Keep the validated stored graph if a future resolver cannot
            // interpret an older observation payload.
          }
        }
        const manualProjectIsNewer =
          projectRecord &&
          restoredRun &&
          projectRecord.updatedAt >= restoredRun.createdAt;

        if (savedProject.success) setBaseProject(savedProject.data);
        if (restoredRun && !manualProjectIsNewer) setActiveRun(restoredRun);
        setPhotoCount(savedPhotoCount);
        setSetupOpen(!savedProject.success && !latestRun);
        setRestoringProject(false);
      })
      .catch(() => {
        if (active) {
          setSetupOpen(true);
          setRestoringProject(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!sceneReady) return;
    const timer = window.setTimeout(() => setLoading(false), 700);
    return () => window.clearTimeout(timer);
  }, [sceneReady]);

  useEffect(() => {
    if (!captureOpen && !byokOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCaptureOpen(false);
        setByokOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [byokOpen, captureOpen]);

  function selectComponent(id: string) {
    setSelected(id || null);
    setInspectorOpen(Boolean(id));
    if (!id) setIsolated(false);
  }

  function handleTool(tool: Tool) {
    if (tool === "parts") setPartsOpen((value) => !value);
    if (tool === "inspect") setInspectorOpen((value) => !value);
    if (tool === "evidence") {
      setEvidenceOpen((value) => {
        if (!value) setInspectorOpen(true);
        return !value;
      });
    }
    if (tool === "grid") setShowGrid((value) => !value);
    if (tool === "quality") setReducedGraphics((value) => !value);
    if (tool === "reset") {
      setResetKey((value) => value + 1);
      setExplode(0.58);
      setIsolated(false);
      setSelected(null);
      setInspectorOpen(false);
      setPartsOpen(false);
      setSceneMode("bench");
    }
  }

  function openEvidence() {
    setEvidenceOpen(true);
    setInspectorOpen(true);
  }

  function arrangeOnWorkbench() {
    setArrangeKey((value) => value + 1);
    setSceneMode("bench");
    setIsolated(false);
  }

  function rebuildDevice() {
    setSceneMode("assembled");
    setIsolated(false);
  }

  function showExplodedView() {
    setSceneMode("exploded");
    setIsolated(false);
  }

  function showProject(nextSource: "project" | "demo") {
    setViewSource(nextSource);
    setSelected(null);
    setIsolated(false);
    setSceneMode("bench");
    setArrangeKey((value) => value + 1);
  }

  function handleRunCompleted(run: InferenceRun) {
    setActiveRun(run);
    setAnalysisOpen(true);
    setViewSource("project");
    setSelected(null);
    setIsolated(false);
    setSceneMode("bench");
    setPartsOpen(true);
  }

  async function saveBaseProject(nextProject: Project, title: string) {
    try {
      const updatedAt = Date.now();
      await db.projects.put({
        id: PROJECT_ID,
        title,
        updatedAt,
        data: nextProject,
      });
      setBaseProject(nextProject);
      setActiveRun(null);
      setViewSource("project");
      setSetupOpen(false);
      setSetupError("");
      setSelected(null);
      setPartsOpen(false);
      setSceneMode("bench");
      return true;
    } catch {
      setSetupError(
        "This project could not be saved in local browser storage.",
      );
      return false;
    }
  }

  function chooseKnownDevice(device: Project["device"]) {
    const title = [device.manufacturer, device.model].filter(Boolean).join(" ");
    void saveBaseProject(emptyProject(device), title);
  }

  function chooseUnknownDevice() {
    void saveBaseProject(
      emptyProject({ confirmedByUser: false }),
      "Unidentified device",
    ).then((saved) => {
      if (saved) setCaptureOpen(true);
    });
  }

  const projectTitle = isDemo
    ? "Synthetic demonstration"
    : [project.device.manufacturer, project.device.model]
        .filter(Boolean)
        .join(" ") || "Unidentified device";

  const activeTools: Tool[] = [];
  if (partsOpen) activeTools.push("parts");
  if (inspectorOpen) activeTools.push("inspect");
  if (evidenceOpen) activeTools.push("evidence");
  if (showGrid) activeTools.push("grid");
  if (reducedGraphics) activeTools.push("quality");

  return (
    <section
      className={`viewer-workbench ${reducedGraphics ? "is-reduced" : ""}`}
      aria-labelledby="viewer-title"
    >
      <header className="viewer-topbar">
        <button
          type="button"
          className="viewer-brand viewer-brand--button"
          onClick={onExit}
          aria-label="Return to home"
        >
          <span>E</span>
          <strong>EIDA</strong>
        </button>
        <div className="viewer-project">
          <strong>
            {restoringProject ? "Loading project…" : projectTitle}
          </strong>
          <small>
            {isDemo
              ? "training fixture"
              : project.device.confirmedByUser
                ? "identity confirmed by user"
                : "identity unconfirmed"}
          </small>
        </div>
        <div className="viewer-topbar__actions">
          <button
            type="button"
            className={`model-button ${byokState.verified ? "is-connected" : ""}`}
            onClick={() => setByokOpen(true)}
            title={
              byokState.configured
                ? byokState.model
                : "Configure Meta Model API"
            }
          >
            <i aria-hidden="true" />
            {byokState.verified ? "AI connected" : "Configure AI"}
          </button>
          <button
            type="button"
            className="add-views-button"
            onClick={() => setCaptureOpen(true)}
          >
            <span>＋</span> Add views
            {photoCount > 0 && <b>{photoCount}</b>}
          </button>
          <details className="viewer-menu">
            <summary>Menu</summary>
            <div>
              <button type="button" onClick={() => setCaptureOpen(true)}>
                Add views
              </button>
              <button type="button" onClick={openEvidence}>
                Evidence levels
              </button>
              <button type="button" onClick={() => setByokOpen(true)}>
                Configure Meta Model API
              </button>
              <button type="button" onClick={() => setSetupOpen(true)}>
                {baseProject ? "Change device" : "Start a project"}
              </button>
              {!isDemo && (
                <button type="button" onClick={() => showProject("demo")}>
                  Open synthetic demo
                </button>
              )}
              {isDemo && baseProject && (
                <button type="button" onClick={() => showProject("project")}>
                  Return to my project
                </button>
              )}
              <span className="viewer-menu__section">Navigation 3D</span>
              <span className="viewer-menu__help">
                Drag to rotate | two fingers to pan | pinch to zoom | keyboard
                controls available
              </span>
            </div>
          </details>
        </div>
      </header>

      <DeviceViewer
        components={project.components}
        explode={explode}
        mode={sceneMode}
        arrangeKey={arrangeKey}
        selected={selected}
        isolated={isolated}
        showGrid={showGrid}
        reducedGraphics={reducedGraphics}
        resetKey={resetKey}
        onSelect={selectComponent}
        onReady={() => setSceneReady(true)}
      />

      <div
        className={`scene-loader ${loading ? "is-visible" : ""}`}
        aria-live="polite"
        aria-busy={loading}
      >
        <div className="loader-screw" aria-hidden="true">
          <span className="loader-screw__head" />
        </div>
        <div>
          <strong>Initializing 3D</strong>
          <span>Building the scene</span>
        </div>
      </div>

      <GlassPanel className="scene-status" reducedGraphics={reducedGraphics}>
        <div>
          <span className="scene-status__path">
            {isDemo
              ? "Synthetic demo fixture"
              : resolvedProject
                ? "Evidence-resolved project"
                : "Evidence project"}
          </span>
          <h2 id="viewer-title">
            {project.components.length === 0
              ? "No evidence-backed parts yet"
              : sceneMode === "bench"
                ? "Parts on the workbench"
                : sceneMode === "assembled"
                  ? "Rebuilt device"
                  : "Technical exploded view"}
          </h2>
        </div>
        <div className="scene-mode-actions" aria-label="Part arrangement">
          <button
            type="button"
            className={sceneMode === "bench" ? "is-active" : ""}
            onClick={arrangeOnWorkbench}
            disabled={project.components.length === 0}
          >
            <span aria-hidden="true">▦</span>
            <small>Arrange</small>
          </button>
          <button
            type="button"
            className={sceneMode === "exploded" ? "is-active" : ""}
            onClick={showExplodedView}
            disabled={project.components.length === 0}
          >
            <span aria-hidden="true">↕</span>
            <small>Explode</small>
          </button>
          <button
            type="button"
            className={sceneMode === "assembled" ? "is-active" : ""}
            onClick={rebuildDevice}
            disabled={project.components.length === 0}
          >
            <span aria-hidden="true">↺</span>
            <small>Rebuild</small>
          </button>
        </div>
      </GlassPanel>

      {partsOpen && project.components.length > 0 && (
        <GlassPanel className="parts-panel" reducedGraphics={reducedGraphics}>
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Structure</span>
              <h3>Components</h3>
            </div>
            <span>{project.components.length}</span>
          </div>
          <ol className="parts-list">
            {project.components.map((item, index) => {
              const itemStatus = item.claims[0]?.status ?? "unknown";
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.id === selected ? "is-selected" : ""}
                    onClick={() => selectComponent(item.id)}
                  >
                    <span className="part-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="part-copy">
                      <strong>{item.label}</strong>
                      <small>{item.category}</small>
                    </span>
                    <span className={`part-state part-state--${itemStatus}`}>
                      {itemStatus === "unknown" ? "◇" : "●"}
                      <span className="visually-hidden">{itemStatus}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </GlassPanel>
      )}

      {project.components.length > 0 && (
        <ViewerToolbar activeTools={activeTools} onAction={handleTool} />
      )}

      {!restoringProject &&
        !setupOpen &&
        !isDemo &&
        project.components.length === 0 && (
          <GlassPanel
            className="project-guide"
            reducedGraphics={reducedGraphics}
          >
            <span className="panel-kicker">Project ready</span>
            <h3>{projectTitle}</h3>
            <p>
              Components appear only after evidence has been collected and
              resolved. Choose the next useful step.
            </p>
            <ol className="project-guide-steps">
              <li className="is-complete">
                <span>1</span>
                <div>
                  <strong>Device context</strong>
                  <small>
                    {project.device.confirmedByUser
                      ? "Identity entered by you"
                      : "Identity intentionally left unknown"}
                  </small>
                </div>
                <b>✓</b>
              </li>
              <li className={photoCount >= 3 ? "is-complete" : ""}>
                <span>2</span>
                <div>
                  <strong>Add visual evidence</strong>
                  <small>
                    {photoCount > 0
                      ? `${photoCount} local photo${photoCount > 1 ? "s" : ""} available`
                      : "Whole object, labels, sides and connectors"}
                  </small>
                </div>
                <button type="button" onClick={() => setCaptureOpen(true)}>
                  {photoCount > 0 ? "Review" : "Add photos"}
                </button>
              </li>
              <li className={activeRun ? "is-complete" : ""}>
                <span>3</span>
                <div>
                  <strong>Resolve observations</strong>
                  <small>
                    {photoCount < 3
                      ? "At least three photos are needed"
                      : byokState.verified
                        ? "Connection ready; approve the analysis"
                        : "Connect your own model key, then approve the transfer"}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => setByokOpen(true)}
                  disabled={photoCount < 3}
                >
                  {byokState.verified ? "Analyze" : "Configure AI"}
                </button>
              </li>
            </ol>
            <button
              type="button"
              className="project-guide-edit"
              onClick={() => setSetupOpen(true)}
            >
              Edit device identity
            </button>
          </GlassPanel>
        )}

      {inspectorOpen && (
        <GlassPanel
          className="component-inspector"
          reducedGraphics={reducedGraphics}
          aria-live="polite"
        >
          <div className="inspector-grip" aria-hidden="true" />
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Inspector</span>
              <h3>{component?.label ?? "No selection"}</h3>
            </div>
            <button
              type="button"
              className="panel-close"
              onClick={() => setInspectorOpen(false)}
              aria-label="Close inspector"
            >
              ×
            </button>
          </div>

          {component ? (
            <>
              <div className="inspector-status-row">
                <EvidenceBadge status={status} />
                <span>{component.id.toUpperCase()}</span>
              </div>
              <div className="inspector-metrics">
                <div>
                  <span>Geometry</span>
                  <strong>
                    {component.geometry.kind === "placeholder"
                      ? "Indicative volume"
                      : component.geometry.estimated
                        ? "Estimated parametric"
                        : "Measured parametric"}
                  </strong>
                </div>
                <div>
                  <span>Dimensions</span>
                  <strong>
                    {component.geometry.dimensionsMm
                      ? `${component.geometry.dimensionsMm.join(" × ")} mm`
                      : "Unknown"}
                  </strong>
                </div>
                <div>
                  <span>Sources</span>
                  <strong>{componentEvidence.length} evidence item</strong>
                </div>
              </div>
              <div className="inspector-actions">
                <button
                  type="button"
                  className={isolated ? "is-active" : ""}
                  onClick={() => setIsolated((value) => !value)}
                  aria-pressed={isolated}
                >
                  {isolated ? "Show assembly" : "Isolate part"}
                </button>
                <button type="button" onClick={() => setSelected(null)}>
                  Clear selection
                </button>
              </div>
            </>
          ) : (
            <p className="viewer-empty-state">
              Select a part in the scene or from the accessible list.
            </p>
          )}

          {evidenceOpen && (
            <div className="inspector-evidence">
              <div className="evidence-title-row">
                <h4>Evidence levels</h4>
                <span>Legend</span>
              </div>
              <EvidenceLegend />
              {isDemo ? (
                <p>Demo scene with no linked evidence.</p>
              ) : componentEvidence.length > 0 ? (
                <ul className="evidence-source-list">
                  {componentEvidence.map((item) => (
                    <li key={item.id}>
                      <strong>{item.kind}</strong>
                      <span>{item.description}</span>
                      <small>{item.locator ?? item.sourceId}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No admissible source is linked to this component.</p>
              )}
              {componentStatuses.length > 1 && (
                <p>
                  Contradictory statuses are preserved:{" "}
                  {componentStatuses.join(", ")}.
                </p>
              )}
            </div>
          )}
        </GlassPanel>
      )}

      {sceneMode === "exploded" && (
        <GlassPanel className="explode-dock" reducedGraphics={reducedGraphics}>
          <ExplodeSlider
            value={explode}
            onChange={setExplode}
            onAssemble={rebuildDevice}
          />
        </GlassPanel>
      )}

      <div className="viewer-gesture-hint" id="keyboard-navigation-hint">
        {sceneMode === "bench" ? (
          <>
            <span>Drag a part</span> move | <span>background</span> rotate |
            <span> WASD / arrows</span> pan | <span>Q E</span> rotate
          </>
        ) : (
          <>
            <span>WASD / arrows</span> pan | <span>Q E</span> rotate |{" "}
            <span>+ -</span> zoom | <span>0</span> reset
          </>
        )}
      </div>

      {captureOpen && (
        <div
          className="capture-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="capture-title"
        >
          <button
            className="capture-backdrop"
            onClick={() => setCaptureOpen(false)}
            aria-label="Close"
          />
          <GlassPanel
            className="capture-drawer"
            reducedGraphics={reducedGraphics}
          >
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">New observations</span>
                <h3 id="capture-title">Add views</h3>
              </div>
              <button
                type="button"
                className="panel-close"
                onClick={() => setCaptureOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="capture-drawer__intro">
              Add 3 to 8 clear views of the device, its sides, and its
              connectors.
            </p>
            <PhotoIntake onCountChange={setPhotoCount} />
            <div className="capture-next-step">
              <div>
                <strong>Next: resolve visible observations</strong>
                <small>
                  {photoCount >= 3
                    ? "You have enough views to continue. You will review consent before anything leaves this browser."
                    : "Add at least three complementary views to continue."}
                </small>
              </div>
              <button
                type="button"
                disabled={photoCount < 3}
                onClick={() => {
                  setCaptureOpen(false);
                  setByokOpen(true);
                }}
              >
                Continue to analysis →
              </button>
            </div>
          </GlassPanel>
        </div>
      )}

      <ByokSettings
        open={byokOpen}
        onClose={() => setByokOpen(false)}
        onStateChange={setByokState}
        photoCount={photoCount}
        device={
          isDemo
            ? (baseProject?.device ?? { confirmedByUser: false })
            : project.device
        }
        onRunCompleted={handleRunCompleted}
      />

      {!restoringProject && setupOpen && (
        <DeviceSetup
          canClose={Boolean(baseProject || activeRun || isDemo)}
          existingDevice={baseProject?.device}
          photoCount={photoCount}
          error={setupError}
          onClose={() => setSetupOpen(false)}
          onKnownDevice={chooseKnownDevice}
          onUnknownDevice={chooseUnknownDevice}
          onOpenDemo={() => {
            setViewSource("demo");
            setSetupOpen(false);
          }}
        />
      )}
      {analysis && analysisOpen && (
        <GlassPanel
          className="analysis-result"
          reducedGraphics={reducedGraphics}
        >
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Live model result</span>
              <h3>Photo observations</h3>
            </div>
            <button
              type="button"
              className="panel-close"
              onClick={() => setAnalysisOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <ul>
            {analysis.observations.map((observation, index) => (
              <li key={`${observation.label}-${index}`}>
                <strong>{observation.label}</strong>
                <span>{observation.description}</span>
                <small>
                  {observation.visibility} · photo{" "}
                  {observation.evidencePhotoIndices.join(", ")}
                </small>
              </li>
            ))}
          </ul>
          <p>{analysis.notes}</p>
          {activeRun?.usage && (
            <small className="analysis-usage">
              Tokens: {activeRun.usage.inputTokens ?? "?"} input /{" "}
              {activeRun.usage.outputTokens ?? "?"} output
            </small>
          )}
        </GlassPanel>
      )}
    </section>
  );
}
