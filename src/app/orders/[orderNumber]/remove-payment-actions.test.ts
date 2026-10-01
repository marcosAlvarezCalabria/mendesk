import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";
import { PaymentNotFoundError } from "@/domain/errors/PaymentNotFoundError";

const syncOrder = { id: "order-1", orderNumber: { value: "260910-0020" }, client: { id: "client-1" }, payments: [{ id: "payment-1" }] };
const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getByOrderNumber: vi.fn(),
  getSessionToken: vi.fn(),
  isAuthError: vi.fn(),
  revalidatePath: vi.fn(),
  redirectToLoginForAuthError: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/application/useCases/RemovePaymentFromOrder", () => ({
  RemovePaymentFromOrder: class { execute(input: unknown) { return mocks.execute(input); } },
}));
vi.mock("@/app/authRedirect", () => ({ redirectToLoginForAuthError: mocks.redirectToLoginForAuthError }));
vi.mock("@/composition/directus", () => ({
  makeOrderRepository: () => ({ getByOrderNumber: mocks.getByOrderNumber }),
  makePaymentRepository: vi.fn(() => ({})),
}));
vi.mock("@/infrastructure/auth/authError", () => ({ isAuthError: mocks.isAuthError }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: mocks.getSessionToken }));

import { removePaymentAction } from "@/app/orders/[orderNumber]/remove-payment-actions";

describe("removePaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionToken.mockResolvedValue("token");
    mocks.getByOrderNumber.mockResolvedValue(syncOrder);
    mocks.isAuthError.mockReturnValue(false);
    mocks.execute.mockResolvedValue(undefined);
  });

  it("removes the exact payment and refreshes every order surface", async () => {
    const state = await removePaymentAction({ status: "idle", error: null }, formData());

    expect(mocks.execute).toHaveBeenCalledWith({ orderNumber: "260910-0020", paymentId: "payment-1" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/stats");
    expect(state).toEqual({ status: "success", mutationResult: "confirmed-saved", error: null, sync: expect.objectContaining({ eventId: expect.any(String) }) });
  });

  it.each([
    [new OrderNotEditableError(), "notEditable"],
    [new PaymentNotFoundError(), "notFound"],
    [new Error("Directus unavailable"), "deleteFailed"],
  ] as const)("returns a recoverable error for %s", async (error, expected) => {
    mocks.execute.mockRejectedValueOnce(error);

    const state = await removePaymentAction({ status: "idle", error: null }, formData());

    expect(state).toMatchObject({ status: "error", error: expected, mutationResult: expected === "deleteFailed" ? "outcome-unknown" : "confirmed-not-saved" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reconciles an unknown removal without deleting twice", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("response lost"));
    const first = await removePaymentAction({ status: "idle", error: null }, formData());
    mocks.getByOrderNumber.mockResolvedValueOnce({ ...syncOrder, payments: [] });

    const checked = await removePaymentAction(first, formData());

    expect(checked).toMatchObject({ status: "success", mutationResult: "confirmed-saved" });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("confirms an unknown removal was not saved when the payment remains", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("response lost"));
    const first = await removePaymentAction({ status: "idle", error: null }, formData());

    const checked = await removePaymentAction(first, formData());

    expect(checked).toEqual({ status: "error", mutationResult: "confirmed-not-saved", error: "deleteFailed" });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
});

function formData(): FormData {
  const data = new FormData();
  data.set("order_number", "260910-0020");
  data.set("payment_id", "payment-1");
  return data;
}
