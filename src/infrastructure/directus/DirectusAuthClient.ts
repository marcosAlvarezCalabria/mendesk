import { authentication, createDirectus, refresh, rest } from "@directus/sdk";

type DirectusAuthenticationData = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires?: unknown;
};

export type DirectusLoginResult = {
  access_token: string;
  refresh_token: string | null;
  expires: number;
};

export interface DirectusAuthClient {
  login(email: string, password: string): Promise<DirectusLoginResult>;
  refresh(refreshToken: string): Promise<DirectusLoginResult>;
}

export function createDirectusAuthClient(url: string): DirectusAuthClient {
  const client = createDirectus(url).with(authentication("json")).with(rest());

  return {
    async login(email: string, password: string) {
      const response = (await client.login({ email, password })) as DirectusAuthenticationData;

      return normalizeLoginResult(response);
    },
    async refresh(refreshToken: string) {
      const response = (await client.request(refresh({ mode: "json", refresh_token: refreshToken }))) as DirectusAuthenticationData;

      return normalizeLoginResult(response);
    },
  };
}

function normalizeLoginResult(response: DirectusAuthenticationData): DirectusLoginResult {
  return {
    access_token: typeof response.access_token === "string" ? response.access_token : "",
    refresh_token: typeof response.refresh_token === "string" ? response.refresh_token : null,
    expires: typeof response.expires === "number" ? response.expires : 0,
  };
}
