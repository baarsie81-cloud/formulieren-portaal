import "server-only";

import { eq } from "drizzle-orm";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/audit/actions";
import { writeUserAuditEvent } from "@/server/audit/log";
import type { TenantContext } from "@/server/auth/tenant";
import { getDb } from "@/server/db";
import { organizations } from "@/server/db/schema";
import { NotFoundError, ValidationError } from "@/server/errors";
import type { OrganizationSignatureMetadataInput } from "@/server/organizations/schema";
import { sha256Hex } from "@/server/pdf/hash";
import {
  assertPdfSha256,
  getPrivatePngBytes,
  putPrivatePng,
} from "@/server/storage/blob";
import {
  assertOrganizationSignatureBlobKey,
  organizationSignaturePngBlobKey,
} from "@/server/storage/paths";

export type OrganizationSignatureProfile = {
  organizationId: string;
  organizationName: string;
  hasSignature: boolean;
  signaturePngBlobKey: string | null;
  signaturePngSha256: string | null;
  signerName: string | null;
  signerTitle: string | null;
};

export async function getOrganizationSignatureProfile(
  tenant: TenantContext,
): Promise<OrganizationSignatureProfile> {
  const organization = await getOrganizationRow(tenant.organizationId);

  return {
    organizationId: organization.id,
    organizationName: organization.name,
    hasSignature: Boolean(
      organization.signaturePngBlobKey && organization.signaturePngSha256,
    ),
    signaturePngBlobKey: organization.signaturePngBlobKey,
    signaturePngSha256: organization.signaturePngSha256,
    signerName: organization.signatureSignerName,
    signerTitle: organization.signatureSignerTitle,
  };
}

export async function updateOrganizationSignature(
  tenant: TenantContext,
  metadata: OrganizationSignatureMetadataInput,
  pngBytes: Uint8Array | null,
): Promise<OrganizationSignatureProfile> {
  const organization = await getOrganizationRow(tenant.organizationId);
  const hasExisting = Boolean(
    organization.signaturePngBlobKey && organization.signaturePngSha256,
  );

  if (!pngBytes && !hasExisting) {
    throw new ValidationError("Upload a PNG file");
  }

  let signaturePngBlobKey = organization.signaturePngBlobKey;
  let signaturePngSha256 = organization.signaturePngSha256;

  if (pngBytes) {
    const sha256 = sha256Hex(pngBytes);
    const blobKey = organizationSignaturePngBlobKey(tenant.organizationId, sha256);

    if (
      organization.signaturePngBlobKey !== blobKey ||
      organization.signaturePngSha256 !== sha256
    ) {
      await putPrivatePng(blobKey, pngBytes);
    }

    signaturePngBlobKey = blobKey;
    signaturePngSha256 = sha256;
  }

  const db = getDb();

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(organizations)
      .set({
        signaturePngBlobKey,
        signaturePngSha256,
        signatureSignerName: metadata.signerName,
        signatureSignerTitle: metadata.signerTitle,
      })
      .where(eq(organizations.id, tenant.organizationId))
      .returning();

    if (!row) {
      throw new NotFoundError("Organization not found");
    }

    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.ORGANIZATION_SIGNATURE_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.ORGANIZATION,
      entityId: tenant.organizationId,
      metadata: {
        replacedPng: Boolean(pngBytes),
      },
    });

    return row;
  });

  return {
    organizationId: updated.id,
    organizationName: updated.name,
    hasSignature: Boolean(updated.signaturePngBlobKey && updated.signaturePngSha256),
    signaturePngBlobKey: updated.signaturePngBlobKey,
    signaturePngSha256: updated.signaturePngSha256,
    signerName: updated.signatureSignerName,
    signerTitle: updated.signatureSignerTitle,
  };
}

export async function readOrganizationSignaturePngBytes(
  tenant: TenantContext,
): Promise<{ bytes: Uint8Array; sha256: string }> {
  const organization = await getOrganizationRow(tenant.organizationId);
  const blobKey = organization.signaturePngBlobKey;
  const sha256 = organization.signaturePngSha256;

  if (!blobKey || !sha256) {
    throw new NotFoundError("Organization signature not found");
  }

  assertOrganizationSignatureBlobKey(blobKey, tenant.organizationId, sha256);
  const bytes = await getPrivatePngBytes(blobKey);
  assertPdfSha256(bytes, sha256);

  return { bytes, sha256 };
}

async function getOrganizationRow(organizationId: string) {
  const db = getDb();
  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    throw new NotFoundError("Organization not found");
  }

  return organization;
}
