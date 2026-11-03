import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchPublicEvidenceImage } from "@/server/research/web-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  url: z
    .string()
    .url()
    .max(4_096)
    .refine((value) => value.startsWith("https://")),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid source image URL." },
        { status: 400 },
      );
    }
    const image = await fetchPublicEvidenceImage(parsed.data.url);
    return new Response(new Uint8Array(image.body), {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Type": image.mediaType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Source image download failed.",
      },
      { status: 502 },
    );
  }
}
