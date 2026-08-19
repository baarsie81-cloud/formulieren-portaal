import "server-only";

import { and, eq, isNull, or } from "drizzle-orm";
import { SIGNATURE_DECLARATION_TEXT } from "@/lib/constants";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/audit/actions";
import { writeClientAuditEvent } from "@/server/audit/log";
import { getDb } from "@/server/db";
import {
  acceptances,
  documentTemplates,
  formDocuments,
  formRequests,
  formSessions,
  organizations,
  secureTokens,
  signatures,
} from "@/server/db/schema";
import { ConflictError, TokenAccessError, ValidationError } from "@/server/errors";
import { readFormSessionCookie } from "@/server/forms/cookie";
import { getStoredTemplatePdfBytes } from "@/server/forms/final-pdf";
import { hashIp } from "@/server/forms/ip-hash";
import type { RequestMeta } from "@/server/forms/request-meta";
import { parseRawToken } from "@/server/forms/schema";
import {
  fillableFields,
  parseFieldsSchemaSnapshot,
} from "@/server/forms/snapshot";
import {
  effectiveRequestStatus,
  isSignableRequestStatus,
} from "@/server/forms/status";
import { hashSecret, hashesMatch } from "@/server/forms/token";
import { asFieldValueMap } from "@/server/forms/values";
import { getHmacSecret } from "@/server/env";
import { buildFinalPdfBytes } from "@/server/pdf/finalize";
import { sha256Hex } from "@/server/pdf/hash";
import { parseSignaturePngDataUrl } from "@/server/pdf/signature-image";
import {
  assertPdfSha256,
  deletePrivatePdf,
  putPrivatePdf,
  putPrivatePng,
} from "@/server/storage/blob";
import {
  finalPdfBlobKey,
  signaturePngBlobKey,
} from "@/server/storage/paths";

export type SignPublicFormInput = {
  signerName: string;
  method: "drawn" | "typed";
  signatureDataUrl: string;
  acceptedDeclaration: boolean;
};

type ResolvedSigningContext = {
  token: typeof secureTokens.$inferSelect;
  request: typeof formRequests.$inferSelect;
  document: typeof formDocuments.$inferSelect;
  session: typeof formSessions.$inferSelect & { nonce: string };
  snapshot: NonNullable<ReturnType<typeof parseFieldsSchemaSnapshot>>;
  organizationName: string;
  documentName: string;
};

export async function signAndFinalizePublicForm(
  rawToken: string,
  input: SignPublicFormInput,
  meta: RequestMeta,
): Promise<void> {
  validateSignInput(input);

  const resolved = await resolveSigningContext(rawToken);
  const signaturePngBytes = parseSignaturePngDataUrl(input.signatureDataUrl);
  const signatureSha256 = sha256Hex(signaturePngBytes);
  const signatureBlobPath = signaturePngBlobKey(
    resolved.document.organizationId,
    resolved.document.id,
    signatureSha256,
  );

  const templateBytes = await getStoredTemplatePdfBytes({
    organizationId: resolved.document.organizationId,
    documentTemplateId: resolved.document.documentTemplateId,
    templateBlobKey: resolved.document.templateBlobKey,
    templateSha256: resolved.document.templateSha256,
  });

  const now = new Date();

  const finalPdfBytes = await buildFinalPdfBytes({
    templateBytes,
    snapshot: resolved.snapshot,
    values: asFieldValueMap(resolved.document.fieldValues),
    signaturePngBytes,
    audit: {
      organizationName: resolved.organizationName,
      documentName: resolved.documentName,
      signerName: input.signerName.trim(),
      signedAt: now,
      declarationText: SIGNATURE_DECLARATION_TEXT,
      formDocumentId: resolved.document.id,
      formRequestId: resolved.request.id,
      templateSha256: resolved.document.templateSha256,
    },
  });

  const finalPdfSha256 = sha256Hex(finalPdfBytes);
  const finalBlobPath = finalPdfBlobKey(
    resolved.document.organizationId,
    resolved.request.id,
    resolved.document.id,
    finalPdfSha256,
  );
  const ipHash = hashIp(getHmacSecret(), meta.ip);
  const db = getDb();

  await putPrivatePng(signatureBlobPath, signaturePngBytes);

  try {
    await putPrivatePdf(finalBlobPath, finalPdfBytes);
  } catch (error) {
    await deletePrivatePdf(signatureBlobPath).catch(() => undefined);
    throw error;
  }

  assertPdfSha256(finalPdfBytes, finalPdfSha256);

  try {
    await db.transaction(async (tx) => {
      const [signature] = await tx
        .insert(signatures)
        .values({
          organizationId: resolved.document.organizationId,
          formDocumentId: resolved.document.id,
          formSessionId: resolved.session.id,
          signerName: input.signerName.trim(),
          method: input.method,
          signatureBlobKey: signatureBlobPath,
          signatureSha256,
        })
        .returning();

      if (!signature) {
        throw new Error("Failed to store signature");
      }

      const [acceptance] = await tx
        .insert(acceptances)
        .values({
          organizationId: resolved.document.organizationId,
          formDocumentId: resolved.document.id,
          formSessionId: resolved.session.id,
          declarationText: SIGNATURE_DECLARATION_TEXT,
          acceptedAt: now,
          ipHash,
          userAgent: meta.userAgent,
        })
        .returning();

      if (!acceptance) {
        throw new Error("Failed to store acceptance");
      }

      const [document] = await tx
        .update(formDocuments)
        .set({
          status: "finalized",
          finalPdfBlobKey: finalBlobPath,
          finalPdfSha256,
          finalizedAt: now,
        })
        .where(
          and(
            eq(formDocuments.organizationId, resolved.document.organizationId),
            eq(formDocuments.id, resolved.document.id),
            or(eq(formDocuments.status, "pending"), eq(formDocuments.status, "in_progress")),
          ),
        )
        .returning();

      if (!document) {
        throw new ConflictError("Document is already finalized");
      }

      await tx
        .update(formRequests)
        .set({
          status: "completed",
          completedAt: now,
        })
        .where(
          and(
            eq(formRequests.organizationId, resolved.request.organizationId),
            eq(formRequests.id, resolved.request.id),
          ),
        );

      await tx
        .update(secureTokens)
        .set({ revokedAt: now })
        .where(
          and(
            eq(secureTokens.organizationId, resolved.token.organizationId),
            eq(secureTokens.id, resolved.token.id),
            isNull(secureTokens.revokedAt),
          ),
        );

      await tx
        .update(formSessions)
        .set({ revokedAt: now, lastSeenAt: now })
        .where(
          and(
            eq(formSessions.organizationId, resolved.session.organizationId),
            eq(formSessions.id, resolved.session.id),
          ),
        );

      await writeClientAuditEvent(tx, {
        organizationId: resolved.request.organizationId,
        action: AUDIT_ACTIONS.SIGNATURE_CREATED,
        entityType: AUDIT_ENTITY_TYPES.SIGNATURE,
        entityId: signature.id,
        formRequestId: resolved.request.id,
        formDocumentId: resolved.document.id,
        formSessionId: resolved.session.id,
        ipHash,
        metadata: { method: input.method },
      });

      await writeClientAuditEvent(tx, {
        organizationId: resolved.request.organizationId,
        action: AUDIT_ACTIONS.ACCEPTANCE_RECORDED,
        entityType: AUDIT_ENTITY_TYPES.ACCEPTANCE,
        entityId: acceptance.id,
        formRequestId: resolved.request.id,
        formDocumentId: resolved.document.id,
        formSessionId: resolved.session.id,
        ipHash,
      });

      await writeClientAuditEvent(tx, {
        organizationId: resolved.request.organizationId,
        action: AUDIT_ACTIONS.FORM_DOCUMENT_FINALIZED,
        entityType: AUDIT_ENTITY_TYPES.FORM_DOCUMENT,
        entityId: resolved.document.id,
        formRequestId: resolved.request.id,
        formDocumentId: resolved.document.id,
        formSessionId: resolved.session.id,
        ipHash,
        metadata: { finalPdfSha256 },
      });
    });
  } catch (error) {
    await deletePrivatePdf(signatureBlobPath).catch(() => undefined);
    await deletePrivatePdf(finalBlobPath).catch(() => undefined);
    throw error;
  }
}

function validateSignInput(input: SignPublicFormInput): void {
  const signerName = input.signerName.trim();

  if (signerName.length < 2 || signerName.length > 200) {
    throw new ValidationError("Vul je volledige naam in");
  }

  if (input.method !== "drawn" && input.method !== "typed") {
    throw new ValidationError("Ongeldige handtekeningmethode");
  }

  if (!input.acceptedDeclaration) {
    throw new ValidationError("Je moet akkoord gaan met de verklaring");
  }
}

async function resolveSigningContext(rawToken: string): Promise<ResolvedSigningContext> {
  const tokenValue = parseRawToken(rawToken);

  if (!tokenValue) {
    throw new TokenAccessError();
  }

  const db = getDb();
  const [token] = await db
    .select()
    .from(secureTokens)
    .where(eq(secureTokens.tokenHash, hashSecret(tokenValue)))
    .limit(1);

  if (!token || token.revokedAt != null || token.expiresAt.getTime() <= Date.now()) {
    throw new TokenAccessError();
  }

  const [row] = await db
    .select({
      request: formRequests,
      document: formDocuments,
      organizationName: organizations.name,
      documentName: documentTemplates.name,
    })
    .from(formRequests)
    .innerJoin(
      formDocuments,
      and(
        eq(formDocuments.organizationId, formRequests.organizationId),
        eq(formDocuments.formRequestId, formRequests.id),
      ),
    )
    .innerJoin(organizations, eq(organizations.id, formRequests.organizationId))
    .innerJoin(
      documentTemplates,
      and(
        eq(documentTemplates.organizationId, formDocuments.organizationId),
        eq(documentTemplates.id, formDocuments.documentTemplateId),
      ),
    )
    .where(
      and(
        eq(formRequests.organizationId, token.organizationId),
        eq(formRequests.id, token.formRequestId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new TokenAccessError();
  }

  const status = effectiveRequestStatus(row.request.status, row.request.expiresAt);

  if (!isSignableRequestStatus(status)) {
    throw new TokenAccessError();
  }

  if (row.document.status === "finalized") {
    throw new ConflictError("Document is already finalized");
  }

  const snapshot = parseFieldsSchemaSnapshot(row.document.fieldsSchemaSnapshot);

  if (!snapshot) {
    throw new TokenAccessError();
  }

  const cookie = await readFormSessionCookie();

  if (!cookie) {
    throw new TokenAccessError();
  }

  const [session] = await db
    .select()
    .from(formSessions)
    .where(
      and(
        eq(formSessions.organizationId, token.organizationId),
        eq(formSessions.id, cookie.sessionId),
        eq(formSessions.formRequestId, token.formRequestId),
        eq(formSessions.secureTokenId, token.id),
        isNull(formSessions.revokedAt),
      ),
    )
    .limit(1);

  if (!session || !hashesMatch(session.nonceHash, hashSecret(cookie.nonce))) {
    throw new TokenAccessError();
  }

  const fillSubmitted = session.completedAt != null;
  const hasFillableFields = fillableFields(snapshot).length > 0;

  if (hasFillableFields && !fillSubmitted) {
    throw new ConflictError("Form must be submitted before signing");
  }

  if (row.document.status !== "in_progress" && row.document.status !== "pending") {
    throw new ConflictError("Document cannot be signed");
  }

  return {
    token,
    request: { ...row.request, status },
    document: row.document,
    session: { ...session, nonce: cookie.nonce },
    snapshot,
    organizationName: row.organizationName,
    documentName: row.documentName,
  };
}
