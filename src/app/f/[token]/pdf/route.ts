import { NextResponse } from "next/server";
import { IntegrityError, NotFoundError, StorageError, TokenAccessError } from "@/server/errors";
import { getStoredTemplatePdfBytes } from "@/server/forms/final-pdf";
import { getPublicFormDocument } from "@/server/forms/public";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Serves the original (blank) template PDF for the public fill UI.
 * Auth matches /f/[token]/preview: valid token + form session cookie.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  try {
    const document = await getPublicFormDocument(token);
    const bytes = await getStoredTemplatePdfBytes({
      organizationId: document.organizationId,
      documentTemplateId: document.documentTemplateId,
      templateBlobKey: document.templateBlobKey,
      templateSha256: document.templateSha256,
    });

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="formulier.pdf"',
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    if (error instanceof TokenAccessError || error instanceof NotFoundError) {
      return new NextResponse("Not found", { status: 404 });
    }

    if (error instanceof IntegrityError) {
      return new NextResponse("Integrity check failed", { status: 409 });
    }

    if (error instanceof StorageError) {
      return new NextResponse("Storage is not configured", { status: 503 });
    }

    throw error;
  }
}
