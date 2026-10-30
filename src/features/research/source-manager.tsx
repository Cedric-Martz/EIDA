"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  addSource,
  canonicalizeSourceUrl,
  dedupeSources,
  removeSource,
  selectSource,
  unselectSource,
  type DiscoveredSource,
  type ResearchProviderResult,
  type ResearchSource,
  type SelectedSource,
} from "@/domain/research";
import { createLocalId } from "@/shared/create-local-id";
import { createIfixitClient } from "./ifixit-client";
import { normalizeResearchQuery } from "./sanitize";
import { createExternalResearchClient } from "./research-service-client";
import { sourceMatchesDevice } from "./device-match";
import styles from "./source-manager.module.css";

const SOURCE_TYPE_LABELS: Record<ResearchSource["sourceType"], string> = {
  "teardown-guide": "Teardown guide",
  "repair-guide": "Repair guide",
  "service-manual": "Service manual",
  "parts-catalog": "Parts catalog",
  "technical-drawing": "Technical drawing",
  "cad-model": "CAD model",
  datasheet: "Datasheet",
  "product-page": "Product page",
  "photo-set": "Photo set",
  video: "Video",
  forum: "Forum",
  repository: "Repository",
  "web-page": "Web page",
  other: "Other",
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type Notice = {
  tone: "info" | "success" | "warning" | "error";
  message: string;
};

export type SourceManagerProps = {
  deviceLabel: string;
  query?: string;
  currentSources: ResearchSource[];
  onSourcesChange: (sources: ResearchSource[]) => void;
  onClose: () => void;
  onPrepareReconstruction: (
    approvedSources: SelectedSource[],
  ) => void | Promise<void>;
  researchEndpoint?: string;
};

function sourceTypeFromUrl(url: URL): ResearchSource["sourceType"] {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();

  if (host === "github.com" || host.endsWith(".github.com")) {
    return "repository";
  }
  if (host === "ifixit.com" || host.endsWith(".ifixit.com")) {
    return path.includes("/guide/") ? "repair-guide" : "web-page";
  }
  if (
    /\.(?:step|stp|stl|obj|3mf|gltf|glb)$/i.test(path) ||
    ["grabcad.com", "printables.com", "thingiverse.com"].some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    )
  ) {
    return "cad-model";
  }
  if (
    host === "youtu.be" ||
    host.endsWith(".youtube.com") ||
    host.endsWith(".vimeo.com")
  ) {
    return "video";
  }
  return "web-page";
}

function createManualSource(rawValue: string): DiscoveredSource {
  const value = rawValue.trim();
  if (value.length > 4_096) {
    throw new TypeError("The URL is too long.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("Enter a complete HTTPS URL.");
  }

  if (url.protocol !== "https:") {
    throw new TypeError("Manual sources must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new TypeError("URLs containing credentials are not accepted.");
  }

  const canonicalUrl = canonicalizeSourceUrl(url.toString());
  const pathLabel = url.pathname === "/" ? "" : url.pathname;
  const title = `${url.hostname}${pathLabel}`.slice(0, 500);

  return {
    schemaVersion: 1,
    id: createLocalId("manual-source"),
    url: url.toString(),
    canonicalUrl,
    title,
    publisher: url.hostname,
    sourceType: sourceTypeFromUrl(url),
    provider: { id: "manual", label: "Manual link" },
    discoveredAt: Date.now(),
    license: {
      code: "unknown",
      label: "License not verified",
      attributionRequired: null,
      commercialUse: "unknown",
      derivatives: "unknown",
    },
    selection: "discovered",
  };
}

function mergeSearchResults(
  currentSources: readonly ResearchSource[],
  discoveredSources: readonly DiscoveredSource[],
): ResearchSource[] {
  // Current sources come first so a user's approval cannot be overwritten by a
  // later search response for the same canonical URL.
  return dedupeSources([...currentSources, ...discoveredSources]);
}

function confidenceLabel(score: number | undefined): string {
  if (score === undefined) return "Not scored";
  return `${Math.round(score * 100)}%`;
}

function SourceCard({
  source,
  onToggleApproval,
  onRemove,
}: {
  source: ResearchSource;
  onToggleApproval: (source: ResearchSource) => void;
  onRemove: (source: ResearchSource) => void;
}) {
  const approved = source.selection === "selected";

  return (
    <li>
      <article
        className={`${styles.sourceCard} ${approved ? styles.sourceCardApproved : ""}`}
      >
        <div className={styles.sourceMain}>
          <div className={styles.sourceStateRow}>
            <span
              className={`${styles.stateBadge} ${approved ? styles.stateApproved : styles.stateDiscovered}`}
            >
              <span aria-hidden="true">{approved ? "✓" : "○"}</span>
              {approved ? "Approved" : "Discovered"}
            </span>
            <span className={styles.sourceProvider}>
              {source.provider.label}
            </span>
          </div>

          <h4>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
              <span className={styles.externalMark} aria-hidden="true">
                ↗
              </span>
            </a>
          </h4>

          {source.summary && (
            <p className={styles.sourceSummary}>{source.summary}</p>
          )}

          <dl className={styles.sourceMetadata}>
            <div>
              <dt>Type</dt>
              <dd>{SOURCE_TYPE_LABELS[source.sourceType]}</dd>
            </div>
            <div>
              <dt>Publisher</dt>
              <dd>{source.publisher ?? source.provider.label}</dd>
            </div>
            <div>
              <dt>License</dt>
              <dd>
                {source.license.url ? (
                  <a
                    href={source.license.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.license.label}
                  </a>
                ) : (
                  source.license.label
                )}
              </dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{confidenceLabel(source.relevanceScore)}</dd>
            </div>
          </dl>
        </div>

        <div className={styles.sourceActions}>
          <a
            className={styles.openButton}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${source.title} in a new tab`}
          >
            Open source
          </a>
          <button
            type="button"
            className={approved ? styles.unapproveButton : styles.approveButton}
            onClick={() => onToggleApproval(source)}
          >
            {approved ? "Unapprove" : "Approve source"}
          </button>
          <button
            type="button"
            className={styles.removeButton}
            onClick={() => onRemove(source)}
            aria-label={`Remove ${source.title}`}
          >
            Remove
          </button>
        </div>
      </article>
    </li>
  );
}

export function SourceManager({
  deviceLabel,
  query,
  currentSources,
  onSourcesChange,
  onClose,
  onPrepareReconstruction,
  researchEndpoint,
}: SourceManagerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const searchInputId = useId();
  const manualInputId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const sourcesRef = useRef(currentSources);
  const onSourcesChangeRef = useRef(onSourcesChange);
  sourcesRef.current = currentSources;
  onSourcesChangeRef.current = onSourcesChange;

  const initialQuery = useMemo(
    () => normalizeResearchQuery(query?.trim() || deviceLabel),
    [deviceLabel, query],
  );
  const resolvedEndpoint = (
    researchEndpoint ??
    process.env.NEXT_PUBLIC_EIDA_RESEARCH_API ??
    ""
  ).trim();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchStatus, setSearchStatus] = useState<
    "idle" | "searching" | "complete" | "error"
  >("idle");
  const [searchNotices, setSearchNotices] = useState<Notice[]>([]);
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualFeedback, setManualFeedback] = useState<Notice | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState("");

  const approvedSources = currentSources.filter(
    (source): source is SelectedSource =>
      source.selection === "selected" &&
      sourceMatchesDevice(deviceLabel, source),
  );
  const incompatibleApprovedCount = currentSources.filter(
    (source) =>
      source.selection === "selected" &&
      !sourceMatchesDevice(deviceLabel, source),
  ).length;
  const discoveredSources = currentSources.filter(
    (source): source is DiscoveredSource => source.selection === "discovered",
  );

  const commitSources = useCallback((nextSources: ResearchSource[]) => {
    sourcesRef.current = nextSources;
    onSourcesChangeRef.current(nextSources);
  }, []);

  const runSearch = useCallback(
    async (rawQuery: string) => {
      const normalizedQuery = normalizeResearchQuery(rawQuery);
      if (!normalizedQuery) {
        setSearchStatus("error");
        setSearchNotices([
          { tone: "error", message: "Enter a device name before searching." },
        ]);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setSearchStatus("searching");
      setSearchNotices([]);
      setLastSearchedQuery(normalizedQuery);

      try {
        let providerResults: ResearchProviderResult[];

        if (resolvedEndpoint) {
          const response = await createExternalResearchClient({
            endpoint: resolvedEndpoint,
          }).search({ query: normalizedQuery, limit: 40 }, controller.signal);
          if (!response.ok) {
            if (
              requestId !== requestIdRef.current ||
              controller.signal.aborted
            ) {
              return;
            }
            setSearchStatus("error");
            setSearchNotices([
              { tone: "error", message: response.error.message },
            ]);
            return;
          }
          providerResults = response.value;
        } else {
          const response = await createIfixitClient().searchGuides(
            normalizedQuery,
            controller.signal,
          );
          if (!response.ok) {
            if (
              requestId !== requestIdRef.current ||
              controller.signal.aborted
            ) {
              return;
            }
            setSearchStatus("error");
            setSearchNotices([
              { tone: "error", message: response.error.message },
              {
                tone: "info",
                message:
                  "You can retry, add HTTPS links manually, or configure NEXT_PUBLIC_EIDA_RESEARCH_API for multi-provider search.",
              },
            ]);
            return;
          }
          providerResults = [response.value];
        }

        if (requestId !== requestIdRef.current || controller.signal.aborted) {
          return;
        }

        const unfilteredSources = providerResults.flatMap(
          (result) => result.sources,
        );
        const foundSources = unfilteredSources.filter((source) =>
          sourceMatchesDevice(normalizedQuery, source),
        );
        const incompatibleCount =
          unfilteredSources.length - foundSources.length;
        const previousSources = sourcesRef.current;
        const nextSources = mergeSearchResults(previousSources, foundSources);
        const addedCount = nextSources.length - previousSources.length;
        commitSources(nextSources);

        const providerNames = Array.from(
          new Set(providerResults.map((result) => result.provider.label)),
        ).join(", ");
        const notices: Notice[] = [
          foundSources.length > 0
            ? {
                tone: "success",
                message: `${foundSources.length} result${foundSources.length === 1 ? "" : "s"} returned by ${providerNames}; ${addedCount} new source${addedCount === 1 ? "" : "s"} added.`,
              }
            : {
                tone: "info",
                message: `No source matched “${normalizedQuery}”. Try the exact model number or add a link manually.`,
              },
        ];

        if (incompatibleCount > 0) {
          notices.push({
            tone: "warning",
            message: `${incompatibleCount} result${incompatibleCount === 1 ? " was" : "s were"} hidden because the title names a different model or size variant.`,
          });
        }

        for (const result of providerResults) {
          if (result.status === "partial") {
            notices.push({
              tone: "warning",
              message: `${result.provider.label} returned partial results.`,
            });
          }
          if (result.status === "failed") {
            notices.push({
              tone: "error",
              message:
                result.error?.message ??
                `${result.provider.label} could not complete the search.`,
            });
          }
          for (const warning of result.warnings.slice(0, 3)) {
            notices.push({
              tone: "warning",
              message: `${result.provider.label}: ${warning}`,
            });
          }
        }

        setSearchStatus("complete");
        setSearchNotices(notices);
      } catch {
        if (requestId !== requestIdRef.current || controller.signal.aborted) {
          return;
        }
        setSearchStatus("error");
        setSearchNotices([
          {
            tone: "error",
            message: "The source search stopped unexpectedly. Please retry.",
          },
        ]);
      } finally {
        if (requestId === requestIdRef.current) abortRef.current = null;
      }
    },
    [commitSources, resolvedEndpoint],
  );

  useEffect(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    searchInputRef.current?.focus();
    return () => {
      const previous = previouslyFocusedRef.current;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true" &&
          element.getClientRects().length > 0,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !dialog.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => document.removeEventListener("keydown", handleDialogKeyDown);
  }, [onClose]);

  useEffect(() => {
    setSearchQuery(initialQuery);
    if (!initialQuery) return;
    void runSearch(initialQuery);
    return () => abortRef.current?.abort();
  }, [initialQuery, runSearch]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(searchQuery);
  }

  function addManualUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManualFeedback(null);

    try {
      const source = createManualSource(manualUrl);
      const before = sourcesRef.current;
      const next = addSource(before, source);
      if (next.length === before.length) {
        setManualFeedback({
          tone: "info",
          message: "That source is already in the list.",
        });
        return;
      }
      commitSources(next);
      setManualUrl("");
      setManualFeedback({
        tone: "success",
        message:
          "Link added as discovered. Review its license, then approve it.",
      });
    } catch (error) {
      setManualFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Enter a valid HTTPS URL.",
      });
    }
  }

  function toggleApproval(source: ResearchSource) {
    const next =
      source.selection === "selected"
        ? unselectSource(sourcesRef.current, source.id)
        : selectSource(sourcesRef.current, source.id, Date.now());
    commitSources(next);
    setPrepareError("");
  }

  function deleteSource(source: ResearchSource) {
    commitSources(removeSource(sourcesRef.current, source.id));
    setPrepareError("");
  }

  async function prepareReconstruction() {
    if (approvedSources.length === 0 || preparing) return;
    setPreparing(true);
    setPrepareError("");
    try {
      await onPrepareReconstruction(approvedSources);
    } catch (error) {
      setPrepareError(
        error instanceof Error
          ? error.message.slice(0, 500)
          : "The reconstruction could not be prepared.",
      );
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div
        ref={dialogRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>01 · Source research</p>
            <h2 id={titleId}>Build an evidence set</h2>
            <p id={descriptionId}>
              Find plans, guides and technical references for{" "}
              {deviceLabel || "this device"}. Only approved sources continue to
              reconstruction.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close source manager"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.searchPanel} aria-label="Find sources">
            <div className={styles.searchMode}>
              <span className={styles.modeDot} aria-hidden="true" />
              <div>
                <strong>
                  {resolvedEndpoint
                    ? "Multi-provider research service"
                    : "Static demo · direct iFixit search"}
                </strong>
                <small>
                  {resolvedEndpoint
                    ? "Results are normalized by the configured public research endpoint. No secret is stored in this page."
                    : "GitHub Pages calls iFixit’s public API directly. General web search becomes available when a research endpoint is configured."}
                </small>
              </div>
            </div>

            <form className={styles.searchForm} onSubmit={submitSearch}>
              <label htmlFor={searchInputId}>Device or exact model</label>
              <div className={styles.searchControls}>
                <input
                  ref={searchInputRef}
                  id={searchInputId}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="e.g. Samsung Galaxy Tab 4 SM-T530"
                  maxLength={200}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={searchStatus === "searching" || !searchQuery.trim()}
                >
                  {searchStatus === "searching"
                    ? "Searching…"
                    : "Search sources"}
                </button>
              </div>
            </form>

            <div
              className={styles.searchFeedback}
              aria-live="polite"
              aria-busy={searchStatus === "searching"}
            >
              {incompatibleApprovedCount > 0 && (
                <p className={styles.feedbackWarning} role="status">
                  {incompatibleApprovedCount} previously approved source
                  {incompatibleApprovedCount === 1 ? " is" : "s are"} excluded
                  from reconstruction because they name another model or size
                  variant. You can remove them below.
                </p>
              )}
              {searchStatus === "searching" && (
                <p className={styles.feedbackInfo} role="status">
                  Searching for plans and teardown evidence for “
                  {lastSearchedQuery}”…
                </p>
              )}
              {searchNotices.length > 0 && (
                <ul>
                  {searchNotices.map((notice, index) => (
                    <li
                      key={`${notice.tone}:${notice.message}:${index}`}
                      className={
                        styles[
                          `feedback${notice.tone[0].toUpperCase()}${notice.tone.slice(1)}`
                        ]
                      }
                    >
                      {notice.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section
            className={styles.manualPanel}
            aria-label="Add a source manually"
          >
            <div className={styles.panelHeading}>
              <div>
                <h3>Add a source you already trust</h3>
                <p>
                  HTTPS links are added as discovered until you approve them.
                </p>
              </div>
              <span>Manual</span>
            </div>
            <form className={styles.manualForm} onSubmit={addManualUrl}>
              <label htmlFor={manualInputId}>Public HTTPS URL</label>
              <div>
                <input
                  id={manualInputId}
                  type="url"
                  inputMode="url"
                  value={manualUrl}
                  onChange={(event) => {
                    setManualUrl(event.target.value);
                    setManualFeedback(null);
                  }}
                  placeholder="https://example.org/device/service-manual.pdf"
                  maxLength={4_096}
                  pattern="https://.*"
                  required
                />
                <button type="submit">Add link</button>
              </div>
            </form>
            {manualFeedback && (
              <p
                className={
                  styles[
                    `feedback${manualFeedback.tone[0].toUpperCase()}${manualFeedback.tone.slice(1)}`
                  ]
                }
                role={manualFeedback.tone === "error" ? "alert" : "status"}
              >
                {manualFeedback.message}
              </p>
            )}
          </section>

          <section
            className={styles.sourceSection}
            aria-labelledby={`${titleId}-approved`}
          >
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.sectionNumber}>A</span>
                <div>
                  <h3 id={`${titleId}-approved`}>
                    Approved for reconstruction
                  </h3>
                  <p>These sources will be passed to the modeling pipeline.</p>
                </div>
              </div>
              <strong>{approvedSources.length}</strong>
            </div>
            {approvedSources.length > 0 ? (
              <ul className={styles.sourceList}>
                {approvedSources.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    onToggleApproval={toggleApproval}
                    onRemove={deleteSource}
                  />
                ))}
              </ul>
            ) : (
              <div className={styles.emptyState}>
                <span aria-hidden="true">✓</span>
                <p>
                  No approved source yet. Review the discovered results below
                  and approve only those you want to use.
                </p>
              </div>
            )}
          </section>

          <section
            className={styles.sourceSection}
            aria-labelledby={`${titleId}-discovered`}
          >
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.sectionNumber}>D</span>
                <div>
                  <h3 id={`${titleId}-discovered`}>
                    Discovered · needs review
                  </h3>
                  <p>
                    Check relevance, provenance and license before approval.
                  </p>
                </div>
              </div>
              <strong>{discoveredSources.length}</strong>
            </div>
            {discoveredSources.length > 0 ? (
              <ul className={styles.sourceList}>
                {discoveredSources.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    onToggleApproval={toggleApproval}
                    onRemove={deleteSource}
                  />
                ))}
              </ul>
            ) : (
              <div className={styles.emptyState}>
                <span aria-hidden="true">⌕</span>
                <p>
                  Search the exact device model or add a public source manually.
                </p>
              </div>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <div aria-live="polite">
            <strong>
              {approvedSources.length} approved source
              {approvedSources.length === 1 ? "" : "s"}
            </strong>
            <span>
              {currentSources.length} total · discovered links stay out of the
              model
            </span>
          </div>
          <button
            type="button"
            onClick={() => void prepareReconstruction()}
            disabled={approvedSources.length === 0 || preparing}
          >
            {preparing ? "Preparing…" : "Prepare reconstruction"}
            {!preparing && <span aria-hidden="true">→</span>}
          </button>
          {prepareError && (
            <p className={styles.prepareError} role="alert">
              {prepareError}
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
