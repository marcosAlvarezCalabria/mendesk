import type { PhoneNumber } from "@/domain/values/PhoneNumber";

export type ClientListItem = {
  id: string;
  name: string;
  phone: PhoneNumber | null;
  gdprConsent: boolean;
};
