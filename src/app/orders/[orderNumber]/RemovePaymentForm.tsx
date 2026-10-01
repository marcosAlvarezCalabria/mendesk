"use client";

import { useActionState, useContext, useState } from "react";

import { Icon } from "@/app/_ui/Icon";
import { removePaymentAction, type RemovePaymentErrorCode, type RemovePaymentState } from "@/app/orders/[orderNumber]/remove-payment-actions";
import { OrderSyncContext } from "@/app/sync/OrderSyncProvider";
import { useMutationSync } from "@/app/sync/useMutationSync";

const initialState: RemovePaymentState = { status: "idle", error: null };

export type RemovePaymentTexts = {
  remove: string;
  cancel: string;
  confirmation: string;
  confirm: string;
  removing: string;
  checkSaved: string;
  checkingSaved: string;
  success: string;
  errors: Record<RemovePaymentErrorCode, string>;
};

export function RemovePaymentForm({ orderNumber, paymentId, paymentType, amount, texts }: {
  orderNumber: string;
  paymentId: string;
  paymentType: string;
  amount: string;
  texts: RemovePaymentTexts;
}) {
  const session = useContext(OrderSyncContext);
  const [state, formAction, isPending] = useActionState(async (prev: RemovePaymentState, data: FormData) => {
    const result = await removePaymentAction(prev, data);
    if (result.sync) session?.consume(result.sync);
    return result;
  }, initialState);
  const sync = useMutationSync(state.sync);
  const [confirming, setConfirming] = useState(false);
  const outcomeUnknown = state.status === "error" && state.mutationResult === "outcome-unknown";
  const submissionBlocked = isPending || sync.phase === "refreshing" || sync.phase === "error";
  const confirmation = texts.confirmation.replace("{type}", paymentType).replaceAll("{amount}", amount);

  return (
    <form action={formAction} className={confirming ? "mt-2" : "absolute right-1 top-1"}>
      <input name="order_number" type="hidden" value={orderNumber} />
      <input name="payment_id" type="hidden" value={paymentId} />

      {confirming ? (
        <div className="grid gap-3 rounded-lg bg-status-cancelled/10 p-3">
          <p className="break-words text-body-sm text-status-cancelled">{confirmation}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="min-h-11 rounded-full px-4 text-label-md text-on-surface transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:opacity-60" disabled={submissionBlocked || outcomeUnknown} onClick={() => setConfirming(false)} type="button">
              {texts.cancel}
            </button>
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-status-cancelled px-4 text-label-md text-white transition hover:bg-status-cancelled/90 focus:outline-none focus:ring-2 focus:ring-status-cancelled focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={submissionBlocked} type="submit">
              <Icon className="size-4" name={outcomeUnknown ? "refresh" : "delete"} />
              <span aria-live="polite">{outcomeUnknown ? (isPending ? texts.checkingSaved : texts.checkSaved) : isPending ? texts.removing : texts.confirm}</span>
            </button>
          </div>
          {state.status === "success" && sync.phase === "ready" ? <p className="text-body-sm font-bold text-status-ready" role="status" aria-live="polite">{texts.success}</p> : null}
          {state.status === "error" && state.error && !outcomeUnknown ? <p className="text-body-sm text-status-cancelled" role="alert" aria-live="assertive">{texts.errors[state.error]}</p> : null}
        </div>
      ) : (
        <button aria-label={texts.remove} className="flex size-11 items-center justify-center rounded-full text-status-cancelled transition hover:bg-status-cancelled/10 focus:outline-none focus:ring-2 focus:ring-status-cancelled focus:ring-offset-2" onClick={() => setConfirming(true)} title={texts.remove} type="button">
          <Icon className="size-4" name="delete" />
        </button>
      )}
    </form>
  );
}
