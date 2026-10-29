# EIDA specifications

## Goal

From multiple photographs and selected technical documents, create an interactive, component-based 3D exploded view of an electronic device with auditable evidence and visible uncertainty. Evidences aims to be pictures you made, or from a web search from the AI from user's given informations.

## Current usable slice

The static interface opens on a presentation page, then starts a real evidence project instead of silently loading synthetic parts. The user can confirm a known manufacturer/model or leave the identity unknown and begin with photographs. The workspace explains the next step, accepts 3–8 browser-stored photos, and exposes AI configuration only as the continuation of that evidence flow. A confirmed identity is context, never automatic proof of a component.

After a BYOK connection test and explicit per-action consent, exactly three photos can be analyzed by Meta Model API. Validated observations are resolved into a local evidence graph with estimated primitives or unknown placeholders. The viewer restores the latest project or successful run and keeps the six-part fixture behind a clearly labelled demo action. On the workbench, enlarged hit targets, immediate pointer tracking, temporary camera locking and bounded placement improve part manipulation on pointer and touch devices. Controlled-document import, online evidence discovery and SAM segmentation are not currently implemented.

## Primary user

Curious smartphone user exploring electronics for repair, reuse or responsible collection.

## Primary research device

Samsung Galaxy Tab 4 SM-T530. This is a **reference model**, not a claim that all internal parts are already documented or measurable.

## MVP acceptance scenario

1. Capture 3–8 images on Galaxy A32 5G.
2. Confirm model identity.
3. Import/approve a technical source.
4. Obtain a structured component proposal from Muse Spark.
5. Show at least five independently manipulable 3D objects.
6. Show evidence and uncertainty for each component.
7. Request another photo when an important claim cannot be supported.
8. Offer safe, non-specific reuse/collection guidance.

## Explicit non-goals

Exact hidden geometry, fully automatic CAD, AR alignment, robotic disassembly, battery extraction advice, chemical/material assay, certified recycling advice, public multi-user SaaS.

## Research claim

Evidence-aware reconstruction can reduce unsupported component claims at comparable coverage versus an ungrounded multimodal baseline. Must be measured, not assumed.

## Cut order

Drop automatic web discovery, advanced mesh generation, GLB export, and recovery location lookup before cutting evidence display or the working 3D viewer.
