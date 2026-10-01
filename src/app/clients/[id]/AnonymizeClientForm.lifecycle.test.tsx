import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ action: undefined as undefined | ((previous: unknown, form: FormData) => Promise<unknown>), replace: vi.fn(), consume: vi.fn(), save: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }), unstable_rethrow: () => {} }));
vi.mock("./actions", () => ({ anonymizeClientAction: mocks.save }));
vi.mock("@/app/sync/useMutationSync", () => ({ useMutationSync: () => ({ phase: "refreshing", retry: vi.fn() }) }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(), useContext: () => ({ consume: mocks.consume }), useEffect: () => {},
  useRef: () => ({ current: null }), useState: (value: unknown) => [value, vi.fn()],
  useActionState: (action: typeof mocks.action, state: unknown) => { mocks.action = action; return [state, vi.fn(), false]; },
}));
import { AnonymizeClientForm } from "./AnonymizeClientForm";
describe("anonymization completion navigation", () => {
  it("navigates after confirmed removal before refresh can unmount the action", async () => {
    const sync = { eventId: "test" };
    mocks.save.mockResolvedValue({ status: "success", mutationResult: "confirmed-saved", error: null, sync });
    AnonymizeClientForm({ clientId: "test", returnTo: "/clients?page=2", texts: { confirmation: "Confirm", submit: "Remove", submitting: "Working" } });
    await mocks.action!({ status: "idle", error: null }, new FormData());
    expect(mocks.consume).toHaveBeenCalledWith(sync); expect(mocks.replace).toHaveBeenCalledWith("/clients?page=2");
  });
});
