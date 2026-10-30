import { NextRequest, NextResponse } from "next/server";
import {
  META_MODEL_API_BASE_URL,
  metaApiKey,
  metaError,
} from "@/server/meta/model-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const key = metaApiKey(request);
  if (!key) {
    return NextResponse.json({
      configured: false,
      connected: false,
      source: "missing",
      models: ["muse-spark-1.3", "sam-3.1"],
    });
  }

  const response = await fetch(`${META_MODEL_API_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    return NextResponse.json(
      {
        configured: true,
        connected: false,
        source: request.headers.has("x-eida-meta-key")
          ? "session"
          : "environment",
        error: await metaError(response),
        models: [],
      },
      { status: response.status },
    );
  }

  const body = (await response.json()) as {
    data?: Array<{ id?: string }>;
  };
  const available = (body.data ?? [])
    .map((model) => model.id)
    .filter((id): id is string => typeof id === "string");
  return NextResponse.json({
    configured: true,
    connected: true,
    source: request.headers.has("x-eida-meta-key") ? "session" : "environment",
    models: available,
  });
}
