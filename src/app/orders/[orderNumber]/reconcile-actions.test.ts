import { beforeEach, describe, expect, it, vi } from "vitest";

import { Money } from "@/domain/values/Money";

const syncOrder = { id: "order-1", orderNumber: { value: "260829-0142" }, client: { id: "client-1" } };

const mocks = vi.hoisted(() => ({
  findGarment: vi.fn(),
  findOrder: vi.fn(),
  findPayment: vi.fn(),
  getSessionToken: vi.fn(),
  isAuthError: vi.fn(),
  revalidatePath: vi.fn(),
  redirectToLoginForAuthError: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/app/authRedirect", () => ({ redirectToLoginForAuthError: mocks.redirectToLoginForAuthError }));
vi.mock("@/composition/directus", () => ({
  makeGarmentRepository: vi.fn(() => ({ getByIdempotencyKey: mocks.findGarment })),
  makeOrderRepository: vi.fn(() => ({ getByOrderNumber: mocks.findOrder })),
  makePaymentRepository: vi.fn(() => ({ getByIdempotencyKey: mocks.findPayment })),
  makePhotoStorage: vi.fn(() => ({})),
}));
vi.mock("@/infrastructure/auth/authError", () => ({ isAuthError: mocks.isAuthError }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: mocks.getSessionToken }));

import { reconcileAddedGarmentAction } from "@/app/orders/[orderNumber]/edit-actions";
import { reconcileRecordedPaymentAction } from "@/app/orders/[orderNumber]/payment-actions";

const GARMENT_KEY = "550e8400-e29b-41d4-a716-446655440001";
const PAYMENT_KEY = "550e8400-e29b-41d4-a716-446655440002";

describe("reconcileAddedGarmentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionToken.mockResolvedValue("token");
    mocks.isAuthError.mockReturnValue(false);
    mocks.findOrder.mockResolvedValue(syncOrder);
  });

  it("confirms that an absent UUID was not saved", async () => {
    mocks.findGarment.mockResolvedValue(null);

    await expect(reconcileAddedGarmentAction(
      { status: "idle", error: null },
      garmentFormData(),
    )).resolves.toEqual({ status: "absent", mutationResult: "confirmed-not-saved", error: null });
  });

  it("confirms a matching saved garment after reload even when the file input is empty", async () => {
    mocks.findGarment.mockResolvedValue({
      id: "garment-1",
      orderId: "order-1",
      description: "Blue dress",
      alterationType: "waist",
      measurements: "Take in 2cm",
      photoId: "photo-1",
      price: Money.fromEuros(30),
      dateUpdated: new Date("2026-09-06T08:00:00.000Z"),
    });

    const state = await reconcileAddedGarmentAction(
      { status: "idle", error: null },
      garmentFormData(),
    );

    expect(state).toEqual({
      status: "saved",
      mutationResult: "confirmed-saved",
      sync: expect.objectContaining({ eventId: expect.any(String) }),
      error: null,
      nextIdempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders/260829-0142");
  });

  it("reports a confirmed conflict when the UUID belongs to another order", async () => {
    mocks.findGarment.mockResolvedValue({
      id: "garment-1",
      orderId: "order-2",
      description: "Blue dress",
      alterationType: "waist",
      measurements: "Take in 2cm",
      price: Money.fromEuros(30),
      dateUpdated: new Date("2026-09-06T08:00:00.000Z"),
    });

    const state = await reconcileAddedGarmentAction(
      { status: "idle", error: null },
      garmentFormData(),
    );

    expect(state).toMatchObject({ status: "error", mutationResult: "confirmed-not-saved" });
  });

  it("keeps the outcome unknown when Directus cannot answer", async () => {
    mocks.findGarment.mockRejectedValue(new Error("Directus unavailable"));

    const state = await reconcileAddedGarmentAction(
      { status: "idle", error: null },
      garmentFormData(),
    );

    expect(state).toMatchObject({ status: "error", mutationResult: "outcome-unknown" });
  });
});

describe("reconcileRecordedPaymentAction", () => {
  beforeEach(() => {
    mocks.findOrder.mockResolvedValue({ ...syncOrder, orderNumber: { value: "260828-0142" } });
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionToken.mockResolvedValue("token");
    mocks.isAuthError.mockReturnValue(false);
  });

  it("confirms that an absent UUID was not saved", async () => {
    mocks.findPayment.mockResolvedValue(null);

    await expect(reconcileRecordedPaymentAction(
      { status: "idle", error: null },
      paymentFormData(),
    )).resolves.toEqual({ status: "absent", mutationResult: "confirmed-not-saved", error: null });
  });

  it("confirms a matching saved payment", async () => {
    mocks.findPayment.mockResolvedValue({
      id: "payment-1",
      orderId: "order-1",
      type: "final",
      method: "card",
      amount: Money.fromEuros(42.5),
      createdAt: new Date("2026-09-06T08:00:00.000Z"),
    });

    const state = await reconcileRecordedPaymentAction(
      { status: "idle", error: null },
      paymentFormData(),
    );

    expect(state).toEqual({
      status: "saved",
      mutationResult: "confirmed-saved",
      sync: expect.objectContaining({ eventId: expect.any(String) }),
      error: null,
      nextIdempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders/260828-0142");
  });

  it.each([
    [{ orderId: "order-2", type: "final", method: "card", amount: 42.5 }, "another order"],
    [{ orderId: "order-1", type: "deposit", method: "card", amount: 42.5 }, "different details"],
  ])("reports a confirmed conflict for %s", async (saved) => {
    mocks.findPayment.mockResolvedValue({
      id: "payment-1",
      orderId: saved.orderId,
      type: saved.type,
      method: saved.method,
      amount: Money.fromEuros(saved.amount),
      createdAt: new Date("2026-09-06T08:00:00.000Z"),
    });

    const state = await reconcileRecordedPaymentAction(
      { status: "idle", error: null },
      paymentFormData(),
    );

    expect(state).toMatchObject({ status: "error", mutationResult: "confirmed-not-saved" });
  });

  it("keeps the outcome unknown when Directus cannot answer", async () => {
    mocks.findPayment.mockRejectedValue(new Error("Directus unavailable"));

    const state = await reconcileRecordedPaymentAction(
      { status: "idle", error: null },
      paymentFormData(),
    );

    expect(state).toMatchObject({ status: "error", mutationResult: "outcome-unknown" });
  });
});

function garmentFormData(): FormData {
  const formData = new FormData();
  formData.set("order_number", "260829-0142");
  formData.set("idempotency_key", GARMENT_KEY);
  formData.set("description", "Blue dress");
  formData.set("alteration_type", "waist");
  formData.set("measurements", "Take in 2cm");
  formData.set("price", "30");
  return formData;
}

function paymentFormData(): FormData {
  const formData = new FormData();
  formData.set("order_id", "order-1");
  formData.set("order_number", "260828-0142");
  formData.set("idempotency_key", PAYMENT_KEY);
  formData.set("payment_type", "final");
  formData.set("amount", "42.50");
  formData.set("payment_method", "card");
  return formData;
}
