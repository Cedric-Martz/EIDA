import Image from "next/image";
import { EidaIcon } from "@/components/ui/eida-icon";
import styles from "./eida-documentation.module.css";

const iconPath = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg`;

const installCommand = `git clone https://github.com/Cedric-Martz/EIDA.git
cd EIDA
npm install
cp .env.example .env.local
npm run dev`;

const workerInstall = `git clone https://github.com/facebookresearch/map-anything.git
cd map-anything
python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e .
pip install -r ../EIDA/services/mapanything-worker/requirements.txt`;

const workerStart = `cd ../EIDA/services/mapanything-worker
export MAPANYTHING_REPO=/absolute/path/to/map-anything
export EIDA_PUBLIC_BASE_URL=http://localhost:8001
export EIDA_ALLOWED_ORIGINS=http://localhost:3000
uvicorn app:app --host 127.0.0.1 --port 8001`;

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
            <a href="#mapanything">Worker MapAnything</a>
            <a href="#studio">Studio setup</a>
            <a href="#pipeline">Workflow</a>
            <a href="#troubleshooting">Troubleshooting</a>
          </nav>
          <div className={styles.sideStatus}>
            <i aria-hidden="true" />
            <span>
              <strong>Local-first setup</strong>
              Meta Model API + your own worker
            </span>
          </div>
        </aside>

        <article className={styles.content}>
          <section className={styles.intro} id="overview">
            <p className={styles.eyebrow}>Documentation / v1</p>
            <h1>Build traceable 3D assemblies from device photos.</h1>
            <p>
              EIDA uses the Meta Model API to structure evidence and segment
              components. An optional MapAnything worker aligns multiple views
              in a shared metric scene.
            </p>
            <div className={styles.badges}>
              <span>3-8 photos</span>
              <span>Meta models</span>
              <span>Apache MapAnything</span>
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
                <span>Reconstruction worker</span>
                <strong>MapAnything</strong>
                <p>Multi-view alignment on infrastructure you control.</p>
              </div>
              <div>
                <span>Browser</span>
                <strong>EIDA Graph</strong>
                <p>GLB compilation, validation, storage, and rendering.</p>
              </div>
            </div>
          </section>

          <section className={styles.section} id="mapanything">
            <div className={styles.sectionTitle}>
              <span>03</span>
              <div>
                <p>Optional metric pass</p>
                <h2>Start the MapAnything worker</h2>
              </div>
            </div>
            <p>
              The EIDA wrapper calls the official MapAnything script and uses
              the Apache-licensed <code>facebook/map-anything-apache</code>
              checkpoint. CUDA is recommended; CPU mode remains available for
              asynchronous runs.
            </p>
            <h3>A. Install the model and wrapper</h3>
            <CodeBlock>{workerInstall}</CodeBlock>
            <h3>B. Start the local service</h3>
            <CodeBlock>{workerStart}</CodeBlock>
            <h3>C. Check availability</h3>
            <CodeBlock>{`curl http://localhost:8001/health`}</CodeBlock>
            <p>
              The response must contain <code>&quot;ready&quot;: true</code>.
              The
              <code>device</code> field reports either <code>cuda</code> or the
              <code>cpu</code> fallback.
            </p>
            <div className={styles.links}>
              <a href="https://github.com/facebookresearch/map-anything">
                Official MapAnything repository
                <EidaIcon name="external" size={15} />
              </a>
              <a href="https://huggingface.co/facebook/map-anything-apache">
                Apache checkpoint <EidaIcon name="external" size={15} />
              </a>
            </div>
          </section>

          <section className={styles.section} id="studio">
            <div className={styles.sectionTitle}>
              <span>04</span>
              <div>
                <p>Studio setup</p>
                <h2>Connect the worker in EIDA</h2>
              </div>
            </div>
            <ol className={styles.steps}>
              <li>
                <span>1</span>
                <p>
                  Open a project, select the sources, and add three to eight
                  complementary views.
                </p>
              </li>
              <li>
                <span>2</span>
                <p>
                  Open <strong>Meta reconstruction</strong>, then enable
                  <strong> Add metric multi-view registration</strong>.
                </p>
              </li>
              <li>
                <span>3</span>
                <p>
                  Use <code>http://localhost:8001</code> and select
                  <strong> Connect MapAnything</strong>.
                </p>
              </li>
              <li>
                <span>4</span>
                <p>
                  Start the reconstruction. MapAnything runs alongside Muse and
                  SAM while the component graph is prepared.
                </p>
              </li>
            </ol>
            <div className={styles.callout}>
              <strong>Remote worker</strong>
              Use an HTTPS URL, restrict CORS origins, and set
              <code>EIDA_WORKER_TOKEN</code>. The token stays in the session.
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
              <EidaIcon name="plus" size={16} />
              <div>
                <b>04</b>
                <span>Map</span>
                <small>metric scene</small>
              </div>
              <EidaIcon name="arrow-right" size={16} />
              <div>
                <b>05</b>
                <span>EIDA</span>
                <small>graph + GLB</small>
              </div>
            </div>
            <p>
              EIDA tracks the MapAnything job and stores its status in
              IndexedDB. The resulting GLB and report are linked to the graph as
              spatial evidence. If the worker becomes unavailable, EIDA
              completes the local SAM path and reports the fallback.
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
              <summary>The worker returns ready: false</summary>
              <p>
                Check <code>MAPANYTHING_REPO</code>, the PyTorch installation,
                and the presence of
                <code>scripts/demo_images_only_inference.py</code>.
              </p>
            </details>
            <details>
              <summary>The browser blocks the request</summary>
              <p>
                Add the exact EIDA origin to
                <code>EIDA_ALLOWED_ORIGINS</code>. Remote URLs must use HTTPS;
                HTTP is accepted only on localhost.
              </p>
            </details>
            <details>
              <summary>CPU processing takes too long</summary>
              <p>
                Reduce the input to four clear views or use a GPU worker.
                Results already produced by Muse and SAM are kept during the
                fallback.
              </p>
            </details>
            <details>
              <summary>Where are generated files stored?</summary>
              <p>
                The worker stores GLB files and reports in
                <code>services/mapanything-worker/.data/artifacts</code>.
                Temporary photos are deleted when the job finishes.
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
