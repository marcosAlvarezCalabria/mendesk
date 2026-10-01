import { describe, expect, it } from "vitest";

import type { ClientRepository, ClientWithHistory, NewClient } from "@/application/ports/ClientRepository";
import { RegisterClientIntake } from "@/application/useCases/RegisterClientIntake";
import type { Client } from "@/domain/entities/Client";
import { IdempotencyConflictError } from "@/domain/errors/IdempotencyConflictError";
import { InvalidPhoneNumberError } from "@/domain/errors/InvalidPhoneNumberError";

describe("RegisterClientIntake", () => {
  it("creates a client with trimmed name, normalized phone and GDPR consent", async () => {
    const clients = new FakeClientRepository();
    const useCase = new RegisterClientIntake(clients);

    const client = await useCase.execute({ name: "  Mary Kelly  ", phoneRaw: "085 200 9225", gdprConsent: true, notes: "Prefers mornings" });

    expect(clients.created).toHaveLength(1);
    expect(clients.created[0]?.name).toBe("Mary Kelly");
    expect(clients.created[0]?.phone.value).toBe("353852009225");
    expect(clients.created[0]?.gdprConsent).toBe(true);
    expect(client.name).toBe("Mary Kelly");
  });

  it("rejects a blank client name before calling the repository", async () => {
    const clients = new FakeClientRepository();
    const useCase = new RegisterClientIntake(clients);

    await expect(useCase.execute({ name: "   ", phoneRaw: "085 200 9225", gdprConsent: true })).rejects.toThrow("Client name is required");
    expect(clients.created).toHaveLength(0);
  });

  it("propagates invalid phone numbers", async () => {
    const clients = new FakeClientRepository();
    const useCase = new RegisterClientIntake(clients);

    await expect(useCase.execute({ name: "Mary", phoneRaw: "123", gdprConsent: true })).rejects.toThrow(InvalidPhoneNumberError);
    expect(clients.created).toHaveLength(0);
  });

  it("reuses a compatible client already stored under the normalized phone", async () => {
    const existing = makeClient({ id: "client-existing" });
    const clients = new FakeClientRepository(existing);
    const useCase = new RegisterClientIntake(clients);

    await expect(useCase.execute({
      name: "  Mary Kelly  ",
      phoneRaw: "085 200 9225",
      gdprConsent: true,
      notes: "Prefers mornings",
    })).resolves.toBe(existing);

    expect(clients.created).toEqual([]);
  });

  it("rejects incompatible content stored under the same phone", async () => {
    const clients = new FakeClientRepository(makeClient({ name: "Another person" }));
    const useCase = new RegisterClientIntake(clients);

    await expect(useCase.execute({
      name: "Mary Kelly",
      phoneRaw: "085 200 9225",
      gdprConsent: true,
      notes: "Prefers mornings",
    })).rejects.toBeInstanceOf(IdempotencyConflictError);

    expect(clients.created).toEqual([]);
  });
});

class FakeClientRepository implements ClientRepository {
  readonly created: NewClient[] = [];
  constructor(private readonly existing: Client | null = null) {}

  async getByPhone(): Promise<Client | null> {
    return this.existing;
  }

  async create(client: NewClient): Promise<Client> {
    this.created.push(client);

    return {
      id: `client-${this.created.length}`,
      name: client.name,
      phone: client.phone,
      gdprConsent: client.gdprConsent,
      notes: client.notes,
    };
  }
  async getWithHistory(clientId: string): Promise<ClientWithHistory | null> {
    void clientId;
    throw new Error("Not implemented");
  }

  async anonymize(clientId: string): Promise<void> {
    void clientId;
    throw new Error("Not implemented");
  }
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    name: "Mary Kelly",
    phone: { value: "353852009225" } as Client["phone"],
    gdprConsent: true,
    notes: "Prefers mornings",
    ...overrides,
  };
}
