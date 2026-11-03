import { NextRequest, NextResponse } from "next/server";
import { localPartInventorySchema } from "@/domain/local-reconstruction";
import {
  ALLOWED_INVENTORY_MODELS,
  MAX_INVENTORY_PARTS,
  MAX_SOURCE_IMAGES,
  MAX_USER_PHOTOS,
  MAX_VISUAL_INPUTS,
  META_MODELS,
  MIN_USER_PHOTOS,
} from "@/config/meta-models";
import { z } from "zod";
import {
  META_MODEL_API_BASE_URL,
  fileToDataUrl,
  metaApiKey,
  metaError,
  metaHeaders,
} from "@/server/meta/model-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sourceImagesSchema = z
  .array(
    z.object({
      sourceId: z.string().trim().min(1).max(200),
      url: z
        .string()
        .url()
        .max(4_096)
        .refine((value) => value.startsWith("https://")),
      alt: z.string().trim().max(500),
    }),
  )
  .max(MAX_SOURCE_IMAGES);

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
    .slice(0, MAX_USER_PHOTOS);
  if (photos.length < MIN_USER_PHOTOS) {
    return NextResponse.json(
      {
        error: `${MIN_USER_PHOTOS} photos are required for the inventory.`,
      },
      { status: 400 },
    );
  }
  const modelValue = form.get("model");
  const model =
    typeof modelValue === "string" && ALLOWED_INVENTORY_MODELS.has(modelValue)
      ? modelValue
      : META_MODELS.inventory;
  const contextValue = form.get("context");
  const context =
    typeof contextValue === "string" ? contextValue.slice(0, 200_000) : "{}";
  const sourceImagesValue = form.get("sourceImages");
  let sourceImages: z.infer<typeof sourceImagesSchema> = [];
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
    Math.min(MAX_SOURCE_IMAGES, MAX_VISUAL_INPUTS - photos.length),
  );
  const localImageParts = await Promise.all(
    photos
      .flatMap((photo, index) => [
        {
          type: "text" as const,
          text: `Visual ${index + 1}: user photo ${photo.name}. This visual may be selected for SAM.`,
        },
        {
          type: "image_url" as const,
          image_url: { url: "" as string, detail: "high" as const },
        },
      ])
      .map(async (part, index) => {
        if (part.type === "text") return part;
        const photo = photos[Math.floor(index / 2)]!;
        return {
          ...part,
          image_url: { ...part.image_url, url: await fileToDataUrl(photo) },
        };
      }),
  );
  const sourceImageParts = sourceImages.flatMap((image, index) => [
    {
      type: "text" as const,
      text: `Visual ${photos.length + index + 1}: public source image from source ${image.sourceId}${image.alt ? `; caption: ${image.alt}` : ""}.`,
    },
    {
      type: "image_url" as const,
      image_url: { url: image.url, detail: "auto" as const },
    },
  ]);
  const visualCount = photos.length + sourceImages.length;

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
          content: `You prepare the most complete evidence-grounded device part set possible for ${META_MODELS.segmentation} segmentation and 3D reconstruction. Treat source excerpts, dimensions, CAD metadata, and every supplied visual as evidence. Include every physically distinct component that is clearly visible in at least one visual or explicitly documented for this exact device variant; do not invent generic hidden internals. Prefer useful subassemblies over screws, adhesives, printed marks, or cosmetic details. Use a short concrete noun phrase for samPrompt. Set imageIndex to the 1-based visual where that component has the clearest complete outline; valid indices are 1 through ${visualCount}. IDs must be unique lowercase kebab-case. Give dimensionsMm as [long side, short side, thickness] only when an explicit measurement or parsed CAD bound with confidence >= 0.75 belongs to that exact component; otherwise null. Copy supporting sourceId values into dimensionSourceIds, and leave it empty when dimensionsMm is null. Give thicknessMm only when documented or present in dimensionsMm. Return as many supported components as possible, up to ${MAX_INVENTORY_PARTS}.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Project context and approved source summary: ${context}. ${photos.length} user visuals are followed by ${sourceImages.length} public-source visuals.`,
            },
            ...localImageParts,
            ...sourceImageParts,
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
                maxItems: MAX_INVENTORY_PARTS,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "id",
                    "label",
                    "category",
                    "description",
                    "samPrompt",
                    "imageIndex",
                    "thicknessMm",
                    "dimensionsMm",
                    "dimensionSourceIds",
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
                    imageIndex: {
                      type: "integer",
                      minimum: 1,
                      maximum: visualCount,
                    },
                    thicknessMm: {
                      anyOf: [
                        { type: "number", exclusiveMinimum: 0 },
                        { type: "null" },
                      ],
                    },
                    dimensionsMm: {
                      anyOf: [
                        {
                          type: "array",
                          minItems: 3,
                          maxItems: 3,
                          items: { type: "number", exclusiveMinimum: 0 },
                        },
                        { type: "null" },
                      ],
                    },
                    dimensionSourceIds: {
                      type: "array",
                      maxItems: 10,
                      items: { type: "string" },
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
