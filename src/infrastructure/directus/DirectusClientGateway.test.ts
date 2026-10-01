import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDirectusClientGateway } from "@/infrastructure/directus/DirectusClientGateway";

const sdk = vi.hoisted(() => ({
  request: vi.fn(),
  readItems: vi.fn((collection: string, query: unknown) => ({ collection, query })),
  readItem: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteFile: vi.fn(),
}));

vi.mock("@directus/sdk", () => ({
  createDirectus: () => {
    const client = { with: () => client, request: sdk.request };
    return client;
  },
  rest: () => ({}),
  staticToken: () => ({}),
  readItems: sdk.readItems,
  readItem: sdk.readItem,
  createItem: sdk.createItem,
  updateItem: sdk.updateItem,
  deleteFile: sdk.deleteFile,
}));

describe("DirectusClientGateway listClients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.request.mockResolvedValue([]);
  });

  it("requests only visible client fields with stable look-ahead pagination", async () => {
    const gateway = createDirectusClientGateway("https://directus.example", "token");

    await gateway.listClients({ page: 2, pageSize: 20, search: "mary" });

    const options = sdk.readItems.mock.calls[0]?.[1];
    expect(options).toEqual({
      fields: ["id", "name", "phone", "gdpr_consent"],
      filter: { _and: [{ phone: { _nnull: true } }, { _or: [{ name: { _icontains: "mary" } }] }] },
      sort: ["name", "id"],
      limit: 21,
      offset: 20,
    });
    expect(JSON.stringify(options)).not.toMatch(/notes|orders|appointments|photo/);
  });
});

describe("DirectusClientGateway directory filters", () => {
  beforeEach(() => { vi.clearAllMocks(); sdk.request.mockResolvedValue([]); });
  it("normalizes telephone search and excludes anonymized rows before pagination", async () => {
    await createDirectusClientGateway("https://directus.example", "test").listClients({ page: 1, pageSize: 20, search: "00353 (85) 000-0001" });
    expect(sdk.readItems).toHaveBeenCalledWith("clients", expect.objectContaining({
      filter: { _and: [{ phone: { _nnull: true } }, { _or: [{ name: { _icontains: "00353 (85) 000-0001" } }, { phone: { _contains: "353850000001" } }] }] },
    }));
  });
  it("uses only the non-null predicate for an empty directory query", async () => {
    await createDirectusClientGateway("https://directus.example", "test").listClients({ page: 1, pageSize: 20 });
    expect(sdk.readItems).toHaveBeenCalledWith("clients", expect.objectContaining({ filter: { phone: { _nnull: true } } }));
  });
});

describe("DirectusClientGateway deleteFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats an already deleted file as a completed anonymization step", async () => {
    sdk.request.mockRejectedValueOnce({ status: 404 });
    const gateway = createDirectusClientGateway("https://directus.example", "token");

    await expect(gateway.deleteFile("file-1")).resolves.toBeUndefined();

    expect(sdk.deleteFile).toHaveBeenCalledWith("file-1");
  });

  it("propagates deletion failures whose outcome is not confirmed", async () => {
    const failure = { status: 503 };
    sdk.request.mockRejectedValueOnce(failure);
    const gateway = createDirectusClientGateway("https://directus.example", "token");

    await expect(gateway.deleteFile("file-1")).rejects.toBe(failure);
  });
});
