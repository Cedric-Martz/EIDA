import type {
  DiscoveredSource,
  ResearchSource,
} from "@/domain/research/schema";

const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "mc_cid",
  "mc_eid",
  "ref_src",
]);

function isTrackingParameter(name: string): boolean {
  return (
    name.toLowerCase().startsWith("utm_") ||
    TRACKING_PARAMETERS.has(name.toLowerCase())
  );
}

export function canonicalizeSourceUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("Only HTTP(S) source URLs can be canonicalized");
  }
  if (url.username || url.password) {
    throw new TypeError("Source URLs cannot contain credentials");
  }

  url.hash = "";
  for (const key of Array.from(url.searchParams.keys())) {
    if (isTrackingParameter(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function sourceKey(source: ResearchSource): string {
  try {
    return canonicalizeSourceUrl(source.canonicalUrl || source.url);
  } catch {
    return source.canonicalUrl || source.url;
  }
}

function preferredDuplicate(
  existing: ResearchSource,
  candidate: ResearchSource,
): ResearchSource {
  if (
    existing.selection === "discovered" &&
    candidate.selection === "selected"
  ) {
    return candidate;
  }
  return existing;
}

export function dedupeSources(
  sources: readonly ResearchSource[],
): ResearchSource[] {
  const deduped: ResearchSource[] = [];

  for (const source of sources) {
    const key = sourceKey(source);
    const existingIndex = deduped.findIndex(
      (candidate) => candidate.id === source.id || sourceKey(candidate) === key,
    );
    if (existingIndex === -1) {
      deduped.push(source);
    } else {
      deduped[existingIndex] = preferredDuplicate(
        deduped[existingIndex],
        source,
      );
    }
  }

  return deduped;
}

export function addSource(
  sources: readonly ResearchSource[],
  source: ResearchSource,
): ResearchSource[] {
  return dedupeSources([...sources, source]);
}

export function selectSource(
  sources: readonly ResearchSource[],
  sourceId: string,
  selectedAt: number,
): ResearchSource[] {
  let changed = false;
  const next = sources.map((source): ResearchSource => {
    if (source.id !== sourceId || source.selection === "selected") {
      return source;
    }
    changed = true;
    return { ...source, selection: "selected", selectedAt };
  });
  return changed ? next : (sources as ResearchSource[]);
}

export function unselectSource(
  sources: readonly ResearchSource[],
  sourceId: string,
): ResearchSource[] {
  let changed = false;
  const next = sources.map((source): ResearchSource => {
    if (source.id !== sourceId || source.selection === "discovered") {
      return source;
    }
    changed = true;
    const discovered: DiscoveredSource = {
      schemaVersion: source.schemaVersion,
      id: source.id,
      url: source.url,
      canonicalUrl: source.canonicalUrl,
      title: source.title,
      sourceType: source.sourceType,
      provider: source.provider,
      discoveredAt: source.discoveredAt,
      license: source.license,
      selection: "discovered",
      ...(source.publisher === undefined
        ? {}
        : { publisher: source.publisher }),
      ...(source.summary === undefined ? {} : { summary: source.summary }),
      ...(source.thumbnailUrl === undefined
        ? {}
        : { thumbnailUrl: source.thumbnailUrl }),
      ...(source.relevanceScore === undefined
        ? {}
        : { relevanceScore: source.relevanceScore }),
    };
    return discovered;
  });
  return changed ? next : (sources as ResearchSource[]);
}

export function removeSource(
  sources: readonly ResearchSource[],
  sourceId: string,
): ResearchSource[] {
  const next = sources.filter((source) => source.id !== sourceId);
  return next.length === sources.length ? (sources as ResearchSource[]) : next;
}
