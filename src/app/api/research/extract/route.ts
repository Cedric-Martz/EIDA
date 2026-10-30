import { NextResponse } from "next/server";
import { z } from "zod";
import {
  httpUrlSchema,
  researchSourceTypeSchema,
  webEvidenceBundleSchema,
} from "@/domain/research";
import { extractWebSource } from "@/server/research/web-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  sources: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(200),
        url: httpUrlSchema,
        title: z.string().trim().min(1).max(500),
        sourceType: researchSourceTypeSchema,
      }),
    )
    .min(1)
    .max(10),
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON source list." },
      { status: 400 },
    );
  }
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "The approved source list is invalid." },
      { status: 400 },
    );
  }

  const sources = await Promise.all(parsed.data.sources.map(extractWebSource));
  const bundle = webEvidenceBundleSchema.parse({
    schemaVersion: 1,
    extractedAt: Date.now(),
    sources,
  });
  return NextResponse.json(bundle, {
    headers: { "Cache-Control": "no-store" },
  });
}
