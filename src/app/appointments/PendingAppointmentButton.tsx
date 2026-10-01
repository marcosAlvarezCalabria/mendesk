"use client";

import { useFormStatus } from "react-dom";

export function PendingAppointmentButton({ disabled = false, label, pendingLabel }: { disabled?: boolean; label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-on-surface-variant sm:w-auto sm:min-w-40"
      disabled={disabled || pending}
      type="submit"
    >
      <span aria-live="polite">{pending ? pendingLabel : label}</span>
    </button>
  );
}
