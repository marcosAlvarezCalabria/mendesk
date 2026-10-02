import { technicalKeys } from "@/config/technicalKeys";

export const SESSION_COOKIE_NAME = technicalKeys.sessionCookie;
export const REFRESH_COOKIE_NAME = technicalKeys.refreshCookie;

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export type RefreshCookieOptions = Omit<SessionCookieOptions, "maxAge">;

export function buildSessionCookieOptions(expiresIn: number): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(0, Math.floor(expiresIn / 1000)),
  };
}

export function buildRefreshCookieOptions(): RefreshCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

export async function setSessionCookie(token: string, expiresIn: number): Promise<void> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(expiresIn));
}

export async function setSessionCookies(session: { accessToken: string; refreshToken: string | null; expiresIn: number }): Promise<void> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, session.accessToken, buildSessionCookieOptions(session.expiresIn));
  if (session.refreshToken) {
    cookieStore.set(REFRESH_COOKIE_NAME, session.refreshToken, buildRefreshCookieOptions());
  } else {
    cookieStore.set(REFRESH_COOKIE_NAME, "", { ...buildRefreshCookieOptions(), maxAge: 0 });
  }
}

export async function getSessionToken(): Promise<string | undefined> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return cookieStore.get(REFRESH_COOKIE_NAME)?.value;
}

export async function clearSessionCookie(): Promise<void> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", buildSessionCookieOptions(0));
  cookieStore.set(REFRESH_COOKIE_NAME, "", { ...buildRefreshCookieOptions(), maxAge: 0 });
}
