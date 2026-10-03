"use client";

import { ShopProfileForm, type ShopProfileFormCopy } from "@/app/_ui/ShopProfileForm";
import type { ShopProfile } from "@/domain/entities/ShopProfile";
import { updateShopSettingsAction } from "./actions";

export function SettingsForm({ copy, initial }: { copy: ShopProfileFormCopy; initial: ShopProfile }) {
  return <ShopProfileForm action={updateShopSettingsAction} copy={copy} initial={initial} />;
}
