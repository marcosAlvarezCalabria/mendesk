import { describe, expect, it, vi } from "vitest";
import { OrdersReadRetry } from "./OrdersReadRetry";
const session = vi.hoisted(() => ({ retry: vi.fn() }));
vi.mock("react", async importOriginal => ({ ...await importOriginal<typeof import("react")>(), useContext: () => session }));
vi.mock("@/app/sync/OrderSyncProvider", () => ({ OrderSyncContext: {} }));
describe("orders read retry", () => {
  it("only requests a read through the existing sync session", () => {
    const button = OrdersReadRetry({ label: "Try again" });
    button.props.onClick(); expect(session.retry).toHaveBeenCalledOnce();
    expect(button.props.type).toBe("button");
  });
});
