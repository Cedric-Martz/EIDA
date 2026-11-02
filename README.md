# EIDA

**Evidence-based Intelligence for Disassembly & Analysis.** EIDA turns reviewed repair sources and device photographs into an auditable, interactive 3D exploded view.

The application is local-first and uses a single reconstruction studio. The same screen contains Meta access, approved sources, photo intake, dimensions, processing stages and the final launch button. A local Next.js server handles the provider proxy.

## Reconstruction path

1. The user discovers sources, excludes mismatched variants, approves the remaining links and adds 3-8 complementary photographs.
2. The local server fetches the approved public HTTPS pages, extracts relevant text, documented dimensions, source images and links to technical files, then sends that evidence snapshot to Muse.
3. **Muse Spark 1.3** reads the approved context and up to six photos to produce a conservative part inventory and a SAM prompt for each part.
4. **SAM 3.1** returns pixel masks for those visible parts through the Meta Model API, one accepted part at a time.
5. **MapAnything Apache (optional)** receives 3-8 views through a local or free-compute worker, registers their cameras and exports a metric scene GLB in parallel.
6. **EIDA local geometry** simplifies the actual mask contours, scales them from the known device envelope, extrudes them and exports GLB assets in the browser.
7. **EIDA validation** links the metric scene as spatial evidence, assembles the editable parts and reports spatial diagnostics before opening the viewer.

This produces component silhouettes from visible evidence and keeps inferred depth, hidden faces and placement clearly labelled unless the project includes measurements or CAD assets.

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

For metric multi-view registration, follow the worker setup in [`services/mapanything-worker`](services/mapanything-worker/README.md), start it on port 8001, then enable **Add metric multi-view registration** in the reconstruction studio.

Do not expose the development server to the public internet. Production-like local use is available with `npm run build && npm start`.

## Runtime and services

- Muse and SAM calls use the configured Meta Model API account.
- Contour processing, GLB generation, assembly validation, storage and rendering run on the local computer.
- No search API, hosted database or cloud storage is required. MapAnything is optional and runs on a worker you control.
- Standard Muse is selected by default. The contributor/training-sharing variant is an explicit choice and remains subject to Meta's current terms.
- The former `services/meta-pipeline` and `services/research-worker` contracts are optional research material; they are not required by this workflow.
- Without a valid Meta Model API key, the evidence viewer and synthetic demo remain available, but live inventory and segmentation are disabled.

## What works

- Guided source discovery and approval, including exclusion of mismatched variants.
- Local photo storage and removal through IndexedDB.
- One-page workflow configuration and live per-stage status.
- Official `@meta-sam/parser` decoding of streamed SAM 3.1 masks.
- Local GLB generation from real mask outlines.
- Optional asynchronous MapAnything scene reconstruction with health checking, job polling, artifact links and automatic local fallback.
- Assembly, exploded and workbench layouts with keyboard, mouse and touch navigation.
- Evidence/fidelity labels and deterministic spatial diagnostics.
- Versioned Zod schemas, local persistence and unit tests.
- A synthetic demo that remains explicitly separate from evidence projects.

## Local operation and deployment

```bash
npm run check
```

## Current limitations

- The extractor reads HTML/text pages and indexes images and links to PDF/CAD/archive files. PDF text, image downloads and document OCR are not implemented. MapAnything now provides an optional registered metric scene, but per-component fitting still comes from the editable EIDA graph.
- A complete, high-confidence three-value dimension found in approved text can set the device envelope automatically. Otherwise the envelope is a user-confirmed estimate.
- Muse and SAM can only use the first six local photos for the current launch. The browser sends the approved photos and the evidence snapshot to the configured Meta account.
- Masks provide visible 2D outlines, not hidden surfaces, reliable depth, material properties, fasteners, or measured CAD. Extrusion, placement and thickness remain estimates unless documented.
- The local route has no accounts, durable server database, shared quota, billing enforcement, background queue or production authentication. It is for local/restricted use, not a public multi-user service.
- Browser IndexedDB can be cleared or evicted. Export and backup are not yet a complete archival workflow.

## Privacy and fidelity

Photos remain in IndexedDB until the user explicitly accepts the per-run consent. Up to six selected photos and the approved evidence snapshot are then sent through the local server to Meta for Muse/SAM processing; generated GLB geometry stays local. A session key is kept only in `sessionStorage`, while an `.env.local` key stays server-side.

EIDA does not claim that it can see through a device. Visible masks are evidence; inferred depth and transforms remain labelled estimates. See [the evaluation protocol](docs/evaluation.md), [product scope](docs/product.md), [security policy](SECURITY.md) and [privacy notes](docs/privacy.md).

## License

Original source code is MIT licensed. Third-party documentation, photographs, trademarks and model assets are not relicensed by this repository.
