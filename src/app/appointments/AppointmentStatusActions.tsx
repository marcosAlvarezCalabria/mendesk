"use client";

import { useActionState } from "react";

import { PendingAppointmentButton } from "@/app/appointments/PendingAppointmentButton";
import { setAppointmentStatusAction, type ScheduleState } from "@/app/appointments/actions";
import type { AppointmentStatus } from "@/domain/values/AppointmentStatus";

const initialState: ScheduleState = { status: "idle", error: null };

type StatusTarget = AppointmentStatus;

export function AppointmentStatusActions({
  appointmentId,
  currentStatus,
  texts,
}: {
  appointmentId: string;
  currentStatus: Extract<AppointmentStatus, "scheduled" | "completed">;
  texts: {
    markCompleted: string;
    markingCompleted: string;
    cancel: string;
    cancelling: string;
    confirmCancel: string;
    undoCompleted: string;
    undoingCompleted: string;
    checkSaved: string;
    checkingSaved: string;
    confirmedSaved: string;
    error: string;
  };
}) {
  const [state, formAction, isPending] = useActionState(setAppointmentStatusAction, initialState);
  const unknownTarget = state.status === "error" && state.mutationResult === "outcome-unknown"
    ? state.pendingChange?.status
    : undefined;
  const actions = currentStatus === "completed"
    ? [{ status: "scheduled" as const, label: texts.undoCompleted, pendingLabel: texts.undoingCompleted }]
    : [
        { status: "completed" as const, label: texts.markCompleted, pendingLabel: texts.markingCompleted },
        { status: "cancelled" as const, label: texts.cancel, pendingLabel: texts.cancelling },
      ];

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        {actions.map(item => (
          <StatusForm
            appointmentId={appointmentId}
            confirmationMessage={item.status === "cancelled" ? texts.confirmCancel : undefined}
            disabled={isPending || Boolean(unknownTarget && unknownTarget !== item.status)}
            expectedStatus={currentStatus}
            key={item.status}
            label={unknownTarget === item.status ? texts.checkSaved : item.label}
            pendingLabel={unknownTarget === item.status ? texts.checkingSaved : item.pendingLabel}
            action={formAction}
            status={item.status}
          />
        ))}
      </div>

      {state.status === "success" ? (
        <p className="text-sm font-medium text-on-secondary-container" role="status" aria-live="polite">{texts.confirmedSaved}</p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-sm font-medium text-on-error-container" role="alert" aria-live="assertive">{texts.error}</p>
      ) : null}
    </div>
  );
}

function StatusForm({
  action,
  appointmentId,
  confirmationMessage,
  disabled,
  expectedStatus,
  label,
  pendingLabel,
  status,
}: {
  action: (payload: FormData) => void;
  appointmentId: string;
  confirmationMessage?: string;
  disabled: boolean;
  expectedStatus: Extract<AppointmentStatus, "scheduled" | "completed">;
  label: string;
  pendingLabel: string;
  status: StatusTarget;
}) {
  return (
    <form
      action={action}
      onSubmit={confirmationMessage ? (event) => {
        if (!confirmAppointmentStatusChange(status, confirmationMessage, window.confirm.bind(window))) event.preventDefault();
      } : undefined}
    >
      <input name="appointment_id" type="hidden" value={appointmentId} />
      <input name="expected_status" type="hidden" value={expectedStatus} />
      <input name="status" type="hidden" value={status} />
      <PendingAppointmentButton disabled={disabled} label={label} pendingLabel={pendingLabel} />
    </form>
  );
}

export function confirmAppointmentStatusChange(
  status: AppointmentStatus,
  message: string,
  confirm: (message: string) => boolean,
): boolean {
  return status !== "cancelled" || confirm(message);
}
