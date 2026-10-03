import type { StoreIdentity } from "@/config/storeConfig";
import type { ShopProfile } from "@/domain/entities/ShopProfile";

export function runtimeStoreIdentity(baseline: StoreIdentity, profile: ShopProfile | null): StoreIdentity {
  if (!profile) return baseline;

  return {
    ...baseline,
    name: profile.name,
    logo: {
      ...baseline.logo,
      alt: profile.name,
    },
  };
}
