# EIDA specifications

## Goal

From multiple photographs and selected technical documents, create an interactive, component-based 3D exploded view of an electronic device with auditable evidence and visible uncertainty. Evidences aims to be pictures you made, or from a web search from the AI from user's given informations.

## Current usable slice

The static interface opens on a presentation page, then lets the user deliberately enter a selectable synthetic 3D fixture. The workbench starts with its secondary panels closed. Users can place its six parts in deterministic slots, drag them across the grid, inspect an exploded layout, and trigger a staggered reconstruction animation. A scene drawer accepts 3–8 browser-stored photos. The fixture is deliberately marked as unverified and is not the result of image inference. Model confirmation, controlled-document import, consent for remote inference and live analysis are not currently implemented.

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
