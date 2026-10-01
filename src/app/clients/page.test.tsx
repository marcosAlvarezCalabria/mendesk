import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ list: vi.fn(), token: vi.fn() }));
vi.mock("@/application/useCases/ListClients", () => ({ ListClients: class { execute = mocks.list; } }));
vi.mock("@/composition/directus", () => ({ makeClientListReader: vi.fn() }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: mocks.token }));
vi.mock("@/i18n/getLocale", () => ({ getLocale: async () => "en" }));
vi.mock("@/app/_ui/AppHeader", () => ({ AppHeader: () => null }));
vi.mock("@/app/authRedirect", () => ({ redirectToLoginForAuthError: async (error: unknown) => { throw error; } }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(url); } }));
import Page from "./page";
describe("Clients server page", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.token.mockResolvedValue("test"); mocks.list.mockResolvedValue({ items: [], hasNextPage: false }); });
  it("discards duplicate params rather than choosing first", async () => {
    await Page({ searchParams: Promise.resolve({ q: ["a", "b"], page: ["2", "3"] }) });
    expect(mocks.list).toHaveBeenCalledWith({ search: "", page: 1 });
  });
  it("renders a recoverable initial read error without a success marker", async () => {
    mocks.list.mockRejectedValue(new Error("network"));
    const tree = await Page({ searchParams: Promise.resolve({ q: "Example" }) });
    expect(tree.props.children[0]).toBeNull();
    expect(tree.props.children[2].props.children.props.initialError).toBe(true);
  });
  it("keeps the directory destination through login", async () => {
    mocks.token.mockResolvedValue(null);
    await expect(Page({ searchParams: Promise.resolve({ q: "Example", page: "2" }) })).rejects.toThrow("next=%2Fclients%3Fq%3DExample%26page%3D2");
  });
});
