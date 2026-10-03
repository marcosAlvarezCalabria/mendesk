import { beforeEach, describe, expect, it, vi } from "vitest";

import { PhoneNumber } from "@/domain/values/PhoneNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { OrderNumber } from "@/domain/values/OrderNumber";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getByOrderNumber: vi.fn(),
  getCurrentStoreIdentity: vi.fn(),
  getLocale: vi.fn(),
  getSessionToken: vi.fn(),
  isAuthError: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  redirectToLoginForAuthError: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: mocks.redirect }));
vi.mock("@/application/useCases/ChangeOrderStatus", () => ({
  ChangeOrderStatus: class {
    execute(input: unknown) {
      return mocks.execute(input);
    }
  },
}));
vi.mock("@/app/authRedirect", () => ({ redirectToLoginForAuthError: mocks.redirectToLoginForAuthError }));
vi.mock("@/composition/directus", () => ({ makeOrderRepository: vi.fn(() => ({ getByOrderNumber: mocks.getByOrderNumber })) }));
vi.mock("@/composition/currentStoreIdentity", () => ({ getCurrentStoreIdentity: mocks.getCurrentStoreIdentity }));
vi.mock("@/infrastructure/auth/authError", () => ({ isAuthError: mocks.isAuthError }));
vi.mock("@/i18n/getLocale", () => ({ getLocale: mocks.getLocale }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: mocks.getSessionToken }));

import { changeStatusAction } from "@/app/orders/[orderNumber]/status-actions";

describe("changeStatusAction locale", () => {
  it("returns an order-scoped receipt after a confirmed transition", async () => {
    const order = {
      ...persistedOrder("ready"), id: "order-1", orderNumber: OrderNumber.fromString("260828-0142"),
      client: { ...persistedOrder("ready").client, id: "client-1", gdprConsent: true },
      receivedDate: new Date(), dueDate: new Date(), garments: [], payments: [],
    };
    mocks.execute.mockResolvedValue(order);
    mocks.getByOrderNumber.mockResolvedValue(order);
    const result = await changeStatusAction({ status: "idle", error: null }, statusFormData("ready"));
    expect(result).toMatchObject({ sync: {
      target: { kind: "order", orderId: "order-1", orderNumber: "260828-0142", clientId: "client-1" },
      snapshot: { status: "ready" },
    } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/stats");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/clients/client-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders/260828-0142/tickets");
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionToken.mockResolvedValue("token");
    mocks.getLocale.mockResolvedValue("uk");
    mocks.getCurrentStoreIdentity.mockResolvedValue({
      name: "Atelier Aurora",
      shortName: "Aurora",
      logo: { src: "/store/demo-atelier-mark.svg", alt: "Atelier Aurora" },
    });
    mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
    mocks.isAuthError.mockReturnValue(false);
    mocks.redirectToLoginForAuthError.mockRejectedValue(new Error("NEXT_REDIRECT"));
    mocks.getByOrderNumber.mockResolvedValue(null);
    mocks.execute.mockResolvedValue({
      id: "order-1", orderNumber: OrderNumber.fromString("260828-0142"),
      client: {
        id: "client-1",
        name: "Олена",
        phone: PhoneNumber.fromRaw("353851234567"),
      },
    });
  });

  it("uses the active Ukrainian locale for the Ready WhatsApp message", async () => {
    const formData = new FormData();
    formData.set("orderNumber", "260828-0142");
    formData.set("target", "ready");

    const state = await changeStatusAction({ status: "idle", error: null }, formData);

    expect(mocks.execute).toHaveBeenCalledWith({ orderNumber: "260828-0142", target: "ready", expectedStatus: "", expectedDateUpdated: "" });
    expect(mocks.getLocale).toHaveBeenCalledOnce();
    expect(state.status).toBe("success");
    expect(readWhatsappMessage(state.whatsappUrl)).toContain("готове");
    expect(readWhatsappMessage(state.whatsappUrl)).toContain("Atelier Aurora");
    expect(readWhatsappMessage(state.whatsappUrl)).not.toContain("Demo Atelier");
  });

  it("marks an anonymized client's order Ready without offering WhatsApp", async () => {
    mocks.execute.mockResolvedValueOnce({ id: "order-1", orderNumber: OrderNumber.fromString("260828-0142"), client: { id: "client-1", name: "Deleted client", phone: null } });
    const formData = new FormData();
    formData.set("orderNumber", "260828-0142");
    formData.set("target", "ready");

    await expect(changeStatusAction({ status: "idle", error: null }, formData)).resolves.toEqual({
      status: "success",
      mutationResult: "confirmed-saved",
      error: null,
      target: "ready",
      whatsappUrl: undefined,
      sync: expect.objectContaining({ target: expect.objectContaining({ orderId: "order-1" }) }),
    });
  });

  it("returns a receipt before the client navigates after marking an order collected", async () => {
    const formData = new FormData();
    formData.set("orderNumber", "260828-0142");
    formData.set("target", "collected");

    await expect(changeStatusAction({ status: "idle", error: null }, formData)).resolves.toMatchObject({ status: "success", target: "collected", sync: { target: { orderId: "order-1" } } });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/orders/260828-0142");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns a recoverable error code for an invalid target", async () => {
    const formData = new FormData();
    formData.set("orderNumber", "260828-0142");
    formData.set("target", "unknown");

    await expect(changeStatusAction({ status: "idle", error: null }, formData)).resolves.toEqual({
      status: "error",
      mutationResult: "confirmed-not-saved",
      error: "invalid-transition",
    });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("turns an unexpected repository failure into a retryable state", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("Directus unavailable"));
    const formData = new FormData();
    formData.set("orderNumber", "260828-0142");
    formData.set("target", "ready");

    await expect(changeStatusAction({ status: "idle", error: null }, formData)).resolves.toMatchObject({
      status: "error", mutationResult: "outcome-unknown", target: "ready", error: "unexpected",
    });
  });

  it("delegates an expired session to the shared login redirect", async () => {
    const authError = { status: 401 };
    mocks.execute.mockRejectedValueOnce(authError);
    mocks.isAuthError.mockReturnValueOnce(true);
    const formData = new FormData();
    formData.set("orderNumber", "260828-0142");
    formData.set("target", "ready");

    await expect(changeStatusAction({ status: "idle", error: null }, formData)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirectToLoginForAuthError).toHaveBeenCalledWith(authError, "/orders/260828-0142");
  });

  it("checks Directus instead of repeating an unknown status mutation and confirms it was saved", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("response lost"));
    const first = await changeStatusAction({ status: "idle", error: null }, statusFormData("ready"));
    mocks.getByOrderNumber.mockResolvedValueOnce(persistedOrder("ready"));

    const checked = await changeStatusAction(first, statusFormData("cancelled"));

    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.getByOrderNumber).toHaveBeenCalledWith("260828-0142");
    expect(checked).toMatchObject({ status: "success", mutationResult: "confirmed-saved", target: "ready" });
  });

  it("confirms an unknown status mutation was not saved when source and version remain", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("response lost"));
    const first = await changeStatusAction({ status: "idle", error: null }, statusFormData("ready"));
    mocks.getByOrderNumber.mockResolvedValueOnce(persistedOrder("received"));

    await expect(changeStatusAction(first, statusFormData("ready"))).resolves.toEqual({ status: "error", mutationResult: "confirmed-not-saved", error: "unexpected", target: "ready" });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("reports conflict when reconciliation finds another version", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("response lost"));
    const first = await changeStatusAction({ status: "idle", error: null }, statusFormData("ready"));
    mocks.getByOrderNumber.mockResolvedValueOnce(persistedOrder("received", "2026-09-05T10:01:00.000Z"));

    await expect(changeStatusAction(first, statusFormData("ready"))).resolves.toEqual({ status: "error", mutationResult: "confirmed-not-saved", error: "conflict", target: "ready" });
  });

  it("returns a coherent saved result when a read-only check finds Collected", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("response lost"));
    const first = await changeStatusAction({ status: "idle", error: null }, statusFormData("collected"));
    mocks.getByOrderNumber.mockResolvedValueOnce({ ...persistedOrder("ready"), status: OrderStatus.COLLECTED });

    await expect(changeStatusAction(first, statusFormData("collected"))).resolves.toMatchObject({ status: "success", mutationResult: "confirmed-saved", error: null, target: "collected", sync: { target: { orderId: "order-1" } } });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("keeps an unknown status blocked when the read-only check also fails", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("response lost"));
    const first = await changeStatusAction({ status: "idle", error: null }, statusFormData("ready"));
    mocks.getByOrderNumber.mockRejectedValueOnce(new Error("read failed"));

    const checked = await changeStatusAction(first, statusFormData("ready"));
    expect(checked).toMatchObject({ status: "error", mutationResult: "outcome-unknown", error: "unexpected", target: "ready" });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
});

function statusFormData(target: string): FormData {
  const formData = new FormData();
  formData.set("orderNumber", "260828-0142");
  formData.set("target", target);
  formData.set("source", "received");
  formData.set("expectedDateUpdated", "2026-09-05T10:00:00.000Z");
  return formData;
}

function persistedOrder(status: "received" | "ready", dateUpdated = "2026-09-05T10:00:00.000Z") {
  return { id: "order-1", orderNumber: OrderNumber.fromString("260828-0142"), status: status === "ready" ? OrderStatus.READY : OrderStatus.RECEIVED, dateUpdated: new Date(dateUpdated), client: { id: "client-1", name: "Mary", phone: PhoneNumber.fromRaw("353851234567") } };
}

function readWhatsappMessage(url: string | undefined): string {
  if (!url) {
    throw new Error("Expected a WhatsApp URL");
  }

  const message = new URL(url).searchParams.get("text");

  if (!message) {
    throw new Error("Expected a WhatsApp message");
  }

  return message;
}
