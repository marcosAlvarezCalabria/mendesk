import { describe, expect, it } from "vitest";

import type { ClientListItem } from "@/application/dtos/ClientListItem";
import type { ClientListPage, ClientListQuery, ClientListReader } from "@/application/ports/ClientListReader";
import { CLIENT_LIST_PAGE_SIZE, ListClients } from "@/application/useCases/ListClients";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("ListClients", () => {
  it("requests the first compact page by default", async () => {
    const page = { items: [makeClient()], hasNextPage: true };
    const reader = new FakeClientListReader(page);

    await expect(new ListClients(reader).execute({})).resolves.toEqual(page);
    expect(reader.lastQuery).toEqual({ page: 1, pageSize: CLIENT_LIST_PAGE_SIZE, search: undefined });
  });

  it("passes the selected page and a trimmed search term", async () => {
    const reader = new FakeClientListReader({ items: [], hasNextPage: false });

    await new ListClients(reader).execute({ page: 2, search: "  mary  " });

    expect(reader.lastQuery).toEqual({ page: 2, pageSize: 8, search: "mary" });
  });

  it("passes undefined for blank search", async () => {
    const reader = new FakeClientListReader({ items: [], hasNextPage: false });

    await new ListClients(reader).execute({ search: "   " });

    expect(reader.lastQuery?.search).toBeUndefined();
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity])("rejects invalid page %s", async (page) => {
    const reader = new FakeClientListReader({ items: [], hasNextPage: false });

    expect(() => new ListClients(reader).execute({ page })).toThrow("Page must be a positive integer");
    expect(reader.lastQuery).toBeNull();
  });
});

class FakeClientListReader implements ClientListReader {
  lastQuery: ClientListQuery | null = null;

  constructor(private readonly page: ClientListPage) {}

  async list(query: ClientListQuery): Promise<ClientListPage> {
    this.lastQuery = query;
    return this.page;
  }
}

function makeClient(overrides: Partial<ClientListItem> = {}): ClientListItem {
  return {
    id: "client-1",
    name: "Mary",
    phone: PhoneNumber.fromRaw("085 200 9225"),
    gdprConsent: true,
    ...overrides,
  };
}
