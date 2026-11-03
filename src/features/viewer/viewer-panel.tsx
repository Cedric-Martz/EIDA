"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { GlassPanel } from "@/components/ui/glass-panel";
import { EidaIcon } from "@/components/ui/eida-icon";
import {
  assemblyManifestSchema,
  diagnoseAssembly,
  type AssemblyDiagnostic,
  type AssemblyManifest,
} from "@/domain/assembly";
import { assemblyManifestToProject } from "@/domain/assembly/project-adapter";
import {
  projectSchema,
  type ComponentNode,
  type Project,
} from "@/domain/evidence/schema";
import { resolvePhotoObservations } from "@/domain/evidence/resolve-photo-observations";
import { inferenceRunSchema, type InferenceRun } from "@/domain/inference/run";
import { demoAssemblyManifest } from "@/domain/reconstruction/demo-assembly";
import {
  demoPhotoForEvidence,
  demoReferenceAssets,
} from "@/domain/reconstruction/demo-assets";
import { demoProject } from "@/domain/reconstruction/demo-project";
import {
  compileReconstructionGraph,
  reconstructionGraphSchema,
  validateReconstructionGraph,
  type ReconstructionGraph,
} from "@/domain/reconstruction-graph";
import {
  researchSourceSchema,
  type ResearchSource,
  type SelectedSource,
} from "@/domain/research";
import { SourceManager } from "@/features/research/source-manager";
import { sourceMatchesDevice } from "@/features/research/device-match";
import {
  boundRoundedBoxRadius,
  generateGraphAssets,
} from "@/features/local-reconstruction/silhouette-geometry";
import { DeviceSetup } from "@/features/workspace/device-setup";
import { ProjectWorkflow } from "@/features/workspace/project-workflow";
import { db } from "@/storage/indexed-db/db";
import {
  DeviceViewer,
  type CameraViewPreset,
  type SceneMode,
} from "./device-viewer";
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

export function ViewerPanel({
  initialViewSource = "project",
  onExit,
}: {
  initialViewSource?: "project" | "demo";
  onExit: () => void;
}) {
  const [explode, setExplode] = useState(
    initialViewSource === "demo" ? 1 : 0.58,
  );
  const [selected, setSelected] = useState<string | null>(
    initialViewSource === "demo" ? "battery" : null,
  );
  const [isolated, setIsolated] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(
    initialViewSource === "demo",
  );
  const [evidenceOpen, setEvidenceOpen] = useState(
    initialViewSource === "demo",
  );
  const [showGrid, setShowGrid] = useState(true);
  const [reducedGraphics, setReducedGraphics] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [photoCount, setPhotoCount] = useState(0);
  const [activeRun, setActiveRun] = useState<InferenceRun | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [baseProject, setBaseProject] = useState<Project | null>(null);
  const [researchSources, setResearchSources] = useState<ResearchSource[]>([]);
  const [sourcesRestored, setSourcesRestored] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [assemblyManifest, setAssemblyManifest] =
    useState<AssemblyManifest | null>(null);
  const [assemblyProject, setAssemblyProject] = useState<Project | null>(null);
  const [assemblyDiagnostics, setAssemblyDiagnostics] = useState<
    readonly AssemblyDiagnostic[]
  >([]);
  const [reconstructionGraph, setReconstructionGraph] =
    useState<ReconstructionGraph | null>(null);
  const [graphCompiling, setGraphCompiling] = useState(false);
  const [graphError, setGraphError] = useState("");
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [highlightedPartIds, setHighlightedPartIds] = useState<string[]>([]);
  const [viewSource, setViewSource] = useState<"project" | "demo">(
    initialViewSource,
  );
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [restoringProject, setRestoringProject] = useState(
    initialViewSource !== "demo",
  );
  const [sceneMode, setSceneMode] = useState<SceneMode>(
    initialViewSource === "demo" ? "exploded" : "bench",
  );
  const [cameraView, setCameraView] = useState<CameraViewPreset>("isometric");
  const [arrangeKey, setArrangeKey] = useState(0);
  const resolvedProject = activeRun?.resolvedProject ?? null;
  const project: Project =
    viewSource === "demo"
      ? demoProject
      : (assemblyProject ??
        resolvedProject ??
        baseProject ??
        emptyProject({ confirmedByUser: false }));
  const isDemo = viewSource === "demo";
  const activeAssembly = isDemo ? demoAssemblyManifest : assemblyManifest;
  // Project diagnostics are restored asynchronously from IndexedDB. They must
  // never leak into the curated reference demo, whose part IDs and graph are
  // unrelated to the user's latest reconstruction.
  const activeDiagnostics = isDemo ? [] : assemblyDiagnostics;
  const hasReconstructedMeshes = Boolean(
    activeAssembly?.parts.some((part) => part.geometry.kind === "asset"),
  );
  const sourceDeviceLabel = [project.device.manufacturer, project.device.model]
    .filter(Boolean)
    .join(" ");
  const approvedSources = researchSources.filter(
    (source): source is SelectedSource =>
      source.selection === "selected" &&
      sourceMatchesDevice(sourceDeviceLabel, source),
  );
  const excludedSourceCount = researchSources.filter(
    (source) =>
      source.selection === "selected" &&
      !sourceMatchesDevice(sourceDeviceLabel, source),
  ).length;
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
  const graphPart = reconstructionGraph?.parts.find(
    (part) => part.id === selected,
  );
  const graphEvidenceIds = new Set(
    graphPart ? Object.values(graphPart.evidence).flat() : [],
  );
  const graphEvidence =
    reconstructionGraph?.evidence.filter((item) =>
      graphEvidenceIds.has(item.id),
    ) ?? [];
  const graphRelations =
    reconstructionGraph?.relations.filter(
      (relation) =>
        relation.sourcePartId === selected ||
        relation.targetPartId === selected,
    ) ?? [];
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
      db.researchSources.where("projectId").equals(PROJECT_ID).toArray(),
      db.assemblyManifests.where("projectId").equals(PROJECT_ID).toArray(),
      db.metaJobs.where("projectId").equals(PROJECT_ID).toArray(),
    ])
      .then(
        ([
          projectRecord,
          records,
          savedPhotoCount,
          sourceRecords,
          assemblyRecords,
          graphRecords,
        ]) => {
          if (!active) return;
          const savedProject = projectSchema.safeParse(projectRecord?.data);
          const latestRun = records
            .map((record) => inferenceRunSchema.safeParse(record))
            .filter((result) => result.success)
            .map((result) => result.data)
            .filter(
              (run) =>
                run.status === "succeeded" && run.resolvedProject !== null,
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
          const restoredSources = sourceRecords.flatMap((record) => {
            const parsed = researchSourceSchema.safeParse(record.data);
            return parsed.success ? [parsed.data] : [];
          });
          const latestAssemblyRecord = [...assemblyRecords].sort(
            (left, right) => right.updatedAt - left.updatedAt,
          )[0];
          const restoredManifest = assemblyManifestSchema.safeParse(
            latestAssemblyRecord?.data,
          );
          const restoredGraph = [...graphRecords]
            .sort((left, right) => right.updatedAt - left.updatedAt)
            .map((record) => reconstructionGraphSchema.safeParse(record.data))
            .find((result) => result.success);
          const contextProject =
            restoredRun?.resolvedProject && !manualProjectIsNewer
              ? restoredRun.resolvedProject
              : savedProject.success
                ? savedProject.data
                : emptyProject({ confirmedByUser: false });

          if (savedProject.success) setBaseProject(savedProject.data);
          if (restoredRun && !manualProjectIsNewer) setActiveRun(restoredRun);
          setResearchSources(restoredSources);
          setSourcesRestored(true);
          if (restoredManifest.success) {
            try {
              setAssemblyManifest(restoredManifest.data);
              setAssemblyDiagnostics(diagnoseAssembly(restoredManifest.data));
              setAssemblyProject(
                assemblyManifestToProject(restoredManifest.data, {
                  projectId: PROJECT_ID,
                  device: contextProject.device,
                  evidence: contextProject.evidence,
                }),
              );
              if (initialViewSource !== "demo") {
                setSceneMode("assembled");
                setPartsOpen(true);
              }
            } catch {
              // A stale assembly never replaces a valid evidence project.
            }
          }
          if (restoredGraph?.success) {
            setReconstructionGraph(restoredGraph.data);
          }
          setPhotoCount(savedPhotoCount);
          setSetupOpen(
            initialViewSource !== "demo" && !savedProject.success && !latestRun,
          );
          if (
            initialViewSource !== "demo" &&
            (savedProject.success || latestRun) &&
            !restoredManifest.success
          ) {
            setWorkflowOpen(true);
          }
          setRestoringProject(false);
        },
      )
      .catch(() => {
        if (active) {
          setSourcesRestored(true);
          setSetupOpen(initialViewSource !== "demo");
          setRestoringProject(false);
        }
      });
    return () => {
      active = false;
    };
  }, [initialViewSource]);

  useEffect(() => {
    if (!sceneReady) return;
    const timer = window.setTimeout(() => setLoading(false), 700);
    return () => window.clearTimeout(timer);
  }, [sceneReady]);

  useEffect(() => {
    if (!sourcesRestored) return;
    const timer = window.setTimeout(() => {
      void db
        .transaction("rw", db.researchSources, async () => {
          const existingIds = await db.researchSources
            .where("projectId")
            .equals(PROJECT_ID)
            .primaryKeys();
          if (existingIds.length > 0) {
            await db.researchSources.bulkDelete(existingIds);
          }
          if (researchSources.length > 0) {
            const updatedAt = Date.now();
            await db.researchSources.bulkPut(
              researchSources.map((source) => ({
                id: source.id,
                projectId: PROJECT_ID,
                selection: source.selection,
                updatedAt,
                data: source,
              })),
            );
          }
        })
        .catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [researchSources, sourcesRestored]);

  function selectComponent(id: string) {
    setSelected(id || null);
    setInspectorOpen(Boolean(id));
    setDiagnosticsOpen(false);
    if (id && window.matchMedia("(max-width: 1100px)").matches) {
      setPartsOpen(false);
    }
    setHighlightedPartIds([]);
    if (!id) setIsolated(false);
  }

  function handleTool(tool: Tool) {
    const compact = window.matchMedia("(max-width: 1100px)").matches;
    if (tool === "parts") {
      const next = !partsOpen;
      setPartsOpen(next);
      if (next && compact) {
        setInspectorOpen(false);
        setEvidenceOpen(false);
        setDiagnosticsOpen(false);
      }
    }
    if (tool === "inspect") {
      const next = !inspectorOpen;
      setInspectorOpen(next);
      if (!next) setEvidenceOpen(false);
      if (next) {
        setDiagnosticsOpen(false);
        if (compact) setPartsOpen(false);
      }
    }
    if (tool === "evidence") {
      setEvidenceOpen((value) => {
        if (!value) {
          setInspectorOpen(true);
          setDiagnosticsOpen(false);
          if (compact) setPartsOpen(false);
        }
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
      setCameraView("isometric");
      setHighlightedPartIds([]);
    }
  }

  function openEvidence() {
    setEvidenceOpen(true);
    setInspectorOpen(true);
    setDiagnosticsOpen(false);
    if (window.matchMedia("(max-width: 1100px)").matches) setPartsOpen(false);
  }

  function toggleDiagnostics() {
    const next = !diagnosticsOpen;
    setDiagnosticsOpen(next);
    if (next) {
      setInspectorOpen(false);
      setEvidenceOpen(false);
      if (window.matchMedia("(max-width: 1100px)").matches) setPartsOpen(false);
    }
  }

  function cycleCameraView() {
    const order: CameraViewPreset[] = ["isometric", "front", "top", "side"];
    const current = order.indexOf(cameraView);
    setCameraView(order[(current + 1) % order.length]!);
  }

  function arrangeOnWorkbench() {
    setArrangeKey((value) => value + 1);
    setSceneMode("bench");
    setIsolated(false);
    setHighlightedPartIds([]);
  }

  function rebuildDevice() {
    setSceneMode("assembled");
    setIsolated(false);
    setHighlightedPartIds([]);
  }

  function showExplodedView() {
    setSceneMode("exploded");
    setIsolated(false);
    setHighlightedPartIds([]);
  }

  function showProject(nextSource: "project" | "demo") {
    setViewSource(nextSource);
    setSelected(nextSource === "demo" ? "battery" : null);
    setIsolated(false);
    setExplode(nextSource === "demo" ? 1 : 0.58);
    setSceneMode(nextSource === "demo" ? "exploded" : "bench");
    setInspectorOpen(nextSource === "demo");
    setEvidenceOpen(nextSource === "demo");
    setDiagnosticsOpen(false);
    setHighlightedPartIds([]);
    setArrangeKey((value) => value + 1);
  }

  async function saveBaseProject(nextProject: Project, title: string) {
    try {
      const updatedAt = Date.now();
      await db.transaction(
        "rw",
        db.projects,
        db.researchSources,
        db.assemblyManifests,
        db.metaJobs,
        async () => {
          await db.projects.put({
            id: PROJECT_ID,
            title,
            updatedAt,
            data: nextProject,
          });
          await db.researchSources
            .where("projectId")
            .equals(PROJECT_ID)
            .delete();
          await db.assemblyManifests
            .where("projectId")
            .equals(PROJECT_ID)
            .delete();
          await db.metaJobs.where("projectId").equals(PROJECT_ID).delete();
        },
      );
      setBaseProject(nextProject);
      setActiveRun(null);
      setResearchSources([]);
      setAssemblyManifest(null);
      setAssemblyProject(null);
      setAssemblyDiagnostics([]);
      setReconstructionGraph(null);
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
    void saveBaseProject(emptyProject(device), title).then((saved) => {
      if (saved) setWorkflowOpen(true);
    });
  }

  function chooseUnknownDevice() {
    void saveBaseProject(
      emptyProject({ confirmedByUser: false }),
      "Unidentified device",
    ).then((saved) => {
      if (saved) setWorkflowOpen(true);
    });
  }

  function prepareReconstruction() {
    setSourcesOpen(false);
    setWorkflowOpen(true);
  }

  function applyAssemblyManifest(
    manifest: AssemblyManifest,
    diagnostics: readonly AssemblyDiagnostic[],
    activateViewer = true,
    graph?: ReconstructionGraph,
  ) {
    const contextProject =
      resolvedProject ?? baseProject ?? emptyProject(project.device);
    const nextProject = assemblyManifestToProject(manifest, {
      projectId: PROJECT_ID,
      device: contextProject.device,
      evidence: contextProject.evidence,
    });
    setAssemblyManifest(manifest);
    setAssemblyProject(nextProject);
    setAssemblyDiagnostics(diagnostics);
    if (graph) setReconstructionGraph(graph);
    setViewSource("project");
    setWorkflowOpen(false);
    setSelected(null);
    setIsolated(false);
    if (activateViewer) {
      setSceneMode("assembled");
      setPartsOpen(true);
    } else {
      setWorkflowOpen(true);
    }
    void db.assemblyManifests
      .put({
        id: manifest.id,
        projectId: PROJECT_ID,
        updatedAt: Date.now(),
        data: manifest,
      })
      .catch(() => undefined);
    if (graph) {
      void db.metaJobs
        .put({
          id: graph.id,
          projectId: PROJECT_ID,
          status: "succeeded",
          updatedAt: Date.now(),
          data: graph,
        })
        .catch(() => undefined);
    }
  }

  function inspectDiagnostic(diagnostic: AssemblyDiagnostic) {
    const [firstPartId] = diagnostic.partIds;
    setHighlightedPartIds([...diagnostic.partIds]);
    setSelected(firstPartId ?? null);
    setInspectorOpen(Boolean(firstPartId));
    setDiagnosticsOpen(false);
    setSceneMode("assembled");
    setIsolated(true);
    setResetKey((value) => value + 1);
  }

  async function updateGraphPart(
    partId: string,
    update: (
      part: ReconstructionGraph["parts"][number],
    ) => ReconstructionGraph["parts"][number],
  ) {
    if (!reconstructionGraph || graphCompiling) return;
    setGraphCompiling(true);
    setGraphError("");
    try {
      const nextGraph = validateReconstructionGraph({
        ...reconstructionGraph,
        parts: reconstructionGraph.parts.map((part) =>
          part.id === partId ? update(part) : part,
        ),
      });
      const assets = await generateGraphAssets(nextGraph);
      const manifest = compileReconstructionGraph(nextGraph, assets);
      const diagnostics = diagnoseAssembly(manifest);
      const contextProject =
        resolvedProject ?? baseProject ?? emptyProject(project.device);
      const nextProject = assemblyManifestToProject(manifest, {
        projectId: PROJECT_ID,
        device: contextProject.device,
        evidence: contextProject.evidence,
      });
      setReconstructionGraph(nextGraph);
      setAssemblyManifest(manifest);
      setAssemblyProject(nextProject);
      setAssemblyDiagnostics(diagnostics);
      setViewSource("project");
      await Promise.all([
        db.metaJobs.put({
          id: nextGraph.id,
          projectId: PROJECT_ID,
          status: "succeeded",
          updatedAt: Date.now(),
          data: nextGraph,
        }),
        db.assemblyManifests.put({
          id: manifest.id,
          projectId: PROJECT_ID,
          updatedAt: Date.now(),
          data: manifest,
        }),
      ]);
      setResetKey((value) => value + 1);
    } catch (error) {
      setGraphError(
        error instanceof Error ? error.message : "Graph recompilation failed.",
      );
    } finally {
      setGraphCompiling(false);
    }
  }

  function graphPartHalfExtents(
    part: ReconstructionGraph["parts"][number],
  ): [number, number, number] {
    if (part.geometry.kind === "primitive") {
      return part.geometry.dimensionsMm.map((value) => value / 2) as [
        number,
        number,
        number,
      ];
    }
    if (part.geometry.kind === "mesh-reference") {
      const bounds = part.geometry.boundsMm;
      return [0, 1, 2].map(
        (axis) => (bounds.maxMm[axis] - bounds.minMm[axis]) / 2,
      ) as [number, number, number];
    }
    const xs = part.geometry.profileMm.map((point) => point[0]);
    const ys = part.geometry.profileMm.map((point) => point[1]);
    return [
      (Math.max(...xs) - Math.min(...xs)) / 2,
      (Math.max(...ys) - Math.min(...ys)) / 2,
      part.geometry.depthMm / 2,
    ];
  }

  function autoAdjustDiagnostic(diagnostic: AssemblyDiagnostic) {
    if (!reconstructionGraph || graphCompiling) return;
    const [sourceId, targetId] = diagnostic.partIds;
    const source = reconstructionGraph.parts.find(
      (part) => part.id === sourceId,
    );
    if (!source) return;

    void updateGraphPart(source.id, (part) => {
      const position = [...part.transform.positionMm] as [
        number,
        number,
        number,
      ];
      if (diagnostic.code === "aabb-overlap" && targetId) {
        const target = reconstructionGraph.parts.find(
          (candidate) => candidate.id === targetId,
        );
        if (target) {
          const sourceHalf = graphPartHalfExtents(part);
          const targetHalf = graphPartHalfExtents(target);
          position[2] =
            target.transform.positionMm[2] +
            targetHalf[2] +
            sourceHalf[2] +
            0.5;
        }
      } else {
        const half = graphPartHalfExtents(part);
        const bounds = reconstructionGraph.assemblyBoundsMm;
        position.forEach((value, axis) => {
          position[axis] = Math.min(
            bounds.maxMm[axis] - half[axis],
            Math.max(bounds.minMm[axis] + half[axis], value),
          );
        });
      }
      return {
        ...part,
        transform: { ...part.transform, positionMm: position },
      };
    });
  }

  const projectTitle = isDemo
    ? "Framework Laptop 13 reference demo"
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
      className={[
        "viewer-workbench",
        reducedGraphics ? "is-reduced" : "",
        partsOpen ? "has-parts-panel" : "",
        inspectorOpen ? "has-inspector-panel" : "",
        diagnosticsOpen ? "has-diagnostics-panel" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby="viewer-title"
    >
      <header className="viewer-topbar">
        <button
          type="button"
          className="viewer-brand viewer-brand--button"
          onClick={onExit}
          aria-label="Return to home"
        >
          <Image src="/icon.svg" alt="" width={34} height={34} priority />
          <strong>EIDA</strong>
        </button>
        <div className="viewer-project">
          <strong>
            {restoringProject ? "Loading project…" : projectTitle}
          </strong>
          <small>
            {isDemo
              ? "licensed evidence + official CAD"
              : project.device.confirmedByUser
                ? "identity confirmed by user"
                : "identity unconfirmed"}
          </small>
        </div>
        <div className="viewer-topbar__actions">
          {!isDemo && (
            <button
              type="button"
              className="model-button"
              onClick={() => setWorkflowOpen(true)}
              title="Open the Meta AI reconstruction workflow"
            >
              <i aria-hidden="true" />
              Meta reconstruction
            </button>
          )}
          <details className="viewer-menu">
            <summary>Menu</summary>
            <div>
              {!isDemo && (
                <button type="button" onClick={() => setWorkflowOpen(true)}>
                  Open Meta reconstruction
                </button>
              )}
              <button type="button" onClick={openEvidence}>
                Evidence levels
              </button>
              <button type="button" onClick={() => setSetupOpen(true)}>
                {baseProject ? "Change device" : "Start a project"}
              </button>
              {!isDemo && (
                <button type="button" onClick={() => showProject("demo")}>
                  Open reference demo
                </button>
              )}
              {isDemo && baseProject && (
                <button type="button" onClick={() => showProject("project")}>
                  Return to my project
                </button>
              )}
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
        assembly={activeAssembly}
        explode={explode}
        mode={sceneMode}
        arrangeKey={arrangeKey}
        selected={selected}
        isolated={isolated}
        showGrid={showGrid}
        reducedGraphics={reducedGraphics}
        resetKey={resetKey}
        cameraView={cameraView}
        warningPartIds={highlightedPartIds}
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
              ? "Evidence-backed reference demo"
              : assemblyProject
                ? `${hasReconstructedMeshes ? "Meta reconstructed meshes" : "Estimated assembly"} - ${activeDiagnostics.length} spatial warning${activeDiagnostics.length === 1 ? "" : "s"}`
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
          {activeDiagnostics.length > 0 && (
            <button
              type="button"
              className={
                diagnosticsOpen
                  ? "is-active diagnostics-trigger"
                  : "diagnostics-trigger"
              }
              onClick={toggleDiagnostics}
            >
              <EidaIcon name="alert" size={16} />
              <small>{activeDiagnostics.length} issues</small>
            </button>
          )}
          <button
            type="button"
            className={sceneMode === "bench" ? "is-active" : ""}
            onClick={arrangeOnWorkbench}
            disabled={project.components.length === 0}
          >
            <EidaIcon name="grid" size={17} />
            <small>Arrange</small>
          </button>
          <button
            type="button"
            className={sceneMode === "exploded" ? "is-active" : ""}
            onClick={showExplodedView}
            disabled={project.components.length === 0}
          >
            <EidaIcon name="gallery" size={17} />
            <small>Explode</small>
          </button>
          <button
            type="button"
            className={sceneMode === "assembled" ? "is-active" : ""}
            onClick={rebuildDevice}
            disabled={project.components.length === 0}
          >
            <EidaIcon name="gears" size={17} />
            <small>Rebuild</small>
          </button>
          <button
            type="button"
            onClick={cycleCameraView}
            title={`Camera view: ${cameraView}. Click for the next view.`}
          >
            <EidaIcon name="camera" size={17} />
            <small>{cameraView}</small>
          </button>
          <button
            type="button"
            onClick={() => setResetKey((value) => value + 1)}
            disabled={project.components.length === 0}
          >
            <EidaIcon name="search" size={17} />
            <small>Fit</small>
          </button>
        </div>
      </GlassPanel>

      {diagnosticsOpen && activeDiagnostics.length > 0 && (
        <GlassPanel
          className="diagnostics-panel"
          reducedGraphics={reducedGraphics}
        >
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Spatial validation</span>
              <h3>Review geometry conflicts</h3>
            </div>
            <button
              type="button"
              className="panel-close"
              onClick={() => setDiagnosticsOpen(false)}
              aria-label="Close diagnostics"
            >
              <EidaIcon name="close" size={15} />
            </button>
          </div>
          <p className="diagnostics-intro">
            Select a conflict to isolate the affected parts and correct their
            graph properties.
          </p>
          <ol className="diagnostics-list">
            {activeDiagnostics.map((diagnostic, index) => (
              <li
                key={`${diagnostic.code}:${diagnostic.partIds.join(":")}:${index}`}
              >
                <div>
                  <span>{diagnostic.code.replaceAll("-", " ")}</span>
                  <strong>{diagnostic.message}</strong>
                  <small>{diagnostic.partIds.join(" ↔ ")}</small>
                </div>
                <div className="diagnostic-actions">
                  <button
                    type="button"
                    onClick={() => inspectDiagnostic(diagnostic)}
                  >
                    Inspect
                  </button>
                  {reconstructionGraph && (
                    <button
                      type="button"
                      onClick={() => autoAdjustDiagnostic(diagnostic)}
                      disabled={graphCompiling}
                    >
                      Adjust
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </GlassPanel>
      )}

      {partsOpen && project.components.length > 0 && (
        <GlassPanel className="parts-panel" reducedGraphics={reducedGraphics}>
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Structure</span>
              <h3>Components</h3>
            </div>
            <button
              type="button"
              className="panel-close"
              onClick={() => setPartsOpen(false)}
              aria-label="Close components"
            >
              <EidaIcon name="close" size={15} />
            </button>
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
                      <EidaIcon
                        name={itemStatus === "unknown" ? "link" : "check"}
                        size={13}
                      />
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
              Identity, sources, photos and reconstruction are now grouped in
              one guided workspace.
            </p>
            <button
              type="button"
              className="project-guide-edit"
              onClick={() => setWorkflowOpen(true)}
            >
              Open Meta reconstruction
              <EidaIcon name="arrow-right" size={16} />
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
              onClick={() => {
                setInspectorOpen(false);
                setEvidenceOpen(false);
              }}
              aria-label="Close inspector"
            >
              <EidaIcon name="close" size={15} />
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
                      : component.geometry.kind === "reference_asset"
                        ? "Official CAD envelope"
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
                  <strong>
                    {componentEvidence.length + graphEvidence.length} evidence
                    item
                    {componentEvidence.length + graphEvidence.length === 1
                      ? ""
                      : "s"}
                  </strong>
                </div>
              </div>
              {graphPart && (
                <div className="graph-editor">
                  <div className="graph-editor__heading">
                    <div>
                      <span>EIDA graph recipe</span>
                      <strong>{graphPart.geometry.kind}</strong>
                    </div>
                    <small>{graphCompiling ? "Compiling…" : "Live"}</small>
                  </div>
                  <fieldset disabled={graphCompiling}>
                    <legend>Position - mm</legend>
                    <div className="graph-vector-fields">
                      {(["X", "Y", "Z"] as const).map((axis, index) => (
                        <label
                          key={`${graphPart.id}:${axis}:${graphPart.transform.positionMm[index]}`}
                        >
                          {axis}
                          <input
                            type="number"
                            step="0.5"
                            defaultValue={graphPart.transform.positionMm[index]}
                            onBlur={(event) => {
                              const value = Number(event.currentTarget.value);
                              if (!Number.isFinite(value)) return;
                              void updateGraphPart(graphPart.id, (part) => ({
                                ...part,
                                transform: {
                                  ...part.transform,
                                  positionMm: part.transform.positionMm.map(
                                    (current, currentIndex) =>
                                      currentIndex === index ? value : current,
                                  ) as [number, number, number],
                                },
                              }));
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {graphPart.geometry.kind !== "mesh-reference" && (
                    <fieldset disabled={graphCompiling}>
                      <legend>Dimensions - mm</legend>
                      <div className="graph-vector-fields">
                        {(["W", "H", "D"] as const).map((axis, index) => {
                          const value =
                            graphPartHalfExtents(graphPart)[index] * 2;
                          return (
                            <label
                              key={`${graphPart.id}:size:${axis}:${value}`}
                            >
                              {axis}
                              <input
                                type="number"
                                min="0.1"
                                step="0.5"
                                defaultValue={Number(value.toFixed(2))}
                                onBlur={(event) => {
                                  const nextValue = Number(
                                    event.currentTarget.value,
                                  );
                                  if (
                                    !Number.isFinite(nextValue) ||
                                    nextValue <= 0
                                  )
                                    return;
                                  void updateGraphPart(graphPart.id, (part) => {
                                    if (part.geometry.kind === "primitive") {
                                      const dimensionsMm =
                                        part.geometry.dimensionsMm.map(
                                          (current, currentIndex) =>
                                            currentIndex === index
                                              ? nextValue
                                              : current,
                                        ) as [number, number, number];
                                      return {
                                        ...part,
                                        geometry: {
                                          ...part.geometry,
                                          dimensionsMm,
                                          ...(part.geometry.primitive ===
                                          "rounded_box"
                                            ? {
                                                cornerRadiusMm:
                                                  boundRoundedBoxRadius(
                                                    part.geometry
                                                      .cornerRadiusMm,
                                                    dimensionsMm,
                                                  ),
                                              }
                                            : {}),
                                        },
                                      };
                                    }
                                    if (
                                      part.geometry.kind === "profile-extrusion"
                                    ) {
                                      if (index === 2) {
                                        return {
                                          ...part,
                                          geometry: {
                                            ...part.geometry,
                                            depthMm: nextValue,
                                          },
                                        };
                                      }
                                      const currentSize =
                                        graphPartHalfExtents(part)[index] * 2;
                                      const scale = nextValue / currentSize;
                                      return {
                                        ...part,
                                        geometry: {
                                          ...part.geometry,
                                          profileMm:
                                            part.geometry.profileMm.map(
                                              ([x, y]) =>
                                                index === 0
                                                  ? ([x * scale, y] as [
                                                      number,
                                                      number,
                                                    ])
                                                  : ([x, y * scale] as [
                                                      number,
                                                      number,
                                                    ]),
                                            ),
                                        },
                                      };
                                    }
                                    return part;
                                  });
                                }}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  )}
                  {graphError && (
                    <p className="graph-editor__error">{graphError}</p>
                  )}
                  {graphPart.assumptions.length > 0 && (
                    <div className="graph-assumptions">
                      <span>Assumptions to review</span>
                      <ul>
                        {graphPart.assumptions.map((assumption) => (
                          <li key={assumption.id}>
                            <strong>{assumption.property}</strong>
                            {assumption.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {graphRelations.length > 0 && (
                    <div className="graph-assumptions">
                      <span>Assembly relations</span>
                      <ul>
                        {graphRelations.map((relation) => (
                          <li key={relation.id}>
                            <strong>{relation.kind}</strong>
                            {relation.sourcePartId}
                            <EidaIcon name="arrow-right" size={13} />
                            {relation.targetPartId}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
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
              {componentEvidence.length > 0 || graphEvidence.length > 0 ? (
                <>
                  {isDemo && (
                    <div className="demo-evidence-assets">
                      {componentEvidence.flatMap((item) => {
                        const photo = demoPhotoForEvidence(item.id);
                        return photo ? (
                          <a
                            href={photo.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            key={photo.evidenceId}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.src} alt={photo.alt} />
                            <span>
                              {photo.author} · {photo.license}
                            </span>
                          </a>
                        ) : (
                          []
                        );
                      })}
                      {componentEvidence.some(
                        (item) =>
                          item.id === demoReferenceAssets.cad.evidenceId,
                      ) && (
                        <a
                          className="demo-cad-download"
                          href={demoReferenceAssets.cad.downloadUrl}
                          download
                        >
                          <EidaIcon name="paper" size={18} />
                          <span>
                            Download official battery STEP
                            <small>
                              {demoReferenceAssets.cad.author} ·{" "}
                              {demoReferenceAssets.cad.license}
                            </small>
                          </span>
                        </a>
                      )}
                    </div>
                  )}
                  <ul className="evidence-source-list">
                    {graphEvidence.map((item) => (
                      <li key={item.id}>
                        <strong>{item.kind}</strong>
                        <span>{item.label}</span>
                        <small>
                          {item.confidence !== undefined
                            ? `${Math.round(item.confidence * 100)}% confidence`
                            : (item.locator ?? item.sourceId ?? item.id)}
                        </small>
                      </li>
                    ))}
                    {componentEvidence.map((item) => (
                      <li key={item.id}>
                        <strong>{item.kind}</strong>
                        <span>{item.description}</span>
                        {item.sourceId.startsWith("https://") ? (
                          <a
                            href={item.sourceId}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open source
                          </a>
                        ) : (
                          <small>{item.locator ?? item.sourceId}</small>
                        )}
                      </li>
                    ))}
                  </ul>
                  {graphPart && (
                    <div className="property-evidence-map">
                      {Object.entries(graphPart.evidence).map(
                        ([property, ids]) => (
                          <div key={property}>
                            <span>{property}</span>
                            <strong>{ids.length} linked</strong>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </>
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

      {workflowOpen && !isDemo && !setupOpen && (
        <ProjectWorkflow
          projectId={PROJECT_ID}
          deviceLabel={projectTitle}
          selectedSources={approvedSources}
          excludedSourceCount={excludedSourceCount}
          photoCount={photoCount}
          observedParts={activeRun?.observations?.observations ?? []}
          onPhotoCountChange={setPhotoCount}
          onManageSources={() => {
            setSourcesOpen(true);
          }}
          onOpenDemo={() => {
            setWorkflowOpen(false);
            showProject("demo");
          }}
          onApplyManifest={applyAssemblyManifest}
          onClose={() => setWorkflowOpen(false)}
        />
      )}

      {!restoringProject && setupOpen && (
        <DeviceSetup
          canClose={Boolean(baseProject || activeRun || isDemo)}
          existingDevice={baseProject?.device}
          photoCount={photoCount}
          error={setupError}
          onClose={() => {
            setSetupOpen(false);
            if (baseProject && !isDemo) setWorkflowOpen(true);
          }}
          onKnownDevice={chooseKnownDevice}
          onUnknownDevice={chooseUnknownDevice}
          onOpenDemo={() => {
            showProject("demo");
            setSetupOpen(false);
          }}
        />
      )}
      {sourcesOpen && !isDemo && (
        <SourceManager
          deviceLabel={projectTitle}
          currentSources={researchSources}
          onSourcesChange={setResearchSources}
          onClose={() => {
            setSourcesOpen(false);
            setWorkflowOpen(true);
          }}
          onPrepareReconstruction={prepareReconstruction}
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
              <EidaIcon name="close" size={15} />
            </button>
          </div>
          <ul>
            {analysis.observations.map((observation, index) => (
              <li key={`${observation.label}-${index}`}>
                <strong>{observation.label}</strong>
                <span>{observation.description}</span>
                <small>
                  {observation.visibility} - photo{" "}
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
