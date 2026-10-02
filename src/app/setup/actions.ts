"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/app/safeNextPath";
import { makeShopProfileRepository } from "@/composition/directus";
import { normalizeShopProfile, ShopProfileValidationError } from "@/domain/entities/ShopProfile";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";

export type SetupFormState = { error: string | null };

export async function completeSetupAction(_state: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/setup");
  try {
    const profile = normalizeShopProfile({
      name: String(formData.get("name") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
      contactPhone: String(formData.get("contactPhone") ?? ""),
      whatsappNumber: String(formData.get("whatsappNumber") ?? ""),
      address: String(formData.get("address") ?? ""),
    });
    await makeShopProfileRepository(token).complete(profile);
  } catch (error) {
    if (error instanceof ShopProfileValidationError) return { error: error.message };
    throw error;
  }
  redirect(safeNextPath(formData.get("next")));
}
