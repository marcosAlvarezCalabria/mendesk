import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClientListItem } from "@/application/dtos/ClientListItem";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

const listClientsExecute = vi.fn();
const makeClientListReader = vi.fn();
const cookieSet = vi.fn();
let sessionToken: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (sessionToken ? { value: sessionToken } : undefined),
    set: cookieSet,
  }),
}));

vi.mock("@/composition/directus", () => ({
  makeClientListReader,
}));

vi.mock("@/application/useCases/ListClients", () => ({
  ListClients: class {
    execute = listClientsExecute;
  },
}));

describe("/api/clients/search", () => {
  it.each(["0", "-1", "1.5", "1e2", "9007199254740992", "2&page=3"])("rejects invalid page %s before I/O", async page => {
    const { GET } = await import("./route");
    const response = await GET(new Request(`https://panel.test/api/clients/search?page=${page}`));
    expect(response.status).toBe(400); expect(listClientsExecute).not.toHaveBeenCalled();
  });
  it("marks client responses no-store", async () => {
    const { GET } = await import("./route"); listClientsExecute.mockResolvedValue({ items: [], hasNextPage: false });
    const response = await GET(new Request("https://panel.test/api/clients/search"));
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  beforeEach(() => {
    sessionToken = "token";
    cookieSet.mockClear();
    listClientsExecute.mockReset();
    makeClientListReader.mockReset();
  });

  it("returns clients for an authenticated search", async () => {
    const { GET } = await import("./route");
    const clients: ClientListItem[] = [
      {
        id: "client-1",
        name: "Mary",
        phone: PhoneNumber.fromRaw("0852009225"),
        gdprConsent: true,
      },
    ];
    listClientsExecute.mockResolvedValue({ items: clients, hasNextPage: true });

    const response = await GET(new Request("https://panel.test/api/clients/search?search=mar&page=2"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [{ id: "client-1", name: "Mary", phone: "353852009225", gdprConsent: true }],
      hasNextPage: true,
    });
    expect(listClientsExecute).toHaveBeenCalledWith({ page: 2, search: "mar" });
  });

  it("returns null phone for an anonymized client", async () => {
    const { GET } = await import("./route");
    listClientsExecute.mockResolvedValue({
      items: [{ id: "client-1", name: "Deleted client", phone: null, gdprConsent: false }],
      hasNextPage: false,
    });

    const response = await GET(new Request("https://panel.test/api/clients/search"));

    await expect(response.json()).resolves.toEqual({
      items: [{ id: "client-1", name: "Deleted client", phone: null, gdprConsent: false }],
      hasNextPage: false,
    });
  });

  it("clears the session and returns unauthorized when Directus rejects the token", async () => {
    const { GET } = await import("./route");
    listClientsExecute.mockRejectedValue({ status: 401 });

    const response = await GET(new Request("https://panel.test/api/clients/search?search=mar"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(cookieSet).toHaveBeenCalledWith(
      "koko_session",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });
});
