import { describe, expect, it } from "vitest";

import { isAuthError } from "@/infrastructure/auth/authError";
import { DirectusMappingError } from "@/infrastructure/directus/DirectusMappingError";

describe("isAuthError", () => {
  it("detects Directus errors with status 401", () => {
    expect(isAuthError({ status: 401 })).toBe(true);
  });

  it("detects nested response status 401", () => {
    expect(isAuthError({ response: { status: 401 } })).toBe(true);
  });

  it("detects credential and token auth codes", () => {
    expect(isAuthError({ code: "INVALID_CREDENTIALS" })).toBe(true);
    expect(isAuthError({ code: "TOKEN_EXPIRED" })).toBe(true);
  });

  it.each(["INVALID_CREDENTIALS", "TOKEN_EXPIRED", "UNAUTHORIZED"])(
    "detects the nested Directus auth code %s",
    (code) => {
      expect(
        isAuthError({
          errors: [{ message: "Authentication failed", extensions: { code } }],
        }),
      ).toBe(true);
    },
  );

  it("detects InvalidCredentialsError by name", () => {
    expect(isAuthError({ name: "InvalidCredentialsError" })).toBe(true);
  });

  it("detects an authentication error preserved as a cause", () => {
    const wrapped = new Error("Mutation was not saved", {
      cause: { status: 401 },
    });

    expect(isAuthError(wrapped)).toBe(true);
  });

  it("detects an authentication error in an aggregate reconciliation cause", () => {
    const wrapped = new Error("Mutation outcome is unknown", {
      cause: new AggregateError([new Error("network"), { status: 401 }]),
    });

    expect(isAuthError(wrapped)).toBe(true);
  });

  it.each([
    { label: "permission failure", error: { status: 403 } },
    { label: "network failure", error: new TypeError("fetch failed") },
    { label: "server failure", error: { response: { status: 503 } } },
    { label: "mapping failure", error: new DirectusMappingError("Invalid Directus order") },
    { label: "free authentication-looking text", error: new Error("Unauthorized upstream response") },
    { label: "missing error", error: null },
  ])("rejects $label as an authentication error", ({ error }) => {
    expect(isAuthError(error)).toBe(false);
  });
});
