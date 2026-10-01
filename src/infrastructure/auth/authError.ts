export function isAuthError(error: unknown): boolean {
  return isAuthErrorInner(error, new Set());
}

function isAuthErrorInner(error: unknown, seen: Set<object>): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  if (seen.has(error)) return false;
  seen.add(error);

  if ("status" in error && error.status === 401) {
    return true;
  }

  if ("response" in error && hasStatus(error.response, 401)) {
    return true;
  }

  if ("code" in error && typeof error.code === "string" && isAuthCode(error.code)) {
    return true;
  }

  if (hasDirectusAuthCode(error)) {
    return true;
  }

  if ("name" in error && error.name === "InvalidCredentialsError") {
    return true;
  }

  if ("cause" in error && isAuthErrorInner(error.cause, seen)) {
    return true;
  }

  return error instanceof AggregateError
    && error.errors.some((nestedError: unknown) => isAuthErrorInner(nestedError, seen));
}

function hasDirectusAuthCode(error: object): boolean {
  if (!("errors" in error) || !Array.isArray(error.errors)) return false;

  return error.errors.some((item: unknown) =>
    Boolean(item && typeof item === "object" && "extensions" in item && hasAuthCode(item.extensions)),
  );
}

function hasStatus(value: unknown, status: number): boolean {
  return Boolean(value && typeof value === "object" && "status" in value && value.status === status);
}

function isAuthCode(code: string): boolean {
  return code === "INVALID_CREDENTIALS" || code === "TOKEN_EXPIRED" || code === "UNAUTHORIZED";
}

function hasAuthCode(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && "code" in value && typeof value.code === "string" && isAuthCode(value.code));
}
