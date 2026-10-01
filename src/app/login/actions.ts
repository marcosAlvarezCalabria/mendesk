"use server";

import { redirect } from "next/navigation";

import { safeNextPath } from "@/app/safeNextPath";
import { makeAuthService } from "@/composition/directus";
import { InvalidCredentialsError } from "@/domain/errors/InvalidCredentialsError";
import { setSessionCookies } from "@/infrastructure/auth/sessionCookie";

export type LoginFormState = { error: string | null };

export async function loginAction(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = safeNextPath(formData.get("next"));

  try {
    const session = await makeAuthService().login({ email, password });
    await setSessionCookies(session);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      return { error: "Invalid email or password" };
    }

    throw error;
  }

  redirect(nextPath);
}
