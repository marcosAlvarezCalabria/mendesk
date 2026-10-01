"use client";

import { useFormStatus } from "react-dom";

export function ReadyConfirmationSubmitButton({ disabled, label, pendingLabel }: { disabled: boolean; label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      className="min-h-11 w-full rounded-full bg-primary px-4 text-label-md font-bold text-on-primary transition-[transform,filter] duration-75 active:scale-[0.98] active:brightness-90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transform-none"
      disabled={disabled || pending}
      type="submit"
    >
      <span aria-live="polite">
        {pending ? pendingLabel : label}
      </span>
    </button>
  );
}
