import { describe, expect, it } from "vitest";

import type { ClientRepository, ClientWithHistory, NewClient } from "@/application/ports/ClientRepository";
import { AnonymizeClient } from "@/application/useCases/AnonymizeClient";
import type { Client } from "@/domain/entities/Client";
import { ANONYMIZED_CLIENT_NAME } from "@/domain/gdpr/anonymization";

describe("AnonymizeClient", () => {
  it("delegates anonymization for a valid client id", async () => {
    const clients = new FakeClientRepository();
    const useCase = new AnonymizeClient(clients);

    await useCase.execute("client-1");

    expect(clients.anonymized).toEqual(["client-1"]);
  });

  it("rejects a blank client id before calling the repository", async () => {
    const clients = new FakeClientRepository();
    const useCase = new AnonymizeClient(clients);

    await expect(useCase.execute("   ")).rejects.toThrow("Client id is required");
    expect(clients.anonymized).toEqual([]);
  });

  it("exposes the shared anonymized client name literal", () => {
    expect(ANONYMIZED_CLIENT_NAME).toBe("Deleted client");
  });
});

class FakeClientRepository implements ClientRepository {
  readonly anonymized: string[] = [];

  async getByPhone(): Promise<Client | null> {
    return null;
  }

  async create(client: NewClient): Promise<Client> {
    void client;
    throw new Error("Not implemented");
  }

  async getWithHistory(clientId: string): Promise<ClientWithHistory | null> {
    void clientId;
    throw new Error("Not implemented");
  }

  async anonymize(clientId: string): Promise<void> {
    this.anonymized.push(clientId);
  }
}
