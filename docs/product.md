# EIDA specifications

## Goal

From multiple photographs and selected technical documents, create an interactive, component-based 3D exploded view of an electronic device with auditable evidence and visible uncertainty. Evidences aims to be pictures you made, or from a web search from the AI from user's given informations.

## Current usable slice

The local interface opens on a presentation page, then starts a real evidence project instead of silently loading synthetic parts. The user discovers and reviews public repair sources, excludes mismatched variants, confirms a known manufacturer/model or leaves the identity unknown, and adds 3–8 browser-stored photos. The launch first extracts the approved web pages, dimensions, images and technical-file links; it then gives that snapshot plus up to six photos to Muse, sends one accepted part at a time to SAM 3.1, and builds/validates local GLB silhouettes. A confirmed identity is context, never automatic proof of a component.

After a BYOK connection test and explicit per-run consent, the approved source snapshot and up to six photos can be processed through the local Meta proxy. Muse inventory and SAM masks are validated before local geometry is generated. The viewer restores the latest project or successful run and keeps the six-part fixture behind a clearly labelled demo action. On the workbench, enlarged hit targets, immediate pointer tracking, temporary camera locking and bounded placement improve part manipulation on pointer and touch devices.

## Primary user

Curious smartphone user exploring electronics for repair, reuse or responsible collection.

## Primary research device

Samsung Galaxy Tab 4 SM-T530. This is a **reference model**, not a claim that all internal parts are already documented or measurable.

## MVP acceptance scenario

1. Capture 3–8 images on Galaxy A32 5G.
2. Confirm model identity or leave it unknown.
3. Discover, review and approve public repair sources.
4. Extract their readable text, dimensions, images and technical-file links.
5. Obtain a structured, evidence-grounded component proposal from Muse Spark.
6. Obtain SAM masks for visible, segmentable parts.
7. Show independently manipulable estimated 3D silhouettes.
8. Show evidence, source links, dimensions and uncertainty for each component.
9. Keep unsupported depth, hidden geometry and materials explicitly estimated/unknown.

## Material and service constraints

The project is intentionally built without paid infrastructure. It does not pay for a search provider, hosted GPU, photogrammetry service, CAD conversion service, database, object storage, queue or production monitoring. Live Muse/SAM usage depends on credits and access supplied by the user or hackathon account. The local machine performs extraction orchestration, contour processing, GLB generation, validation, storage and rendering.

## Current limitations

- HTML/text extraction is supported; PDF text, OCR, CAD parsing, technical-file download and automatic multi-view registration are not.
- A complete documented dimension can set scale, but image contours cannot establish depth, hidden surfaces, exact placement, material, fastener geometry or mechanical fit.
- The current workflow is sequential and bounded to six photos and ten inventory items. Failed provider calls do not become synthetic success.
- The local server has no accounts, shared quota, durable backend persistence or production-grade multi-user isolation.
- GitHub Pages is a documentation and synthetic-demo target only, not the live reconstruction deployment.

## Explicit non-goals

Exact hidden geometry, fully automatic CAD, AR alignment, robotic disassembly, battery extraction advice, chemical/material assay, certified recycling advice, public multi-user SaaS.

## Research claim

Evidence-aware reconstruction can reduce unsupported component claims at comparable coverage versus an ungrounded multimodal baseline. Must be measured, not assumed.

## Cut order

Drop advanced mesh generation, GLB export and recovery location lookup before cutting evidence display or the working 3D viewer. Keep the bounded evidence extraction and local viewer usable without paid services.
