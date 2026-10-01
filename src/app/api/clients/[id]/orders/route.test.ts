import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
const makeClientRepository = vi.fn();

vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: vi.fn(async () => "token"), clearSessionCookie: vi.fn() }));
vi.mock("@/composition/directus", () => ({ makeClientRepository }));
vi.mock("@/application/useCases/GetClient", () => ({ GetClient: class { execute = execute; } }));

describe("/api/clients/[id]/orders", () => {
  beforeEach(() => { execute.mockReset(); makeClientRepository.mockReset(); });

  it("returns only order choices belonging to the requested client", async () => {
    execute.mockResolvedValue({ orders: [{ id: "order-1", orderNumber: { value: "260911-0022" }, status: { value: "received" } }] });
    const { GET } = await import("./route");

    const response = await GET(new Request("https://panel.test/api/clients/client-1/orders"), { params: Promise.resolve({ id: "client-1" }) });

    await expect(response.json()).resolves.toEqual({ items: [{ id: "order-1", orderNumber: "260911-0022", status: "received" }] });
    expect(execute).toHaveBeenCalledWith("client-1");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
