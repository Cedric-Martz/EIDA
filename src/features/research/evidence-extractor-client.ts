import {
  webEvidenceBundleSchema,
  type SelectedSource,
  type WebEvidenceBundle,
} from "@/domain/research";

export async function extractApprovedSources(
  sources: readonly SelectedSource[],
  signal?: AbortSignal,
): Promise<WebEvidenceBundle> {
  const response = await fetch("/api/research/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal,
    body: JSON.stringify({
      sources: sources.slice(0, 10).map(({ id, url, title, sourceType }) => ({
        id,
        url,
        title,
        sourceType,
      })),
    }),
  });
  const body = (await response.json()) as { error?: unknown };
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : `Evidence extraction returned HTTP ${response.status}.`,
    );
  }
  return webEvidenceBundleSchema.parse(body);
}
