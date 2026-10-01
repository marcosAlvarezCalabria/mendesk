import { redirect } from "next/navigation";

import { safeNextPath } from "@/app/safeNextPath";
import { isAuthError } from "@/infrastructure/auth/authError";
import { clearSessionCookie } from "@/infrastructure/auth/sessionCookie";

export async function redirectToLoginForAuthError(error: unknown, requestedPath?: string): Promise<never> {
  if (isAuthError(error)) {
    await clearSessionCookie();
    const nextPath = safeNextPath(requestedPath);
    const searchParams = new URLSearchParams({ next: nextPath });

    redirect(`/login?${searchParams.toString()}`);
  }

  throw error;
}