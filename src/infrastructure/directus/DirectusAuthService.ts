import type { AuthService, Credentials, Session } from "@/application/ports/AuthService";
import { InvalidCredentialsError } from "@/domain/errors/InvalidCredentialsError";
import { isAuthError } from "@/infrastructure/auth/authError";
import type { DirectusAuthClient } from "@/infrastructure/directus/DirectusAuthClient";

export class DirectusAuthService implements AuthService {
  constructor(private readonly client: DirectusAuthClient) {}

  async refresh(refreshToken: string): Promise<Session> {
    const result = await this.client.refresh(refreshToken);

    return toSession(result);
  }

  async login(credentials: Credentials): Promise<Session> {
    if (isBlank(credentials.email) || isBlank(credentials.password)) {
      throw new InvalidCredentialsError();
    }

    try {
      const result = await this.client.login(credentials.email, credentials.password);

      return toSession(result);
    } catch (error) {
      if (isAuthError(error)) {
        throw new InvalidCredentialsError();
      }

      throw error;
    }
  }
}

function toSession(result: Awaited<ReturnType<DirectusAuthClient["login"]>>): Session {
  return {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresIn: result.expires,
  };
}

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}
