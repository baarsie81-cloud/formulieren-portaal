import { NextResponse } from "next/server";
import { requireDashboardContext } from "@/server/auth/guard";
import { IntegrityError, NotFoundError, StorageError } from "@/server/errors";
import { readOrganizationSignaturePngBytes } from "@/server/organizations/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const tenant = await requireDashboardContext();

  try {
    const { bytes } = await readOrganizationSignaturePngBytes(tenant);

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": 'inline; filename="organisatiehandtekening.png"',
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
