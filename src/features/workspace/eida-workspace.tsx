"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { EidaLanding } from "@/features/landing/eida-landing";

const ViewerPanel = dynamic(
  () =>
    import("@/features/viewer/viewer-panel").then(
      (module) => module.ViewerPanel,
    ),
  {
    ssr: false,
    loading: () => (
      <section
        className="workspace-loading"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="loader-screw" aria-hidden="true">
          <span className="loader-screw__head" />
        </div>
        <div>
          <strong>Loading 3D workbench</strong>
          <span>Downloading the interactive viewer</span>
        </div>
      </section>
    ),
  },
);

export function EidaWorkspace() {
  const [hydrated, setHydrated] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Keep the server render and the browser's first render identical. This also
  // prevents browser-only state restored by future features from changing the
  // root tree before React has attached its event handlers.
  if (!hydrated) {
    return <EidaLanding onEnter={() => undefined} />;
  }

  if (!workspaceOpen) {
    return <EidaLanding onEnter={() => setWorkspaceOpen(true)} />;
  }

  return (
    <main className="browser-workbench" id="top">
      <ViewerPanel onExit={() => setWorkspaceOpen(false)} />
    </main>
  );
}
