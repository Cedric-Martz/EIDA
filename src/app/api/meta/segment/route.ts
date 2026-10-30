import {
  decodeMaskToSVGPath,
  parseImageStream,
  recordsOfKind,
} from "@meta-sam/parser";
import { NextRequest, NextResponse } from "next/server";
import { localSegmentationResultSchema } from "@/domain/local-reconstruction";
import {
  META_MODEL_API_BASE_URL,
  fileToDataUrl,
  metaApiKey,
  metaError,
  metaHeaders,
  sseEvents,
} from "@/server/meta/model-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const key = metaApiKey(request);
  if (!key) {
    return NextResponse.json(
      { error: "Configure MODEL_API_KEY or enter a session key." },
      { status: 401 },
    );
  }
  const form = await request.formData();
  const photo = form.get("photo");
  const promptValue = form.get("prompt");
  if (!(photo instanceof File) || typeof promptValue !== "string") {
    return NextResponse.json(
      { error: "A photo and a SAM prompt are required." },
      { status: 400 },
    );
  }
  const prompt = promptValue.trim().slice(0, 120);
  if (!prompt) {
    return NextResponse.json(
      { error: "The SAM prompt is empty." },
      { status: 400 },
    );
  }
  const response = await fetch(`${META_MODEL_API_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      ...metaHeaders(key),
      Accept: "text/event-stream",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: "sam-3.1",
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: await fileToDataUrl(photo) },
          ],
        },
      ],
      metadata: { include_confidence: "true" },
      stream: true,
    }),
  });
  if (!response.ok) {
    return NextResponse.json(
      { error: await metaError(response) },
      { status: response.status },
    );
  }

  try {
    const parsed = await parseImageStream(sseEvents(response)).finalResult;
    const masks = recordsOfKind(parsed.records, "mask")
      .map((record) => ({
        objectId: record.objectId,
        bounds: record.bounds,
        width: record.mask.width,
        height: record.mask.height,
        svgPath: decodeMaskToSVGPath(record.mask),
        confidence: record.confidence ?? null,
      }))
      .sort(
        (left, right) => right.width * right.height - left.width * left.height,
      );
    const result = localSegmentationResultSchema.parse({
      prompt,
      masks,
      diagnostics: parsed.diagnostics.map(
        (diagnostic) => `${diagnostic.code}: ${diagnostic.message}`,
      ),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `SAM output could not be decoded: ${error.message}`
            : "SAM output could not be decoded.",
      },
      { status: 502 },
    );
  }
}
