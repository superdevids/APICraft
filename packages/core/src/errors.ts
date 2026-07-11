export class APIError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: unknown[];

  constructor(statusCode: number, message: string, code?: string, details?: unknown[]) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: {
        statusCode: this.statusCode,
        message: this.message,
        code: this.code,
        details: this.details,
      },
    };
  }
}

export class ValidationError extends APIError {
  constructor(message = "Validation failed", code = "VALIDATION_ERROR", details?: unknown[]) {
    super(400, message, code, details);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends APIError {
  constructor(message = "Authentication failed", code = "AUTHENTICATION_ERROR", details?: unknown[]) {
    super(401, message, code, details);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends APIError {
  constructor(message = "Resource not found", code = "NOT_FOUND", details?: unknown[]) {
    super(404, message, code, details);
    this.name = "NotFoundError";
  }
}
