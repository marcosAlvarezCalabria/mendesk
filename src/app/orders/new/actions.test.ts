import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addGarments: vi.fn(),
  createOrder: vi.fn(),
  findGarmentByIdempotencyKey: vi.fn(),
  findOrderByIdempotencyKey: vi.fn(),
  findPaymentByIdempotencyKey: vi.fn(),
  getOrRefreshSessionToken: vi.fn(),
  registerClient: vi.fn(),
  recordPayment: vi.fn(),
  isAuthError: vi.fn(),
  photoMatches: vi.fn(),
  makePhotoStorage: vi.fn(() => ({ matches: mocks.photoMatches })),
  redirectToLoginForAuthError: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/application/useCases/AddOrderGarments", () => ({
  AddOrderGarments: class {
    execute(input: unknown) {
      return mocks.addGarments(input);
    }
  },
  OrderGarmentProcessingError: class extends Error {
    constructor(readonly failures: readonly { index: number; cause: unknown }[]) {
      super("Garment processing failed");
    }
  },
}));
vi.mock("@/application/useCases/CreateOrder", () => ({
  CreateOrder: class {
    execute(input: unknown) {
      return mocks.createOrder(input);
    }
  },
}));
vi.mock("@/application/useCases/RegisterClientIntake", () => ({
  RegisterClientIntake: class {
    execute(input: unknown) {
      return mocks.registerClient(input);
    }
  },
}));
vi.mock("@/application/useCases/RecordPayment", () => ({
  RecordPayment: class {
    execute(input: unknown) {
      return mocks.recordPayment(input);
    }
  },
}));
vi.mock("@/app/authRedirect", () => ({ redirectToLoginForAuthError: mocks.redirectToLoginForAuthError }));
vi.mock("@/app/refreshSession", () => ({ getOrRefreshSessionToken: mocks.getOrRefreshSessionToken }));
vi.mock("@/composition/directus", () => ({
  makeClientRepository: vi.fn(() => ({})),
  makeGarmentRepository: vi.fn(() => ({ getByIdempotencyKey: mocks.findGarmentByIdempotencyKey })),
  makeOrderRepository: vi.fn(() => ({ getByIdempotencyKey: mocks.findOrderByIdempotencyKey })),
  makePaymentRepository: vi.fn(() => ({ getByIdempotencyKey: mocks.findPaymentByIdempotencyKey })),
  makeOrderSequenceProvider: vi.fn(() => ({})),
  makePhotoStorage: mocks.makePhotoStorage,
}));
vi.mock("@/infrastructure/auth/authError", () => ({ isAuthError: mocks.isAuthError }));

import { createOrderAction } from "@/app/orders/new/actions";
import { OrderGarmentProcessingError } from "@/application/useCases/AddOrderGarments";
import { IdempotencyConflictError } from "@/domain/errors/IdempotencyConflictError";

const ORDER_IDEMPOTENCY_KEY = "550e8400-e29b-41d4-a716-446655440000";
const GARMENT_IDEMPOTENCY_KEY = "550e8400-e29b-41d4-a716-446655440001";

describe("createOrderAction", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns to New Order after login when the session expired before any write", async () => {
    mocks.getOrRefreshSessionToken.mockResolvedValue(undefined);

    await expect(createOrderAction(
      { status: "idle", error: null, errorCode: null },
      validOrderFormData(),
    )).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith("/login?next=%2Forders%2Fnew");
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.addGarments).not.toHaveBeenCalled();
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it("invalidates a confirmed order when a later garment lookup fails", async () => {
    mocks.findOrderByIdempotencyKey.mockResolvedValue(savedOrder());
    mocks.findGarmentByIdempotencyKey.mockRejectedValue(new Error("read unavailable"));
    const data = validOrderFormData(); data.set("intent", "reconcile");
    const result = await createOrderAction({ status: "error", mutationResult: "outcome-unknown", error: "Unknown", errorCode: "createFailed" }, data);
    expect(result).toMatchObject({ mutationResult: "outcome-unknown", sync: { target: { orderId: "order-1" } } });
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.addGarments).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/stats");
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrRefreshSessionToken.mockResolvedValue("token");
    mocks.findGarmentByIdempotencyKey.mockResolvedValue(null);
    mocks.addGarments.mockResolvedValue([]);
    mocks.createOrder.mockResolvedValue({ id: "order-1", orderNumber: { value: "260902-0007" }, client: { id: "client-new" } });
    mocks.findOrderByIdempotencyKey.mockResolvedValue(null);
    mocks.findPaymentByIdempotencyKey.mockResolvedValue(null);
    mocks.recordPayment.mockResolvedValue({ id: "payment-1" });
    mocks.photoMatches.mockResolvedValue(true);
    mocks.registerClient.mockResolvedValue({ id: "client-new" });
    mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
    mocks.isAuthError.mockReturnValue(false);
    mocks.redirectToLoginForAuthError.mockRejectedValue(new Error("NEXT_REDIRECT"));
  });

  it("rejects an order without garments before writing to Directus", async () => {
    const formData = validOrderFormData();
    formData.delete("garment_description");
    formData.delete("garment_type");
    formData.delete("garment_measurements");
    formData.delete("garment_price");

    const state = await createOrderAction(
      { status: "idle", error: null, errorCode: null },
      formData,
    );

    expect(state).toEqual({ status: "error", mutationResult: "confirmed-not-saved", error: "Add at least one garment to the order.", errorCode: "garmentMissing" });
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.addGarments).not.toHaveBeenCalled();
  });

  it("creates the order and its garments before opening the new order", async () => {
    const state = await createOrderAction(
      { status: "idle", error: null, errorCode: null },
      validOrderFormData(),
    );

    expect(state).toMatchObject({ status: "success", mutationResult: "confirmed-saved", error: null, errorCode: null, orderNumber: "260902-0007", sync: { target: { kind: "order", orderId: "order-1" } } });
    expect(mocks.redirect).not.toHaveBeenCalled();

    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: ORDER_IDEMPOTENCY_KEY,
      clientId: "client-1",
      dueDate: new Date("2026-09-15T00:00:00.000Z"),
      receivedDate: expect.any(Date),
    }));
    expect(mocks.addGarments).toHaveBeenCalledWith({
      orderId: "order-1",
      garments: [{
        idempotencyKey: GARMENT_IDEMPOTENCY_KEY,
        description: "Blue dress",
        alterationType: "hem",
        measurements: "Hem 4 cm",
        priceEuros: 42.5,
        photo: undefined,
      }],
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders");
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it("treats a blank optional deposit as zero", async () => {
    const formData = validOrderFormData();
    formData.set("deposit", "");

    const state = await createOrderAction(
      { status: "idle", error: null, errorCode: null },
      formData,
    );

    expect(state).toMatchObject({ status: "success", mutationResult: "confirmed-saved" });
    expect(mocks.createOrder).toHaveBeenCalledOnce();
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it("uses the confirmed review values when uncontrolled delivery fields were reset after a failed submission", async () => {
    const formData = validOrderFormData();
    formData.set("due_date", "");
    formData.set("notes", "");
    formData.set("payment_method", "");
    formData.append("due_date", "2026-09-15");
    formData.append("notes", "Keep the original hem");
    formData.append("payment_method", "cash");

    await createOrderAction({ status: "idle", error: null, errorCode: null }, formData);

    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      dueDate: new Date("2026-09-15T00:00:00.000Z"),
      notes: "Keep the original hem",
    }));
  });

  it("records one idempotent deposit after the order and garments", async () => {
    const formData = validOrderFormData();
    formData.set("deposit", "20.50");
    formData.set("payment_method", "card");

    await createOrderAction({ status: "idle", error: null, errorCode: null }, formData);

    expect(mocks.recordPayment).toHaveBeenCalledTimes(1);
    expect(mocks.recordPayment).toHaveBeenCalledWith({
      orderId: "order-1",
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440002",
      type: "deposit",
      amountEuros: 20.5,
      method: "card",
    });
    expect(mocks.addGarments.mock.invocationCallOrder[0]).toBeLessThan(mocks.recordPayment.mock.invocationCallOrder[0]!);
  });

  it("rejects a positive deposit without Cash or Card before writing", async () => {
    const formData = validOrderFormData();
    formData.set("deposit", "10");

    const state = await createOrderAction({ status: "idle", error: null, errorCode: null }, formData);

    expect(state).toMatchObject({ status: "error", mutationResult: "confirmed-not-saved", errorCode: "paymentMethod" });
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it("rejects a deposit above the garment total before writing", async () => {
    const formData = validOrderFormData();
    formData.set("deposit", "42.51");
    formData.set("payment_method", "cash");

    const state = await createOrderAction({ status: "idle", error: null, errorCode: null }, formData);

    expect(state).toMatchObject({ status: "error", mutationResult: "confirmed-not-saved", errorCode: "deposit" });
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it("reports an unknown deposit result without offering a blind retry", async () => {
    const formData = validOrderFormData();
    formData.set("deposit", "20.50");
    formData.set("payment_method", "cash");
    mocks.recordPayment.mockRejectedValue(new TypeError("response lost"));

    const state = await createOrderAction({ status: "idle", error: null, errorCode: null }, formData);

    expect(state).toMatchObject({
      status: "error",
      mutationResult: "outcome-unknown",
      errorCode: "partialPaymentUnknown",
      orderNumber: "260902-0007",
    });
  });

  it("blocks a deposit UUID conflict without overwriting or offering retry", async () => {
    const formData = validOrderFormData();
    formData.set("deposit", "20.50");
    formData.set("payment_method", "cash");
    mocks.recordPayment.mockRejectedValue(new IdempotencyConflictError());

    const state = await createOrderAction({ status: "idle", error: null, errorCode: null }, formData);

    expect(state).toMatchObject({
      status: "error",
      mutationResult: "confirmed-saved",
      reconciliationOutcome: "conflict",
      errorCode: "paymentConflict",
      orderNumber: "260902-0007",
    });
  });

  it("reconciles a new-client retry before registering another client", async () => {
    const formData = validOrderFormData();
    formData.set("client_mode", "new");
    formData.delete("client_id");
    formData.set("name", "Mary Kelly");
    formData.set("phone", "085 200 9225");
    formData.set("gdpr", "on");
    mocks.findOrderByIdempotencyKey.mockResolvedValue({
      client: {
        id: "client-original",
        name: "Mary Kelly",
        phone: { value: "353852009225" },
        gdprConsent: true,
      },
    });

    const state = await createOrderAction(
      { status: "idle", error: null, errorCode: null },
      formData,
    );

    expect(state).toEqual({ sync: expect.objectContaining({ eventId: expect.any(String) }), status: "success", mutationResult: "confirmed-saved", error: null, errorCode: null, orderNumber: "260902-0007" });
    expect(mocks.redirect).not.toHaveBeenCalled();

    expect(mocks.findOrderByIdempotencyKey).toHaveBeenCalledWith(
      expect.objectContaining({ value: ORDER_IDEMPOTENCY_KEY }),
    );
    expect(mocks.registerClient).not.toHaveBeenCalled();
    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      clientId: "client-original",
    }));
  });

  it("reconciles the deposit by UUID before confirming a complete order", async () => {
    const formData = validOrderFormData();
    formData.set("intent", "reconcile");
    formData.set("deposit", "20.50");
    formData.set("payment_method", "card");
    mocks.findOrderByIdempotencyKey.mockResolvedValue(savedOrder());
    mocks.findGarmentByIdempotencyKey.mockResolvedValue(savedGarment());
    mocks.findPaymentByIdempotencyKey.mockResolvedValue({
      id: "payment-1",
      orderId: "order-1",
      type: "deposit",
      amount: { cents: 2050 },
      method: "card",
    });

    const state = await createOrderAction(
      { status: "error", mutationResult: "outcome-unknown", error: "Unknown", errorCode: "partialPaymentUnknown", orderNumber: "260902-0007" },
      formData,
    );

    expect(state.status).toBe("success");
    expect(mocks.findPaymentByIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it("confirms a missing deposit before allowing the same UUID to retry", async () => {
    const formData = validOrderFormData();
    formData.set("intent", "reconcile");
    formData.set("deposit", "20.50");
    formData.set("payment_method", "cash");
    mocks.findOrderByIdempotencyKey.mockResolvedValue(savedOrder());
    mocks.findGarmentByIdempotencyKey.mockResolvedValue(savedGarment());

    const state = await createOrderAction(
      { status: "error", mutationResult: "outcome-unknown", error: "Unknown", errorCode: "partialPaymentUnknown", orderNumber: "260902-0007" },
      formData,
    );

    expect(state).toMatchObject({ status: "error", mutationResult: "confirmed-not-saved", reconciliationOutcome: "absent" });
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it("rejects reuse of an order key with different new-client content", async () => {
    const formData = validOrderFormData();
    formData.set("client_mode", "new");
    formData.delete("client_id");
    formData.set("name", "Another client");
    formData.set("phone", "085 200 9225");
    formData.set("gdpr", "on");
    mocks.findOrderByIdempotencyKey.mockResolvedValue({
      client: {
        id: "client-original",
        name: "Mary Kelly",
        phone: { value: "353852009225" },
        gdprConsent: true,
      },
    });

    const state = await createOrderAction(
      { status: "idle", error: null, errorCode: null },
      formData,
    );

    expect(state).toMatchObject({
      status: "error",
      mutationResult: "confirmed-not-saved",
      errorCode: "staleSubmission",
      replacementIdempotencyKeys: {
        order: expect.stringMatching(/^[0-9a-f-]{36}$/),
        garments: [expect.stringMatching(/^[0-9a-f-]{36}$/)],
        payment: expect.stringMatching(/^[0-9a-f-]{36}$/),
      },
    });
    expect(new Set(Object.values(state.replacementIdempotencyKeys ?? {}).flat())).toHaveProperty("size", 3);
    expect(mocks.registerClient).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("rotates every key when an existing-client draft reuses an earlier order key", async () => {
    mocks.createOrder.mockRejectedValue(new IdempotencyConflictError());

    const state = await createOrderAction(
      { status: "idle", error: null, errorCode: null },
      validOrderFormData(),
    );

    expect(state).toMatchObject({
      status: "error",
      mutationResult: "confirmed-not-saved",
      errorCode: "staleSubmission",
      replacementIdempotencyKeys: {
        order: expect.stringMatching(/^[0-9a-f-]{36}$/),
        garments: [expect.stringMatching(/^[0-9a-f-]{36}$/)],
        payment: expect.stringMatching(/^[0-9a-f-]{36}$/),
      },
    });
  });
  it("reconciles an unknown full-order result with GET lookups only", async () => {
    const formData = validOrderFormData();
    formData.set("intent", "reconcile");
    mocks.findOrderByIdempotencyKey.mockResolvedValue(savedOrder());
    mocks.findGarmentByIdempotencyKey.mockResolvedValue(savedGarment());

    const state = await createOrderAction(
      { status: "error", mutationResult: "outcome-unknown", error: "Unknown", errorCode: "createFailed" },
      formData,
    );

    expect(state).toEqual({ sync: expect.objectContaining({ eventId: expect.any(String) }), status: "success", mutationResult: "confirmed-saved", error: null, errorCode: null, orderNumber: "260902-0007" });
    expect(mocks.findOrderByIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(mocks.findGarmentByIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(mocks.registerClient).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.addGarments).not.toHaveBeenCalled();
    expect(mocks.makePhotoStorage).not.toHaveBeenCalled();
  });

  it("rejects reconciliation when the persisted photo bytes differ from the preserved file", async () => {
    const formData = validOrderFormData();
    formData.set("intent", "reconcile");
    formData.append("garment_photo", new File([new Uint8Array([1, 2, 3])], "dress.jpg", { type: "image/jpeg" }));
    mocks.findOrderByIdempotencyKey.mockResolvedValue(savedOrder());
    mocks.findGarmentByIdempotencyKey.mockResolvedValue({ ...savedGarment(), photoId: "file-1" });
    mocks.photoMatches.mockResolvedValue(false);

    const state = await createOrderAction(
      { status: "error", mutationResult: "outcome-unknown", error: "Unknown", errorCode: "createFailed" },
      formData,
    );

    expect(state).toMatchObject({ status: "error", mutationResult: "confirmed-not-saved", reconciliationOutcome: "conflict" });
    expect(mocks.photoMatches).toHaveBeenCalledOnce();
  });

  it("confirms absence read-only and enables an explicit idempotent retry", async () => {
    const formData = validOrderFormData();
    formData.set("intent", "reconcile");

    const reconciled = await createOrderAction(
      { status: "error", mutationResult: "outcome-unknown", error: "Unknown", errorCode: "createFailed" },
      formData,
    );

    expect(reconciled).toMatchObject({ status: "error", mutationResult: "confirmed-not-saved", reconciliationOutcome: "absent", errorCode: "createFailed" });
    expect(mocks.registerClient).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.addGarments).not.toHaveBeenCalled();

    const retry = new FormData();
    for (const [key, value] of formData.entries()) if (key !== "intent") retry.append(key, value);
    await createOrderAction(reconciled, retry);

    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: ORDER_IDEMPOTENCY_KEY }));
    expect(mocks.addGarments).toHaveBeenCalledWith(expect.objectContaining({ garments: [expect.objectContaining({ idempotencyKey: GARMENT_IDEMPOTENCY_KEY })] }));
  });

  it("reconciles only unknown garment positions when submitted rows use stable slots with gaps", async () => {
    const secondKey = "550e8400-e29b-41d4-a716-446655440002";
    const formData = validOrderFormData();
    formData.set("intent", "reconcile");
    formData.append("garment_idempotency_key", secondKey);
    formData.append("garment_description", "Grey trousers");
    formData.append("garment_type", "waist");
    formData.append("garment_measurements", "Take in 2 cm");
    formData.append("garment_price", "30.00");
    mocks.findOrderByIdempotencyKey.mockResolvedValue(savedOrder());
    mocks.findGarmentByIdempotencyKey.mockResolvedValueOnce({
      ...savedGarment(), id: "garment-2", description: "Grey trousers", alterationType: "waist", measurements: "Take in 2 cm", price: { cents: 3000 },
    });

    const state = await createOrderAction(
      { status: "error", mutationResult: "outcome-unknown", error: "Unknown", errorCode: "partialGarmentsUnknown", orderNumber: "260902-0007", failedPositions: [2] },
      formData,
    );

    expect(state.status).toBe("success");
    expect(mocks.findGarmentByIdempotencyKey).toHaveBeenCalledTimes(1);
    expect(mocks.findGarmentByIdempotencyKey).toHaveBeenCalledWith(expect.objectContaining({ value: secondKey }));
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.addGarments).not.toHaveBeenCalled();
  });

  it("reports a reconciliation conflict without retrying or writing", async () => {
    const formData = validOrderFormData();
    formData.set("intent", "reconcile");
    mocks.findOrderByIdempotencyKey.mockResolvedValue({ ...savedOrder(), notes: "Different content" });

    const state = await createOrderAction(
      { status: "error", mutationResult: "outcome-unknown", error: "Unknown", errorCode: "createFailed" },
      formData,
    );

    expect(state).toMatchObject({ status: "error", mutationResult: "confirmed-not-saved", reconciliationOutcome: "conflict", errorCode: "createFailed" });
    expect(mocks.findGarmentByIdempotencyKey).not.toHaveBeenCalled();
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.addGarments).not.toHaveBeenCalled();
  });

  it("keeps reconciliation unknown when a GET cannot be confirmed", async () => {
    const formData = validOrderFormData();
    formData.set("intent", "reconcile");
    mocks.findOrderByIdempotencyKey.mockRejectedValue(new TypeError("connection lost"));

    const state = await createOrderAction(
      { status: "error", mutationResult: "outcome-unknown", error: "Unknown", errorCode: "createFailed" },
      formData,
    );

    expect(state).toMatchObject({ status: "error", mutationResult: "outcome-unknown", errorCode: "createFailed" });
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.addGarments).not.toHaveBeenCalled();
  });

  function savedOrder() {
    return {
      id: "order-1",
      orderNumber: { value: "260902-0007" },
      client: { id: "client-1", name: "Mary Kelly", phone: { value: "353852009225" }, gdprConsent: true },
      status: { value: "received" },
      dueDate: new Date("2026-09-15T00:00:00.000Z"),
      notes: undefined,
    };
  }

  function savedGarment() {
    return {
      id: "garment-1",
      orderId: "order-1",
      description: "Blue dress",
      alterationType: "hem",
      measurements: "Hem 4 cm",
      price: { cents: 4250 },
      photoId: undefined,
    };
  }

  it("returns a recoverable error when Directus cannot create the order", async () => {
    mocks.createOrder.mockRejectedValue(new Error("Directus unavailable"));

    const state = await createOrderAction(
      { status: "idle", error: null, errorCode: null },
      validOrderFormData(),
    );

    expect(state).toEqual({
      status: "error",
      mutationResult: "outcome-unknown",
      error: "The order could not be confirmed. Check the connection before trying again.",
      errorCode: "createFailed",
    });
    expect(mocks.addGarments).not.toHaveBeenCalled();
  });

  it("includes a safe operation diagnostic only during local development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.createOrder.mockRejectedValue(new Error("The mutation was confirmed as not saved.", {
      cause: { errors: [{ message: "Field is forbidden", extensions: { code: "FORBIDDEN" } }], response: { status: 403 } },
    }));

    const state = await createOrderAction(
      { status: "idle", error: null, errorCode: null },
      validOrderFormData(),
    );

    expect(state).toMatchObject({
      diagnostic: "order creation: The mutation was confirmed as not saved. | cause: Field is forbidden [FORBIDDEN, 403]",
    });
  });

  it("does not tell the user to recreate a garment whose result is unknown", async () => {
    mocks.addGarments.mockRejectedValue(
      new OrderGarmentProcessingError([{ index: 0, stage: "garment", cause: new TypeError("response lost") }]),
    );

    const state = await createOrderAction(
      { status: "idle", error: null, errorCode: null },
      validOrderFormData(),
    );

    expect(state).toMatchObject({
      status: "error",
      mutationResult: "outcome-unknown",
      errorCode: "partialGarmentsUnknown",
      orderNumber: "260902-0007",
      failedPositions: [1],
    });
    expect(state.error).toContain("check them before retrying");
    expect(state.error).not.toContain("add them again");
  });

  it("rejects malformed idempotency keys before writing to Directus", async () => {
    const formData = validOrderFormData();
    formData.set("order_idempotency_key", "not-a-uuid");

    const state = await createOrderAction(
      { status: "idle", error: null, errorCode: null },
      formData,
    );

    expect(state).toEqual({
      status: "error",
      mutationResult: "confirmed-not-saved",
      error: "The order could not be saved. Check the connection and try again.",
      errorCode: "createFailed",
    });
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.addGarments).not.toHaveBeenCalled();
  });

  it("delegates an expired session to the shared login redirect", async () => {
    const authError = { status: 401 };
    mocks.createOrder.mockRejectedValue(authError);
    mocks.isAuthError.mockReturnValue(true);

    await expect(createOrderAction(
      { status: "idle", error: null, errorCode: null },
      validOrderFormData(),
    )).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirectToLoginForAuthError).toHaveBeenCalledWith(authError, "/orders/new");
  });
});

function validOrderFormData(): FormData {
  const formData = new FormData();
  formData.set("client_mode", "existing");
  formData.set("client_id", "client-1");
  formData.set("due_date", "2026-09-15");
  formData.set("order_idempotency_key", ORDER_IDEMPOTENCY_KEY);
  formData.set("garment_idempotency_key", GARMENT_IDEMPOTENCY_KEY);
  formData.set("payment_idempotency_key", "550e8400-e29b-41d4-a716-446655440002");
  formData.set("deposit", "0");
  formData.set("garment_description", "Blue dress");
  formData.set("garment_type", "hem");
  formData.set("garment_measurements", "Hem 4 cm");
  formData.set("garment_price", "42.50");
  return formData;
}
