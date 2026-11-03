# EIDA specifications

## Goal

From multiple photographs and selected technical documents, create an interactive, component-based 3D exploded view of an electronic device with auditable evidence. Sources can include user photographs and reviewed public material found from the device information provided.

## Current usable slice

The local interface opens on a presentation page, then starts a real evidence project instead of silently inventing parts. It searches iFixit and the general web for the exact variant, including manuals, internal photos, drawings and 3D/CAD assets. Matching sources are enabled by default but remain removable. The user adds 3-16 browser-stored photos; Muse can inspect those plus extracted source images before SAM 3.1 segments each accepted component. A second Muse pass compares viewpoints and reconciles perspective-distorted masks into canonical primitives or corrected profiles. EIDA writes the results into a validated `.eida.json` reconstruction graph before local compilation. A confirmed identity is context, never automatic proof of a component.

After a BYOK connection test and explicit per-run consent, the approved source snapshot and combined user/source images can be processed through the local Meta proxy. Muse inventory, SAM masks and the multi-view geometry plan are validated before the reconstruction graph is generated. Each graph part preserves its canonical recipe, pose, fidelity, property-level evidence and explicit assumptions. The graph is persisted locally, can be downloaded, and is deterministically compiled into the assembly consumed by the viewer.

The workbench auto-fits the camera and packs parts from their physical bounds. Its inspector exposes graph dimensions, position, assumptions, relations and property-level evidence. Spatial diagnostics can isolate their affected parts, highlight them in the scene and apply a bounded first-pass adjustment before recompilation.

## Primary user

Curious smartphone user exploring electronics for repair, reuse or responsible collection.

## Primary research device

Samsung Galaxy Tab 4 SM-T530. This is a **reference model**, not a claim that all internal parts are already documented or measurable.

## MVP acceptance scenario

1. Capture 3-16 images on Galaxy A32 5G.
2. Confirm model identity or leave it unknown.
3. Discover, review and approve public repair sources.
4. Extract their readable text, dimensions, images and technical-file links.
5. Obtain a structured, evidence-grounded component proposal from Muse Spark.
6. Obtain SAM masks for visible, segmentable parts.
7. Produce and validate an editable EIDA Reconstruction Graph.
8. Compile the graph into independently manipulable 3D parts.
9. Show evidence, source links, dimensions and assumptions for each component.
10. Keep unsupported depth, hidden geometry and materials explicitly estimated/unknown.

## Runtime and services

The local machine performs extraction orchestration, contour processing, GLB generation, validation, storage and rendering. Muse and SAM use the configured Meta Model API account.

## Current limitations

- HTML/text extraction and controlled ASCII STEP/DXF bounds parsing are
  supported. PDF text, OCR, full B-rep tessellation, binary/proprietary CAD and
  automatic multi-view registration are not.
- Approved CAD links are downloaded to memory only, limited to three files per
  source and 12 MB per file, fingerprinted with SHA-256, then discarded after
  parsing.
- A complete documented dimension can set scale, but image contours cannot establish depth, hidden surfaces, exact placement, material, fastener geometry or mechanical fit.
- The current workflow is sequential and bounded to 48 visual inputs and 24 inventory items. Failed provider calls do not become fabricated success.
- The local server has no accounts, shared quota, durable backend persistence or production-grade multi-user isolation.
- GitHub Pages is a documentation and reference-demo target only, not the live reconstruction deployment.

## Explicit non-goals

Exact hidden geometry, fully automatic CAD, AR alignment, robotic disassembly, battery extraction advice, chemical/material assay, certified recycling advice, public multi-user SaaS.

## Research claim

Evidence-aware reconstruction can reduce unsupported component claims at comparable coverage versus an ungrounded multimodal baseline. Must be measured, not assumed.

## Cut order

Drop advanced mesh generation, GLB export and recovery location lookup before cutting evidence display or the working 3D viewer. Keep the bounded evidence extraction and local viewer usable without paid services.
