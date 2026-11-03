# EIDA

**Evidence-based Intelligence for Disassembly & Analysis.** EIDA turns reviewed repair sources and device photographs into an auditable, interactive 3D exploded view.

The application is local-first and uses a single reconstruction studio. The same screen contains Meta access, approved sources, photo intake, dimensions, processing stages and the final launch button. A local Next.js server handles the provider proxy.

## Reconstruction path

1. The local research route searches iFixit and the live web for the exact variant, including manuals, internal photographs, specifications, drawings and downloadable 3D/CAD assets. Matching results are enabled by default so the user can remove false positives.
2. The user reviews those sources and adds 3-16 complementary photographs.
3. The local server extracts approved HTTPS pages, dimensions, up to 32 public-source images and links to technical files.
4. **Muse Spark 1.3** reads up to 48 visual inputs and proposes as many evidence-supported components as possible, bounded to 24 per run.
5. **SAM 3.1** returns a pixel mask for each component from its clearest user or public-source image.
6. **Muse geometry reconciliation** compares viewpoints, replaces perspective-distorted masks with canonical primitives where appropriate, and keeps corrected profiles for genuinely irregular parts.
7. **EIDA local geometry** converts each accepted mask into an individual editable recipe and GLB asset.
8. **EIDA validation** assembles the parts and reports spatial diagnostics before opening the viewer.

This produces canonical component recipes from visible evidence and keeps inferred dimensions, hidden faces and placement clearly labelled unless the project includes measurements or CAD assets.

## Quick start

Node.js 22+ and npm 10+ are recommended.

```bash
npm install
cp .env.example .env.local
```

Add a Meta Model API key to `.env.local`:

```text
MODEL_API_KEY=your_key_here
```

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create or reopen a project, then click **Meta reconstruction**. Alternatively, leave `.env.local` empty and paste the key into the studio; it can be retained only for the current browser tab.

For a deterministic presentation with no model call, open
[http://localhost:3000/?demo=reference](http://localhost:3000/?demo=reference).
The reference demo uses a Framework Laptop 13, three attributed Creative
Commons photographs and an official Framework battery STEP. Asset authors,
licenses, source URLs and checksums are recorded in
`public/demo/framework-laptop-13/ATTRIBUTION.md`.

Do not expose the development server to the public internet. Production-like local use is available with `npm run build && npm start`.

## Runtime and services

- Muse and SAM calls use the configured Meta Model API account.
- Contour processing, GLB generation, assembly validation, storage and rendering run on the local computer.
- General web search uses Muse Spark 1.3 search grounding through the server-side Meta key; iFixit's public API remains an additional provider.
- Standard Muse is selected by default. The contributor/training-sharing variant is an explicit choice and remains subject to Meta's current terms.
- Without a valid Meta Model API key, the evidence viewer and licensed reference demo remain available, but live inventory and segmentation are disabled.

## What works

- Guided source discovery and approval, including exclusion of mismatched variants.
- Local photo storage and removal through IndexedDB.
- One-page workflow configuration and live per-stage status.
- Official `@meta-sam/parser` decoding of streamed SAM 3.1 masks.
- Local GLB generation from real mask outlines.
- Broad web/manual/CAD discovery with reviewable sources and default inclusion.
- Assembly, exploded and workbench layouts with keyboard, mouse and touch navigation.
- Evidence/fidelity labels and deterministic spatial diagnostics.
- Versioned Zod schemas, local persistence and unit tests.
- A deterministic Framework Laptop 13 reference demo built from attributed Creative Commons photographs, official specifications and official open CAD.

## Local operation and deployment

```bash
npm run check
```

## Current limitations

- The extractor reads HTML/text pages, downloads selected source images for segmentation and indexes PDF/CAD/archive links. PDF text and OCR are not implemented.
- A complete, high-confidence three-value dimension found in approved text can set the device envelope automatically. Otherwise the envelope is a user-confirmed estimate.
- Muse can inspect up to 16 local photos and 32 extracted public-source images. Each accepted component still requires a separate SAM call.
- Masks provide visible 2D outlines, not hidden surfaces, reliable depth, material properties, fasteners, or measured CAD. Extrusion, placement and thickness remain estimates unless documented.
- The local route has no accounts, durable server database, shared quota, billing enforcement, background queue or production authentication. It is for local/restricted use, not a public multi-user service.
- Browser IndexedDB can be cleared or evicted. Export and backup are not yet a complete archival workflow.

## Privacy and fidelity

Photos remain in IndexedDB until the user explicitly accepts the per-run consent. Up to 16 selected photos, 32 public-source images and the approved evidence snapshot are then sent through the local server for Muse inventory, SAM segmentation and Muse geometry reconciliation; final graph and asset compilation stays local. A session key is kept only in `sessionStorage`, while an `.env.local` key stays server-side.

EIDA does not claim that it can see through a device. Visible masks are evidence; inferred depth and transforms remain labelled estimates. See [the evaluation protocol](docs/evaluation.md), [product scope](docs/product.md), [security policy](SECURITY.md) and [privacy notes](docs/privacy.md).

## License

Original source code is MIT licensed. Third-party documentation, photographs, trademarks and model assets are not relicensed by this repository.
