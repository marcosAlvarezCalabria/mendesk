import { describe, expect, it } from "vitest";
import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import { AppointmentConflictError } from "@/domain/errors/AppointmentConflictError";
import { ConcurrentGarmentModificationError } from "@/domain/errors/ConcurrentGarmentModificationError";
import { IdempotencyConflictError } from "@/domain/errors/IdempotencyConflictError";
import { OrderConflictError } from "@/domain/errors/OrderConflictError";

import {
  classifyMutationError,
  confirmedSaved,
  type MutationResult,
} from "@/application/mutations/MutationResult";
import { isAuthError } from "@/infrastructure/auth/authError";

describe("MutationResult", () => {
  it("carries the persisted value only after a confirmed save", () => {
    const result: MutationResult<{ id: string }> = confirmedSaved({ id: "order-1" });

    expect(result).toEqual({ type: "confirmed-saved", value: { id: "order-1" } });
  });

  it.each([
    { label: "top-level status", error: { status: 401 } },
    { label: "nested status", error: { response: { status: 401 } } },
    {
      label: "Directus auth code",
      error: { errors: [{ extensions: { code: "TOKEN_EXPIRED" } }] },
    },
  ])("classifies $label as an expired session", ({ error }) => {
    expect(classifyMutationError(error, isAuthError)).toEqual({ type: "auth-expired" });
  });

  it.each([
    { label: "bad request", error: { status: 400 }, reason: "validation" },
    { label: "unprocessable input", error: { response: { status: 422 } }, reason: "validation" },
    { label: "forbidden operation", error: { status: 403 }, reason: "rejected" },
    { label: "missing target", error: { status: 404 }, reason: "rejected" },
    { label: "conflict", error: { response: { status: 409 } }, reason: "conflict" },
    { label: "stale write", error: { status: 412 }, reason: "conflict" },
    { label: "validation code", error: { code: "FAILED_VALIDATION" }, reason: "validation" },
    { label: "unique constraint", error: { errors: [{ extensions: { code: "RECORD_NOT_UNIQUE" } }] }, reason: "conflict" },
    { label: "reconciled rejection", error: new MutationConfirmedNotSavedError(), reason: "rejected" },
    { label: "idempotency conflict", error: new IdempotencyConflictError(), reason: "conflict" },
    { label: "appointment concurrency conflict", error: new AppointmentConflictError(), reason: "conflict" },
    { label: "order concurrency conflict", error: new OrderConflictError(), reason: "conflict" },
    { label: "garment concurrency conflict", error: new ConcurrentGarmentModificationError(), reason: "conflict" },
  ])("classifies $label as confirmed not saved", ({ error, reason }) => {
    expect(classifyMutationError(error, isAuthError)).toEqual({
      type: "confirmed-not-saved",
      reason,
    });
  });

  it.each([
    { label: "server failure", error: { status: 500 } },
    { label: "gateway failure", error: { response: { status: 503 } } },
    { label: "network failure", error: new TypeError("fetch failed: bearer secret-token") },
    { label: "timeout", error: { name: "TimeoutError", message: "secret-token" } },
    { label: "aborted response", error: { name: "AbortError" } },
    { label: "connection reset", error: { code: "ECONNRESET" } },
    { label: "reconciled ambiguity", error: new MutationOutcomeUnknownError() },
    { label: "unrecognised failure", error: { response: { body: "secret-token" } } },
    { label: "non-object throw", error: "secret-token" },
  ])("classifies $label as an unknown outcome", ({ error }) => {
    expect(classifyMutationError(error, isAuthError)).toEqual({ type: "outcome-unknown" });
  });

  it("does not expose the original error, token, message, or response", () => {
    const result = classifyMutationError(
      {
        status: 422,
        token: "secret-token",
        message: "Database rejected secret-token",
        response: { status: 422, body: "full response" },
      },
      isAuthError,
    );

    expect(result).toEqual({ type: "confirmed-not-saved", reason: "validation" });
    expect(JSON.stringify(result)).not.toMatch(/secret-token|Database|full response/);
  });

  it("fails closed when the auth classifier itself throws", () => {
    expect(
      classifyMutationError({ status: 409 }, () => {
        throw new Error("classifier failed with secret-token");
      }),
    ).toEqual({ type: "outcome-unknown" });
  });
});
