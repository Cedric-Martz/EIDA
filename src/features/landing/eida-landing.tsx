"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { EidaIcon } from "@/components/ui/eida-icon";
import { META_MODEL_LABELS } from "@/config/meta-models";
import styles from "./eida-landing.module.css";

const storySteps = [
  {
    number: "01",
    status: "Available now",
    kicker: "Ground",
    title: "Give information about the device.",
    body: "Name the exact device variant, review general-web, manual and CAD results, then add complementary photographs. Muse turns the approved evidence into a cited part inventory.",
    detail: `Reviewed sources - up to 48 visuals - ${META_MODEL_LABELS.inventory}`,
    visualTitle: "Grounded inventory",
    visualDetail: "Sources stay attached",
  },
  {
    number: "02",
    status: "Available now",
    kicker: "Separate",
    title: "Find the real outline of each part.",
    body: `${META_MODEL_LABELS.segmentation} segments each component from its clearest user or public-source image. Every returned mask remains visible before geometry is generated.`,
    detail: `${META_MODEL_LABELS.segmentation} masks - reviewable contours`,
    visualTitle: "Parts isolated",
    visualDetail: "Views aligned by features",
  },
  {
    number: "03",
    status: "Built locally",
    kicker: "Reconstruct",
    title: "Rebuild the device, layer by layer.",
    body: "EIDA turns the approved contours and reference dimensions into local GLB parts, assembles them and checks their spatial relationships.",
    detail: "Local geometry - assembly checks - PBR viewer",
    visualTitle: "Validated assembly",
    visualDetail: "Every artifact is inspectable",
  },
] as const;

const guideSteps = [
  {
    number: "1",
    title: "Create the project evidence",
    body: "Enter the exact device variant, approve the relevant repair sources and add clear, complementary views.",
  },
  {
    number: "2",
    title: "Connect the Meta models",
    body: `Open Meta reconstruction and add your Model API key. The studio checks ${META_MODEL_LABELS.inventory} and ${META_MODEL_LABELS.segmentation} from the same screen.`,
  },
  {
    number: "3",
    title: "Build and inspect",
    body: "Launch the reconstruction, follow each stage, then explore the generated parts and their assembly in the workbench.",
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
        <small>MAPPED</small>
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
            <Image src="/icon.svg" alt="" width={38} height={38} priority />
          </span>
          <span className={styles.brandName}>EIDA</span>
          <span className={styles.brandTag}>Open-source 3D intelligence</span>
        </a>
        <nav className={styles.nav} aria-label="Landing page">
          <a href="#method">How it works</a>
          <a href="#guide">Guide</a>
          <a href="https://cedric-martz.github.io/EIDA/documentation">
            Documentation
          </a>
          <button type="button" onClick={openDemo}>
            <span>Reference demo</span>
            Open Framework 13
          </button>
        </nav>
      </header>

      <div id="main-content">
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroGrid} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <h1 id="landing-title">
              Evidence-based Intelligence for Disassembly & Analysis.
            </h1>
            <p className={styles.heroLede}>
              EIDA combines {META_MODEL_LABELS.inventory} and{" "}
              {META_MODEL_LABELS.segmentation} to turn reviewed device evidence
              into an inspectable 3D assembly, directly in your workspace.
            </p>
            <div className={styles.heroActions}>
              <button
                type="button"
                className={styles.primaryCta}
                onClick={openDemo}
                aria-describedby="demo-disclaimer"
              >
                <span>
                  <small>Licensed reference dataset</small>
                  Explore the Framework 13 demo
                </span>
                <EidaIcon name="external" size={30} />
              </button>
              <a className={styles.secondaryCta} href="#guide">
                Read the quick guide <EidaIcon name="arrow-down" size={16} />
              </a>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.heroVisualScene} aria-hidden="true"></div>
            <DeviceStack stage={3} />
          </div>

          <a className={styles.scrollCue} href="#method">
            <EidaIcon name="arrow-down" size={16} />
          </a>
        </section>

        <section className={styles.promise} aria-label="EIDA principles">
          <p>Sources stay connected.</p>
          <span aria-hidden="true" />
          <p>Contours become parts.</p>
          <span aria-hidden="true" />
          <p>Scroll reveals the assembly.</p>
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
              Three connected stages.
            </h2>
            <p>
              Scroll from reviewed evidence to a complete assembly. The 3D view
              follows the story automatically.
            </p>
          </div>

          <div className={styles.storyLayout}>
            <figure className={styles.stickyVisual}>
              <div className={styles.stickyTopline}>
                <span>
                  Layer {currentStep.number} / {storySteps.length}
                </span>
                <span className={styles.signal}>
                  <i aria-hidden="true" /> Scroll-driven view
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
                    <EidaIcon name="arrow-right" size={15} /> {step.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className={styles.guide}
          id="guide"
          aria-labelledby="guide-title"
        >
          <div className={styles.guideHeading}>
            <p className={styles.sectionIndex}>02 / Quick guide</p>
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
        </section>

        <section className={styles.finalCta} aria-labelledby="final-cta-title">
          <div className={styles.finalOrb} aria-hidden="true">
            <Image src="/icon.svg" alt="" width={88} height={88} />
          </div>
          <p className={styles.sectionIndex}>Ready to inspect?</p>
          <h2 id="final-cta-title">
            See the device come apart.
            <br />
            Keep the evidence together.
          </h2>
          <button type="button" onClick={openDemo}>
            <span>Explore the reference reconstruction</span>
            <EidaIcon name="external" size={20} />
          </button>
        </section>
      </div>

      <footer className={styles.footer}>
        <a className={styles.brand} href="#top" aria-label="Back to top">
          <span className={styles.brandMark} aria-hidden="true">
            <Image src="/icon.svg" alt="" width={38} height={38} />
          </span>
          <span className={styles.brandName}>EIDA</span>
        </a>
        <p>Evidence-based Intelligence for Disassembly &amp; Analysis</p>
        <a href="#top">
          Back to top <EidaIcon name="arrow-up" size={14} />
        </a>
      </footer>
    </main>
  );
}
