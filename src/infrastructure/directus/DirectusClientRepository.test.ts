import { describe, expect, it } from "vitest";

import type { NewClient } from "@/application/ports/ClientRepository";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import { ClientAnonymizationIncompleteError } from "@/domain/errors/ClientAnonymizationIncompleteError";
import { ClientNotFoundError } from "@/domain/errors/ClientNotFoundError";
import { ANONYMIZED_CLIENT_NAME } from "@/domain/gdpr/anonymization";
import { PhoneNumber } from "@/domain/values/PhoneNumber";
import type { DirectusClientCreatePayload, DirectusClientGateway, DirectusClientUpdatePayload } from "@/infrastructure/directus/DirectusClientGateway";
import { DirectusClientRepository } from "@/infrastructure/directus/DirectusClientRepository";
import type { DirectusClientListRecord, DirectusClientRecord, DirectusGarmentRecord, DirectusOrderRecord } from "@/infrastructure/directus/records";

describe("DirectusClientRepository", () => {
  it("preserves the created Directus client id when the gateway returns a record", async () => {
    const gateway = new FakeDirectusClientGateway({ id: "client-1", name: "Mary", phone: "353852009225", gdpr_consent: true, notes: null });
    const repository = new DirectusClientRepository(gateway);
    const input = createClientInput();

    const client = await repository.create(input);

    expect(gateway.lastPayload).toEqual({ name: "Mary", phone: "353852009225", gdpr_consent: true, notes: "Prefers mornings" });
    expect(client.id).toBe("client-1");
    expect(client.name).toBe("Mary");
    expect(client.phone?.value).toBe("353852009225");
    expect(client.gdprConsent).toBe(true);
    expect(client.notes).toBe("Prefers mornings");
  });

  it("does not invent a saved client when Directus returns no create body", async () => {
    const gateway = new FakeDirectusClientGateway(null);
    const repository = new DirectusClientRepository(gateway);
    const input = createClientInput();

    await expect(repository.create(input)).rejects.toBeInstanceOf(MutationOutcomeUnknownError);

    expect(gateway.lastPayload).toEqual({ name: "Mary", phone: "353852009225", gdpr_consent: true, notes: "Prefers mornings" });
  });

  it("lists clients through the gateway and maps results", async () => {
    const gateway = new FakeDirectusClientGateway(null, [makeClient({ id: "client-1", name: "Mary" }), makeClient({ id: "client-2", name: "Anne" })]);
    const repository = new DirectusClientRepository(gateway);

    const clients = await repository.list({ page: 1, pageSize: 1, search: "mary" });

    expect(gateway.lastListQuery).toEqual({ page: 1, pageSize: 1, search: "mary" });
    expect(clients.items).toHaveLength(1);
    expect(clients.items[0]?.name).toBe("Mary");
    expect(clients.items[0]?.phone?.value).toBe("353852009225");
    expect(clients.hasNextPage).toBe(true);
  });

  it("returns a client with mapped order history", async () => {
    const gateway = new FakeDirectusClientGateway(makeClient({ id: "client-1" }), [], [
      makeOrder({ id: "order-old", received_date: "2026-08-19T10:00:00.000Z" }),
      makeOrder({ id: "order-new", received_date: "2026-08-20T10:00:00.000Z" }),
    ]);
    const repository = new DirectusClientRepository(gateway);

    const history = await repository.getWithHistory("client-1");

    expect(gateway.lastGetClientId).toBe("client-1");
    expect(gateway.lastOrdersClientId).toBe("client-1");
    expect(history?.client.id).toBe("client-1");
    expect(history?.orders).toHaveLength(2);
    expect(history?.orders.map(order => order.id)).toEqual(["order-new", "order-old"]);
  });

  it("returns null when the client does not exist", async () => {
    const gateway = new FakeDirectusClientGateway(null);
    const repository = new DirectusClientRepository(gateway);

    await expect(repository.getWithHistory("missing-client")).resolves.toBeNull();
    expect(gateway.lastGetClientId).toBe("missing-client");
    expect(gateway.lastOrdersClientId).toBeNull();
  });

  it("anonymizes personal client data and deletes garment photos", async () => {
    const gateway = new FakeDirectusClientGateway(makeClient({ id: "client-1" }), [], [
      makeOrder({ garments: [{ id: "garment-1", date_updated: "2026-09-05T10:00:00.000Z", description: "Dress", alteration_type: "hem", measurements: null, photo: "file-1", price: "25" }] }),
      makeOrder({ id: "order-2", garments: [{ id: "garment-2", date_updated: "2026-09-05T10:00:00.000Z", description: "Jacket", alteration_type: "zipper", measurements: null, photo: { id: "file-2" }, price: "40" }] }),
    ]);
    const repository = new DirectusClientRepository(gateway);

    await repository.anonymize("client-1");

    expect(gateway.lastUpdate).toEqual({
      id: "client-1",
      payload: { name: ANONYMIZED_CLIENT_NAME, phone: null, notes: "", gdpr_consent: false },
    });
    expect(gateway.lastOrdersClientId).toBe("client-1");
    expect(gateway.deletedFileIds).toEqual(["file-1", "file-2"]);
  });

  it("resumes a partially completed anonymization without repeating finished steps", async () => {
    const gateway = new FakeDirectusClientGateway(
      makeClient({ id: "client-1", name: ANONYMIZED_CLIENT_NAME, phone: null, gdpr_consent: false, notes: "" }),
      [],
      [makeOrder({ garments: [makeGarment("garment-1", "file-1"), makeGarment("garment-2", "file-2")] })],
    );
    gateway.failDeleteOnceFor = "file-2";
    const repository = new DirectusClientRepository(gateway);

    await expect(repository.anonymize("client-1")).rejects.toThrow("delete failed");
    await expect(repository.anonymize("client-1")).resolves.toBeUndefined();

    expect(gateway.updateCalls).toBe(0);
    expect(gateway.deleteAttempts).toEqual(["file-1", "file-2", "file-2"]);
    expect(gateway.deletedFileIds).toEqual(["file-1", "file-2"]);
  });

  it("reconciles an anonymized client after the update response is lost", async () => {
    const gateway = new FakeDirectusClientGateway(makeClient({ id: "client-1" }), [], [
      makeOrder({ garments: [makeGarment("garment-1", "file-1")] }),
    ]);
    gateway.persistUpdateThenFail = true;
    const repository = new DirectusClientRepository(gateway);

    await expect(repository.anonymize("client-1")).rejects.toThrow("response lost");
    await expect(repository.anonymize("client-1")).resolves.toBeUndefined();

    expect(gateway.updateCalls).toBe(1);
    expect(gateway.deleteAttempts).toEqual(["file-1"]);
    expect(gateway.deletedFileIds).toEqual(["file-1"]);
  });

  it("reconciles a photo attached concurrently before reporting completion", async () => {
    const gateway = new FakeDirectusClientGateway(makeClient({ id: "client-1" }), [], [
      makeOrder({ garments: [makeGarment("garment-1", "file-1")] }),
    ]);
    gateway.addPhotoAfterFirstOrderRead = makeGarment("garment-2", "file-2");
    const repository = new DirectusClientRepository(gateway);

    await repository.anonymize("client-1");

    expect(gateway.deleteAttempts).toEqual(["file-1", "file-2"]);
    expect(gateway.orderReadCount).toBe(3);
  });

  it("does not claim completion when reconciliation still finds a photo", async () => {
    const gateway = new FakeDirectusClientGateway(makeClient({ id: "client-1" }), [], [
      makeOrder({ garments: [makeGarment("garment-1", "file-1")] }),
    ]);
    gateway.keepDeletedPhotoReferences = true;
    const repository = new DirectusClientRepository(gateway);

    await expect(repository.anonymize("client-1")).rejects.toEqual(new ClientAnonymizationIncompleteError(1));
    expect(gateway.orderReadCount).toBe(3);
  });

  it("rejects a missing client before changing orders or files", async () => {
    const gateway = new FakeDirectusClientGateway(null);
    const repository = new DirectusClientRepository(gateway);

    await expect(repository.anonymize("missing-client")).rejects.toBeInstanceOf(ClientNotFoundError);

    expect(gateway.updateCalls).toBe(0);
    expect(gateway.orderReadCount).toBe(0);
    expect(gateway.deleteAttempts).toEqual([]);
  });
});

function createClientInput(): NewClient {
  return { name: "Mary", phone: PhoneNumber.fromRaw("085 200 9225"), gdprConsent: true, notes: "Prefers mornings" };
}

class FakeDirectusClientGateway implements DirectusClientGateway {
  lastPayload: DirectusClientCreatePayload | null = null;
  lastUpdate: { id: string; payload: DirectusClientUpdatePayload } | null = null;
  lastListQuery: { page: number; pageSize: number; search?: string } | null = null;
  lastGetClientId: string | null = null;
  lastOrdersClientId: string | null = null;
  readonly deletedFileIds: string[] = [];
  readonly deleteAttempts: string[] = [];
  updateCalls = 0;
  orderReadCount = 0;
  failDeleteOnceFor: string | null = null;
  addPhotoAfterFirstOrderRead: DirectusGarmentRecord | null = null;
  keepDeletedPhotoReferences = false;
  persistUpdateThenFail = false;

  constructor(
    private readonly record: DirectusClientRecord | null,
    private readonly clients: readonly DirectusClientRecord[] = [],
    private readonly orders: DirectusOrderRecord[] = [],
  ) {}

  async createClient(payload: DirectusClientCreatePayload): Promise<DirectusClientRecord | null> {
    this.lastPayload = payload;
    return this.record;
  }

  async getClientByPhone(phone: string): Promise<DirectusClientRecord | null> {
    return this.record?.phone === phone ? this.record : null;
  }

  async listClients(query: { page: number; pageSize: number; search?: string }): Promise<DirectusClientListRecord[]> {
    this.lastListQuery = query;
    return [...this.clients];
  }

  async getClient(id: string): Promise<DirectusClientRecord | null> {
    this.lastGetClientId = id;
    return this.record?.id === id ? this.record : null;
  }

  async listOrdersByClient(clientId: string): Promise<DirectusOrderRecord[]> {
    this.lastOrdersClientId = clientId;
    this.orderReadCount += 1;
    if (this.orderReadCount === 2 && this.addPhotoAfterFirstOrderRead) {
      this.orders[0]?.garments?.push(this.addPhotoAfterFirstOrderRead);
    }
    return [...this.orders];
  }

  async updateClient(id: string, payload: DirectusClientUpdatePayload): Promise<void> {
    this.updateCalls += 1;
    this.lastUpdate = { id, payload };
    if (this.record) {
      Object.assign(this.record, payload);
    }
    if (this.persistUpdateThenFail) {
      this.persistUpdateThenFail = false;
      throw new Error("response lost");
    }
  }

  async deleteFile(id: string): Promise<void> {
    this.deleteAttempts.push(id);
    if (this.failDeleteOnceFor === id) {
      this.failDeleteOnceFor = null;
      throw new Error("delete failed");
    }
    this.deletedFileIds.push(id);
    if (!this.keepDeletedPhotoReferences) {
      for (const order of this.orders) {
        for (const garment of order.garments ?? []) {
          if (getPhotoId(garment) === id) garment.photo = null;
        }
      }
    }
  }
}

function makeGarment(id: string, photo: string): DirectusGarmentRecord {
  return { id, date_updated: "2026-09-05T10:00:00.000Z", description: "Garment", alteration_type: "hem", measurements: null, photo, price: "25" };
}

function getPhotoId(garment: DirectusGarmentRecord): string | null {
  if (!garment.photo) return null;
  return typeof garment.photo === "string" ? garment.photo : garment.photo.id;
}

function makeClient(overrides: Partial<DirectusClientRecord> = {}): DirectusClientRecord {
  return {
    id: "client-1",
    name: "Mary",
    phone: "353852009225",
    gdpr_consent: true,
    notes: null,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<DirectusOrderRecord> = {}): DirectusOrderRecord {
  return {
    id: "order-1",
    date_updated: '2026-08-19T10:05:00.000Z',
    order_number: "260819-0142",
    client: makeClient(),
    status: "received",
    received_date: "2026-08-19T10:00:00.000Z",
    due_date: "2026-08-21T10:00:00.000Z",
    collected_at: null,
    notes: null,
    garments: [],
    payments: [],
    ...overrides,
  };
}
