import "server-only";

import { del, get, put } from "@vercel/blob";
import { isBlobConfigured } from "@/server/env";
import { IntegrityError, NotFoundError, StorageError } from "@/server/errors";
import { sha256Hex } from "@/server/pdf/hash";

const PRIVATE = { access: "private" as const };

function requireBlobConfigured(): void {
  if (!isBlobConfigured()) {
    throw new StorageError("BLOB_READ_WRITE_TOKEN is not set");
  }
}

function toStorageError(error: unknown, fallback: string): StorageError {
  if (error instanceof StorageError) {
    return error;
  }

  return new StorageError(fallback);
}

export async function putPrivatePdf(
  pathname: string,
  bytes: Uint8Array,
): Promise<void> {
  requireBlobConfigured();

  try {
    await put(pathname, Buffer.from(bytes), {
      ...PRIVATE,
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/pdf",
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
  } catch (error) {
    throw toStorageError(error, "Failed to store PDF");
  }
}

export async function getPrivatePdfBytes(pathname: string): Promise<Uint8Array> {
  requireBlobConfigured();

  try {
    const result = await get(pathname, { ...PRIVATE, useCache: false });

    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new NotFoundError("Template file not found");
    }

    return new Uint8Array(await new Response(result.stream).arrayBuffer());
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof StorageError) {
      throw error;
    }

    throw toStorageError(error, "Failed to read PDF");
  }
}

export async function deletePrivatePdf(pathname: string): Promise<void> {
  requireBlobConfigured();

  try {
    await del(pathname);
  } catch (error) {
    throw toStorageError(error, "Failed to delete PDF");
  }
}

export function assertPdfSha256(bytes: Uint8Array, expectedSha256: string): void {
  if (sha256Hex(bytes) !== expectedSha256) {
    throw new IntegrityError();
  }
}
