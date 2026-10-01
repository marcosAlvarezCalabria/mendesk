import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";

const mocks = vi.hoisted(() => ({ read: vi.fn(), invalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.invalidate }));
vi.mock("@/composition/directus", () => ({ makeOrderRepository: () => ({ getByOrderNumber: mocks.read }) }));
import { completeClientMutation, completeOrderMutation } from "./server";

const target = { kind: "order" as const, orderId: "order-id", orderNumber: "260907-0142", clientId: "client-id" };
const date = new Date("2026-09-07T10:00:00Z");
describe("mutation synchronization receipts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.read.mockResolvedValue({ id: target.orderId, orderNumber: OrderNumber.fromString(target.orderNumber),
      client: { id: target.clientId, name: "Example", phone: null, gdprConsent: true },
      status: OrderStatus.RECEIVED, receivedDate: date, dateUpdated: date, dueDate: date, garments: [], payments: [] });
  });
  it("rereads the aggregate and invalidates all five derived paths", async () => {
    const receipt = await completeOrderMutation(target, "test-only");
    expect(receipt.target).toEqual(target);
    expect(receipt.snapshot?.orderNumber).toBe(target.orderNumber);
    expect(receipt.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(mocks.read).toHaveBeenCalledWith(target.orderNumber);
    expect(mocks.invalidate.mock.calls).toEqual([["/orders"], ["/orders/260907-0142"], ["/orders/260907-0142/tickets"], ["/clients/client-id"], ["/stats"]]);
  });
  it.each([new Error("Network"), { status: 401 }])("does not undo a confirmed write when rereading fails", async (error) => {
    mocks.read.mockRejectedValue(error);
    const receipt = await completeOrderMutation(target, "test-only");
    expect(receipt.snapshot).toBeNull();
    expect(receipt.target).toEqual(target);
    expect(mocks.invalidate).toHaveBeenCalledTimes(5);
  });
  it("does not attach a snapshot belonging to a different order", async () => {
    const order = await mocks.read();
    mocks.read.mockResolvedValue({ ...order, id: "different-id" });
    expect((await completeOrderMutation(target, "test-only")).snapshot).toBeNull();
  });
  it("invalidates client paths including dynamic tickets and appointments", async () => {
    const receipt = await completeClientMutation("client-id");
    expect(receipt.snapshot).toBeNull();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.invalidate).toHaveBeenCalledWith("/orders/[orderNumber]", "page");
    expect(mocks.invalidate).toHaveBeenCalledWith("/orders/[orderNumber]/tickets", "page");
    expect(mocks.invalidate).toHaveBeenCalledWith("/appointments");
  });
});
