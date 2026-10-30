import { describe, expect, it } from "vitest";
import type { DiscoveredSource, ResearchSource } from "./schema";
import {
  addSource,
  canonicalizeSourceUrl,
  dedupeSources,
  removeSource,
  selectSource,
  unselectSource,
} from "./source-list";

function discovered(
  id: string,
  url = `https://example.com/${id}`,
): DiscoveredSource {
  return {
    schemaVersion: 1,
    id,
    url,
    canonicalUrl: url,
    title: `Source ${id}`,
    sourceType: "service-manual",
    provider: { id: "test", label: "Test" },
    discoveredAt: 1,
    license: {
      code: "unknown",
      label: "Unknown",
      attributionRequired: null,
      commercialUse: "unknown",
      derivatives: "unknown",
    },
    selection: "discovered",
  };
}

describe("research source list operations", () => {
  it("canonicalizes URL fragments, tracking parameters and query order", () => {
    expect(
      canonicalizeSourceUrl(
        "https://EXAMPLE.com/manual/?utm_source=newsletter&b=2&a=1#page-2",
      ),
    ).toBe("https://example.com/manual?a=1&b=2");
  });

  it("rejects non-web and credential-bearing URLs", () => {
    expect(() => canonicalizeSourceUrl("file:///tmp/manual.pdf")).toThrow();
    expect(() =>
      canonicalizeSourceUrl("https://user:secret@example.com/manual"),
    ).toThrow();
  });

  it("adds a new source without mutating the previous list", () => {
    const first = discovered("one");
    const previous = Object.freeze([first]) as readonly ResearchSource[];
    const next = addSource(previous, discovered("two"));
    expect(next.map((source) => source.id)).toEqual(["one", "two"]);
    expect(previous).toEqual([first]);
  });

  it("deduplicates canonical URLs and identifiers with stable order", () => {
    const one = discovered(
      "one",
      "https://example.com/manual?utm_source=mail&a=1",
    );
    const duplicateUrl = discovered(
      "two",
      "https://example.com/manual?a=1#dimensions",
    );
    const duplicateId = discovered("one", "https://example.com/other");
    expect(dedupeSources([one, duplicateUrl, duplicateId])).toEqual([one]);
  });

  it("preserves a selected duplicate over an earlier discovered result", () => {
    const first = discovered("one", "https://example.com/manual");
    const selected: ResearchSource = {
      ...discovered("two", "https://example.com/manual/"),
      selection: "selected",
      selectedAt: 20,
    };
    expect(dedupeSources([first, selected])).toEqual([selected]);
  });

  it("selects and unselects a source immutably", () => {
    const source = discovered("one");
    const list: ResearchSource[] = [source];
    const selected = selectSource(list, source.id, 42);
    expect(selected[0]).toMatchObject({
      id: source.id,
      selection: "selected",
      selectedAt: 42,
    });
    expect(list[0]).toBe(source);

    const unselected = unselectSource(selected, source.id);
    expect(unselected[0]).toEqual(source);
    expect("selectedAt" in unselected[0]).toBe(false);
  });

  it("leaves the list unchanged when a selection target does not exist", () => {
    const list: ResearchSource[] = [discovered("one")];
    expect(selectSource(list, "missing", 42)).toBe(list);
    expect(unselectSource(list, "missing")).toBe(list);
    expect(removeSource(list, "missing")).toBe(list);
  });

  it("removes only the requested source", () => {
    const one = discovered("one");
    const two = discovered("two");
    expect(removeSource([one, two], "one")).toEqual([two]);
  });
});
