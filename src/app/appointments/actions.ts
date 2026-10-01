"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CreationReconciliationState } from "@/app/_ui/CreationReconciliation";
import { redirectToLoginForAuthError } from "@/app/authRedirect";

import { parseDateTime } from "@/app/appointments/appointmentDateTime";

import { classifyMutationError, type MutationResult } from "@/application/mutations/MutationResult";
import { isAuthError } from "@/infrastructure/auth/authError";
import { ScheduleAppointment } from "@/application/useCases/ScheduleAppointment";
import { UpdateAppointmentStatus } from "@/application/useCases/UpdateAppointmentStatus";
import { DeleteScheduledAppointment } from "@/application/useCases/DeleteScheduledAppointment";
import { UpdateAppointmentDetails } from "@/application/useCases/UpdateAppointmentDetails";
import { makeAppointmentRepository } from "@/composition/directus";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { IdempotencyConflictError } from "@/domain/errors/IdempotencyConflictError";
import type { AppointmentStatus } from "@/domain/values/AppointmentStatus";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";

type PendingAppointmentStatusChange = {
  appointmentId: string;
  expectedStatus: AppointmentStatus;
  status: AppointmentStatus;
};

export type ScheduleState =
  | { status: "idle"; error: null; mutationResult?: undefined; diagnostic?: undefined }
  | { status: "success"; error: null; mutationResult: "confirmed-saved"; nextIdempotencyKey?: string; diagnostic?: undefined }
  | {
      status: "error";
      error: string;
      mutationResult: Exclude<MutationResult<never>["type"], "confirmed-saved" | "auth-expired">;
      appointmentId?: string;
      pendingChange?: PendingAppointmentStatusChange;
      diagnostic?: string;
      nextIdempotencyKey?: string;
    };

export type DeleteAppointmentState =
  | { status: "idle"; error: null }
  | { status: "success"; error: null }
  | { status: "error"; error: string };

export type EditAppointmentState =
  | { status: "idle"; error: null; mutationResult?: undefined }
  | { status: "success"; error: null; mutationResult: "confirmed-saved"; saved: { scheduledAt: string; orderId: string; notes: string } }
  | { status: "error"; error: string; mutationResult: Exclude<MutationResult<never>["type"], "confirmed-saved" | "auth-expired"> };

export async function updateAppointmentDetailsAction(
  _prev: EditAppointmentState,
  formData: FormData,
): Promise<EditAppointmentState> {
  const token = await getSessionToken();
  const appointmentId = String(formData.get("appointment_id") ?? "").trim();
  const scheduledAtValue = String(formData.get("scheduled_at") ?? "").trim();
  const expectedScheduledAtValue = String(formData.get("expected_scheduled_at") ?? "").trim();
  const orderId = String(formData.get("order_id") ?? "").trim();
  const expectedOrderId = String(formData.get("expected_order_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const expectedNotes = String(formData.get("expected_notes") ?? "").trim();
  const currentPath = `/appointments/${encodeURIComponent(appointmentId)}`;
  if (!token) redirect(`/login?${new URLSearchParams({ next: currentPath })}`);

  try {
    await new UpdateAppointmentDetails(makeAppointmentRepository(token)).execute({
      appointmentId,
      expectedScheduledAt: parseDateTime(expectedScheduledAtValue),
      expectedOrderId: expectedOrderId || undefined,
      expectedNotes: expectedNotes || undefined,
      scheduledAt: parseDateTime(scheduledAtValue),
      orderId: orderId || undefined,
      notes: notes || undefined,
    });
  } catch (error) {
    if (isAuthError(error)) return redirectToLoginForAuthError(error, currentPath);
    const mutationResult = isAppointmentValidationError(error) ? "confirmed-not-saved" : classifyNonAuthMutation(error);
    return { status: "error", mutationResult, error: appointmentErrorMessage(error) };
  }

  revalidatePath("/appointments");
  revalidatePath(currentPath);
  return { status: "success", mutationResult: "confirmed-saved", error: null, saved: { scheduledAt: scheduledAtValue, orderId, notes } };
}

export async function scheduleAppointmentAction(_prev: ScheduleState, formData: FormData): Promise<ScheduleState> {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  const clientId = String(formData.get("client_id") ?? "").trim();
  const orderId = String(formData.get("order_id") ?? "").trim() || undefined;
  const scheduledAt = parseDateTime(String(formData.get("scheduled_at") ?? ""));
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  let appointmentId: string;
  try {
    appointmentId = IdempotencyKey.fromString(String(formData.get("appointment_id") ?? "")).value;
  } catch {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "The appointment could not be saved." };
  }

  try {
    await new ScheduleAppointment(makeAppointmentRepository(token)).execute({ appointmentId, clientId, orderId, scheduledAt, notes });
  } catch (error) {
    if (isAuthError(error)) {
      return redirectToLoginForAuthError(error, "/appointments");
    }

    if (error instanceof IdempotencyConflictError) {
      return {
        status: "error",
        mutationResult: "confirmed-not-saved",
        error: "This draft is linked to a different saved appointment.",
        appointmentId,
        ...developmentDiagnostic("appointment comparison", error.mismatchedFields.length > 0 ? `Different fields: ${error.mismatchedFields.join(", ")}${error.mismatchDetails.length > 0 ? ` | ${error.mismatchDetails.join(" | ")}` : ""}` : "Different content"),
      };
    }

    return {
      status: "error",
      mutationResult: isAppointmentValidationError(error) ? "confirmed-not-saved" : classifyNonAuthMutation(error),
      error: appointmentErrorMessage(error),
      appointmentId,
      ...developmentDiagnostic("appointment creation", safeErrorMessage(error)),
    };
  }

  revalidatePath("/appointments");
  return { status: "success", mutationResult: "confirmed-saved", error: null, nextIdempotencyKey: crypto.randomUUID() };
}

export async function reconcileScheduledAppointmentAction(
  _prev: CreationReconciliationState,
  formData: FormData,
): Promise<CreationReconciliationState> {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const clientId = String(formData.get("client_id") ?? "").trim();
  const orderId = String(formData.get("order_id") ?? "").trim() || undefined;
  const scheduledAt = parseDateTime(String(formData.get("scheduled_at") ?? ""));
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  let appointmentId: string;
  try {
    appointmentId = IdempotencyKey.fromString(String(formData.get("appointment_id") ?? "")).value;
  } catch {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "The saved result could not be checked." };
  }

  try {
    const appointment = await makeAppointmentRepository(token).getById(appointmentId);
    if (!appointment) return { status: "absent", mutationResult: "confirmed-not-saved", error: null };
    const compatible = Boolean(scheduledAt) &&
      appointment.clientId === clientId &&
      appointment.orderId === orderId &&
      appointment.scheduledAt.getTime() === scheduledAt?.getTime() &&
      appointment.notes === notes;
    if (!compatible) {
      return { status: "error", mutationResult: "confirmed-not-saved", error: "This UUID was saved with different appointment details." };
    }
    revalidatePath("/appointments");
    return { status: "saved", mutationResult: "confirmed-saved", error: null, nextIdempotencyKey: crypto.randomUUID() };
  } catch (error) {
    if (isAuthError(error)) return redirectToLoginForAuthError(error, "/appointments");
    return { status: "error", mutationResult: "outcome-unknown", error: "The saved result could not be checked." };
  }
}

export async function setAppointmentStatusAction(prev: ScheduleState, formData: FormData): Promise<ScheduleState> {
  const token = await getSessionToken();

  if (!token) {
    redirect("/login");
  }

  if (prev.status === "error" && prev.mutationResult === "outcome-unknown" && prev.pendingChange) {
    return reconcileAppointmentStatusChange(token, prev.pendingChange);
  }

  const appointmentId = String(formData.get("appointment_id") ?? "").trim();
  const expectedStatus = String(formData.get("expected_status") ?? "").trim() as AppointmentStatus;
  const status = String(formData.get("status") ?? "").trim();

  if (!appointmentId) {
    return { status: "error", mutationResult: "confirmed-not-saved", error: "Appointment is required." };
  }

  try {
    await new UpdateAppointmentStatus(makeAppointmentRepository(token)).execute({
      appointmentId,
      expectedStatus,
      status,
    });
  } catch (error) {
    if (isAuthError(error)) {
      return redirectToLoginForAuthError(error, "/appointments");
    }

    const mutationResult = isAppointmentValidationError(error)
      ? "confirmed-not-saved"
      : classifyNonAuthMutation(error);
    return {
      status: "error",
      mutationResult,
      error: appointmentErrorMessage(error),
      ...(mutationResult === "outcome-unknown"
        ? { pendingChange: { appointmentId, expectedStatus, status: status as AppointmentStatus } }
        : {}),
    };
  }

  revalidatePath("/appointments");
  revalidatePath("/appointments/history");
  revalidatePath(`/appointments/${appointmentId}`);
  return { status: "success", mutationResult: "confirmed-saved", error: null };
}

export async function deleteAppointmentAction(
  _prev: DeleteAppointmentState,
  formData: FormData,
): Promise<DeleteAppointmentState> {
  const token = await getSessionToken();
  if (!token) redirect("/login?next=/appointments");

  const appointmentId = String(formData.get("appointment_id") ?? "").trim();
  const repository = makeAppointmentRepository(token);

  try {
    await new DeleteScheduledAppointment(repository).execute(appointmentId);
  } catch (error) {
    if (isAuthError(error)) return redirectToLoginForAuthError(error, "/appointments");
    if (error instanceof Error && error.message === "Appointment is required") {
      return { status: "error", error: "Appointment is required." };
    }
    if (error instanceof Error && error.message === "Only scheduled appointments can be deleted") {
      return { status: "error", error: "This appointment can no longer be deleted." };
    }

    try {
      const appointment = appointmentId ? await repository.getById(appointmentId) : null;
      if (!appointment && appointmentId) {
        revalidatePath("/appointments");
        return { status: "success", error: null };
      }
      if (appointment?.status !== "scheduled") {
        return { status: "error", error: "This appointment can no longer be deleted." };
      }
    } catch (reconciliationError) {
      if (isAuthError(reconciliationError)) return redirectToLoginForAuthError(reconciliationError, "/appointments");
    }

    return { status: "error", error: appointmentId ? "The appointment could not be deleted. Try again." : "Appointment is required." };
  }

  revalidatePath("/appointments");
  return { status: "success", error: null };
}

async function reconcileAppointmentStatusChange(
  token: string,
  pending: PendingAppointmentStatusChange,
): Promise<ScheduleState> {
  try {
    const appointment = await makeAppointmentRepository(token).getById(pending.appointmentId);
    if (appointment?.status === pending.status) {
      revalidatePath("/appointments");
      revalidatePath("/appointments/history");
      revalidatePath(`/appointments/${pending.appointmentId}`);
      return { status: "success", mutationResult: "confirmed-saved", error: null };
    }

    return {
      status: "error",
      mutationResult: "confirmed-not-saved",
      error: "The appointment could not be saved.",
    };
  } catch (error) {
    if (isAuthError(error)) {
      return redirectToLoginForAuthError(error, "/appointments");
    }

    return {
      status: "error",
      mutationResult: "outcome-unknown",
      error: "The appointment could not be saved.",
      pendingChange: pending,
    };
  }
}

function classifyNonAuthMutation(error: unknown): Exclude<MutationResult<never>["type"], "confirmed-saved" | "auth-expired"> {
  const classified = classifyMutationError(error, isAuthError);

  return classified.type === "auth-expired"
    ? "outcome-unknown"
    : classified.type;
}

function appointmentErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AppointmentConflictError") {
      return "The appointment changed elsewhere. Refresh it before editing.";
    }

    if (error.message === "Client is required") {
      return "Please choose a client.";
    }

    if (error.message === "A date and time is required") {
      return "Please choose a date and time.";


    }

    if (error.message === "Invalid appointment status") {
      return "Please choose a valid appointment status.";
    }
  }

  return "The appointment could not be saved.";
}
function isAppointmentValidationError(error: unknown): boolean {
  return error instanceof Error && [
    "Client is required",
    "A date and time is required",
    "Invalid appointment status",
    "Appointment id is required",
  ].includes(error.message);
}

function developmentDiagnostic(operation: string, reason: string): { diagnostic?: string } {
  return process.env.NODE_ENV === "development" ? { diagnostic: `${operation}: ${reason}` } : {};
}

function safeErrorMessage(error: unknown, depth = 0): string {
  if (typeof error !== "object" || error === null) return "Unknown failure";
  const candidate = error as { cause?: unknown; errors?: Array<{ message?: unknown; extensions?: { code?: unknown } }>; message?: unknown; response?: { status?: unknown }; status?: unknown };
  const first = candidate.errors?.[0];
  const message = typeof candidate.message === "string" ? candidate.message : typeof first?.message === "string" ? first.message : "Request failed";
  const code = typeof first?.extensions?.code === "string" ? first.extensions.code : undefined;
  const status = typeof candidate.response?.status === "number" ? candidate.response.status : typeof candidate.status === "number" ? candidate.status : undefined;
  const annotations = [code, status].filter(value => value !== undefined).join(", ");
  const current = annotations ? `${message} [${annotations}]` : message;
  return candidate.cause !== undefined && depth < 3 ? `${current} | cause: ${safeErrorMessage(candidate.cause, depth + 1)}` : current;
}
