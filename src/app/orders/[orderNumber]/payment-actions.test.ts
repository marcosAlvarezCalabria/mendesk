import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvalidMoneyError } from "@/domain/errors/InvalidMoneyError";
import { Money } from "@/domain/values/Money";
import { OrderStatus } from "@/domain/values/OrderStatus";

const syncOrder = {
  id: "order-1",
  orderNumber: { value: "260828-0142" },
  client: { id: "client-1" },
  status: OrderStatus.RECEIVED,
  garments: [{ price: Money.fromEuros(50) }],
  payments: [{ amount: Money.fromEuros(7.5) }],
};

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
vi.mock("@/application/useCases/RecordPayment", () => ({
  RecordPayment: class {
    execute(input: unknown) {
      return mocks.execute(input);
    }
  },
}));
vi.mock("@/app/authRedirect", () => ({ redirectToLoginForAuthError: mocks.redirectToLoginForAuthError }));
vi.mock("@/composition/directus", () => ({ makePaymentRepository: vi.fn(() => ({})), makeOrderRepository: () => ({ getByOrderNumber: mocks.getByOrderNumber }) }));
vi.mock("@/infrastructure/auth/authError", () => ({ isAuthError: mocks.isAuthError }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: mocks.getSessionToken }));

import { recordPaymentAction } from "@/app/orders/[orderNumber]/payment-actions";

const PAYMENT_IDEMPOTENCY_KEY = "550e8400-e29b-41d4-a716-446655440002";

describe("recordPaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionToken.mockResolvedValue("token");
    mocks.getByOrderNumber.mockResolvedValue(syncOrder);
    mocks.isAuthError.mockReturnValue(false);
    mocks.redirectToLoginForAuthError.mockRejectedValue(new Error("NEXT_REDIRECT"));
    mocks.execute.mockResolvedValue({ id: "payment-1" });
  });

  it("records the submitted payment and refreshes the order surfaces", async () => {
    const state = await recordPaymentAction(
      { status: "idle", error: null },
      paymentFormData({ amount: "42.50", type: "final", method: "card" }),
    );

    expect(mocks.execute).toHaveBeenCalledWith({
      orderId: "order-1",
      idempotencyKey: PAYMENT_IDEMPOTENCY_KEY,
      type: "final",
      amountEuros: 42.5,
      method: "card",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders/260828-0142");
    expect(state).toEqual({
      mutationResult: "confirmed-saved",
      sync: expect.objectContaining({ eventId: expect.any(String) }),
      status: "success",
      error: null,
      nextIdempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("rejects an amount above the current outstanding balance before writing", async () => {
    const state = await recordPaymentAction(
      { status: "idle", error: null },
      paymentFormData({ amount: "42.51", type: "deposit", method: "cash" }),
    );

    expect(state).toEqual({
      status: "error",
      mutationResult: "confirmed-not-saved",
      error: "overOutstanding",
      idempotencyKey: PAYMENT_IDEMPOTENCY_KEY,
    });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([OrderStatus.COLLECTED, OrderStatus.CANCELLED])("rejects a payment for a terminal %s order", async (status) => {
    mocks.getByOrderNumber.mockResolvedValueOnce({ ...syncOrder, status });

    const state = await recordPaymentAction(
      { status: "idle", error: null },
      paymentFormData({ amount: "10", type: "final", method: "card" }),
    );

    expect(state).toEqual({
      status: "error",
      mutationResult: "confirmed-not-saved",
      error: "notEditable",
      idempotencyKey: PAYMENT_IDEMPOTENCY_KEY,
    });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each([
    [new Error("Payment amount must be greater than zero."), "invalidAmount"],
    [new InvalidMoneyError(), "invalidAmount"],
    [new Error("Invalid payment type."), "invalidType"],
    [new Error("Invalid payment method."), "invalidMethod"],
    [new Error("Directus unavailable"), "saveFailed"],
  ] as const)("returns a recoverable error code for %s", async (error, expectedCode) => {
    mocks.execute.mockRejectedValue(error);

    const state = await recordPaymentAction(
      { status: "idle", error: null },
      paymentFormData({ amount: "20", type: "deposit", method: "cash" }),
    );

    expect(state).toEqual({
      status: "error",
      mutationResult: expectedCode === "saveFailed" ? "outcome-unknown" : "confirmed-not-saved",
      error: expectedCode,
      idempotencyKey: PAYMENT_IDEMPOTENCY_KEY,
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("delegates an expired session to the shared login redirect", async () => {
    const authError = { status: 401 };
    mocks.execute.mockRejectedValueOnce(authError);
    mocks.isAuthError.mockReturnValueOnce(true);

    await expect(recordPaymentAction(
      { status: "idle", error: null },
      paymentFormData({ amount: "20", type: "deposit", method: "cash" }),
    )).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirectToLoginForAuthError).toHaveBeenCalledWith(authError, "/orders/260828-0142");
  });

  it("rejects a malformed order reference before recording a payment", async () => {
    const formData = paymentFormData({ amount: "20", type: "deposit", method: "cash" });
    formData.set("order_number", "not-an-order");

    const state = await recordPaymentAction({ status: "idle", error: null }, formData);

    expect(state).toEqual({ status: "error", mutationResult: "confirmed-not-saved", error: "saveFailed" });
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a malformed idempotency key before recording a payment", async () => {
    const formData = paymentFormData({ amount: "20", type: "deposit", method: "cash" });
    formData.set("idempotency_key", "invalid");

    const state = await recordPaymentAction({ status: "idle", error: null }, formData);

    expect(state).toEqual({ status: "error", mutationResult: "confirmed-not-saved", error: "saveFailed" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});

function paymentFormData({ amount, type, method }: { amount: string; type: string; method: string }): FormData {
  const formData = new FormData();
  formData.set("order_id", "order-1");
  formData.set("order_number", "260828-0142");
  formData.set("idempotency_key", PAYMENT_IDEMPOTENCY_KEY);
  formData.set("payment_type", type);
  formData.set("amount", amount);
  formData.set("payment_method", method);
  return formData;
}
