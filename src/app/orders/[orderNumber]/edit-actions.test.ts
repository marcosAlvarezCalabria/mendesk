import { beforeEach, describe, expect, it, vi } from "vitest";

import { InvalidMoneyError } from "@/domain/errors/InvalidMoneyError";
import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";

const syncOrder = { id: "order-1", orderNumber: { value: "260829-0142" }, client: { id: "client-1" } };

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
vi.mock("@/application/useCases/AddGarmentToOrder", () => ({
  AddGarmentToOrder: class {
    execute(input: unknown) {
      return mocks.execute(input);
    }
  },
}));
vi.mock("@/application/useCases/EditOrderDetails", () => ({
  EditOrderDetails: class {
    execute(input: unknown) {
      return mocks.execute(input);
    }
  },
}));
vi.mock("@/application/useCases/EditGarment", () => ({
  EditGarment: class {
    execute(input: unknown) {
      return mocks.execute(input);
    }
  },
}));
vi.mock("@/app/authRedirect", () => ({ redirectToLoginForAuthError: mocks.redirectToLoginForAuthError }));
vi.mock("@/composition/directus", () => ({
  makeGarmentRepository: vi.fn(() => ({})),
  makeOrderRepository: vi.fn(() => ({ getByOrderNumber: mocks.getByOrderNumber })),
  makePhotoStorage: vi.fn(() => ({})),
}));
vi.mock("@/infrastructure/auth/authError", () => ({ isAuthError: mocks.isAuthError }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: mocks.getSessionToken }));

import { addGarmentToOrderAction, editGarmentAction, editOrderDetailsAction } from "@/app/orders/[orderNumber]/edit-actions";

const GARMENT_IDEMPOTENCY_KEY = "550e8400-e29b-41d4-a716-446655440001";

describe("addGarmentToOrderAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionToken.mockResolvedValue("token");
    mocks.getByOrderNumber.mockResolvedValue(syncOrder);
    mocks.isAuthError.mockReturnValue(false);
    mocks.redirectToLoginForAuthError.mockRejectedValue(new Error("NEXT_REDIRECT"));
    mocks.execute.mockResolvedValue({ id: "garment-1" });
  });

  it("adds the submitted garment and refreshes the order surfaces", async () => {
    const state = await addGarmentToOrderAction(
      { status: "idle", error: null },
      garmentFormData(),
    );

    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: GARMENT_IDEMPOTENCY_KEY,
      orderNumber: "260829-0142",
      description: "Blue dress",
      alterationType: "waist",
      measurements: "Take in 2cm",
      priceEuros: 30,
      photo: undefined,
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders/260829-0142");
    expect(state).toEqual({
      mutationResult: "confirmed-saved",
      sync: expect.objectContaining({ eventId: expect.any(String) }),
      status: "success",
      error: null,
      nextIdempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("passes an optional photo through a deferred loader", async () => {
    const formData = garmentFormData();
    formData.set("photo", new File([new Uint8Array([1, 2, 3])], "dress.jpg", { type: "image/jpeg" }));

    await addGarmentToOrderAction({ status: "idle", error: null }, formData);

    const input = mocks.execute.mock.calls[0]?.[0] as { photo?: { load(): Promise<unknown> } };
    await expect(input.photo?.load()).resolves.toEqual({
      bytes: new Uint8Array([1, 2, 3]),
      filename: "dress.jpg",
      contentType: "image/jpeg",
    });
  });

  it.each([
    [new OrderNotEditableError(), "notEditable"],
    [new Error("Garment description is required"), "description"],
    [new InvalidMoneyError(), "price"],
    [new Error("Directus unavailable"), "saveFailed"],
  ] as const)("returns a recoverable error code for %s", async (error, expectedCode) => {
    mocks.execute.mockRejectedValue(error);

    const state = await addGarmentToOrderAction(
      { status: "idle", error: null },
      garmentFormData(),
    );

    expect(state).toEqual({
      status: "error",
      mutationResult: expectedCode === "saveFailed" ? "outcome-unknown" : "confirmed-not-saved",
      error: expectedCode,
      idempotencyKey: GARMENT_IDEMPOTENCY_KEY,
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("delegates an expired session to the shared login redirect", async () => {
    const authError = { status: 401 };
    mocks.execute.mockRejectedValueOnce(authError);
    mocks.isAuthError.mockReturnValueOnce(true);

    await expect(
      addGarmentToOrderAction({ status: "idle", error: null }, garmentFormData()),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirectToLoginForAuthError).toHaveBeenCalledWith(authError, "/orders/260829-0142");
  });

  it("rejects a malformed idempotency key before adding a garment", async () => {
    const formData = garmentFormData();
    formData.set("idempotency_key", "invalid");

    const state = await addGarmentToOrderAction(
      { status: "idle", error: null },
      formData,
    );

    expect(state).toEqual({ status: "error", mutationResult: "confirmed-not-saved", error: "saveFailed" });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});

describe("editOrderDetailsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionToken.mockResolvedValue("token");
    mocks.getByOrderNumber.mockResolvedValue(syncOrder);
    mocks.execute.mockResolvedValue(syncOrder);
  });

  it("returns a saved state after persisting the order details", async () => {
    const formData = new FormData();
    formData.set("orderNumber", "260829-0142");
    formData.set("expected_date_updated", "2026-09-06T08:00:00.000Z");
    formData.set("due_date", "2026-08-31");
    formData.set("notes", "Call before collection");

    const state = await editOrderDetailsAction(
      { status: "idle", error: null },
      formData,
    );

    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      orderNumber: "260829-0142",
      expectedDateUpdated: new Date("2026-09-06T08:00:00.000Z"),
      notes: "Call before collection",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders/260829-0142");
    expect(state).toEqual({
      status: "success",
      mutationResult: "confirmed-saved",
      sync: expect.objectContaining({ eventId: expect.any(String) }),
      error: null,
      saved: {
        dueDate: "2026-08-31",
        notes: "Call before collection",
      },
    });
  });

  it("reconciles an unknown result without repeating the update", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("timeout"));
    const formData = orderEditFormData();
    const unknown = await editOrderDetailsAction({ status: "idle", error: null }, formData);
    mocks.getByOrderNumber.mockResolvedValue({ ...syncOrder,
      dueDate: new Date("2026-08-31T00:00:00.000Z"),
      notes: "Call before collection",
      dateUpdated: new Date("2026-09-06T08:01:00.000Z"),
      garments: [],
    });

    const reconciled = await editOrderDetailsAction(unknown, new FormData());

    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.getByOrderNumber).toHaveBeenCalledWith("260829-0142");
    expect(reconciled).toMatchObject({ status: "success", mutationResult: "confirmed-saved" });
  });

  it("allows a later retry only after Directus confirms the update was not saved", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("timeout"));
    const formData = orderEditFormData();
    const unknown = await editOrderDetailsAction({ status: "idle", error: null }, formData);
    mocks.getByOrderNumber.mockResolvedValue({ ...syncOrder,
      dueDate: new Date("2026-08-30T00:00:00.000Z"),
      notes: "Old",
      dateUpdated: new Date("2026-09-06T08:00:00.000Z"),
      garments: [],
    });

    const checked = await editOrderDetailsAction(unknown, new FormData());
    expect(checked).toMatchObject({ status: "error", mutationResult: "confirmed-not-saved" });
    expect(mocks.execute).toHaveBeenCalledTimes(1);

    mocks.execute.mockResolvedValueOnce(syncOrder);
    await editOrderDetailsAction(checked, formData);
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });
});

describe("editGarmentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionToken.mockResolvedValue("token");
    mocks.getByOrderNumber.mockResolvedValue(syncOrder);
    mocks.isAuthError.mockReturnValue(false);
    mocks.execute.mockResolvedValue(syncOrder);
  });

  it("sends the garment version visible in the form", async () => {
    await editGarmentAction({ status: "idle", error: null }, garmentEditFormData());

    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({
      garmentId: "garment-1",
      expectedDateUpdated: new Date("2026-09-06T07:00:00.000Z"),
    }));
  });

  it("reconciles an unknown garment edit without repeating it", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("timeout"));
    const formData = garmentEditFormData();
    const unknown = await editGarmentAction({ status: "idle", error: null }, formData);
    mocks.getByOrderNumber.mockResolvedValue({ ...syncOrder,
      garments: [{
        id: "garment-1",
        description: "Blue dress",
        alterationType: "waist",
        measurements: "Take in 2cm",
        price: { equals: () => true },
        dateUpdated: new Date("2026-09-06T07:01:00.000Z"),
      }],
    });

    const reconciled = await editGarmentAction(unknown, new FormData());

    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(reconciled).toMatchObject({ status: "success", mutationResult: "confirmed-saved" });
  });
});

function orderEditFormData(): FormData {
  const formData = new FormData();
  formData.set("orderNumber", "260829-0142");
  formData.set("expected_date_updated", "2026-09-06T08:00:00.000Z");
  formData.set("due_date", "2026-08-31");
  formData.set("notes", "Call before collection");
  return formData;
}

function garmentEditFormData(): FormData {
  const formData = new FormData();
  formData.set("orderNumber", "260829-0142");
  formData.set("garment_id", "garment-1");
  formData.set("expected_date_updated", "2026-09-06T07:00:00.000Z");
  formData.set("description", "Blue dress");
  formData.set("alteration_type", "waist");
  formData.set("measurements", "Take in 2cm");
  formData.set("price", "30");
  return formData;
}

function garmentFormData(): FormData {
  const formData = new FormData();
  formData.set("order_number", "260829-0142");
  formData.set("idempotency_key", GARMENT_IDEMPOTENCY_KEY);
  formData.set("description", "Blue dress");
  formData.set("alteration_type", "waist");
  formData.set("measurements", "Take in 2cm");
  formData.set("price", "30");
  return formData;
}
