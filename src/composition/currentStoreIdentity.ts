import { cache } from "react";

import { makeShopProfileRepository } from "@/composition/directus";
import { storeConfig } from "@/config/currentStore";
import { runtimeStoreIdentity } from "@/config/runtimeStoreIdentity";
import type { StoreIdentity } from "@/config/storeConfig";
import type { ShopProfile } from "@/domain/entities/ShopProfile";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";

type ProfileReader = () => Promise<ShopProfile | null>;

export const getCurrentStoreIdentity = cache(async (): Promise<StoreIdentity> => {
  const sessionToken = await getSessionToken();
  const tokens = [...new Set([sessionToken, process.env.KIOSK_TOKEN].filter((token): token is string => Boolean(token)))];
  const readers = tokens.map((token) => () => makeShopProfileRepository(token).get());
  return resolveAvailableStoreIdentity(storeConfig.identity, readers);
});

export async function resolveAvailableStoreIdentity(baseline: StoreIdentity, readers: readonly ProfileReader[]): Promise<StoreIdentity> {
  for (const readProfile of readers) {
    try {
      const profile = await readProfile();
      if (profile) return runtimeStoreIdentity(baseline, profile);
    } catch {
      // Store identity must degrade to the installation baseline instead of blocking the panel.
    }
  }

  return baseline;
}
