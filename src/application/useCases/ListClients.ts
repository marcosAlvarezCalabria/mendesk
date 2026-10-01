import type { ClientListPage, ClientListReader } from "@/application/ports/ClientListReader";

export type ListClientsInput = { page?: number; search?: string };

export const CLIENT_LIST_PAGE_SIZE = 8;

export class ListClients {
  constructor(private readonly clients: ClientListReader) {}

  execute(input: ListClientsInput): Promise<ClientListPage> {
    const page = input.page ?? 1;

    if (!Number.isSafeInteger(page) || page < 1) {
      throw new Error("Page must be a positive integer");
    }

    return this.clients.list({ page, pageSize: CLIENT_LIST_PAGE_SIZE, search: input.search?.trim() || undefined });
  }
}
