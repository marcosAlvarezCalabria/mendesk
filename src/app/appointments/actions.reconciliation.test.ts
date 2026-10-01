import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getById: vi.fn(),
  getSessionToken: vi.fn(),
  isAuthError: vi.fn(),
  redirectToLoginForAuthError: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/app/authRedirect", () => ({ redirectToLoginForAuthError: mocks.redirectToLoginForAuthError }));
vi.mock("@/composition/directus", () => ({
  makeAppointmentRepository: vi.fn(() => ({ getById: mocks.getById })),
}));
vi.mock("@/infrastructure/auth/authError", () => ({ isAuthError: mocks.isAuthError }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: mocks.getSessionToken }));

import { reconcileScheduledAppointmentAction } from "@/app/appointments/actions";

describe("reconcileScheduledAppointmentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionToken.mockResolvedValue("token");
    mocks.isAuthError.mockReturnValue(false);
  });

  it("checks an uncertain appointment with a read-only UUID lookup", async () => {
    const scheduledAt = localDate();
    mocks.getById.mockResolvedValue({
      id: "appointment-1", clientId: "client-1", orderId: undefined,
      scheduledAt, notes: "Fitting", status: "scheduled",
    });

    await expect(reconcileScheduledAppointmentAction(
      { status: "idle", error: null }, appointmentFormData(),
    )).resolves.toMatchObject({ status: "saved", mutationResult: "confirmed-saved" });

    expect(mocks.getById).toHaveBeenCalledWith(APPOINTMENT_KEY);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/appointments");
  });

  it("confirms absence before a retry is permitted", async () => {
    mocks.getById.mockResolvedValue(null);
    await expect(reconcileScheduledAppointmentAction(
      { status: "idle", error: null }, appointmentFormData(),
    )).resolves.toEqual({ status: "absent", mutationResult: "confirmed-not-saved", error: null });
  });

  it("reports a confirmed conflict for incompatible content", async () => {
    mocks.getById.mockResolvedValue({
      id: "appointment-1", clientId: "client-2", orderId: undefined,
      scheduledAt: localDate(), notes: "Fitting", status: "scheduled",
    });

    await expect(reconcileScheduledAppointmentAction(
      { status: "idle", error: null }, appointmentFormData(),
    )).resolves.toMatchObject({ status: "error", mutationResult: "confirmed-not-saved" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps the outcome unknown when the lookup cannot be confirmed", async () => {
    mocks.getById.mockRejectedValue(new TypeError("connection lost"));

    await expect(reconcileScheduledAppointmentAction(
      { status: "idle", error: null }, appointmentFormData(),
    )).resolves.toMatchObject({ status: "error", mutationResult: "outcome-unknown" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("delegates an expired session during reconciliation", async () => {
    const authError = { status: 401 };
    mocks.getById.mockRejectedValue(authError);
    mocks.isAuthError.mockReturnValue(true);
    mocks.redirectToLoginForAuthError.mockResolvedValue({
      status: "error", mutationResult: "outcome-unknown", error: "redirected",
    });

    await reconcileScheduledAppointmentAction(
      { status: "idle", error: null }, appointmentFormData(),
    );

    expect(mocks.redirectToLoginForAuthError).toHaveBeenCalledWith(authError, "/appointments");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

const APPOINTMENT_KEY = "550e8400-e29b-41d4-a716-446655440000";

function appointmentFormData(): FormData {
  const formData = new FormData();
  formData.set("client_id", "client-1");
  formData.set("scheduled_at", "2026-09-08T10:30");
  formData.set("notes", "Fitting");
  formData.set("appointment_id", APPOINTMENT_KEY);
  return formData;
}

function localDate(): Date {
  return new Date("2026-09-08T09:30:00.000Z");
}
