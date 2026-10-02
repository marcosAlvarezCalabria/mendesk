import type { ShopProfile } from "@/domain/entities/ShopProfile";

export interface ShopProfileRepository {
  get(): Promise<ShopProfile | null>;
  complete(profile: Omit<ShopProfile, "setupCompletedAt">): Promise<void>;
}
