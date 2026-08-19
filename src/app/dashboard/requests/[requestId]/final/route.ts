import { NextResponse } from "next/server";
import { requireDashboardContext } from "@/server/auth/guard";
import { IntegrityError, NotFoundError, StorageError } from "@/server/errors";
import { getStoredFinalPdfBytes, requireFinalizedDocument } from "@/server/forms/final-pdf";
import { getFormRequest } from "@/server/forms/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const tenant = await requireDashboardContext();
  const { requestId } = await context.params;

  try {
    const detail = await getFormRequest(tenant, requestId);
    requireFinalizedDocument(detail.document);

    const bytes = await getStoredFinalPdfBytes({
      organizationId: detail.document.organizationId,
      formRequestId: detail.request.id,
      formDocumentId: detail.document.id,
      finalPdfBlobKey: detail.document.finalPdfBlobKey,
      finalPdfSha256: detail.document.finalPdfSha256,
    });

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="audit-formulier.pdf"',
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
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
