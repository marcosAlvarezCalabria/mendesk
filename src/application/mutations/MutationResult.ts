import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import { AppointmentConflictError } from "@/domain/errors/AppointmentConflictError";
import { ConcurrentGarmentModificationError } from "@/domain/errors/ConcurrentGarmentModificationError";
import { IdempotencyConflictError } from "@/domain/errors/IdempotencyConflictError";
import { OrderConflictError } from "@/domain/errors/OrderConflictError";

export type MutationFailureReason = "validation" | "conflict" | "rejected";

export type MutationResult<T> =
  | Readonly<{ type: "confirmed-saved"; value: T }>
  | MutationFailure;

export type MutationFailure =
  | Readonly<{ type: "confirmed-not-saved"; reason: MutationFailureReason }>
  | Readonly<{ type: "outcome-unknown" }>
  | Readonly<{ type: "auth-expired" }>;

export type AuthErrorClassifier = (error: unknown) => boolean;

export function confirmedSaved<T>(value: T): MutationResult<T> {
  return { type: "confirmed-saved", value };
}

export function classifyMutationError(
  error: unknown,
  isAuthError: AuthErrorClassifier,
): MutationFailure {
  try {
    if (isAuthError(error)) {
      return { type: "auth-expired" };
    }

    if (error instanceof MutationOutcomeUnknownError) {
      return { type: "outcome-unknown" };
    }
    if (
      error instanceof AppointmentConflictError
      || error instanceof IdempotencyConflictError
      || error instanceof OrderConflictError
      || error instanceof ConcurrentGarmentModificationError
    ) {
      return { type: "confirmed-not-saved", reason: "conflict" };
    }
    if (error instanceof MutationConfirmedNotSavedError) {
      return { type: "confirmed-not-saved", reason: "rejected" };
    }

    const status = readStatus(error);
    if (status === 400 || status === 422) {
      return { type: "confirmed-not-saved", reason: "validation" };
    }
    if (status === 409 || status === 412) {
      return { type: "confirmed-not-saved", reason: "conflict" };
    }
    if (status === 403 || status === 404) {
      return { type: "confirmed-not-saved", reason: "rejected" };
    }

    const codes = readCodes(error);
    if (codes.some(isValidationCode)) {
      return { type: "confirmed-not-saved", reason: "validation" };
    }
    if (codes.some(isConflictCode)) {
      return { type: "confirmed-not-saved", reason: "conflict" };
    }
  } catch {
    return { type: "outcome-unknown" };
  }

  return { type: "outcome-unknown" };
}

function readStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;
  if (typeof error.status === "number") return error.status;

  return isRecord(error.response) && typeof error.response.status === "number"
    ? error.response.status
    : undefined;
}

function readCodes(error: unknown): string[] {
  if (!isRecord(error)) return [];

  const codes: string[] = [];
  if (typeof error.code === "string") codes.push(error.code);
  if (!Array.isArray(error.errors)) return codes;

  for (const item of error.errors) {
    if (!isRecord(item) || !isRecord(item.extensions)) continue;
    if (typeof item.extensions.code === "string") codes.push(item.extensions.code);
  }

  return codes;
}

function isValidationCode(code: string): boolean {
  return code === "FAILED_VALIDATION" || code === "INVALID_PAYLOAD";
}

function isConflictCode(code: string): boolean {
  return code === "RECORD_NOT_UNIQUE" || code === "CONFLICT" || code === "PRECONDITION_FAILED";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}
