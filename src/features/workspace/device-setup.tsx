"use client";

import {
  useId,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  searchDeviceCatalog,
  type DeviceCatalogEntry,
} from "@/domain/device/catalog";
import type { Project } from "@/domain/evidence/schema";

type Device = Project["device"];

export function DeviceSetup({
  canClose,
  existingDevice,
  photoCount,
  error,
  onClose,
  onKnownDevice,
  onUnknownDevice,
  onOpenDemo,
}: {
  canClose: boolean;
  existingDevice?: Device;
  photoCount: number;
  error?: string;
  onClose: () => void;
  onKnownDevice: (device: Device) => void;
  onUnknownDevice: () => void;
  onOpenDemo: () => void;
}) {
  const titleId = useId();
  const searchId = useId();
  const listboxId = useId();
  const [mode, setMode] = useState<"choose" | "known">(
    existingDevice?.confirmedByUser ? "known" : "choose",
  );
  const initialLabel = [existingDevice?.manufacturer, existingDevice?.model]
    .filter(Boolean)
    .join(" ");
  const [query, setQuery] = useState(initialLabel);
  const [identity, setIdentity] = useState<Device | null>(
    existingDevice?.confirmedByUser ? existingDevice : null,
  );
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const suggestions = useMemo(() => searchDeviceCatalog(query), [query]);

  function selectSuggestion(entry: DeviceCatalogEntry) {
    setQuery(`${entry.manufacturer} ${entry.model}`);
    setIdentity({
      manufacturer: entry.manufacturer,
      model: entry.model,
      confirmedByUser: true,
    });
    setSuggestionsOpen(false);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setSuggestionsOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setSuggestionsOpen(true);
      if (suggestions.length === 0) return;
      setActiveSuggestion((current) => {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        return (current + direction + suggestions.length) % suggestions.length;
      });
      return;
    }
    if (
      event.key === "Enter" &&
      suggestionsOpen &&
      suggestions[activeSuggestion]
    ) {
      event.preventDefault();
      selectSuggestion(suggestions[activeSuggestion]);
    }
  }

  function submitKnownDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const enteredIdentity = query.trim();
    if (!enteredIdentity) return;
    onKnownDevice(
      identity ?? { model: enteredIdentity, confirmedByUser: true },
    );
  }

  return (
    <div
      className="project-setup-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="project-setup-card">
        <header className="project-setup-header">
          <div>
            <h2 id={titleId}>What are you examining?</h2>
            <p>
              Start with the identity when you know it. Add photos when the
              identity is unknown or when existing evidence does not support a
              visible detail.
            </p>
          </div>
          {canClose && (
            <button
              type="button"
              className="panel-close"
              onClick={onClose}
              aria-label="Close project setup"
            >
              ×
            </button>
          )}
        </header>

        {error && (
          <p className="project-setup-error" role="alert">
            {error}
          </p>
        )}

        {mode === "choose" ? (
          <div className="project-start-options">
            <button
              type="button"
              className="project-start-option is-primary"
              onClick={() => setMode("known")}
            >
              <span className="project-start-option__icon" aria-hidden="true">
                Aa
              </span>
              <strong>I know the device</strong>
              <small>
                Enter a manufacturer and model. Photos stay optional until
                visual evidence is needed.
              </small>
              <b>Enter identity →</b>
            </button>
            <button
              type="button"
              className="project-start-option"
              onClick={onUnknownDevice}
            >
              <span className="project-start-option__icon" aria-hidden="true">
                ◎
              </span>
              <strong>I do not know</strong>
              <small>
                Begin with photos of the whole object, labels, sides and
                connectors. Its exact identity remains unconfirmed.
              </small>
              <b>
                {photoCount > 0
                  ? `Continue with ${photoCount} photo${photoCount > 1 ? "s" : ""} →`
                  : "Start with photos →"}
              </b>
            </button>
          </div>
        ) : (
          <form className="device-identity-form" onSubmit={submitKnownDevice}>
            <button
              type="button"
              className="project-setup-back"
              onClick={() => setMode("choose")}
            >
              ← Back to choices
            </button>
            <div
              className="device-search"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setSuggestionsOpen(false);
                }
              }}
            >
              <label htmlFor={searchId}>
                <span>Search for an object *</span>
                <div className="device-search-input">
                  <span aria-hidden="true">⌕</span>
                  <input
                    id={searchId}
                    name="device-search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setIdentity(null);
                      setActiveSuggestion(0);
                      setSuggestionsOpen(true);
                    }}
                    onFocus={() => setSuggestionsOpen(true)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="e.g. Galaxy Tab, iPhone, SM-T530…"
                    required
                    autoFocus
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={suggestionsOpen}
                    aria-controls={listboxId}
                    aria-activedescendant={
                      suggestionsOpen && suggestions[activeSuggestion]
                        ? `${listboxId}-${suggestions[activeSuggestion].id}`
                        : undefined
                    }
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setIdentity(null);
                        setActiveSuggestion(0);
                        setSuggestionsOpen(true);
                      }}
                      aria-label="Clear device search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </label>

              {suggestionsOpen && (
                <div className="device-suggestions">
                  <div className="device-suggestions__heading">
                    <span>
                      {query.trim() ? "Suggested matches" : "Examples"}
                    </span>
                    <small>Local catalog</small>
                  </div>
                  {suggestions.length > 0 ? (
                    <ul id={listboxId} role="listbox">
                      {suggestions.map((entry, index) => (
                        <li key={entry.id} role="none">
                          <button
                            id={`${listboxId}-${entry.id}`}
                            type="button"
                            role="option"
                            aria-selected={index === activeSuggestion}
                            className={
                              index === activeSuggestion ? "is-active" : ""
                            }
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActiveSuggestion(index)}
                            onClick={() => selectSuggestion(entry)}
                          >
                            <span
                              className="device-suggestion-icon"
                              aria-hidden="true"
                            >
                              {entry.category.slice(0, 1)}
                            </span>
                            <span>
                              <strong>{entry.model}</strong>
                              <small>{entry.manufacturer}</small>
                            </span>
                            <em>{entry.category}</em>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      No catalog match. You can still use “{query.trim()}” as a
                      custom object name.
                    </p>
                  )}
                </div>
              )}
            </div>
            {identity && (
              <div className="device-selected-identity">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>{identity.model}</strong>
                  <small>
                    {identity.manufacturer} · identity selected from the local
                    catalog
                  </small>
                </div>
              </div>
            )}
            <p>
              Suggestions only help with data entry. Your selection is stored as
              user-confirmed context and does not prove any component, material
              or dimension.
            </p>
            <button
              type="submit"
              className="project-setup-primary"
              disabled={!query.trim()}
            >
              Create evidence project
            </button>
          </form>
        )}

        <footer className="project-setup-footer">
          <span>Want to learn the controls first?</span>
          <button type="button" onClick={onOpenDemo}>
            Open the clearly labelled synthetic demo
          </button>
        </footer>
      </div>
    </div>
  );
}
