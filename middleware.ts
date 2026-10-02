import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { safeNextPath } from "@/app/safeNextPath";
import { sessionTokenExpiresSoon } from "@/app/refreshSession";
import { makeAuthService } from "@/composition/directus";
import { isAuthError } from "@/infrastructure/auth/authError";
import {
  buildRefreshCookieOptions,
  buildSessionCookieOptions,
  REFRESH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/infrastructure/auth/sessionCookie";

export async function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (sessionToken && (!refreshToken || !sessionTokenExpiresSoon(sessionToken))) {
    return NextResponse.next();
  }

  const nextPath = safeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (!refreshToken) {
    return redirectToLogin(request, nextPath);
  }

  try {
    const session = await makeAuthService().refresh(refreshToken);
    if (!isUsableSession(session)) {
      return NextResponse.rewrite(new URL("/offline", request.url));
    }

    const response = NextResponse.redirect(new URL(nextPath, request.url));
    response.cookies.set(
      SESSION_COOKIE_NAME,
      session.accessToken,
      buildSessionCookieOptions(session.expiresIn),
    );
    response.cookies.set(
      REFRESH_COOKIE_NAME,
      session.refreshToken,
      buildRefreshCookieOptions(),
    );

    return response;
  } catch (error) {
    if (isAuthError(error)) {
      return redirectToLogin(request, nextPath);
    }

    return NextResponse.rewrite(new URL("/offline", request.url));
  }
}

export const config = { matcher: ["/dashboard/:path*", "/orders/:path*", "/clients/:path*", "/appointments/:path*", "/stats/:path*", "/setup/:path*"] };

function redirectToLogin(request: NextRequest, nextPath: string): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", nextPath);

  return NextResponse.redirect(loginUrl);
}

function isUsableSession(session: {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
}): session is { accessToken: string; refreshToken: string; expiresIn: number } {
  return session.accessToken.length > 0
    && typeof session.refreshToken === "string"
    && session.refreshToken.length > 0
    && Number.isFinite(session.expiresIn)
    && session.expiresIn > 0;
}
