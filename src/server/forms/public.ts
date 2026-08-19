import "server-only";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/audit/actions";
import { writeClientAuditEvent } from "@/server/audit/log";
import { getDb } from "@/server/db";
import {
  formDocuments,
  formRequests,
  formSessions,
  organizations,
  secureTokens,
} from "@/server/db/schema";
import { getHmacSecret } from "@/server/env";
import { ConflictError, TokenAccessError } from "@/server/errors";
import {
  readFormSessionCookie,
  writeFormSessionCookie,
} from "@/server/forms/cookie";
import { hashIp } from "@/server/forms/ip-hash";
import type { RequestMeta } from "@/server/forms/request-meta";
import { parseRawToken } from "@/server/forms/schema";
import {
  fillableFields,
  parseFieldsSchemaSnapshot,
  type FieldSchemaSnapshot,
} from "@/server/forms/snapshot";
import {
  effectiveRequestStatus,
  isOpenableRequestStatus,
  isWritableRequestStatus,
} from "@/server/forms/status";
import { generateRawSecret, hashSecret, hashesMatch } from "@/server/forms/token";
import {
  asFieldValueMap,
  mergeFieldValues,
  parseFieldValues,
  type ParseFieldValuesResult,
} from "@/server/forms/values";
import type { FieldValueMap } from "@/server/pdf/fill";

export type PublicFormContext = {
  organizationName: string;
  recipientName: string;
  started: boolean;
  fillSubmitted: boolean;
  readyForSigning: boolean;
  finalized: boolean;
  snapshot: FieldSchemaSnapshot[];
  values: FieldValueMap;
};

type ResolvedToken = {
  token: typeof secureTokens.$inferSelect;
  request: typeof formRequests.$inferSelect;
  document: typeof formDocuments.$inferSelect;
  organizationName: string;
  snapshot: FieldSchemaSnapshot[];
};

export async function getPublicFormContext(rawToken: string): Promise<PublicFormContext> {
  const resolved = await resolvePublicToken(rawToken);
  const session = await loadMatchingSession(resolved);
  const fillSubmitted = await hasSubmittedFill(
    resolved.request.organizationId,
    resolved.request.id,
  );
  const fillable = fillableFields(resolved.snapshot);

  return {
    organizationName: resolved.organizationName,
    recipientName: resolved.request.recipientName,
    started: session != null,
    fillSubmitted,
    readyForSigning:
      session != null &&
      (fillSubmitted || fillable.length === 0) &&
      resolved.document.status !== "finalized",
    finalized: resolved.document.status === "finalized",
    snapshot: resolved.snapshot,
    values: asFieldValueMap(resolved.document.fieldValues),
  };
}

export async function startPublicFormSession(rawToken: string, meta: RequestMeta) {
  const resolved = await resolvePublicToken(rawToken);
  const existing = await loadMatchingSession(resolved);

  if (existing) {
    await touchSession(existing.id, resolved.token.organizationId, resolved.token.id, meta);
    await writeFormSessionCookie(
      existing.id,
      existing.nonce,
      secondsUntil(resolved.token.expiresAt),
    );
    return;
  }

  const nonce = generateRawSecret();
  const ipHash = hashIp(getHmacSecret(), meta.ip);
  const now = new Date();
  const db = getDb();

  const session = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(formSessions)
      .values({
        organizationId: resolved.request.organizationId,
        formRequestId: resolved.request.id,
        secureTokenId: resolved.token.id,
        nonceHash: hashSecret(nonce),
        ipHash,
        userAgent: meta.userAgent,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create form session");
    }

    if (resolved.request.status === "sent") {
      await tx
        .update(formRequests)
        .set({
          status: "opened",
          openedAt: now,
        })
        .where(
          and(
            eq(formRequests.organizationId, resolved.request.organizationId),
            eq(formRequests.id, resolved.request.id),
            eq(formRequests.status, "sent"),
          ),
        );

      await writeClientAuditEvent(tx, {
        organizationId: resolved.request.organizationId,
        action: AUDIT_ACTIONS.FORM_REQUEST_OPENED,
        entityType: AUDIT_ENTITY_TYPES.FORM_REQUEST,
        entityId: resolved.request.id,
        formRequestId: resolved.request.id,
        formSessionId: created.id,
        ipHash,
      });
    }

    await tx
      .update(secureTokens)
      .set({ lastUsedAt: now })
      .where(
        and(
          eq(secureTokens.organizationId, resolved.token.organizationId),
          eq(secureTokens.id, resolved.token.id),
        ),
      );

    await writeClientAuditEvent(tx, {
      organizationId: resolved.request.organizationId,
      action: AUDIT_ACTIONS.FORM_SESSION_STARTED,
      entityType: AUDIT_ENTITY_TYPES.FORM_SESSION,
      entityId: created.id,
      formRequestId: resolved.request.id,
      formSessionId: created.id,
      ipHash,
    });

    return created;
  });

  await writeFormSessionCookie(session.id, nonce, secondsUntil(resolved.token.expiresAt));
}

export async function savePublicFormValues(
  rawToken: string,
  rawValues: Record<string, unknown>,
  meta: RequestMeta,
): Promise<ParseFieldValuesResult> {
  return persistPublicFormValues(rawToken, rawValues, meta, "draft");
}

export async function submitPublicFormFill(
  rawToken: string,
  rawValues: Record<string, unknown>,
  meta: RequestMeta,
): Promise<ParseFieldValuesResult> {
  return persistPublicFormValues(rawToken, rawValues, meta, "submit");
}

export async function getPublicFormDocument(rawToken: string) {
  const resolved = await resolvePublicToken(rawToken);
  const session = await loadMatchingSession(resolved);

  if (!session) {
    throw new TokenAccessError();
  }

  return resolved.document;
}

async function persistPublicFormValues(
  rawToken: string,
  rawValues: Record<string, unknown>,
  meta: RequestMeta,
  mode: "draft" | "submit",
): Promise<ParseFieldValuesResult> {
  const resolved = await resolvePublicToken(rawToken);
  const session = await loadMatchingSession(resolved);

  if (!session) {
    throw new TokenAccessError();
  }

  if (!isWritableRequestStatus(effectiveRequestStatus(resolved.request.status, resolved.request.expiresAt))) {
    throw new TokenAccessError();
  }

  const fillSubmitted = await hasSubmittedFill(
    resolved.request.organizationId,
    resolved.request.id,
  );

  if (fillSubmitted) {
    throw new ConflictError("Form is already submitted");
  }

  const parsed = parseFieldValues(resolved.snapshot, rawValues, mode);

  if (!parsed.success) {
    return parsed;
  }

  const current = asFieldValueMap(resolved.document.fieldValues);
  const nextValues =
    mode === "submit" ? { ...current, ...parsed.data } : mergeFieldValues(current, parsed.data);
  const now = new Date();
  const ipHash = hashIp(getHmacSecret(), meta.ip);
  const fieldCount = fillableFields(resolved.snapshot).filter(
    (field) => nextValues[field.valueKey] !== undefined,
  ).length;
  const db = getDb();

  await db.transaction(async (tx) => {
    const [document] = await tx
      .update(formDocuments)
      .set({
        fieldValues: nextValues,
        status: "in_progress",
      })
      .where(
        and(
          eq(formDocuments.organizationId, resolved.document.organizationId),
          eq(formDocuments.id, resolved.document.id),
        ),
      )
      .returning();

    if (!document) {
      throw new TokenAccessError();
    }

    if (resolved.request.status === "opened" || resolved.request.status === "sent") {
      await tx
        .update(formRequests)
        .set({
          status: "in_progress",
          openedAt: resolved.request.openedAt ?? now,
        })
        .where(
          and(
            eq(formRequests.organizationId, resolved.request.organizationId),
            eq(formRequests.id, resolved.request.id),
          ),
        );
    }

    if (mode === "submit") {
      await tx
        .update(formSessions)
        .set({
          completedAt: now,
          lastSeenAt: now,
        })
        .where(
          and(
            eq(formSessions.organizationId, session.organizationId),
            eq(formSessions.id, session.id),
          ),
        );
    } else {
      await tx
        .update(formSessions)
        .set({ lastSeenAt: now })
        .where(
          and(
            eq(formSessions.organizationId, session.organizationId),
            eq(formSessions.id, session.id),
          ),
        );
    }

    await tx
      .update(secureTokens)
      .set({ lastUsedAt: now })
      .where(
        and(
          eq(secureTokens.organizationId, resolved.token.organizationId),
          eq(secureTokens.id, resolved.token.id),
        ),
      );

    await writeClientAuditEvent(tx, {
      organizationId: resolved.request.organizationId,
      action:
        mode === "submit"
          ? AUDIT_ACTIONS.FORM_DOCUMENT_FILL_SUBMITTED
          : AUDIT_ACTIONS.FORM_DOCUMENT_SAVED,
      entityType: AUDIT_ENTITY_TYPES.FORM_DOCUMENT,
      entityId: resolved.document.id,
      formRequestId: resolved.request.id,
      formDocumentId: resolved.document.id,
      formSessionId: session.id,
      ipHash,
      metadata: { fieldCount },
    });
  });

  return parsed;
}

async function resolvePublicToken(rawToken: string): Promise<ResolvedToken> {
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

  if (status === "expired" && row.request.status !== "expired") {
    await db
      .update(formRequests)
      .set({ status: "expired" })
      .where(
        and(
          eq(formRequests.organizationId, row.request.organizationId),
          eq(formRequests.id, row.request.id),
        ),
      );
  }

  if (!isOpenableRequestStatus(status)) {
    throw new TokenAccessError();
  }

  const snapshot = parseFieldsSchemaSnapshot(row.document.fieldsSchemaSnapshot);

  if (!snapshot) {
    throw new TokenAccessError();
  }

  return {
    token,
    request: { ...row.request, status },
    document: row.document,
    organizationName: row.organizationName,
    snapshot,
  };
}

async function loadMatchingSession(resolved: ResolvedToken) {
  const cookie = await readFormSessionCookie();

  if (!cookie) {
    return null;
  }

  const [session] = await getDb()
    .select()
    .from(formSessions)
    .where(
      and(
        eq(formSessions.organizationId, resolved.token.organizationId),
        eq(formSessions.id, cookie.sessionId),
        eq(formSessions.formRequestId, resolved.token.formRequestId),
        eq(formSessions.secureTokenId, resolved.token.id),
        isNull(formSessions.revokedAt),
      ),
    )
    .limit(1);

  if (!session || !hashesMatch(session.nonceHash, hashSecret(cookie.nonce))) {
    return null;
  }

  return { ...session, nonce: cookie.nonce };
}

async function touchSession(
  sessionId: string,
  organizationId: string,
  tokenId: string,
  meta: RequestMeta,
) {
  const now = new Date();
  const db = getDb();

  await db
    .update(formSessions)
    .set({
      lastSeenAt: now,
      userAgent: meta.userAgent,
    })
    .where(
      and(eq(formSessions.organizationId, organizationId), eq(formSessions.id, sessionId)),
    );

  await db
    .update(secureTokens)
    .set({ lastUsedAt: now })
    .where(and(eq(secureTokens.organizationId, organizationId), eq(secureTokens.id, tokenId)));
}

async function hasSubmittedFill(organizationId: string, requestId: string) {
  const [submitted] = await getDb()
    .select({ id: formSessions.id })
    .from(formSessions)
    .where(
      and(
        eq(formSessions.organizationId, organizationId),
        eq(formSessions.formRequestId, requestId),
        isNotNull(formSessions.completedAt),
      ),
    )
    .limit(1);

  return Boolean(submitted);
}

function secondsUntil(date: Date): number {
  return Math.max(60, Math.floor((date.getTime() - Date.now()) / 1000));
}
