export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "ERROR",
    public details?: unknown,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, "BAD_REQUEST", details);
export const unauthorized = (message = "Please sign in.") => new HttpError(401, message, "UNAUTHORIZED");
export const forbidden = (message = "You don't have access to this.", code = "FORBIDDEN") => new HttpError(403, message, code);
export const notFound = (what = "Not found") => new HttpError(404, what, "NOT_FOUND");
export const conflict = (message: string) => new HttpError(409, message, "CONFLICT");
export const tooMany = (retryAfter: number) =>
  new HttpError(429, "Too many requests. Please wait a moment and try again.", "RATE_LIMITED", undefined, {
    "Retry-After": String(retryAfter),
  });
