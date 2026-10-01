import type { ClientListItem } from "@/application/dtos/ClientListItem";
import { ANONYMIZED_CLIENT_NAME } from "@/domain/gdpr/anonymization";
import { PhoneNumber } from "@/domain/values/PhoneNumber";
import { DirectusMappingError } from "@/infrastructure/directus/DirectusMappingError";
import type { DirectusClientListRecord } from "@/infrastructure/directus/records";

export function mapClientListItem(record: DirectusClientListRecord): ClientListItem {
  return {
    id: record.id,
    name: record.name,
    phone: mapPhone(record),
    gdprConsent: record.gdpr_consent,
  };
}

function mapPhone(record: DirectusClientListRecord): PhoneNumber | null {
  if (record.phone) {
    return PhoneNumber.fromRaw(record.phone);
  }

  if (record.name === ANONYMIZED_CLIENT_NAME) {
    return null;
  }

  throw new DirectusMappingError("Active Directus client is missing phone");
}
