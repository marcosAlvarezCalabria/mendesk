import { beforeEach, describe, expect, it, vi } from "vitest";

import { GarmentNotFoundError } from "@/domain/errors/GarmentNotFoundError";
import { LastGarmentRemovalError } from "@/domain/errors/LastGarmentRemovalError";
import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";

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
vi.mock("@/application/useCases/RemoveGarmentFromOrder", () => ({
  RemoveGarmentFromOrder: class {
    execute(input: unknown) {
      return mocks.execute(input);
    }
  },
}));
vi.mock("@/app/authRedirect", () => ({ redirectToLoginForAuthError: mocks.redirectToLoginForAuthError }));
vi.mock("@/composition/directus", () => ({
  makeGarmentRepository: vi.fn(() => ({})),
  makeOrderRepository: vi.fn(() => ({ getByOrderNumber: mocks.getByOrderNumber })),
}));
vi.mock("@/infrastructure/auth/authError", () => ({ isAuthError: mocks.isAuthError }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: mocks.getSessionToken }));

import { removeGarmentAction } from "@/app/orders/[orderNumber]/remove-actions";

describe("removeGarmentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionToken.mockResolvedValue("token");
    mocks.getByOrderNumber.mockResolvedValue(syncOrder);
    mocks.isAuthError.mockReturnValue(false);
    mocks.redirectToLoginForAuthError.mockRejectedValue(new Error("NEXT_REDIRECT"));
    mocks.execute.mockResolvedValue(undefined);
    mocks.getByOrderNumber.mockResolvedValue(syncOrder);
  });

  it("removes the submitted garment and refreshes the order surfaces", async () => {
    const state = await removeGarmentAction(
      { status: "idle", error: null },
      removeFormData(),
    );

    expect(mocks.execute).toHaveBeenCalledWith({
      orderNumber: "260829-0142",
      garmentId: "garment-2",
      expectedDateUpdated: "2026-09-05T10:00:00.000Z",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders/260829-0142");
    expect(state).toEqual({ sync: expect.objectContaining({ eventId: expect.any(String) }), status: "success", mutationResult: "confirmed-saved", error: null });
  });

  it.each([
    [new LastGarmentRemovalError(), "lastGarment"],
    [new OrderNotEditableError(), "notEditable"],
    [new GarmentNotFoundError(), "notFound"],
    [new OrderNotFoundError(), "notFound"],
    [new Error("Directus unavailable"), "deleteFailed"],
  ] as const)("returns a recoverable error code for %s", async (error, expectedCode) => {
    mocks.execute.mockRejectedValue(error);

    const state = await removeGarmentAction(
      { status: "idle", error: null },
      removeFormData(),
    );

    expect(state).toMatchObject({
      status: "error",
      mutationResult: expectedCode === "deleteFailed" ? "outcome-unknown" : "confirmed-not-saved",
      error: expectedCode,
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("delegates an expired session to the shared login redirect", async () => {
    const authError = { status: 401 };
    mocks.execute.mockRejectedValueOnce(authError);
    mocks.isAuthError.mockReturnValueOnce(true);

    await expect(
      removeGarmentAction({ status: "idle", error: null }, removeFormData()),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirectToLoginForAuthError).toHaveBeenCalledWith(authError, "/orders/260829-0142");
  });

  it("checks Directus instead of repeating an unknown removal and confirms it was saved", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("response lost"));
    const first = await removeGarmentAction({ status: "idle", error: null }, removeFormData());
    mocks.getByOrderNumber.mockResolvedValueOnce({ ...syncOrder, garments: [] });

    await expect(removeGarmentAction(first, removeFormData())).resolves.toEqual({ sync: expect.objectContaining({ eventId: expect.any(String) }), status: "success", mutationResult: "confirmed-saved", error: null });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.getByOrderNumber).toHaveBeenCalledWith("260829-0142");
  });

  it("confirms an unknown removal was not saved when the original garment version remains", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("response lost"));
    const first = await removeGarmentAction({ status: "idle", error: null }, removeFormData());
    mocks.getByOrderNumber.mockResolvedValueOnce(orderWithGarment("2026-09-05T10:00:00.000Z"));

    await expect(removeGarmentAction(first, removeFormData())).resolves.toEqual({ status: "error", mutationResult: "confirmed-not-saved", error: "deleteFailed" });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("reports conflict when the garment changed during an unknown removal", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("response lost"));
    const first = await removeGarmentAction({ status: "idle", error: null }, removeFormData());
    mocks.getByOrderNumber.mockResolvedValueOnce(orderWithGarment("2026-09-05T10:01:00.000Z"));

    await expect(removeGarmentAction(first, removeFormData())).resolves.toEqual({ status: "error", mutationResult: "confirmed-not-saved", error: "conflict" });
  });

  it("keeps an unknown removal blocked when the read-only check also fails", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("response lost"));
    const first = await removeGarmentAction({ status: "idle", error: null }, removeFormData());
    mocks.getByOrderNumber.mockRejectedValueOnce(new Error("read failed"));

    const checked = await removeGarmentAction(first, removeFormData());
    expect(checked).toMatchObject({ status: "error", mutationResult: "outcome-unknown", error: "deleteFailed" });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
});

function removeFormData(): FormData {
  const formData = new FormData();
  formData.set("order_number", "260829-0142");
  formData.set("garment_id", "garment-2");
  formData.set("expected_date_updated", "2026-09-05T10:00:00.000Z");
  return formData;
}

function orderWithGarment(dateUpdated: string) {
  return { ...syncOrder, garments: [{ id: "garment-2", dateUpdated: new Date(dateUpdated) }] };
}
