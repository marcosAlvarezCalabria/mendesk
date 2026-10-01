import { describe, expect, it, vi } from "vitest";

import { InvalidCredentialsError } from "@/domain/errors/InvalidCredentialsError";
import { DirectusAuthService } from "@/infrastructure/directus/DirectusAuthService";
import type {
  DirectusAuthClient,
  DirectusLoginResult,
} from "@/infrastructure/directus/DirectusAuthClient";
import { DirectusMappingError } from "@/infrastructure/directus/DirectusMappingError";

describe("DirectusAuthService", () => {
  it("renews an expired access token with the refresh token", async () => {
    const refresh = vi.fn().mockResolvedValue({ access_token: "new-access", refresh_token: "new-refresh", expires: 900_000 });
    const authService = new DirectusAuthService({ login: vi.fn(), refresh } as unknown as DirectusAuthClient);

    await expect(authService.refresh("old-refresh")).resolves.toEqual({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresIn: 900_000,
    });
    expect(refresh).toHaveBeenCalledWith("old-refresh");
  });

  it("returns a session when credentials are valid", async () => {
    const authService = new DirectusAuthService(
      fakeAuthClient({
        access_token: "a",
        refresh_token: "r",
        expires: 900000,
      }),
    );

    await expect(authService.login({ email: "user@example.com", password: "secret" })).resolves.toEqual({
      accessToken: "a",
      refreshToken: "r",
      expiresIn: 900000,
    });
  });

  it("keeps a null refresh token in the returned session", async () => {
    const authService = new DirectusAuthService(
      fakeAuthClient({
        access_token: "a",
        refresh_token: null,
        expires: 900000,
      }),
    );

    await expect(authService.login({ email: "user@example.com", password: "secret" })).resolves.toEqual({
      accessToken: "a",
      refreshToken: null,
      expiresIn: 900000,
    });
  });

  it("throws InvalidCredentialsError when Directus confirms invalid credentials", async () => {
    const authService = new DirectusAuthService({
      async login() {
        throw {
          errors: [{ message: "Invalid user credentials.", extensions: { code: "INVALID_CREDENTIALS" } }],
          response: { status: 401 },
        };
      },
      async refresh() {
        throw new Error("not used");
      },
    });

    await expect(authService.login({ email: "user@example.com", password: "wrong" })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it.each([
    { label: "network error", error: new TypeError("fetch failed") },
    { label: "Directus server error", error: { response: { status: 503 } } },
    { label: "Directus data error", error: new DirectusMappingError("Invalid login response") },
  ])("preserves a $label", async ({ error }) => {
    const authService = new DirectusAuthService({
      async login() {
        throw error;
      },
      async refresh() {
        throw new Error("not used");
      },
    });

    await expect(authService.login({ email: "user@example.com", password: "secret" })).rejects.toBe(error);
  });

  it("throws InvalidCredentialsError for a blank email without calling the client", async () => {
    const client = countingAuthClient();
    const authService = new DirectusAuthService(client);

    await expect(authService.login({ email: "  ", password: "secret" })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    expect(client.calls).toBe(0);
  });

  it("throws InvalidCredentialsError for a blank password without calling the client", async () => {
    const client = countingAuthClient();
    const authService = new DirectusAuthService(client);

    await expect(authService.login({ email: "user@example.com", password: "" })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    expect(client.calls).toBe(0);
  });
});

function fakeAuthClient(result: DirectusLoginResult): DirectusAuthClient {
  return {
    async login() {
      return result;
    },
    async refresh() {
      return result;
    },
  };
}

function countingAuthClient(): DirectusAuthClient & { calls: number } {
  return {
    calls: 0,
    async login() {
      this.calls += 1;

      return {
        access_token: "a",
        refresh_token: "r",
        expires: 900000,
      };
    },
    async refresh() {
      throw new Error("not used");
    },
  };
}
