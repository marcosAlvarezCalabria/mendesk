"use server";

import { redirect } from "next/navigation";

import { clearSessionCookie } from "@/infrastructure/auth/sessionCookie";

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();

  redirect("/login");
}