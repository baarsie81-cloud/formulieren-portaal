export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "not_found");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "conflict");
    this.name = "ConflictError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "validation_error");
    this.name = "ValidationError";
  }
}

export class StorageError extends AppError {
  constructor(message = "Storage is not available") {
    super(message, 503, "storage_unavailable");
    this.name = "StorageError";
  }
}

export class IntegrityError extends AppError {
  constructor(message = "Stored file does not match expected hash") {
    super(message, 409, "integrity_error");
    this.name = "IntegrityError";
  }
}
