"use client";

import { useEffect, useState } from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { demoProject } from "@/domain/reconstruction/demo-project";
import { PhotoIntake } from "@/features/capture/photo-intake";
import {
  ByokSettings,
  type ByokState,
} from "@/features/inference/byok-settings";
import { DeviceViewer, type SceneMode } from "./device-viewer";
import { EvidenceBadge, EvidenceLegend } from "./evidence-badge";
import { ExplodeSlider } from "./explode-slider";
import { ViewerToolbar, type Tool } from "./viewer-toolbar";

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
  const [sceneMode, setSceneMode] = useState<SceneMode>("bench");
  const [arrangeKey, setArrangeKey] = useState(0);
  const component = demoProject.components.find((item) => item.id === selected);
  const status = component?.claims[0]?.status ?? "unknown";

  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      setPartsOpen(false);
    }
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
          <strong>Galaxy Tab 4 10.1</strong>
          <small>SM-T530</small>
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
        components={demoProject.components}
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
          <span className="scene-status__path">Active view</span>
          <h2 id="viewer-title">
            {sceneMode === "bench"
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
          >
            <span aria-hidden="true">▦</span>
            <small>Arrange</small>
          </button>
          <button
            type="button"
            className={sceneMode === "exploded" ? "is-active" : ""}
            onClick={showExplodedView}
          >
            <span aria-hidden="true">↕</span>
            <small>Explode</small>
          </button>
          <button
            type="button"
            className={sceneMode === "assembled" ? "is-active" : ""}
            onClick={rebuildDevice}
          >
            <span aria-hidden="true">↺</span>
            <small>Rebuild</small>
          </button>
        </div>
      </GlassPanel>

      {partsOpen && (
        <GlassPanel className="parts-panel" reducedGraphics={reducedGraphics}>
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Structure</span>
              <h3>Components</h3>
            </div>
            <span>{demoProject.components.length}</span>
          </div>
          <ol className="parts-list">
            {demoProject.components.map((item, index) => {
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

      <ViewerToolbar activeTools={activeTools} onAction={handleTool} />

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
                    {component.geometry.estimated
                      ? "Estimated"
                      : component.geometry.kind === "placeholder"
                        ? "Indicative volume"
                        : "Parametric"}
                  </strong>
                </div>
                <div>
                  <span>Dimensions</span>
                  <strong>
                    {component.geometry.dimensionsMm?.join(" × ")} mm
                  </strong>
                </div>
                <div>
                  <span>Sources</span>
                  <strong>
                    {
                      component.claims.flatMap((claim) => claim.evidenceIds)
                        .length
                    }{" "}
                    evidence item
                  </strong>
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
              <p>Demo scene with no linked evidence.</p>
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
          </GlassPanel>
        </div>
      )}

      <ByokSettings
        open={byokOpen}
        onClose={() => setByokOpen(false)}
        onStateChange={setByokState}
      />
    </section>
  );
}
