"use server";

import { redirect } from "next/navigation";
import type { ShopProfileFormState } from "@/app/_ui/ShopProfileForm";
import { safeNextPath } from "@/app/safeNextPath";
import { shopProfileFromFormData } from "@/app/shopProfileFormData";
import { makeShopProfileRepository } from "@/composition/directus";
import { ShopProfileValidationError } from "@/domain/entities/ShopProfile";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";

export type SetupFormState = ShopProfileFormState;

export async function completeSetupAction(_state: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/setup");
  try {
    const profile = shopProfileFromFormData(formData);
    await makeShopProfileRepository(token).complete(profile);
  } catch (error) {
    if (error instanceof ShopProfileValidationError) return { error: error.message };
    throw error;
  }
  redirect(safeNextPath(formData.get("next")));
}
