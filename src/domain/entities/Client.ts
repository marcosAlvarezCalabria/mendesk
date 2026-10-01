import type { PhoneNumber } from "@/domain/values/PhoneNumber";

export type Client = {
  readonly id: string;
  readonly name: string;
  readonly phone: PhoneNumber | null;
  readonly gdprConsent: boolean;
  readonly notes?: string;
};