import { describe, expect, it } from "vitest";

import type { ClientRepository, ClientWithHistory, NewClient } from "@/application/ports/ClientRepository";
import { GetClient } from "@/application/useCases/GetClient";
import type { Client } from "@/domain/entities/Client";
import type { Order } from "@/domain/entities/Order";
import { ClientNotFoundError } from "@/domain/errors/ClientNotFoundError";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("GetClient", () => {
  it("returns a client with order history", async () => {
    const history = { client: makeClient(), orders: [makeOrder({ id: "order-1" })] };
    const repository = new FakeClientRepository(history);
    const useCase = new GetClient(repository);

    await expect(useCase.execute("client-1")).resolves.toBe(history);
    expect(repository.lastClientId).toBe("client-1");
  });

  it("throws ClientNotFoundError when the client does not exist", async () => {
    const repository = new FakeClientRepository(null);
    const useCase = new GetClient(repository);

    await expect(useCase.execute("missing-client")).rejects.toBeInstanceOf(ClientNotFoundError);
  });
});

class FakeClientRepository implements ClientRepository {
  lastClientId: string | null = null;

  async getByPhone(): Promise<Client | null> {
    return null;
  }

  constructor(private readonly history: ClientWithHistory | null) {}

  async create(client: NewClient): Promise<Client> {
    void client;
    throw new Error("Not implemented");
  }

  async getWithHistory(clientId: string): Promise<ClientWithHistory | null> {
    this.lastClientId = clientId;
    return this.history;
  }

  async anonymize(clientId: string): Promise<void> {
    void clientId;
    throw new Error("Not implemented");
  }}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    name: "Mary",
    phone: PhoneNumber.fromRaw("085 200 9225"),
    gdprConsent: true,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  const receivedDate = new Date("2026-08-19T10:00:00.000Z");

  return {
    id: "order-1",
    orderNumber: OrderNumber.compose(receivedDate, 142),
    client: makeClient(),
    status: OrderStatus.RECEIVED,
    receivedDate,
    dateUpdated: new Date('2026-08-19T10:05:00.000Z'),
    dueDate: new Date("2026-08-21T10:00:00.000Z"),
    garments: [],
    payments: [],
    ...overrides,
  };
}
