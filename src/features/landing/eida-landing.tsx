"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./eida-landing.module.css";

const storySteps = [
  {
    number: "01",
    status: "Available now",
    kicker: "Ground",
    title: "Give Meta AI evidence, not a guess.",
    body: "Name the device, review public repair sources, then add 3–8 complementary photographs. Llama or Muse turns only the approved material into a cited part inventory.",
    detail: "Approved sources · local photo intake · Llama / Muse",
    visualTitle: "Grounded inventory",
    visualDetail: "Sources stay attached",
  },
  {
    number: "02",
    status: "Available now",
    kicker: "Separate",
    title: "Find the real outline of each part.",
    body: "SAM 3.1 segments the housing, boards, battery, connectors and fasteners from the clearest approved view. Every returned mask remains visible before geometry is generated.",
    detail: "SAM 3.1 masks · reviewable contours",
    visualTitle: "Parts isolated",
    visualDetail: "Views aligned by features",
  },
  {
    number: "03",
    status: "Runs locally",
    kicker: "Reconstruct",
    title: "Turn real contours into geometry.",
    body: "EIDA simplifies the SAM masks, scales them from the reference dimensions and extrudes local GLB parts on your computer. No rented GPU or external worker is required.",
    detail: "Local CPU · GLB silhouettes · fidelity labels",
    visualTitle: "Evidence-shaped assets",
    visualDetail: "Estimated scale stays labelled",
  },
  {
    number: "04",
    status: "Interactive delivery",
    kicker: "Assemble",
    title: "Turn the meshes into a device.",
    body: "Muse proposes the inventory; EIDA creates the assembly transforms, checks envelopes and overlaps, then loads the GLB parts in an inspectable assembly.",
    detail: "Assembly manifest · spatial checks · PBR viewer",
    visualTitle: "Validated assembly",
    visualDetail: "Every artifact is inspectable",
  },
] as const;

const guideSteps = [
  {
    number: "1",
    title: "Create the project evidence",
    body: "Enter the exact device variant, approve the relevant repair sources and add 3–8 clear views. The first three are used for the current reconstruction run.",
  },
  {
    number: "2",
    title: "Connect your Meta credits",
    body: "Open Meta reconstruction and add the hackathon Model API key, or place it in the local .env file. The studio checks Muse Spark and SAM 3.1 from the same screen.",
  },
  {
    number: "3",
    title: "Launch one traceable job",
    body: "Confirm the device dimensions, then launch. Photos leave the browser only after consent; all four stages and generated masks update on the same page.",
  },
  {
    number: "4",
    title: "Inspect the result",
    body: "Review the masks and spatial warnings, then arrange, explode and rebuild the locally generated GLB parts in the workbench.",
  },
] as const;

function DeviceStack({ stage = 0 }: { stage?: number }) {
  return (
    <div className={styles.deviceScene} data-stage={stage} aria-hidden="true">
      <div className={styles.sceneHalo} />
      <div className={`${styles.deviceLayer} ${styles.rearShell}`}>
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className={`${styles.deviceLayer} ${styles.battery}`}>
        <span>Li-ion</span>
        <small>ESTIMATED</small>
      </div>
      <div className={`${styles.deviceLayer} ${styles.board}`}>
        <i className={styles.boardChip} />
        <i className={styles.boardPort} />
        <i className={styles.boardTrace} />
        <i className={styles.boardTrace} />
        <i className={styles.boardTrace} />
      </div>
      <div className={`${styles.deviceLayer} ${styles.display}`}>
        <span />
      </div>
      <div className={`${styles.deviceLayer} ${styles.frontGlass}`} />
      <div className={styles.evidenceNode} data-node="photo">
        <span>01</span> Photo
      </div>
      <div className={styles.evidenceNode} data-node="claim">
        <span>02</span> Claim
      </div>
      <div className={styles.evidenceNode} data-node="part">
        <span>03</span> Part
      </div>
    </div>
  );
}

export function EidaLanding({
  onEnter,
  onOpenDemo,
}: {
  onEnter: () => void;
  onOpenDemo?: () => void;
}) {
  const pageRef = useRef<HTMLElement>(null);
  const [activeStory, setActiveStory] = useState(0);
  const openDemo = onOpenDemo ?? onEnter;

  useEffect(() => {
    const root = pageRef.current;
    if (!root || !("IntersectionObserver" in window)) return;

    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-story-step]"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const centeredEntry = entries.find((entry) => entry.isIntersecting);
        if (!centeredEntry) return;

        const nextIndex = Number(
          (centeredEntry.target as HTMLElement).dataset.storyStep,
        );
        if (Number.isInteger(nextIndex)) setActiveStory(nextIndex);
      },
      {
        root,
        rootMargin: "-38% 0px -38% 0px",
        threshold: 0,
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const currentStep = storySteps[activeStory];

  return (
    <main ref={pageRef} className={styles.page} id="top">
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>

      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label="EIDA home">
          <span className={styles.brandMark} aria-hidden="true">
            E
          </span>
          <span className={styles.brandName}>EIDA</span>
          <span className={styles.brandTag}>Research prototype</span>
        </a>
        <nav className={styles.nav} aria-label="Landing page">
          <a href="#method">How it works</a>
          <a href="#guide">Guide</a>
          <button type="button" onClick={openDemo}>
            <span>Demo</span>
            Open workbench
          </button>
        </nav>
      </header>

      <div id="main-content">
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroGrid} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              <span>Open-source</span>
              Evidence-based Intelligence for Disassembly &amp; Analysis
            </p>
            <h1 id="landing-title">
              Don&apos;t just see <em>the parts.</em>
              <br />
              See <strong>why they are there.</strong>
            </h1>
            <p className={styles.heroLede}>
              EIDA combines Muse Spark and SAM 3.1 with local geometry tools to
              turn reviewed device evidence into inspectable 3D parts—without a
              rented GPU, while keeping uncertainty and provenance visible.
            </p>
            <div className={styles.heroActions}>
              <button
                type="button"
                className={styles.primaryCta}
                onClick={openDemo}
                aria-describedby="demo-disclaimer"
              >
                <span>
                  <small>Interactive demo</small>
                  Open the 3D workbench
                </span>
                <b aria-hidden="true">↗</b>
              </button>
              <a className={styles.secondaryCta} href="#guide">
                Read the quick guide <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className={styles.demoNote} id="demo-disclaimer">
              <span aria-hidden="true">●</span>
              The live studio runs locally. Meta hosts Muse and SAM; your
              computer creates and displays the GLB geometry.
            </p>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.visualChrome}>
              <span>Evidence workspace</span>
              <span>01 — 04</span>
            </div>
            <DeviceStack stage={3} />
            <div className={styles.heroReadout}>
              <span>STATUS</span>
              <strong>Traceable / estimated</strong>
              <small>Geometry confidence is shown in the interface</small>
            </div>
          </div>

          <a className={styles.scrollCue} href="#method">
            <span aria-hidden="true">↓</span>
            Scroll to follow the evidence
          </a>
        </section>

        <section className={styles.promise} aria-label="EIDA principles">
          <p>Source before certainty.</p>
          <span aria-hidden="true" />
          <p>Confidence before polish.</p>
          <span aria-hidden="true" />
          <p>Inspection before instruction.</p>
        </section>

        <section
          className={styles.story}
          id="method"
          aria-labelledby="method-title"
        >
          <div className={styles.storyIntro}>
            <p className={styles.sectionIndex}>01 / How it works</p>
            <h2 id="method-title">
              One object.
              <br />
              Four Meta-powered stages.
            </h2>
            <p>
              Follow the job from reviewed evidence to an interactive assembly.
              Each model has a specific role and exposes its artifacts.
            </p>
          </div>

          <div className={styles.storyLayout}>
            <figure className={styles.stickyVisual}>
              <div className={styles.stickyTopline}>
                <span>
                  Layer {currentStep.number} / {storySteps.length}
                </span>
                <span className={styles.signal}>
                  <i aria-hidden="true" /> Live prototype
                </span>
              </div>
              <DeviceStack stage={activeStory} />
              <figcaption>
                <span>{currentStep.visualTitle}</span>
                <strong>{currentStep.visualDetail}</strong>
              </figcaption>
            </figure>

            <div className={styles.storySteps}>
              {storySteps.map((step, index) => (
                <article
                  className={`${styles.storyCard} ${
                    activeStory === index ? styles.storyCardActive : ""
                  }`}
                  data-story-step={index}
                  key={step.number}
                >
                  <div className={styles.cardTopline}>
                    <span>{step.number}</span>
                    <span>{step.status}</span>
                  </div>
                  <p className={styles.cardKicker}>{step.kicker}</p>
                  <h3>{step.title}</h3>
                  <p className={styles.cardBody}>{step.body}</p>
                  <p className={styles.cardDetail}>
                    <span aria-hidden="true">↳</span> {step.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.boundary} aria-labelledby="boundary-title">
          <div className={styles.boundaryHeading}>
            <p className={styles.sectionIndex}>02 / Honest boundaries</p>
            <h2 id="boundary-title">
              Hosted intelligence. Local geometry and control.
            </h2>
            <p>
              The local app keeps source review, photo storage, geometry and the
              3D viewer together. Meta&apos;s hosted Muse and SAM models return
              understanding and masks; EIDA converts them into versioned GLB
              parts without a rented GPU.
            </p>
          </div>
          <div className={styles.boundaryGrid}>
            <article className={styles.nowCard}>
              <div className={styles.boundaryLabel}>
                <span>Now</span>
                <small>Runs on GitHub Pages</small>
              </div>
              <h3>Private project workspace</h3>
              <ul>
                <li>Local device identity and photo intake</li>
                <li>Direct public iFixit guide discovery</li>
                <li>Open, select, exclude, add or remove source links</li>
                <li>Browser storage with explicit upload consent</li>
                <li>One-page Meta reconstruction job monitoring</li>
                <li>Textured GLB/PBR assembly viewer</li>
              </ul>
            </article>
            <article className={styles.nextCard}>
              <div className={styles.boundaryLabel}>
                <span>Local application</span>
                <small>Meta credits + your CPU</small>
              </div>
              <h3>Evidence-shaped reconstruction</h3>
              <ul>
                <li>Muse Spark grounded part inventory</li>
                <li>SAM 3.1 masks and contours</li>
                <li>Local contour simplification and extrusion</li>
                <li>GLB generation without an external worker</li>
                <li>Versioned manifests, artifacts and spatial reports</li>
              </ul>
            </article>
          </div>
          <aside className={styles.boundaryCallout}>
            <span aria-hidden="true">!</span>
            <p>
              <strong>Reconstruction is not metrology.</strong> Image masks can
              recover visible outlines, but hidden faces and absolute dimensions
              remain estimated unless the project includes measurements or CAD.
              EIDA keeps that fidelity visible.
            </p>
          </aside>
        </section>

        <section
          className={styles.guide}
          id="guide"
          aria-labelledby="guide-title"
        >
          <div className={styles.guideHeading}>
            <p className={styles.sectionIndex}>03 / Quick guide</p>
            <h2 id="guide-title">Reconstruct without losing the evidence.</h2>
            <p>
              The whole path now lives in one workflow: prepare inputs, connect
              compute, follow each model and inspect the returned artifacts.
            </p>
          </div>
          <ol className={styles.guideList}>
            {guideSteps.map((step) => (
              <li key={step.number}>
                <span>{step.number}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className={styles.controlsCard}>
            <div>
              <span className={styles.controlsEyebrow}>3D navigation</span>
              <h3>Made for a mouse, keyboard or touch screen.</h3>
            </div>
            <dl>
              <div>
                <dt>Orbit</dt>
                <dd>Drag · Q / E</dd>
              </div>
              <div>
                <dt>Pan</dt>
                <dd>Right-drag · WASD · two fingers</dd>
              </div>
              <div>
                <dt>Zoom</dt>
                <dd>Wheel · pinch · + / −</dd>
              </div>
              <div>
                <dt>Reset</dt>
                <dd>0 · toolbar reset</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="final-cta-title">
          <div className={styles.finalOrb} aria-hidden="true">
            <span>E</span>
          </div>
          <p className={styles.sectionIndex}>Ready to inspect?</p>
          <h2 id="final-cta-title">
            Take the prototype apart.
            <br />
            Keep the evidence together.
          </h2>
          <button type="button" onClick={openDemo}>
            <span>
              <small>Interactive demo</small>
              Open the EIDA workbench
            </span>
            <b aria-hidden="true">↗</b>
          </button>
          <p>
            No account required · Local browser project · Synthetic demo clearly
            labelled
          </p>
        </section>
      </div>

      <footer className={styles.footer}>
        <a className={styles.brand} href="#top" aria-label="Back to top">
          <span className={styles.brandMark} aria-hidden="true">
            E
          </span>
          <span className={styles.brandName}>EIDA</span>
        </a>
        <p>Evidence-based Intelligence for Disassembly &amp; Analysis</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
