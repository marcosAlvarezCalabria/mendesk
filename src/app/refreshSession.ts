import { makeAuthService } from "@/composition/directus";
import { isAuthError } from "@/infrastructure/auth/authError";
import { clearSessionCookie, getRefreshToken, getSessionToken, setSessionCookies } from "@/infrastructure/auth/sessionCookie";

export async function getOrRefreshSessionToken(): Promise<string | undefined> {
  const accessToken = await getSessionToken();
  if (accessToken && !sessionTokenExpiresSoon(accessToken)) {
    return accessToken;
  }

  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return accessToken;
  }

  try {
    const session = await makeAuthService().refresh(refreshToken);
    await setSessionCookies(session);
    return session.accessToken;
  } catch (error) {
    if (!isAuthError(error)) {
      throw error;
    }

    await clearSessionCookie();
    return undefined;
  }
}

export function sessionTokenExpiresSoon(token: string): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof decoded.exp === "number" && decoded.exp * 1000 <= Date.now() + 60_000;
  } catch {
    return false;
  }
}
