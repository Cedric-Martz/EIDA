"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { demoAssemblyManifest } from "@/domain/reconstruction/demo-assembly";
import { demoProject } from "@/domain/reconstruction/demo-project";
import type { SceneMode } from "@/features/viewer/device-viewer";
import styles from "./github-showcase.module.css";

const iconPath = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg`;

const DeviceViewer = dynamic(
  () =>
    import("@/features/viewer/device-viewer").then(
      (module) => module.DeviceViewer,
    ),
  { ssr: false },
);

const chapters = [
  {
    index: "01",
    label: "Observe",
    title: "Les photos deviennent des vues reliées.",
    body: "SAM 3.1 isole les composants. MapAnything aligne jusqu’à huit vues et restitue une référence spatiale métrique.",
  },
  {
    index: "02",
    label: "Structure",
    title: "Les modèles proposent, EIDA organise.",
    body: "Muse transforme les sources approuvées en inventaire. Chaque contour, dimension et relation rejoint un graphe EIDA éditable.",
  },
  {
    index: "03",
    label: "Inspect",
    title: "L’assemblage reste traçable.",
    body: "Le compilateur produit les pièces GLB, vérifie leur placement et conserve les preuves qui ont construit la scène.",
  },
] as const;

function ScrollReconstruction() {
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const scrollRoot = section.closest(`.${styles.page}`);
    if (!(scrollRoot instanceof HTMLElement)) return;

    const update = () => {
      frameRef.current = null;
      const bounds = section.getBoundingClientRect();
      const range = Math.max(bounds.height - window.innerHeight, 1);
      setProgress(Math.min(1, Math.max(0, -bounds.top / range)));
    };
    const schedule = () => {
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(update);
      }
    };
    update();
    scrollRoot.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      scrollRoot.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const active = Math.min(chapters.length - 1, Math.floor(progress * 3));
  const mode: SceneMode =
    progress < 0.2 ? "bench" : progress > 0.82 ? "assembled" : "exploded";
  const explode =
    progress < 0.2
      ? progress / 0.2
      : progress > 0.68
        ? Math.max(0, 1 - (progress - 0.68) / 0.32)
        : 1;

  return (
    <section className={styles.story} id="process" ref={sectionRef}>
      <div className={styles.storySticky}>
        <div className={styles.storyCanvas} aria-hidden="true">
          <DeviceViewer
            components={demoProject.components}
            assembly={demoAssemblyManifest}
            explode={explode}
            mode={mode}
            arrangeKey={0}
            selected={null}
            isolated={false}
            showGrid={mode === "bench"}
            reducedGraphics={false}
            resetKey={0}
            interactive={false}
            onSelect={() => undefined}
            onReady={() => undefined}
          />
          <div className={styles.canvasHud}>
            <span>SCROLL-DRIVEN / NO CONTROLS</span>
            <span>{mode.toUpperCase()}</span>
          </div>
        </div>
        <div className={styles.storyCopy}>
          <span className={styles.kicker}>
            {chapters[active].index} · {chapters[active].label}
          </span>
          <h2>{chapters[active].title}</h2>
          <p>{chapters[active].body}</p>
          <div className={styles.progress} aria-hidden="true">
            <i style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>
      </div>
      <div className={styles.storyTrack} aria-hidden="true">
        {chapters.map((chapter) => (
          <div key={chapter.index} />
        ))}
      </div>
    </section>
  );
}

export function GithubShowcase() {
  return (
    <main className={styles.page} id="top">
      <header className={styles.header}>
        <a className={styles.logo} href="#top" aria-label="EIDA accueil">
          <Image src={iconPath} alt="" width={34} height={34} priority />
          <span>EIDA</span>
        </a>
        <nav aria-label="Navigation principale">
          <a href="#process">Fonctionnement</a>
          <a href="./documentation/">Documentation</a>
          <a
            className={styles.repoLink}
            href="https://github.com/Cedric-Martz/EIDA"
          >
            GitHub ↗
          </a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Evidence-based 3D reconstruction</p>
          <h1>
            Des photos.
            <br />
            Une structure <em>inspectable.</em>
          </h1>
          <p className={styles.lede}>
            EIDA combine les modèles Meta avec un graphe 3D ouvert pour passer
            de vues utilisateur à un assemblage électronique documenté.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href="./documentation/">
              Installer EIDA <span>→</span>
            </a>
            <a className={styles.secondary} href="#process">
              Voir le pipeline ↓
            </a>
          </div>
        </div>
        <div className={styles.heroSignal} aria-hidden="true">
          <span>PHOTO</span>
          <i />
          <span>MAP</span>
          <i />
          <span>GRAPH</span>
          <i />
          <span>GLB</span>
        </div>
      </section>

      <section className={styles.promise} aria-label="Pipeline EIDA">
        <span>SAM 3.1</span>
        <span>MapAnything</span>
        <span>Muse Spark</span>
        <span>.eida.json</span>
      </section>

      <ScrollReconstruction />

      <section className={styles.architecture}>
        <div>
          <p className={styles.kicker}>Deux moteurs, un seul parcours</p>
          <h2>
            Les crédits Meta pour comprendre. Le worker libre pour mesurer.
          </h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>Meta Model API</strong>
              <p>Muse organise les preuves et SAM 3.1 extrait les pièces.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>MapAnything Apache</strong>
              <p>
                Un worker local ou GPU gratuit aligne les vues en parallèle.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>EIDA Graph</strong>
              <p>
                Les résultats deviennent des recettes 3D éditables et reliées.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className={styles.finalCta}>
        <Image src={iconPath} alt="" width={72} height={72} />
        <p className={styles.kicker}>Prêt à reconstruire ?</p>
        <h2>Le guide complet tient sur une page.</h2>
        <a href="./documentation/">Ouvrir la documentation →</a>
      </section>

      <footer className={styles.footer}>
        <span>EIDA · Open source</span>
        <a href="#top">Retour en haut ↑</a>
      </footer>
    </main>
  );
}
