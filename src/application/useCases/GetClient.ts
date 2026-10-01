import type { ClientRepository, ClientWithHistory } from "@/application/ports/ClientRepository";
import { ClientNotFoundError } from "@/domain/errors/ClientNotFoundError";

export class GetClient {
  constructor(private readonly clients: ClientRepository) {}

  async execute(clientId: string): Promise<ClientWithHistory> {
    const client = await this.clients.getWithHistory(clientId);

    if (!client) {
      throw new ClientNotFoundError();
    }

    return client;
  }
}
