type PostgresErrorLike = {
  code?: unknown;
  constraint?: unknown;
};

function asPostgresError(error: unknown): PostgresErrorLike | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  return error as PostgresErrorLike;
}

export function isUniqueViolation(
  error: unknown,
  constraint?: string,
): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    const postgresError = asPostgresError(current);

    if (postgresError?.code === "23505") {
      if (!constraint) {
        return true;
      }

      if (postgresError.constraint === constraint) {
        return true;
      }
    }

    if (typeof current !== "object" || current === null || !("cause" in current)) {
      break;
    }

    current = current.cause;
  }

  return false;
}
