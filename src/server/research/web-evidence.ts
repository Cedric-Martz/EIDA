import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { load } from "cheerio";
import type {
  ExtractedArtifact,
  ExtractedDimension,
  ExtractedImage,
  ExtractedWebSource,
} from "@/domain/research/evidence-bundle";
import type { ResearchSource } from "@/domain/research/schema";

const MAX_BYTES = 2_500_000;
const MAX_REDIRECTS = 3;
const RELEVANT_TERMS =
  /\b(?:dimension|width|height|length|depth|thickness|diameter|battery|board|motherboard|display|screen|housing|shell|connector|camera|speaker|button|screw|remove|replacement|disassembly|teardown|step|mm|millimet)/i;
const FILE_KIND = /\.(pdf|step|stp|stl|obj|3mf|gltf|glb|zip|rar|7z)(?:$|[?#])/i;

type SourceInput = Pick<ResearchSource, "id" | "url" | "title" | "sourceType">;

function privateAddress(address: string): boolean {
  if (address === "::1" || address === "::" || address.startsWith("fe80:")) {
    return true;
  }
  if (address.startsWith("fc") || address.startsWith("fd")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  return (
    parts[0] === 0 ||
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0]! >= 224
  );
}

async function assertPublicUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Only public HTTPS sources can be extracted.");
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Local network sources are not allowed.");
  }
  if (isIP(hostname) && privateAddress(hostname)) {
    throw new Error("Private network addresses are not allowed.");
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => privateAddress(address))
  ) {
    throw new Error("The source does not resolve to a public address.");
  }
  return url;
}

async function boundedBody(response: Response): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES)
    throw new Error("The source exceeds the 2.5 MB extraction limit.");
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES)
        throw new Error("The source exceeds the 2.5 MB extraction limit.");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

async function fetchPublicSource(initialUrl: string): Promise<{
  url: URL;
  response: Response;
  body: Buffer;
}> {
  let url = await assertPublicUrl(initialUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,text/plain,application/pdf;q=0.8,*/*;q=0.2",
        "User-Agent": "EIDA-Evidence-Extractor/1.0 (+local research tool)",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS)
        throw new Error("Too many source redirects.");
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok)
      throw new Error(`Source returned HTTP ${response.status}.`);
    return { url, response, body: await boundedBody(response) };
  }
  throw new Error("Source redirect failed.");
}

function resolvePublicHttpUrl(raw: string, base: URL): string | null {
  try {
    const url = new URL(raw, base);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function artifactKind(url: string): ExtractedArtifact["kind"] | null {
  const extension = url.match(FILE_KIND)?.[1]?.toLowerCase();
  if (extension === "pdf") return "pdf";
  if (
    ["step", "stp", "stl", "obj", "3mf", "gltf", "glb"].includes(
      extension ?? "",
    )
  )
    return "cad";
  if (["zip", "rar", "7z"].includes(extension ?? "")) return "archive";
  return null;
}

export function extractDimensions(
  text: string,
  source: Pick<SourceInput, "id" | "url">,
): ExtractedDimension[] {
  const results: ExtractedDimension[] = [];
  const seen = new Set<string>();
  const triple =
    /(?:dimensions?|size|measures?)?[^.\n]{0,80}?([0-9]+(?:[.,][0-9]+)?)\s*[×xX]\s*([0-9]+(?:[.,][0-9]+)?)\s*[×xX]\s*([0-9]+(?:[.,][0-9]+)?)\s*(mm|cm)\b/gi;
  const labelled =
    /\b(width|height|length|depth|thickness|diameter)\b\s*(?:is|:|=)?\s*([0-9]+(?:[.,][0-9]+)?)\s*(mm|cm)\b/gi;
  const add = (
    label: string,
    raw: string,
    values: number[],
    unit: string,
    confidence: number,
  ) => {
    const multiplier = unit.toLowerCase() === "cm" ? 10 : 1;
    const valuesMm = values.map((value) => value * multiplier);
    const key = `${label}:${valuesMm.join("x")}`;
    if (
      seen.has(key) ||
      valuesMm.some((value) => value <= 0 || value > 100_000)
    )
      return;
    seen.add(key);
    results.push({
      sourceId: source.id,
      sourceUrl: source.url,
      label,
      valuesMm,
      raw: raw.trim().slice(0, 500),
      confidence,
    });
  };
  for (const match of text.matchAll(triple)) {
    add(
      "overall dimensions",
      match[0],
      match.slice(1, 4).map((value) => Number(value.replace(",", "."))),
      match[4]!,
      0.92,
    );
  }
  for (const match of text.matchAll(labelled)) {
    add(
      match[1]!.toLowerCase(),
      match[0],
      [Number(match[2]!.replace(",", "."))],
      match[3]!,
      0.82,
    );
  }
  return results.slice(0, 50);
}

export function extractHtmlEvidence(
  html: string,
  source: SourceInput,
  finalUrl = source.url,
): ExtractedWebSource {
  const base = new URL(finalUrl);
  const $ = load(html);
  $("script,style,noscript,iframe,canvas,svg,form,nav,footer").remove();
  const title = (
    $("meta[property='og:title']").attr("content") ||
    $("title").first().text() ||
    source.title
  )
    .trim()
    .slice(0, 500);
  const blocks = $("h1,h2,h3,h4,p,li,figcaption,td,th")
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, " ").trim())
    .filter((text) => text.length >= 12);
  const ranked = blocks
    .map((text, index) => ({
      text,
      index,
      score: RELEVANT_TERMS.test(text) ? 2 : 0,
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ text }) => text);
  const excerpt = Array.from(new Set(ranked)).join("\n").slice(0, 12_000);
  const images: ExtractedImage[] = [];
  const imageSeen = new Set<string>();
  $("img").each((_, element) => {
    const raw =
      $(element).attr("src") ||
      $(element).attr("data-src") ||
      $(element).attr("data-original");
    if (!raw) return;
    const url = resolvePublicHttpUrl(raw, base);
    if (
      !url ||
      imageSeen.has(url) ||
      /(?:logo|icon|avatar|tracking|pixel)/i.test(url)
    )
      return;
    imageSeen.add(url);
    images.push({
      sourceId: source.id,
      url,
      alt: ($(element).attr("alt") ?? "").trim().slice(0, 500),
    });
  });
  const artifacts: ExtractedArtifact[] = [];
  const artifactSeen = new Set<string>();
  $("a[href]").each((_, element) => {
    const url = resolvePublicHttpUrl($(element).attr("href") ?? "", base);
    if (!url || artifactSeen.has(url)) return;
    const kind = artifactKind(url);
    if (!kind) return;
    artifactSeen.add(url);
    artifacts.push({
      sourceId: source.id,
      url,
      kind,
      label: (
        $(element).text().trim() ||
        new URL(url).pathname.split("/").pop() ||
        kind
      ).slice(0, 500),
    });
  });
  const dimensions = extractDimensions(excerpt, source);
  const warnings: string[] = [];
  if (!excerpt) warnings.push("No readable page text was found.");
  if (images.length === 0) warnings.push("No usable source images were found.");
  return {
    sourceId: source.id,
    url: finalUrl,
    title: title || source.title,
    sourceType: source.sourceType,
    status: excerpt ? "extracted" : "partial",
    excerpt,
    dimensions,
    images: images.slice(0, 20),
    artifacts: artifacts.slice(0, 50),
    warnings,
  };
}

export async function extractWebSource(
  source: SourceInput,
): Promise<ExtractedWebSource> {
  try {
    const directKind = artifactKind(source.url);
    if (directKind) {
      return {
        sourceId: source.id,
        url: source.url,
        title: source.title,
        sourceType: source.sourceType,
        status: "partial",
        excerpt: "",
        dimensions: [],
        images: [],
        artifacts: [
          {
            sourceId: source.id,
            url: source.url,
            kind: directKind,
            label: source.title,
          },
        ],
        warnings: [
          "The technical file was indexed, but its binary contents were not parsed.",
        ],
      };
    }
    const { url, response, body } = await fetchPublicSource(source.url);
    const mediaType =
      response.headers
        .get("content-type")
        ?.split(";")[0]
        ?.trim()
        .toLowerCase() ?? "";
    if (mediaType === "application/pdf") {
      return {
        sourceId: source.id,
        url: url.toString(),
        title: source.title,
        sourceType: source.sourceType,
        status: "partial",
        excerpt: "",
        dimensions: [],
        images: [],
        artifacts: [
          {
            sourceId: source.id,
            url: url.toString(),
            kind: "pdf",
            label: source.title,
          },
        ],
        warnings: [
          "PDF detected and indexed; PDF text extraction is not enabled yet.",
        ],
      };
    }
    if (!mediaType.includes("html") && !mediaType.startsWith("text/"))
      throw new Error(
        `Unsupported source content type: ${mediaType || "unknown"}.`,
      );
    return extractHtmlEvidence(body.toString("utf8"), source, url.toString());
  } catch (error) {
    return {
      sourceId: source.id,
      url: source.url,
      title: source.title,
      sourceType: source.sourceType,
      status: "failed",
      excerpt: "",
      dimensions: [],
      images: [],
      artifacts: [],
      warnings: [
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Source extraction failed.",
      ],
    };
  }
}
