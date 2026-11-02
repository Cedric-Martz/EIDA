import Image from "next/image";
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
        <a className={styles.logo} href="../" aria-label="Retour à EIDA">
          <Image src={iconPath} alt="" width={32} height={32} priority />
          <span>EIDA</span>
        </a>
        <span>Documentation</span>
        <a href="https://github.com/Cedric-Martz/EIDA">GitHub ↗</a>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <p>Commencer</p>
          <nav aria-label="Sommaire de la documentation">
            <a href="#overview">Vue d’ensemble</a>
            <a href="#quick-start">Installation EIDA</a>
            <a href="#meta">Crédits Meta</a>
            <a href="#mapanything">Worker MapAnything</a>
            <a href="#studio">Dans le studio</a>
            <a href="#pipeline">Automatisation</a>
            <a href="#troubleshooting">Dépannage</a>
          </nav>
          <div className={styles.sideStatus}>
            <i aria-hidden="true" />
            <span>
              <strong>Mode sans dépense</strong>
              Meta credits + local/free compute
            </span>
          </div>
        </aside>

        <article className={styles.content}>
          <section className={styles.intro} id="overview">
            <p className={styles.eyebrow}>Documentation / v1</p>
            <h1>Reconstruire avec les crédits Meta et MapAnything.</h1>
            <p>
              EIDA utilise Meta Model API pour comprendre les preuves et
              segmenter les composants. Le worker MapAnything ajoute en option
              l’alignement multi-vues et une scène métrique, sans consommer les
              crédits de l’API.
            </p>
            <div className={styles.badges}>
              <span>3–8 photos</span>
              <span>Meta models</span>
              <span>Apache MapAnything</span>
              <span>Local-first</span>
            </div>
          </section>

          <section className={styles.section} id="quick-start">
            <div className={styles.sectionTitle}>
              <span>01</span>
              <div>
                <p>Application locale</p>
                <h2>Installer EIDA</h2>
              </div>
            </div>
            <p>
              Node.js 22 et npm 10 sont recommandés. GitHub Pages présente le
              projet ; la reconstruction complète s’exécute localement pour ne
              jamais exposer la clé Meta dans un site statique.
            </p>
            <CodeBlock>{installCommand}</CodeBlock>
            <div className={styles.callout}>
              <strong>Ouvrir ensuite</strong>
              <code>http://localhost:3000</code>
            </div>
          </section>

          <section className={styles.section} id="meta">
            <div className={styles.sectionTitle}>
              <span>02</span>
              <div>
                <p>Meta Model API</p>
                <h2>Utiliser les 150 $ au bon endroit</h2>
              </div>
            </div>
            <p>
              La clé finance Muse et SAM 3.1. Elle ne finance pas un GPU
              MapAnything. Ajoutez-la côté serveur dans <code>.env.local</code>{" "}
              :
            </p>
            <CodeBlock>{`MODEL_API_KEY=your_meta_model_api_key`}</CodeBlock>
            <div className={styles.costGrid}>
              <div>
                <span>Crédits Meta</span>
                <strong>Muse + SAM 3.1</strong>
                <p>Inventaire, prompts, segmentation et masques.</p>
              </div>
              <div>
                <span>Calcul libre</span>
                <strong>MapAnything</strong>
                <p>GPU personnel, session gratuite ou CPU de secours.</p>
              </div>
              <div>
                <span>Navigateur</span>
                <strong>EIDA Graph</strong>
                <p>Compilation GLB, validation, stockage et rendu.</p>
              </div>
            </div>
          </section>

          <section className={styles.section} id="mapanything">
            <div className={styles.sectionTitle}>
              <span>03</span>
              <div>
                <p>Passage métrique optionnel</p>
                <h2>Démarrer le worker MapAnything</h2>
              </div>
            </div>
            <p>
              Le wrapper EIDA appelle directement le script officiel MapAnything
              et sélectionne le checkpoint commercialement permissif{" "}
              <code>facebook/map-anything-apache</code>. CUDA est recommandé ;
              le mode CPU reste disponible pour un essai asynchrone.
            </p>
            <h3>A. Installer le modèle et le wrapper</h3>
            <CodeBlock>{workerInstall}</CodeBlock>
            <h3>B. Lancer le service local</h3>
            <CodeBlock>{workerStart}</CodeBlock>
            <h3>C. Vérifier la disponibilité</h3>
            <CodeBlock>{`curl http://localhost:8001/health`}</CodeBlock>
            <p>
              La réponse doit contenir <code>&quot;ready&quot;: true</code>. Le
              champ
              <code>device</code> indique <code>cuda</code> ou le fallback
              <code>cpu</code>.
            </p>
            <div className={styles.links}>
              <a href="https://github.com/facebookresearch/map-anything">
                Dépôt officiel MapAnything ↗
              </a>
              <a href="https://huggingface.co/facebook/map-anything-apache">
                Checkpoint Apache ↗
              </a>
            </div>
          </section>

          <section className={styles.section} id="studio">
            <div className={styles.sectionTitle}>
              <span>04</span>
              <div>
                <p>Configuration visuelle</p>
                <h2>Connecter le worker dans EIDA</h2>
              </div>
            </div>
            <ol className={styles.steps}>
              <li>
                <span>1</span>
                <p>
                  Ouvrez un projet, sélectionnez des sources et ajoutez entre
                  trois et huit vues complémentaires.
                </p>
              </li>
              <li>
                <span>2</span>
                <p>
                  Ouvrez <strong>Meta reconstruction</strong>, puis activez
                  <strong> Add metric multi-view registration</strong>.
                </p>
              </li>
              <li>
                <span>3</span>
                <p>
                  Utilisez <code>http://localhost:8001</code> et cliquez sur
                  <strong> Connect MapAnything</strong>.
                </p>
              </li>
              <li>
                <span>4</span>
                <p>
                  Lancez la reconstruction. MapAnything travaille en parallèle
                  pendant que Muse et SAM préparent les composants.
                </p>
              </li>
            </ol>
            <div className={styles.callout}>
              <strong>Worker distant gratuit</strong>
              Utilisez une URL HTTPS, limitez les origines CORS et définissez
              <code>EIDA_WORKER_TOKEN</code>. Le token reste dans la session.
            </div>
          </section>

          <section className={styles.section} id="pipeline">
            <div className={styles.sectionTitle}>
              <span>05</span>
              <div>
                <p>Orchestration automatique</p>
                <h2>Ce qui se passe après « Start »</h2>
              </div>
            </div>
            <div className={styles.pipeline}>
              <div>
                <b>01</b>
                <span>Sources</span>
                <small>extraction</small>
              </div>
              <i>→</i>
              <div>
                <b>02</b>
                <span>Muse</span>
                <small>inventaire</small>
              </div>
              <i>→</i>
              <div>
                <b>03</b>
                <span>SAM</span>
                <small>contours</small>
              </div>
              <i>+</i>
              <div>
                <b>04</b>
                <span>Map</span>
                <small>scène métrique</small>
              </div>
              <i>→</i>
              <div>
                <b>05</b>
                <span>EIDA</span>
                <small>graph + GLB</small>
              </div>
            </div>
            <p>
              Le job MapAnything est suivi automatiquement et enregistré dans
              IndexedDB. Son GLB et son rapport sont liés au graphe comme preuve
              spatiale. Si le worker devient indisponible après le lancement,
              EIDA termine avec la voie locale SAM et affiche le fallback
              utilisé.
            </p>
          </section>

          <section className={styles.section} id="troubleshooting">
            <div className={styles.sectionTitle}>
              <span>06</span>
              <div>
                <p>Vérifications rapides</p>
                <h2>Dépannage</h2>
              </div>
            </div>
            <details>
              <summary>Le worker répond « ready: false »</summary>
              <p>
                Vérifiez <code>MAPANYTHING_REPO</code>, l’installation PyTorch
                et la présence du script
                <code>scripts/demo_images_only_inference.py</code>.
              </p>
            </details>
            <details>
              <summary>Le navigateur bloque la requête</summary>
              <p>
                Ajoutez exactement l’origine d’EIDA dans
                <code>EIDA_ALLOWED_ORIGINS</code>. Toute URL distante doit être
                en HTTPS ; HTTP est accepté uniquement sur localhost.
              </p>
            </details>
            <details>
              <summary>Le calcul CPU prend trop longtemps</summary>
              <p>
                Réduisez le jeu à quatre vues nettes ou utilisez une session GPU
                gratuite. Les résultats déjà produits par Muse et SAM sont
                conservés pendant le fallback.
              </p>
            </details>
            <details>
              <summary>Où sont les fichiers produits ?</summary>
              <p>
                Le worker conserve les GLB et rapports dans
                <code>services/mapanything-worker/.data/artifacts</code>. Les
                photos temporaires sont supprimées à la fin du job.
              </p>
            </details>
          </section>

          <footer className={styles.footer}>
            <a href="../">← Landing page</a>
            <a href="#top">Retour en haut ↑</a>
          </footer>
        </article>
      </div>
    </main>
  );
}
