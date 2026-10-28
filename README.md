# EIDA

**Evidence-based Intelligence for Disassembly & Analysis.** An open-source research prototype that turns observations and controlled sources into interactive 3D exploded views while keeping every claim auditable.

> **Current status:** The static 3D experience, local browser storage, and browser-owned Meta connection settings are functional. Multimodal analysis, PDF extraction, and SAM reconstruction are not connected yet. The included parts are synthetic demonstration shapes, **not** verified Samsung SM-T530 components.

## What works

- A presentation landing page with an explicit transition into the 3D workbench.
- The Three.js workbench is code-split and downloaded only after the user opens the prototype, keeping the landing page bundle lightweight.
- Import of 3–8 photographs from a drawer overlaid on the scene.
- Local photograph persistence in IndexedDB, including restoration and deletion.
- A light maker-workbench 3D environment with a cutting-mat grid, studio lighting, and six selectable, isolatable, and separable parametric parts.
- Full 3D navigation on touch and desktop: orbit, pan (two-finger touch or right-drag), and zoom.
- Keyboard 3D navigation: WASD or arrow keys to pan, Q/E to orbit, +/- to zoom, and 0 to reset the camera.
- Three animated layouts: aligned on the workbench, exploded for inspection, and reconstructed as an assembly.
- Direct part dragging on the workbench, with one-click tidy-up and staggered reconstruction.
- An accessible component list, HTML toolbar, contextual exploded-view slider, desktop side inspector, and mobile bottom sheet. Secondary panels start closed to keep the manipulation surface clear.
- A provenance panel that displays evidence status, estimated geometry, and evidence count in text.
- Reduced-quality mode with WebGL DPR limited to 1, shadows disabled, and backdrop blur removed.
- A versioned Zod project model, deterministic invariants, and unit tests.
- Fully static export with no API route or server database in the current version.
- Bring Your Own Key (BYOK) configuration for Meta Model API, with the key kept in memory by default or optionally in `sessionStorage`.
- CI, architecture decision records, research protocol, security policy, and prioritized backlog.

## Quick start

Node.js 22+ and npm 10+ are recommended.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on the same machine. **Do not expose the development server to the public internet.**

The application interface, source comments, repository documentation, issue planning, and accessibility labels use English as the project language.

Run the complete validation suite with:

```bash
npm run check
```

`package-lock.json` is committed, and CI uses `npm ci`.

## Hardware scope

- Research reference: Samsung Galaxy Tab 4 10.1 **SM-T530**.
- Mobile browser test device: Samsung Galaxy A32 5G **SM-A326B/DS**.
- No real teardown, component dimensions, or repair procedure has been verified in this repository yet.

## Static build

The production build generates a fully static site in `out/`:

```bash
npm run build
```

The output can be hosted on any static web host. When deploying under a repository subpath such as GitHub Pages, configure the appropriate Next.js `basePath` at build time.

The included GitHub Pages workflow derives that path automatically from `GITHUB_REPOSITORY`. In the repository settings, choose **GitHub Actions** as the Pages source; every push to `main` then validates, exports, and deploys the site.

## Meta Model API and BYOK

Users can enter their own Meta Model API key, select a supported or custom model identifier, and test the connection directly from the browser. EIDA never ships a shared provider key. The test calls `GET /v1/models`; photograph analysis, document grounding, segmentation, and model-generated reconstruction remain unimplemented and unverified. See [Meta integration](docs/meta-integration.md).

Browser-side BYOK is intended for informed users on a trusted device. A shared application key, managed billing, accounts, quotas, or a multi-user production service still require a protected backend.

The current interaction, physics and rendering audit is documented in [the 2026-10-28 project review](docs/project-review-2026-10-28.md).

## Research

EIDA does not claim that it can see through devices. See the [research protocol](docs/evaluation.md) and [product scope](docs/product.md).

## Security and privacy

Images remain on-device in IndexedDB. Browser storage may be evicted and is not a backup. Any future transfer to a model provider must require explicit consent. See [SECURITY.md](SECURITY.md) and [privacy documentation](docs/privacy.md).

## License

The original source code is licensed under MIT. Third-party documentation, photographs, trademarks, and model assets are **not** relicensed by this repository.
