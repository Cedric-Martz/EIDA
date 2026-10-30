"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { demoAssemblyManifest } from "@/domain/reconstruction/demo-assembly";
import { demoProject } from "@/domain/reconstruction/demo-project";
import type { SceneMode } from "@/features/viewer/device-viewer";
import styles from "./github-showcase.module.css";

const DeviceViewer = dynamic(
  () =>
    import("@/features/viewer/device-viewer").then(
      (module) => module.DeviceViewer,
    ),
  { ssr: false },
);

const steps = [
  ["01", "Ground", "Approve sources and identify the exact device variant."],
  [
    "02",
    "Observe",
    "Add complementary photographs and keep uncertain claims visible.",
  ],
  ["03", "Extract", "Read documented dimensions, images and technical links."],
  ["04", "Reconstruct", "Muse proposes parts; SAM 3.1 finds visible outlines."],
  [
    "05",
    "Inspect",
    "EIDA builds local GLB silhouettes and validates the assembly.",
  ],
] as const;

export function GithubShowcase() {
  const [explode, setExplode] = useState(0.58);
  const [mode, setMode] = useState<SceneMode>("exploded");
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.logo} href="#top" aria-label="EIDA home">
          <span>E</span> EIDA
        </a>
        <nav aria-label="Documentation">
          <a href="#process">Process</a>
          <a href="#guide">Guide</a>
          <a href="#limits">Limits</a>
          <a className={styles.headerCta} href="#demo">
            Try the demo
          </a>
        </nav>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            Evidence-based Intelligence for Disassembly &amp; Analysis
          </p>
          <h1>
            Make the invisible <em>inspectable.</em>
          </h1>
          <p className={styles.lede}>
            EIDA turns reviewed repair evidence and device photographs into an
            interactive exploded view, while keeping provenance, estimates and
            missing information in plain sight.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primary} href="#demo">
              Explore the 3D demo <span>↓</span>
            </a>
            <a className={styles.secondary} href="#guide">
              Read the instructions
            </a>
          </div>
          <div className={styles.heroFacts}>
            <span>Local-first</span>
            <span>Evidence-grounded</span>
            <span>No rented GPU</span>
          </div>
        </div>
        <div className={styles.heroOrb} aria-hidden="true">
          <div className={styles.orbRing} />
          <div className={styles.orbCore}>EIDA</div>
          <i />
          <i />
          <i />
        </div>
      </section>

      <section className={styles.statement}>
        <p className={styles.eyebrow}>The idea</p>
        <h2>
          Not a magic mesh generator.
          <br />
          <span>A traceable reconstruction process.</span>
        </h2>
        <p>
          Models can suggest. Sources can document. Geometry can estimate. EIDA
          keeps those roles separate so a beautiful 3D result never pretends to
          be measured CAD.
        </p>
      </section>

      <section className={styles.process} id="process">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>One continuous trace</p>
          <h2>
            From evidence
            <br />
            to assembly.
          </h2>
        </div>
        <div className={styles.stepList}>
          {steps.map(([number, title, body]) => (
            <article key={number} className={styles.step}>
              <span className={styles.stepNumber}>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.demoSection} id="demo">
        <div className={styles.demoIntro}>
          <p className={styles.eyebrow}>
            Synthetic fixture · no API key required
          </p>
          <h2>Pull the device apart.</h2>
          <p>
            This fixture is intentionally separate from evidence projects. Use
            it to understand the viewer controls before running a local
            reconstruction with your own photos and Meta credits.
          </p>
          <label className={styles.slider}>
            <span>
              <b>Explode assembly</b>
              <output>{Math.round(explode * 100)}%</output>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={explode}
              onChange={(event) => setExplode(Number(event.target.value))}
            />
          </label>
          <div
            className={styles.modeButtons}
            role="group"
            aria-label="Demo view mode"
          >
            {(["bench", "exploded", "assembled"] as const).map((nextMode) => (
              <button
                key={nextMode}
                type="button"
                aria-pressed={mode === nextMode}
                onClick={() => setMode(nextMode)}
              >
                {nextMode}
              </button>
            ))}
          </div>
          <p className={styles.controls}>
            Drag to orbit · scroll to zoom · click a part to inspect it
          </p>
        </div>
        <div className={styles.viewerFrame}>
          <DeviceViewer
            components={demoProject.components}
            assembly={demoAssemblyManifest}
            explode={explode}
            mode={mode}
            arrangeKey={0}
            selected={selected}
            isolated={false}
            showGrid
            reducedGraphics={false}
            resetKey={0}
            onSelect={(id) => setSelected(id || null)}
            onReady={() => undefined}
          />
          <div className={styles.viewerLabel}>EIDA / DEVICE FIXTURE / 001</div>
        </div>
      </section>

      <section className={styles.guide} id="guide">
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Quick start</p>
          <h2>
            Run your own
            <br />
            reconstruction.
          </h2>
        </div>
        <ol>
          <li>
            <b>Start locally.</b> Use Node.js 22+, run <code>npm install</code>,
            then <code>npm run dev</code>.
          </li>
          <li>
            <b>Prepare evidence.</b> Review public repair sources, exclude
            mismatched variants, and add 3–8 complementary photographs.
          </li>
          <li>
            <b>Connect Meta.</b> Put <code>MODEL_API_KEY</code> in{" "}
            <code>.env.local</code>, or enter a session key in the studio.
          </li>
          <li>
            <b>Give consent and launch.</b> The local server extracts approved
            source text, dimensions, image links and technical-file links before
            Muse and SAM run.
          </li>
          <li>
            <b>Inspect uncertainty.</b> Review masks, diagnostics and fidelity
            labels before trusting any part or dimension.
          </li>
        </ol>
      </section>

      <section className={styles.limits} id="limits">
        <p className={styles.eyebrow}>Honest boundaries</p>
        <h2>Useful without pretending.</h2>
        <div className={styles.limitGrid}>
          <p>
            <b>Local and unpaid infrastructure.</b> Contours, GLB generation,
            validation, storage and rendering run on your computer. There is no
            hosted GPU, search API, database or cloud storage in the current
            path.
          </p>
          <p>
            <b>Provider credits are still required.</b> Live Muse and SAM calls
            use the configured Meta account. Without credits or a key, this
            documentation and synthetic demo still work, but live reconstruction
            does not.
          </p>
          <p>
            <b>Evidence is not x-ray vision.</b> PDF/CAD contents, OCR, hidden
            surfaces, materials, exact depth, automatic multi-view registration
            and measured mechanical fit are not implemented.
          </p>
          <p>
            <b>GitHub Pages is the showcase.</b> It hosts this documentation and
            fixture only. The live workflow needs a local Next.js server and
            must not expose a shared provider key.
          </p>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>EIDA / open-source research prototype</span>
        <a href="https://github.com/Cedric-Martz/EIDA">View the repository ↗</a>
      </footer>
    </main>
  );
}
