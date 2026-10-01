import type { ClientRepository } from "@/application/ports/ClientRepository";

export class AnonymizeClient {
  constructor(private readonly clients: ClientRepository) {}

  async execute(clientId: string): Promise<void> {
    const trimmedClientId = clientId.trim();

    if (!trimmedClientId) {
      throw new Error("Client id is required");
    }

    await this.clients.anonymize(trimmedClientId);
  }
}