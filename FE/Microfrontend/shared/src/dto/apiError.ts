import { z, ZodError } from 'zod';

export const ApiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'DB_ERROR',
  'SERVER_ERROR',
  'NETWORK_ERROR',
  'TOO_MANY_REQUESTS',
  'UNSUPPORTED_PARAMETER',
  'PRECONDITION_FAILED',
  // Frontend-only: the response parsed as JSON but did not match the DTO
  // schema for that endpoint. Distinguishes "the backend told us we did
  // something wrong" from "the backend and frontend disagree about the
  // contract" -- the second one is a bug, not a user-facing failure.
  'SCHEMA_ERROR',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

/**
 * RFC 9457 (Problem Details for HTTP APIs) response shape.
 *
 * `type`/`title`/`status`/`detail`/`instance` are the RFC's own members.
 * `code` and `errors` are its "extension members" (RFC 9457 §3.2 explicitly
 * allows adding fields beyond the base five) -- `code` is what the frontend
 * actually switches on, since matching stable machine strings is safer than
 * matching human-readable `title`/`detail` text that's free to be reworded.
 */
export const ApiErrorBodySchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string(),
  code: ApiErrorCodeSchema,
  errors: z.record(z.string(), z.array(z.string())).optional(),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

/**
 * Normalised error every part of the UI can rely on, regardless of whether
 * the failure came from the API's Problem Details envelope, a network drop,
 * a schema mismatch, or an unexpected shape.
 *
 * This class's own public shape (constructor, `.message`, `.code`,
 * `.fieldError()`, `.isValidation`) is deliberately stable across the wire
 * format change to RFC 9457 -- every component that reads an ApiError
 * (ErrorPanel, LoginPage, UserFormModal, ...) needed zero changes when the
 * backend's response shape changed underneath it. Only `toApiError()` below,
 * which parses the wire format, had to change.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly errors: Record<string, string[]>;

  constructor(code: ApiErrorCode, message: string, status: number, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.errors = errors;
  }

  /** First validation message for a field, if the server rejected it. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }

  get isValidation(): boolean {
    return this.code === 'VALIDATION_ERROR';
  }
}

export function toApiError(status: number, body: unknown): ApiError {
  if (status === 0) {
    return new ApiError('NETWORK_ERROR', 'Cannot reach the server. Check that the API is running.', 0);
  }

  const parsed = ApiErrorBodySchema.safeParse(body);
  if (parsed.success) {
    // `detail` is the RFC's per-occurrence explanation -- the closest
    // equivalent to what this app's UI has always called "message".
    return new ApiError(parsed.data.code, parsed.data.detail, status, parsed.data.errors ?? {});
  }

  // Server returned something we did not design for (HTML error page, proxy error, ...).
  return new ApiError('SERVER_ERROR', `Unexpected response from the server (HTTP ${status}).`, status);
}

/**
 * The DTO enforcement point: every API function calls this on the raw
 * response body before handing data to a component. A schema mismatch -- the
 * backend renamed a field, changed a type, whatever -- surfaces immediately
 * as a readable ApiError instead of `undefined` silently reaching the UI
 * three components later.
 */
export function parseApiResponse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  throw new ApiError(
    'SCHEMA_ERROR',
    'The server response did not match the expected shape. This is a bug, not a user error.',
    200,
    flattenZodError(result.error),
  );
}

function flattenZodError(error: ZodError): Record<string, string[]> {
  // Built from error.issues directly rather than z.flattenError: v4's
  // flatten() types fieldErrors values as `{}` for a generic schema, which
  // does not assign to Record<string, string[]> even though the runtime
  // values are always string arrays.
  const byField: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    (byField[key] ??= []).push(issue.message);
  }
  return byField;
}
