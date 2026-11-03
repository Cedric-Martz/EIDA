import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { localGeometryPlanSchema } from "@/domain/local-reconstruction";
import {
  ALLOWED_INVENTORY_MODELS,
  MAX_GEOMETRY_VISUALS,
  MAX_INVENTORY_PARTS,
  MAX_SOURCE_IMAGES,
  MAX_USER_PHOTOS,
  META_MODELS,
} from "@/config/meta-models";
import {
  META_MODEL_API_BASE_URL,
  fileToDataUrl,
  metaApiKey,
  metaError,
  metaHeaders,
} from "@/server/meta/model-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const sourceImagesSchema = z
  .array(
    z.object({
      sourceId: z.string().trim().min(1).max(200),
      url: z.string().url().max(4_096).startsWith("https://"),
      alt: z.string().trim().max(500),
    }),
  )
  .max(MAX_SOURCE_IMAGES);

const analysisSchema = z.object({
  deviceLabel: z.string().trim().min(1).max(500),
  dimensionsMm: z.tuple([
    z.number().positive(),
    z.number().positive(),
    z.number().positive(),
  ]),
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(120),
        category: z.string().trim().min(1).max(80),
        description: z.string().trim().min(1).max(500),
        imageIndex: z.number().int().min(1).max(48),
        documentedDimensionsMm: z
          .tuple([
            z.number().positive(),
            z.number().positive(),
            z.number().positive(),
          ])
          .nullable(),
        mask: z.object({
          bounds: z.object({
            left: z.number().int().nonnegative(),
            top: z.number().int().nonnegative(),
            right: z.number().int().positive(),
            bottom: z.number().int().positive(),
          }),
          width: z.number().int().positive(),
          height: z.number().int().positive(),
          confidence: z.number().min(0).max(1).nullable(),
        }),
      }),
    )
    .min(1)
    .max(MAX_INVENTORY_PARTS),
});

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
    .slice(0, Math.min(MAX_USER_PHOTOS, MAX_GEOMETRY_VISUALS));
  const analysisValue = form.get("analysis");
  if (typeof analysisValue !== "string") {
    return NextResponse.json(
      { error: "Geometry analysis context is required." },
      { status: 400 },
    );
  }
  let analysis: z.infer<typeof analysisSchema>;
  try {
    const parsed = analysisSchema.safeParse(JSON.parse(analysisValue));
    if (!parsed.success) throw new Error("invalid analysis");
    analysis = parsed.data;
  } catch {
    return NextResponse.json(
      { error: "Geometry analysis context is invalid." },
      { status: 400 },
    );
  }

  let sourceImages: z.infer<typeof sourceImagesSchema> = [];
  const sourceImagesValue = form.get("sourceImages");
  if (typeof sourceImagesValue === "string" && sourceImagesValue) {
    try {
      const parsed = sourceImagesSchema.safeParse(
        JSON.parse(sourceImagesValue),
      );
      if (parsed.success) sourceImages = parsed.data;
    } catch {
      sourceImages = [];
    }
  }
  sourceImages = sourceImages.slice(
    0,
    Math.max(0, MAX_GEOMETRY_VISUALS - photos.length),
  );

  const modelValue = form.get("model");
  const model =
    typeof modelValue === "string" && ALLOWED_INVENTORY_MODELS.has(modelValue)
      ? modelValue
      : META_MODELS.inventory;
  const localVisuals = await Promise.all(
    photos.map(async (photo, index) => ({
      type: "image_url" as const,
      image_url: {
        url: await fileToDataUrl(photo),
        detail: "high" as const,
      },
      index: index + 1,
    })),
  );
  const visualContent = [
    ...localVisuals.flatMap((visual) => [
      {
        type: "text" as const,
        text: `Visual ${visual.index}: user photograph.`,
      },
      { type: visual.type, image_url: visual.image_url },
    ]),
    ...sourceImages.flatMap((image, index) => [
      {
        type: "text" as const,
        text: `Visual ${photos.length + index + 1}: public evidence from ${image.sourceId}${image.alt ? `; ${image.alt}` : ""}.`,
      },
      {
        type: "image_url" as const,
        image_url: { url: image.url, detail: "auto" as const },
      },
    ]),
  ];

  const response = await fetch(`${META_MODEL_API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: metaHeaders(key),
    cache: "no-store",
    signal: AbortSignal.timeout(110_000),
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "developer",
          content: `You are the geometry reconciliation layer of an evidence-grounded 3D reconstruction system. Camera perspective makes a real rectangle look trapezoidal and changes apparent proportions, so never treat a single SAM silhouette as an orthographic drawing. Compare all available views, the mask bounds, the known device envelope and documented component dimensions. For each requested part, infer a canonical unprojected geometry.

Choose rounded_box, box, cylinder, sphere or plane for manufactured regular parts. Choose mask_profile only for genuinely irregular outlines such as flex cables or uniquely shaped boards; its dimensions still define the corrected orthographic envelope. dimensionsMm is [long side, short side, depth]. Preserve documented dimensions exactly. Otherwise estimate conservative dimensions relative to the known device envelope and mark the appropriate basis and confidence. cornerRadiusMm must be a positive number only for rounded_box and null for every other primitive. Do not claim measurement accuracy from perspective alone. Return exactly one item for every supplied part ID and no unknown IDs.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Reconcile these segmented parts: ${JSON.stringify(analysis)}. The following visuals use the same ordering referenced by imageIndex.`,
            },
            ...visualContent,
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "eida_geometry_reconciliation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["items", "notes"],
            properties: {
              items: {
                type: "array",
                minItems: analysis.items.length,
                maxItems: analysis.items.length,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "id",
                    "primitive",
                    "dimensionsMm",
                    "cornerRadiusMm",
                    "confidence",
                    "basis",
                    "rationale",
                  ],
                  properties: {
                    id: { type: "string" },
                    primitive: {
                      type: "string",
                      enum: [
                        "mask_profile",
                        "box",
                        "rounded_box",
                        "cylinder",
                        "sphere",
                        "plane",
                      ],
                    },
                    dimensionsMm: {
                      type: "array",
                      minItems: 3,
                      maxItems: 3,
                      items: { type: "number", exclusiveMinimum: 0 },
                    },
                    cornerRadiusMm: {
                      anyOf: [
                        { type: "number", exclusiveMinimum: 0 },
                        { type: "null" },
                      ],
                    },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    basis: {
                      type: "string",
                      enum: ["multi-view", "documented", "single-view"],
                    },
                    rationale: { type: "string" },
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
      { error: "Muse returned no geometry plan." },
      { status: 502 },
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return NextResponse.json(
      { error: "Muse returned invalid geometry JSON." },
      { status: 502 },
    );
  }
  const parsed = localGeometryPlanSchema.safeParse(json);
  const expectedIds = new Set(analysis.items.map((item) => item.id));
  if (
    !parsed.success ||
    parsed.data.items.length !== expectedIds.size ||
    new Set(parsed.data.items.map((item) => item.id)).size !==
      expectedIds.size ||
    parsed.data.items.some((item) => !expectedIds.has(item.id))
  ) {
    return NextResponse.json(
      { error: "Muse returned an invalid or incomplete geometry plan." },
      { status: 502 },
    );
  }
  return NextResponse.json({ plan: parsed.data, usage: body.usage ?? null });
}
