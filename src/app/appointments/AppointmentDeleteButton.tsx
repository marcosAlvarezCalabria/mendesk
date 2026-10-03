"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Icon } from "@/app/_ui/Icon";
import { deleteAppointmentAction, type DeleteAppointmentState } from "@/app/appointments/actions";

const initialState: DeleteAppointmentState = { status: "idle", error: null };

export function AppointmentDeleteButton({
  appointmentId,
  clientName,
  texts,
}: {
  appointmentId: string;
  clientName: string;
  texts: { delete: string; deleting: string; confirm: string; error: string };
}) {
  const [state, formAction] = useActionState(deleteAppointmentAction, initialState);

  return (
    <>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm(texts.confirm)) event.preventDefault();
        }}
      >
        <input name="appointment_id" type="hidden" value={appointmentId} />
        <DeleteButton clientName={clientName} label={texts.delete} pendingLabel={texts.deleting} />
      </form>
      {state.status === "error" ? (
        <p className="fixed inset-x-4 bottom-[calc(5rem+var(--mobile-navigation-safe-area))] z-50 mx-auto max-w-md rounded-xl bg-error-container px-4 py-3 text-sm font-semibold text-on-error-container shadow-[0_8px_28px_rgba(46,38,31,0.18)]" role="alert">{texts.error}</p>
      ) : null}
    </>
  );
}

function DeleteButton({ clientName, label, pendingLabel }: { clientName: string; label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button aria-label={`${pending ? pendingLabel : label}: ${clientName}`} className="flex size-11 items-center justify-center rounded-full text-error transition hover:bg-error-container focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2 disabled:cursor-wait disabled:opacity-50" disabled={pending} title={label} type="submit">
      <Icon className="size-5" name="delete" />
      <span className="sr-only" aria-live="polite">{pending ? pendingLabel : label}</span>
    </button>
  );
}
