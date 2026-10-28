export function EidaLanding({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="landing-page" id="top">
      <header className="landing-header">
        <a className="landing-brand" href="#top" aria-label="home">
          <span>E</span>
          <strong>EIDA</strong>
        </a>
        <a className="landing-header__link" href="#method">
          Our method <span aria-hidden="true">↘</span>
        </a>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__copy">
          <p className="landing-eyebrow">Evidence-grounded 3D lab</p>
          <h1 id="landing-title">
            See the object.
            <br />
            <em>Understand its parts.</em>
          </h1>
          <p className="landing-lede">
            Explore a device, separate its components, and trace every
            observation back to its source.
          </p>
        </div>

        <div className="landing-object" aria-hidden="true">
          <span className="landing-object__orbit" />
          <span className="landing-object__part landing-object__part--back" />
          <span className="landing-object__part landing-object__part--battery" />
          <span className="landing-object__part landing-object__part--board">
            <i />
            <i />
            <i />
          </span>
          <span className="landing-object__part landing-object__part--screen" />
          <span className="landing-object__part landing-object__part--front" />
          <span className="landing-object__label">Exploded view: 06 parts</span>
        </div>

        <div className="landing-actions">
          <button type="button" className="landing-cta" onClick={onEnter}>
            Open the prototype <span aria-hidden="true">↗</span>
          </button>
          <span>Interactive demo</span>
        </div>
      </section>

      <section className="landing-method" id="method" aria-label="EIDA method">
        <p>Approved photos and documents</p>
        <span aria-hidden="true">→</span>
        <p>Claims linked to evidence</p>
        <span aria-hidden="true">→</span>
        <p>Interactive 3D parts</p>
      </section>
    </main>
  );
}
