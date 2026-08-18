import { MAX_TEMPLATE_PDF_BYTES } from "@/lib/constants";
import { ValidationError } from "@/server/errors";

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

export function readPdfBytes(file: File): Promise<Uint8Array> {
  if (file.size <= 0) {
    throw new ValidationError("Upload a PDF file");
  }

  if (file.size > MAX_TEMPLATE_PDF_BYTES) {
    throw new ValidationError("PDF is too large");
  }

  const type = file.type.trim().toLowerCase();

  if (type && type !== "application/pdf") {
    throw new ValidationError("File must be a PDF");
  }

  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    assertPdfBytes(bytes);
    return bytes;
  });
}

export function assertPdfBytes(bytes: Uint8Array): void {
  if (bytes.byteLength <= 0) {
    throw new ValidationError("Upload a PDF file");
  }

  if (bytes.byteLength > MAX_TEMPLATE_PDF_BYTES) {
    throw new ValidationError("PDF is too large");
  }

  if (
    bytes.length < PDF_MAGIC.length ||
    PDF_MAGIC.some((value, index) => bytes[index] !== value)
  ) {
    throw new ValidationError("File must be a PDF");
  }
}
