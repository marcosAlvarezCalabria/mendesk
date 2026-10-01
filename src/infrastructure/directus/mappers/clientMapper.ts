import type { Client } from "@/domain/entities/Client";
import { ANONYMIZED_CLIENT_NAME } from "@/domain/gdpr/anonymization";
import { PhoneNumber } from "@/domain/values/PhoneNumber";
import { DirectusMappingError } from "@/infrastructure/directus/DirectusMappingError";
import type { DirectusClientRecord } from "@/infrastructure/directus/records";

export function mapClient(record: DirectusClientRecord): Client {
  return {
    id: record.id,
    name: record.name,
    phone: mapPhone(record),
    gdprConsent: record.gdpr_consent,
    notes: record.notes ?? undefined,
  };
}

function mapPhone(record: DirectusClientRecord): PhoneNumber | null {
  if (record.phone) {
    return PhoneNumber.fromRaw(record.phone);
  }

  if (record.name === ANONYMIZED_CLIENT_NAME) {
    return null;
  }

  throw new DirectusMappingError("Active Directus client is missing phone");
}
