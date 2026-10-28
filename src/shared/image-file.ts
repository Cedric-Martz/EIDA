const supportedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export type SupportedImageType = (typeof supportedImageTypes)[number];

export function isSupportedImageType(type: string): type is SupportedImageType {
  return supportedImageTypes.includes(type as SupportedImageType);
}

export async function hasMatchingImageSignature(file: Blob): Promise<boolean> {
  if (!isSupportedImageType(file.type)) return false;

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (file.type === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  return (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}
