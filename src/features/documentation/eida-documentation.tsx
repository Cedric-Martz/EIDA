import Image from "next/image";
import { EidaIcon } from "@/components/ui/eida-icon";
import styles from "./eida-documentation.module.css";

const iconPath = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg`;

const installCommand = `git clone https://github.com/Cedric-Martz/EIDA.git
cd EIDA
npm install
cp .env.example .env.local
npm run dev`;

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className={styles.code} tabIndex={0}>
      <code>{children}</code>
    </pre>
  );
}

export function EidaDocumentation() {
  return (
    <main className={styles.page} id="top">
      <header className={styles.header}>
        <a className={styles.logo} href="../" aria-label="Back to EIDA">
          <Image src={iconPath} alt="" width={32} height={32} priority />
          <span>EIDA</span>
        </a>
        <span>Documentation</span>
        <a href="https://github.com/Cedric-Martz/EIDA">
          GitHub <EidaIcon name="external" size={14} />
        </a>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <p>Get started</p>
          <nav aria-label="Documentation contents">
            <a href="#overview">Overview</a>
            <a href="#quick-start">Install EIDA</a>
            <a href="#meta">Meta setup</a>
            <a href="#studio">Studio setup</a>
            <a href="#pipeline">Workflow</a>
            <a href="#troubleshooting">Troubleshooting</a>
          </nav>
          <div className={styles.sideStatus}>
            <i aria-hidden="true" />
            <span>
              <strong>Meta Model API + local geometry</strong>
            </span>
          </div>
        </aside>

        <article className={styles.content}>
          <section className={styles.intro} id="overview">
            <p className={styles.eyebrow}>Documentation / v1</p>
            <h1>Build traceable 3D assemblies from device photos.</h1>
            <p>
              EIDA searches public technical evidence, uses the Meta Model API
              to identify and segment components, then compiles editable 3D
              geometry locally.
            </p>
            <div className={styles.badges}>
              <span>3-16 photos</span>
              <span>Muse Spark 1.3 + SAM 3.1</span>
              <span>Web, manuals and CAD</span>
              <span>Local-first</span>
            </div>
          </section>

          <section className={styles.section} id="quick-start">
            <div className={styles.sectionTitle}>
              <span>01</span>
              <div>
                <p>Local application</p>
                <h2>Install EIDA</h2>
              </div>
            </div>
            <CodeBlock>{installCommand}</CodeBlock>
            <div className={styles.callout}>
              <strong>Then open</strong>
              <code>http://localhost:3000</code>
            </div>
          </section>

          <section className={styles.section} id="meta">
            <div className={styles.sectionTitle}>
              <span>02</span>
              <div>
                <p>Meta Model API</p>
                <h2>Connect the Meta Model API</h2>
              </div>
            </div>
            <p>
              Add the key to the server-only <code>.env.local</code> file. It is
              used for Muse and SAM requests:
            </p>
            <CodeBlock>{`MODEL_API_KEY=your_meta_model_api_key`}</CodeBlock>
            <div className={styles.costGrid}>
              <div>
                <span>Meta Model API</span>
                <strong>Muse + SAM</strong>
                <p>Parts inventory, prompts, segmentation, and masks.</p>
              </div>
              <div>
                <span>Research</span>
                <strong>Live web + technical files</strong>
                <p>Manuals, internal photos, drawings, dimensions and CAD.</p>
              </div>
              <div>
                <span>Browser</span>
                <strong>EIDA Graph</strong>
                <p>GLB compilation, validation, storage, and rendering.</p>
              </div>
            </div>
          </section>

          <section className={styles.section} id="studio">
            <div className={styles.sectionTitle}>
              <span>04</span>
              <div>
                <p>Studio setup</p>
                <h2>Prepare evidence in EIDA</h2>
              </div>
            </div>
            <ol className={styles.steps}>
              <li>
                <span>1</span>
                <p>
                  Identify the exact device variant. EIDA searches iFixit and
                  the wider web for manuals, photos, drawings and 3D files.
                </p>
              </li>
              <li>
                <span>2</span>
                <p>
                  Review the automatically enabled results and remove or
                  unapprove anything that belongs to another variant.
                </p>
              </li>
              <li>
                <span>3</span>
                <p>
                  Add 3 to 16 complementary user photos. Public-source images
                  are added automatically after extraction.
                </p>
              </li>
              <li>
                <span>4</span>
                <p>
                  Start reconstruction. Muse builds up to 24 evidence-supported
                  elements and SAM extracts the clearest available outline for
                  each one.
                </p>
              </li>
            </ol>
            <div className={styles.callout}>
              <strong>Visual budget</strong>
              One run can inspect up to 16 user photos and 32 public-source
              images. The official Muse request limit is 50 images.
            </div>
          </section>

          <section className={styles.section} id="pipeline">
            <div className={styles.sectionTitle}>
              <span>05</span>
              <div>
                <p>Automated workflow</p>
                <h2>What happens after Start</h2>
              </div>
            </div>
            <div className={styles.pipeline}>
              <div>
                <b>01</b>
                <span>Sources</span>
                <small>extract</small>
              </div>
              <EidaIcon name="arrow-right" size={16} />
              <div>
                <b>02</b>
                <span>Muse</span>
                <small>inventory</small>
              </div>
              <EidaIcon name="arrow-right" size={16} />
              <div>
                <b>03</b>
                <span>SAM</span>
                <small>outlines</small>
              </div>
              <EidaIcon name="arrow-right" size={16} />
              <div>
                <b>04</b>
                <span>EIDA</span>
                <small>graph + GLB</small>
              </div>
            </div>
            <p>
              Every accepted mask becomes an editable graph element with its own
              geometry recipe and GLB asset. Dimensions from parsed STEP or DXF
              files constrain scale when they can be tied to the exact
              component.
            </p>
          </section>

          <section className={styles.section} id="troubleshooting">
            <div className={styles.sectionTitle}>
              <span>06</span>
              <div>
                <p>Quick checks</p>
                <h2>Troubleshooting</h2>
              </div>
            </div>
            <details>
              <summary>General web results are missing</summary>
              <p>
                Check <code>MODEL_API_KEY</code>. The local research route uses
                Muse Spark 1.3 search grounding; the static GitHub Pages build
                falls back to direct iFixit search.
              </p>
            </details>
            <details>
              <summary>Processing takes too long</summary>
              <p>
                Remove duplicate or low-value sources. More source images can
                improve coverage but each accepted component requires its own
                SAM segmentation call.
              </p>
            </details>
            <details>
              <summary>Where are generated files stored?</summary>
              <p>
                Projects, photos and reconstruction graphs stay in browser
                IndexedDB. The downloadable <code>.eida.json</code> graph
                contains the individual compiled GLB assets.
              </p>
            </details>
          </section>

          <footer className={styles.footer}>
            <a href="../">
              <EidaIcon name="arrow-left" size={14} /> Landing page
            </a>
            <a href="#top">
              Back to top <EidaIcon name="arrow-up" size={14} />
            </a>
          </footer>
        </article>
      </div>
    </main>
  );
}
