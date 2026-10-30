type WorkerEnv = {
  ALLOWED_ORIGINS?: string;
  BRAVE_SEARCH_API_KEY?: string;
};

type ResearchRequest = {
  query?: unknown;
  limit?: unknown;
};

type ResearchSource = {
  externalId: string;
  url: string;
  title: string;
  publisher: string;
  summary: string;
  sourceType:
    | "teardown"
    | "repair_guide"
    | "service_manual"
    | "datasheet"
    | "cad"
    | "repository"
    | "web_page";
  provider: "ifixit" | "brave";
  license: "CC-BY-NC-SA-3.0" | "unknown";
  confidence: number;
  thumbnailUrl?: string;
  modifiedAt?: string;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(
  value: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function allowedOrigin(request: Request, env: WorkerEnv): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const configured = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return origin;
  if (
    configured.length === 0 &&
    (/^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin))
  ) {
    return origin;
  }
  return null;
}

function corsHeaders(request: Request, env: WorkerEnv): Record<string, string> {
  const origin = allowedOrigin(request, env);
  return origin
    ? {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        vary: "Origin",
      }
    : {};
}

function clampLimit(value: unknown) {
  return typeof value === "number" && Number.isInteger(value)
    ? Math.min(30, Math.max(1, value))
    : 15;
}

function normalizedQuery(value: unknown) {
  if (typeof value !== "string") return null;
  const query = value.replace(/\s+/g, " ").trim();
  return query.length >= 2 && query.length <= 160 ? query : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function epochToIso(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return new Date(value * 1000).toISOString();
}

function inferSourceType(
  url: string,
  title: string,
): ResearchSource["sourceType"] {
  const value = `${url} ${title}`.toLowerCase();
  if (/\.(step|stp|stl|obj|glb|gltf|3mf)(\?|$)/.test(value)) return "cad";
  if (/github\.com|gitlab\.com/.test(value)) return "repository";
  if (/service[ -]?manual|repair[ -]?manual|workshop[ -]?manual/.test(value)) {
    return "service_manual";
  }
  if (/datasheet|specification|technical[ -]?drawing/.test(value)) {
    return "datasheet";
  }
  if (/teardown|disassembly|dismantl/.test(value)) return "teardown";
  if (/repair|replacement|guide/.test(value)) return "repair_guide";
  return "web_page";
}

async function fetchJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`upstream_${response.status}`);
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchIfixit(query: string): Promise<ResearchSource[]> {
  const payload = asRecord(
    await fetchJson(
      `https://www.ifixit.com/api/2.0/suggest/${encodeURIComponent(query)}`,
      { headers: { accept: "application/json" } },
    ),
  );
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.flatMap((entry): ResearchSource[] => {
    const result = asRecord(entry);
    if (!result) return [];
    const url = text(result.url);
    const title = text(result.display_title) || text(result.title);
    if (!url || !title || !url.startsWith("https://www.ifixit.com/")) return [];
    const image = asRecord(result.image);
    const kind = text(result.dataType);
    const guideType = text(result.type);
    const externalId =
      kind === "guide"
        ? `ifixit-guide-${String(result.guideid ?? "unknown")}`
        : `ifixit-wiki-${String(result.wikiid ?? "unknown")}`;
    return [
      {
        externalId,
        url,
        title,
        publisher: "iFixit",
        summary: text(result.summary) || text(result.text),
        sourceType:
          guideType === "teardown" || /disassembl|teardown/i.test(title)
            ? "teardown"
            : "repair_guide",
        provider: "ifixit",
        license: "CC-BY-NC-SA-3.0",
        confidence: kind === "guide" ? 0.9 : 0.78,
        thumbnailUrl:
          text(image?.medium) || text(image?.thumbnail) || undefined,
        modifiedAt: epochToIso(result.modified_date),
      },
    ];
  });
}

async function searchBrave(
  query: string,
  limit: number,
  token: string,
): Promise<ResearchSource[]> {
  const researchQuery = `${query} (teardown OR disassembly OR service manual OR datasheet OR CAD OR STEP OR STL)`;
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", researchQuery);
  url.searchParams.set("count", String(Math.min(20, limit)));
  url.searchParams.set("safesearch", "moderate");
  const payload = asRecord(
    await fetchJson(url.toString(), {
      headers: {
        accept: "application/json",
        "x-subscription-token": token,
      },
    }),
  );
  const web = asRecord(payload?.web);
  const results = Array.isArray(web?.results) ? web.results : [];
  return results.flatMap((entry, index): ResearchSource[] => {
    const result = asRecord(entry);
    if (!result) return [];
    const url = text(result.url);
    const title = text(result.title);
    if (!/^https:\/\//i.test(url) || !title) return [];
    const profile = asRecord(result.profile);
    return [
      {
        externalId: `brave-${index}-${new URL(url).hostname}`,
        url,
        title,
        publisher: text(profile?.long_name) || new URL(url).hostname,
        summary: text(result.description),
        sourceType: inferSourceType(url, title),
        provider: "brave",
        license: "unknown",
        confidence: 0.64,
      },
    ];
  });
}

function dedupe(sources: ResearchSource[], limit: number) {
  const seen = new Set<string>();
  return sources
    .sort((left, right) => right.confidence - left.confidence)
    .filter((source) => {
      const key = source.url.replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

async function research(request: Request, env: WorkerEnv) {
  let body: ResearchRequest;
  try {
    body = (await request.json()) as ResearchRequest;
  } catch {
    return json({ error: { code: "INVALID_JSON" } }, 400);
  }
  const query = normalizedQuery(body.query);
  if (!query) {
    return json(
      { error: { code: "INVALID_QUERY", message: "Use 2–160 characters." } },
      400,
    );
  }
  const limit = clampLimit(body.limit);
  const providers: Array<Promise<ResearchSource[]>> = [searchIfixit(query)];
  if (env.BRAVE_SEARCH_API_KEY) {
    providers.push(searchBrave(query, limit, env.BRAVE_SEARCH_API_KEY));
  }
  const settled = await Promise.allSettled(providers);
  const sources = dedupe(
    settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    ),
    limit,
  );
  const failedProviders = settled.filter(
    (result) => result.status === "rejected",
  ).length;
  return json({
    query,
    sources,
    meta: {
      searchedAt: new Date().toISOString(),
      providers: env.BRAVE_SEARCH_API_KEY ? ["ifixit", "brave"] : ["ifixit"],
      partial: failedProviders > 0,
      generalWebSearchConfigured: Boolean(env.BRAVE_SEARCH_API_KEY),
    },
  });
}

async function ifixitGuide(guideId: string) {
  if (!/^\d{1,12}$/.test(guideId)) {
    return json({ error: { code: "INVALID_GUIDE_ID" } }, 400);
  }
  try {
    const payload = asRecord(
      await fetchJson(`https://www.ifixit.com/api/2.0/guides/${guideId}`, {
        headers: { accept: "application/json" },
      }),
    );
    if (!payload) throw new Error("invalid_payload");
    const steps = Array.isArray(payload.steps) ? payload.steps : [];
    return json({
      guide: {
        id: `ifixit-guide-${guideId}`,
        title: text(payload.title),
        summary: text(payload.summary),
        url: text(payload.url),
        license: "CC-BY-NC-SA-3.0",
        attribution: "iFixit and the credited guide author",
        author: text(asRecord(payload.author)?.username),
        steps: steps.flatMap((value, index) => {
          const step = asRecord(value);
          if (!step) return [];
          const lines = Array.isArray(step.lines) ? step.lines : [];
          const media = asRecord(step.media);
          const images = Array.isArray(media?.data) ? media.data : [];
          return [
            {
              index: index + 1,
              id: String(step.stepid ?? index + 1),
              title: text(step.title),
              text: lines
                .map((line) => text(asRecord(line)?.text_raw))
                .filter(Boolean),
              images: images
                .map((image) => {
                  const record = asRecord(image);
                  return {
                    id: String(record?.id ?? ""),
                    thumbnailUrl:
                      text(record?.medium) || text(record?.thumbnail),
                    originalUrl: text(record?.original),
                  };
                })
                .filter((image) => image.thumbnailUrl),
            },
          ];
        }),
      },
    });
  } catch {
    return json({ error: { code: "UPSTREAM_UNAVAILABLE" } }, 502);
  }
}

async function handle(request: Request, env: WorkerEnv) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    return json({ ok: true, service: "eida-research", version: 1 });
  }
  if (request.method === "POST" && url.pathname === "/v1/research") {
    return research(request, env);
  }
  const guideMatch = url.pathname.match(/^\/v1\/ifixit\/guides\/(\d+)$/);
  if (request.method === "GET" && guideMatch) {
    return ifixitGuide(guideMatch[1]);
  }
  return json({ error: { code: "NOT_FOUND" } }, 404);
}

const worker = {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.headers.has("origin") && !allowedOrigin(request, env)) {
      return json({ error: { code: "ORIGIN_NOT_ALLOWED" } }, 403);
    }
    try {
      const response = await handle(request, env);
      Object.entries(cors).forEach(([key, value]) =>
        response.headers.set(key, value),
      );
      return response;
    } catch {
      return json({ error: { code: "INTERNAL_ERROR" } }, 500, cors);
    }
  },
};

export default worker;
