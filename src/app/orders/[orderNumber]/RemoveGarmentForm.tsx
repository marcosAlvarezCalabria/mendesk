"use client";

import { useActionState, useContext, useState } from "react";
import { OrderSyncContext } from "@/app/sync/OrderSyncProvider";
import { useMutationSync } from "@/app/sync/useMutationSync";

import { Icon } from "@/app/_ui/Icon";
import {
  removeGarmentAction,
  type RemoveGarmentErrorCode,
  type RemoveGarmentState,
} from "@/app/orders/[orderNumber]/remove-actions";

const initialState: RemoveGarmentState = { status: "idle", error: null };

export type RemoveGarmentTexts = {
  remove: string;
  cancel: string;
  confirmation: string;
  confirm: string;
  removing: string;
  checkSaved: string;
  checkingSaved: string;
  success: string;
  lastGarmentHint: string;
  errors: Record<RemoveGarmentErrorCode, string>;
};

export function RemoveGarmentForm({
  orderNumber,
  garmentId,
  expectedDateUpdated,
  description,
  canRemove,
  texts,
}: {
  orderNumber: string;
  garmentId: string;
  expectedDateUpdated: string;
  description: string;
  canRemove: boolean;
  texts: RemoveGarmentTexts;
}) {
  const session = useContext(OrderSyncContext);
  const [state, formAction, isPending] = useActionState(async (prev: RemoveGarmentState, data: FormData) => {
    const result = await removeGarmentAction(prev, data);
    if (result.sync) session?.consume(result.sync);
    return result;
  }, initialState);
  const sync = useMutationSync(state.sync);
  const [confirming, setConfirming] = useState(false);
  const showConfirmation = confirming && state.status !== "success";
  const outcomeUnknown = state.status === "error" && state.mutationResult === "outcome-unknown";
  const submissionBlocked = isPending || sync.phase === "refreshing" || sync.phase === "error";

  if (!canRemove) {
    const hintId = `remove-${garmentId}-hint`;
    return (
      <div className="min-w-0 flex-1">
        <button
          aria-describedby={hintId}
          aria-expanded={confirming}
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg px-2.5 text-[0.75rem] font-bold text-status-cancelled transition hover:bg-status-cancelled/10 focus:outline-none focus:ring-2 focus:ring-status-cancelled focus:ring-offset-2 focus:ring-offset-background"
          onClick={() => setConfirming((value) => !value)}
          type="button"
        >
          <Icon className="size-4" name="delete" />
          <span>{texts.remove}</span>
        </button>
        <p className={confirming ? "mt-1 rounded-lg bg-surface-container-low px-2 py-1.5 text-[0.6875rem] leading-4 text-on-surface-variant" : "sr-only"} id={hintId}>
          {texts.lastGarmentHint}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className={confirming ? "basis-full" : "min-w-0 flex-1"}>
      <input name="order_number" type="hidden" value={orderNumber} />
      <input name="garment_id" type="hidden" value={garmentId} />
      <input name="expected_date_updated" type="hidden" value={expectedDateUpdated} />

      {showConfirmation ? (
        <div className="grid gap-3 rounded-lg bg-status-cancelled/10 p-3">
          <p className="break-words text-body-sm text-status-cancelled">
            {texts.confirmation.replace("{description}", description)}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="min-h-11 rounded-full px-4 text-label-md text-on-surface transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submissionBlocked}
              onClick={() => setConfirming(false)}
              type="button"
            >
              {texts.cancel}
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-status-cancelled px-4 text-label-md text-white transition hover:bg-status-cancelled/90 focus:outline-none focus:ring-2 focus:ring-status-cancelled focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submissionBlocked}
              type="submit"
            >
              <Icon name="delete" />
              <span aria-live="polite">{outcomeUnknown ? (isPending ? texts.checkingSaved : texts.checkSaved) : isPending ? texts.removing : texts.confirm}</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg px-2.5 text-[0.75rem] font-bold text-status-cancelled transition hover:bg-status-cancelled/10 focus:outline-none focus:ring-2 focus:ring-status-cancelled focus:ring-offset-2 focus:ring-offset-background"
          onClick={() => setConfirming(true)}
          type="button"
        >
          <Icon className="size-4" name="delete" />
          <span>{texts.remove}</span>
        </button>
      )}

      {state.status === "success" && sync.phase === "ready" ? (
        <p className="mt-3 rounded-lg border border-status-ready/30 bg-status-ready/10 px-4 py-3 text-body-sm text-status-ready" role="status" aria-live="polite">
          {texts.success}
        </p>
      ) : null}
      {state.status === "error" && state.error ? (
        <p className="mt-3 rounded-lg border border-status-cancelled/30 bg-status-cancelled/10 px-4 py-3 text-body-sm text-status-cancelled" role="alert" aria-live="assertive">
          {texts.errors[state.error]}
        </p>
      ) : null}
    </form>
  );
}
