import { NextResponse } from "next/server";
import { requireDashboardContext } from "@/server/auth/guard";
import { IntegrityError, NotFoundError, StorageError } from "@/server/errors";
import { readTemplatePdfBytes } from "@/server/templates/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ templateId: string }> },
) {
  const tenant = await requireDashboardContext();
  const { templateId } = await context.params;

  try {
    const { template, bytes } = await readTemplatePdfBytes(tenant, templateId);
    const filename = downloadFilename(template.name);

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
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

function downloadFilename(name: string): string {
  const base =
    name
      .normalize("NFKD")
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "sjabloon";

  return `${base}.pdf`;
}
