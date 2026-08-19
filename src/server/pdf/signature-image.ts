import { MAX_SIGNATURE_PNG_BYTES } from "@/lib/constants";
import { ValidationError } from "@/server/errors";

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function parseSignaturePngDataUrl(value: string): Uint8Array {
  const trimmed = value.trim();

  if (!trimmed.startsWith("data:image/png;base64,")) {
    throw new ValidationError("Handtekening moet een PNG-afbeelding zijn");
  }

  const base64 = trimmed.slice("data:image/png;base64,".length);

  let bytes: Uint8Array;

  try {
    bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  } catch {
    throw new ValidationError("Handtekening kon niet worden gelezen");
  }

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SIGNATURE_PNG_BYTES) {
    throw new ValidationError("Handtekening is te groot");
  }

  if (!hasPngHeader(bytes)) {
    throw new ValidationError("Handtekening moet een PNG-afbeelding zijn");
  }

  return bytes;
}

function hasPngHeader(bytes: Uint8Array): boolean {
  if (bytes.byteLength < PNG_SIGNATURE.byteLength) {
    return false;
  }

  for (let index = 0; index < PNG_SIGNATURE.byteLength; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      return false;
    }
  }

  return true;
}
