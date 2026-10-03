"use server";

import { redirect } from "next/navigation";

import type { ShopProfileFormState } from "@/app/_ui/ShopProfileForm";
import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { shopProfileFromFormData } from "@/app/shopProfileFormData";
import { makeShopProfileRepository } from "@/composition/directus";
import { ShopProfileValidationError } from "@/domain/entities/ShopProfile";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";

export async function updateShopSettingsAction(_state: ShopProfileFormState, formData: FormData): Promise<ShopProfileFormState> {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/settings");

  try {
    await makeShopProfileRepository(token).complete(shopProfileFromFormData(formData));
    return { error: null, saved: true };
  } catch (error) {
    if (error instanceof ShopProfileValidationError) return { error: error.message, saved: false };
    return redirectToLoginForAuthError(error, "/settings");
  }
}
