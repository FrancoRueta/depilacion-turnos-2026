import type { FieldErrors } from "../shared/types";

interface ApiErrorOptions {
  fields?: FieldErrors;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: FieldErrors;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = options.fields;
    this.details = options.details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function validationError(errors: FieldErrors, message = "Revisá los datos ingresados."): ApiError {
  return new ApiError(400, "VALIDATION_ERROR", message, { fields: errors });
}
