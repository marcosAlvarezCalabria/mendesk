import { normalizeShopProfile } from "@/domain/entities/ShopProfile";

export function shopProfileFromFormData(formData: FormData) {
  return normalizeShopProfile({
    name: String(formData.get("name") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    whatsappNumber: String(formData.get("whatsappNumber") ?? ""),
    address: String(formData.get("address") ?? ""),
  });
}
