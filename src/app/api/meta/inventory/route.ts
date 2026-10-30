import { NextRequest, NextResponse } from "next/server";
import { localPartInventorySchema } from "@/domain/local-reconstruction";
import {
  META_MODEL_API_BASE_URL,
  fileToDataUrl,
  metaApiKey,
  metaError,
  metaHeaders,
} from "@/server/meta/model-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedModels = new Set(["muse-spark-1.3", "muse-spark-1.3-contributor"]);

export async function POST(request: NextRequest) {
  const key = metaApiKey(request);
  if (!key) {
    return NextResponse.json(
      { error: "Configure MODEL_API_KEY or enter a session key." },
      { status: 401 },
    );
  }
  const form = await request.formData();
  const photos = form
    .getAll("photos")
    .filter((value): value is File => value instanceof File)
    .slice(0, 6);
  if (photos.length < 3) {
    return NextResponse.json(
      { error: "Three photos are required for the inventory." },
      { status: 400 },
    );
  }
  const modelValue = form.get("model");
  const model =
    typeof modelValue === "string" && allowedModels.has(modelValue)
      ? modelValue
      : "muse-spark-1.3";
  const contextValue = form.get("context");
  const context =
    typeof contextValue === "string" ? contextValue.slice(0, 50_000) : "{}";
  const imageParts = await Promise.all(
    photos.map(async (photo) => ({
      type: "image_url",
      image_url: { url: await fileToDataUrl(photo), detail: "high" },
    })),
  );

  const response = await fetch(`${META_MODEL_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: metaHeaders(key),
    cache: "no-store",
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "developer",
          content:
            "You prepare device parts for SAM 3.1 segmentation and evidence-grounded 3D reconstruction. Treat webEvidence excerpts, dimensions and technical artifacts as cited evidence, not as suggestions. Return only parts documented by those sources or visibly separable in the supplied photos. Never invent hidden internals. Use a short concrete noun phrase for samPrompt, not an instruction. Pick photoIndex 1 through 6 where the complete outline is most visible. IDs must be unique lowercase kebab-case. Give thicknessMm only when documented, measured, printed, or clearly supplied in context; otherwise null. Limit the list to the 10 most useful parts.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Project context and approved source summary: ${context}`,
            },
            ...imageParts,
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "eida_local_part_inventory",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["items", "notes"],
            properties: {
              items: {
                type: "array",
                minItems: 1,
                maxItems: 10,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "id",
                    "label",
                    "category",
                    "description",
                    "samPrompt",
                    "photoIndex",
                    "thicknessMm",
                  ],
                  properties: {
                    id: {
                      type: "string",
                      pattern: "^[a-z0-9][a-z0-9-]*$",
                    },
                    label: { type: "string" },
                    category: { type: "string" },
                    description: { type: "string" },
                    samPrompt: { type: "string" },
                    photoIndex: {
                      type: "integer",
                      minimum: 1,
                      maximum: 6,
                    },
                    thicknessMm: {
                      anyOf: [
                        { type: "number", exclusiveMinimum: 0 },
                        { type: "null" },
                      ],
                    },
                  },
                },
              },
              notes: { type: "string" },
            },
          },
        },
      },
    }),
  });
  if (!response.ok) {
    return NextResponse.json(
      { error: await metaError(response) },
      { status: response.status },
    );
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: unknown;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json(
      { error: "Muse returned no structured inventory." },
      { status: 502 },
    );
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    return NextResponse.json(
      { error: "Muse returned invalid JSON." },
      { status: 502 },
    );
  }
  const parsed = localPartInventorySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Muse returned an invalid part inventory." },
      { status: 502 },
    );
  }
  return NextResponse.json({
    inventory: parsed.data,
    usage: body.usage ?? null,
  });
}
