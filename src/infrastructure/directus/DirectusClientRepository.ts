import type { ClientListPage, ClientListQuery, ClientListReader } from "@/application/ports/ClientListReader";
import type { ClientRepository, ClientWithHistory, NewClient } from "@/application/ports/ClientRepository";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import type { Client } from "@/domain/entities/Client";
import type { PhoneNumber } from "@/domain/values/PhoneNumber";
import { ClientAnonymizationIncompleteError } from "@/domain/errors/ClientAnonymizationIncompleteError";
import { ClientNotFoundError } from "@/domain/errors/ClientNotFoundError";
import { ANONYMIZED_CLIENT_NAME } from "@/domain/gdpr/anonymization";
import { mapClientListItem } from "@/infrastructure/directus/clientListMapper";
import type { DirectusClientGateway } from "@/infrastructure/directus/DirectusClientGateway";
import type { DirectusGarmentRecord } from "@/infrastructure/directus/records";
import { mapClient } from "@/infrastructure/directus/mappers/clientMapper";
import { mapOrder } from "@/infrastructure/directus/orderMapper";


export class DirectusClientRepository implements ClientRepository, ClientListReader {
  constructor(private readonly gateway: DirectusClientGateway) {}

  async create(client: NewClient): Promise<Client> {
    const record = await this.gateway.createClient({
      name: client.name,
      phone: client.phone.value,
      gdpr_consent: client.gdprConsent,
      notes: client.notes,
    });

    if (!record) {
      throw new MutationOutcomeUnknownError();
    }

    return {
      id: record.id,
      name: client.name,
      phone: client.phone,
      gdprConsent: client.gdprConsent,
      notes: client.notes,
    };
  }

  async getByPhone(phone: PhoneNumber): Promise<Client | null> {
    const record = await this.gateway.getClientByPhone(phone.value);
    return record ? mapClient(record) : null;
  }

  async list(query: ClientListQuery): Promise<ClientListPage> {
    const records = await this.gateway.listClients(query);

    return {
      items: records.slice(0, query.pageSize).map(mapClientListItem),
      hasNextPage: records.length > query.pageSize,
    };
  }

  async getWithHistory(clientId: string): Promise<ClientWithHistory | null> {
    const client = await this.gateway.getClient(clientId);

    if (!client) {
      return null;
    }

    const orders = (await this.gateway.listOrdersByClient(clientId)).map(mapOrder).sort((left, right) => right.receivedDate.getTime() - left.receivedDate.getTime());

    return { client: mapClient(client), orders };
  }

  async anonymize(clientId: string): Promise<void> {
    const client = await this.gateway.getClient(clientId);

    if (!client) {
      throw new ClientNotFoundError();
    }

    if (!isAnonymized(client)) {
      await this.gateway.updateClient(clientId, {
        name: ANONYMIZED_CLIENT_NAME,
        phone: null,
        notes: "",
        gdpr_consent: false,
      });
    }

    for (let pass = 0; pass < 2; pass += 1) {
      const photoIds = await this.listClientPhotoIds(clientId);

      if (photoIds.size === 0) {
        return;
      }

      for (const photoId of photoIds) {
        await this.gateway.deleteFile(photoId);
      }
    }

    const remainingPhotoIds = await this.listClientPhotoIds(clientId);
    if (remainingPhotoIds.size > 0) {
      throw new ClientAnonymizationIncompleteError(remainingPhotoIds.size);
    }
  }

  private async listClientPhotoIds(clientId: string): Promise<Set<string>> {
    const orders = await this.gateway.listOrdersByClient(clientId);
    return collectPhotoIds(orders.flatMap((order) => order.garments ?? []));
  }
}

function isAnonymized(client: { name: string; phone: string | null; notes: string | null; gdpr_consent: boolean }): boolean {
  return client.name === ANONYMIZED_CLIENT_NAME && client.phone === null && client.notes === "" && client.gdpr_consent === false;
}

function collectPhotoIds(garments: readonly DirectusGarmentRecord[]): Set<string> {
  const photoIds = new Set<string>();
  for (const garment of garments) {
    const photoId = getGarmentPhotoId(garment);
    if (photoId) photoIds.add(photoId);
  }
  return photoIds;
}

function getGarmentPhotoId(garment: DirectusGarmentRecord): string | null {
  if (!garment.photo) {
    return null;
  }

  if (typeof garment.photo === "string") {
    return garment.photo;
  }

  return garment.photo.id;
}
