import { NextResponse } from "next/server";
import { cadAnalysisSchema } from "@/domain/research";
import { analyzeCadArtifact } from "@/server/research/cad-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CAD_BYTES = 12_000_000;

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "A technical file is required." },
      { status: 400 },
    );
  }
  if (file.size === 0 || file.size > MAX_CAD_BYTES) {
    return NextResponse.json(
      { error: "Technical files must be between 1 byte and 12 MB." },
      { status: 413 },
    );
  }

  const safeName = (file.name || "technical-file")
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, "-")
    .slice(0, 500);
  const analysis = cadAnalysisSchema.parse(
    analyzeCadArtifact({
      body: Buffer.from(await file.arrayBuffer()),
      url: `https://local.eida.invalid/${encodeURIComponent(safeName)}`,
      ...(file.type ? { mediaType: file.type } : {}),
    }),
  );
  return NextResponse.json(
    { analysis },
    { headers: { "Cache-Control": "no-store" } },
  );
}
