import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseDateTime } from "@/app/appointments/appointmentDateTime";
import { IdempotencyConflictError } from "@/domain/errors/IdempotencyConflictError";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  deleteScheduled: vi.fn(),
  getById: vi.fn(),
  getSessionToken: vi.fn(),
  isAuthError: vi.fn(),
  redirectToLoginForAuthError: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/application/useCases/ScheduleAppointment", () => ({
  ScheduleAppointment: class {
    execute(input: unknown) { return mocks.execute(input); }
  },
}));
vi.mock("@/application/useCases/UpdateAppointmentStatus", () => ({
  UpdateAppointmentStatus: class {
    execute(input: unknown) { return mocks.execute(input); }
  },
}));
vi.mock("@/application/useCases/UpdateAppointmentDetails", () => ({
  UpdateAppointmentDetails: class {
    execute(input: unknown) { return mocks.execute(input); }
  },
}));
vi.mock("@/app/authRedirect", () => ({ redirectToLoginForAuthError: mocks.redirectToLoginForAuthError }));
vi.mock("@/composition/directus", () => ({ makeAppointmentRepository: vi.fn(() => ({ getById: mocks.getById, deleteScheduled: mocks.deleteScheduled })) }));
vi.mock("@/infrastructure/auth/authError", () => ({ isAuthError: mocks.isAuthError }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: mocks.getSessionToken }));

import { deleteAppointmentAction, scheduleAppointmentAction, setAppointmentStatusAction, updateAppointmentDetailsAction } from "@/app/appointments/actions";

describe("parseDateTime", () => {
  it("parses datetime-local values", () => {
    const parsed = parseDateTime("2026-09-01T10:30");

    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.getUTCFullYear()).toBe(2026);
    expect(parsed?.getUTCMonth()).toBe(8);
    expect(parsed?.getUTCDate()).toBe(1);
    expect(parsed?.getUTCHours()).toBe(9);
    expect(parsed?.getUTCMinutes()).toBe(30);
    expect(parsed?.toISOString()).toBe("2026-09-01T09:30:00.000Z");
  });

  it("returns null for empty values", () => {
    expect(parseDateTime("   ")).toBeNull();
  });

  it("returns null for invalid values", () => {
    expect(parseDateTime("not-a-date")).toBeNull();
  });
});

describe("appointment mutation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionToken.mockResolvedValue("token");
    mocks.isAuthError.mockReturnValue(false);
    mocks.redirectToLoginForAuthError.mockRejectedValue(new Error("NEXT_REDIRECT"));
    mocks.execute.mockResolvedValue({ id: "appointment-1" });
    mocks.getById.mockResolvedValue(null);
  });

  it("reports a confirmed save only after scheduling completes", async () => {
    const formData = new FormData();
    formData.set("client_id", "client-1");
    formData.set("scheduled_at", "2026-09-08T10:30");
    formData.set("appointment_id", APPOINTMENT_KEY);

    await expect(scheduleAppointmentAction({ status: "idle", error: null }, formData)).resolves.toMatchObject({
      status: "success",
      mutationResult: "confirmed-saved",
      error: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/appointments");
  });

  it("reports validation as confirmed not saved", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("Client is required"));

    await expect(scheduleAppointmentAction({ status: "idle", error: null }, appointmentFormData())).resolves.toMatchObject({
      status: "error",
      mutationResult: "confirmed-not-saved",
      error: "Please choose a client.",
    });
  });

  it("reports an uncertain scheduling failure without claiming it was saved", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("Directus unavailable"));

    await expect(scheduleAppointmentAction({ status: "idle", error: null }, appointmentFormData())).resolves.toMatchObject({
      status: "error",
      mutationResult: "outcome-unknown",
      error: "The appointment could not be saved.",
    });
  });

  it("includes a safe scheduling diagnostic only during local development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.execute.mockRejectedValueOnce(new Error("The mutation was confirmed as not saved.", {
      cause: { errors: [{ message: "Field is forbidden", extensions: { code: "FORBIDDEN" } }], response: { status: 403 } },
    }));

    await expect(scheduleAppointmentAction({ status: "idle", error: null }, appointmentFormData())).resolves.toMatchObject({
      diagnostic: "appointment creation: The mutation was confirmed as not saved. | cause: Field is forbidden [FORBIDDEN, 403]",
    });
  });

  it("reports which fields conflict without rotating or resubmitting", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.execute.mockRejectedValueOnce(new IdempotencyConflictError(["date/time"]));

    const state = await scheduleAppointmentAction({ status: "idle", error: null }, appointmentFormData());

    expect(state).toMatchObject({
      status: "error",
      mutationResult: "confirmed-not-saved",
      error: "This draft is linked to a different saved appointment.",
      diagnostic: "appointment comparison: Different fields: date/time",
    });
    expect(state).not.toHaveProperty("nextIdempotencyKey");
  });

  it("preserves the safe Agenda destination when auth expires during scheduling", async () => {
    const authError = { status: 401 };
    mocks.execute.mockRejectedValueOnce(authError);
    mocks.isAuthError.mockReturnValueOnce(true);

    await expect(scheduleAppointmentAction({ status: "idle", error: null }, appointmentFormData())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirectToLoginForAuthError).toHaveBeenCalledWith(authError, "/appointments");
  });

  it("reports a persisted appointment status update", async () => {
    const formData = new FormData();
    formData.set("appointment_id", "appointment-1");
    formData.set("expected_status", "scheduled");
    formData.set("status", "completed");

    await expect(setAppointmentStatusAction({ status: "idle", error: null }, formData)).resolves.toEqual({
      status: "success",
      mutationResult: "confirmed-saved",
      error: null,
    });
    expect(mocks.execute).toHaveBeenCalledWith({
      appointmentId: "appointment-1",
      expectedStatus: "scheduled",
      status: "completed",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/appointments/history");
  });

  it("updates the editable appointment fields and preserves the original values for concurrency", async () => {
    const formData = new FormData();
    formData.set("appointment_id", "appointment-1");
    formData.set("expected_scheduled_at", "2026-09-12T09:00");
    formData.set("expected_order_id", "order-1");
    formData.set("expected_notes", "Fitting");
    formData.set("scheduled_at", "2026-09-13T10:30");
    formData.set("notes", "Second fitting");

    await expect(updateAppointmentDetailsAction({ status: "idle", error: null }, formData)).resolves.toEqual({
      status: "success",
      mutationResult: "confirmed-saved",
      error: null,
      saved: { scheduledAt: "2026-09-13T10:30", orderId: "", notes: "Second fitting" },
    });
    expect(mocks.execute).toHaveBeenCalledWith({
      appointmentId: "appointment-1",
      expectedScheduledAt: new Date("2026-09-12T08:00:00.000Z"),
      expectedOrderId: "order-1",
      expectedNotes: "Fitting",
      scheduledAt: new Date("2026-09-13T09:30:00.000Z"),
      orderId: undefined,
      notes: "Second fitting",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/appointments/appointment-1");
  });

  it("reports an uncertain status update and does not revalidate", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("Connection dropped"));
    const formData = new FormData();
    formData.set("appointment_id", "appointment-1");
    formData.set("expected_status", "scheduled");
    formData.set("status", "completed");

    await expect(setAppointmentStatusAction({ status: "idle", error: null }, formData)).resolves.toEqual({
      status: "error",
      mutationResult: "outcome-unknown",
      error: "The appointment could not be saved.",
      pendingChange: {
        appointmentId: "appointment-1",
        expectedStatus: "scheduled",
        status: "completed",
      },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reconciles an uncertain status update before allowing another write", async () => {
    mocks.getById.mockResolvedValueOnce({ id: "appointment-1", status: "completed" });
    const pendingChange = {
      appointmentId: "appointment-1",
      expectedStatus: "scheduled" as const,
      status: "completed" as const,
    };

    await expect(setAppointmentStatusAction({
      status: "error",
      mutationResult: "outcome-unknown",
      error: "The appointment could not be saved.",
      pendingChange,
    }, new FormData())).resolves.toEqual({
      status: "success",
      mutationResult: "confirmed-saved",
      error: null,
    });

    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.getById).toHaveBeenCalledWith("appointment-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/appointments");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/appointments/history");
  });

  it("keeps an uncertain status update blocked when reconciliation cannot read it", async () => {
    mocks.getById.mockRejectedValueOnce(new Error("Directus unavailable"));
    const pendingChange = {
      appointmentId: "appointment-1",
      expectedStatus: "scheduled" as const,
      status: "completed" as const,
    };

    await expect(setAppointmentStatusAction({
      status: "error",
      mutationResult: "outcome-unknown",
      error: "The appointment could not be saved.",
      pendingChange,
    }, new FormData())).resolves.toEqual({
      status: "error",
      mutationResult: "outcome-unknown",
      error: "The appointment could not be saved.",
      pendingChange,
    });

    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("deletes a scheduled appointment and refreshes the agenda", async () => {
    mocks.getById.mockResolvedValueOnce({ id: "appointment-1", status: "scheduled" });

    await expect(deleteAppointmentAction(
      { status: "idle", error: null },
      appointmentIdFormData(),
    )).resolves.toEqual({ status: "success", error: null });

    expect(mocks.deleteScheduled).toHaveBeenCalledWith("appointment-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/appointments");
  });

  it("does not delete an appointment that is no longer scheduled", async () => {
    mocks.getById.mockResolvedValueOnce({ id: "appointment-1", status: "completed" });

    await expect(deleteAppointmentAction(
      { status: "idle", error: null },
      appointmentIdFormData(),
    )).resolves.toEqual({ status: "error", error: "This appointment can no longer be deleted." });

    expect(mocks.deleteScheduled).not.toHaveBeenCalled();
  });

  it("reconciles a lost delete response when the appointment is absent", async () => {
    mocks.getById.mockResolvedValueOnce({ id: "appointment-1", status: "scheduled" }).mockResolvedValueOnce(null);
    mocks.deleteScheduled.mockRejectedValueOnce(new Error("Connection dropped"));

    await expect(deleteAppointmentAction(
      { status: "idle", error: null },
      appointmentIdFormData(),
    )).resolves.toEqual({ status: "success", error: null });
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

function appointmentIdFormData(): FormData {
  const formData = new FormData();
  formData.set("appointment_id", "appointment-1");
  return formData;
}
});
