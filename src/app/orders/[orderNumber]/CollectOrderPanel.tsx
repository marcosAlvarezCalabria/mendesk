"use client";

import { useActionState, useContext, useEffect, useRef, useState } from "react";

import { ActionButton } from "@/app/_ui/ActionButton";
import { cx } from "@/app/_ui/classNames";
import { Icon } from "@/app/_ui/Icon";
import { mobileDialogPanelClassName, mobileOverlayClassName } from "@/app/_ui/mobileOverlay";
import { OverlayPortal } from "@/app/_ui/OverlayPortal";
import { useSessionIdempotencyKey } from "@/app/_ui/sessionIdempotency";
import { useModalFocus } from "@/app/_ui/useModalFocus";
import { collectOrderAction, type CollectError, type CollectState } from "@/app/orders/[orderNumber]/collect-actions";
import { OrderSyncContext } from "@/app/sync/OrderSyncProvider";
import { useMutationSync } from "@/app/sync/useMutationSync";
import type { PaymentMethod } from "@/domain/values/PaymentMethod";

const initialState: CollectState = { status: "idle", error: null };

export type CollectOrderTexts = {
  collect: string; title: string; amount: string; method: string; cash: string; card: string;
  payAndCollect: string; confirmCollect: string; collecting: string; close: string;
  partial: string; success: string; errors: Record<CollectError, string>;
};

export function CollectOrderPanel({ orderNumber, expectedDateUpdated, outstandingAmount, formattedOutstanding, initialIdempotencyKey, texts }: {
  orderNumber: string; expectedDateUpdated: string; outstandingAmount: string; formattedOutstanding: string;
  initialIdempotencyKey: string; texts: CollectOrderTexts;
}) {
  const session = useContext(OrderSyncContext);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [state, action, pending] = useActionState(async (prev: CollectState, data: FormData) => {
    const result = await collectOrderAction(prev, data);
    if (result.sync) session?.consume(result.sync);
    return result;
  }, initialState);
  const sync = useMutationSync(state.sync);
  const { idempotencyKey, ready } = useSessionIdempotencyKey(`koko:idempotency:collect:${orderNumber}`, initialIdempotencyKey);
  const hasOutstanding = collectRequiresPayment(outstandingAmount);
  const blocked = pending || !ready || sync.phase === "refreshing" || sync.phase === "error";
  useModalFocus(open, panelRef, triggerRef);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !blocked) setOpen(false); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [blocked, open]);

  return (
    <>
      <button ref={triggerRef} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-[0.75rem] font-bold text-on-primary transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2" onClick={() => setOpen(true)} type="button">
        <Icon className="size-4" name="inventory_2" /> {texts.collect}
      </button>
      {open ? (
        <OverlayPortal><div className={mobileOverlayClassName} role="presentation">
          <button aria-label={texts.close} className="absolute inset-0 cursor-default" disabled={blocked} onClick={() => setOpen(false)} tabIndex={-1} type="button" />
          <section ref={panelRef} aria-labelledby={`collect-order-title-${orderNumber}`} aria-modal="true" className={`${mobileDialogPanelClassName} w-full`} role="dialog" tabIndex={-1}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0"><h2 id={`collect-order-title-${orderNumber}`} className="text-title-md font-extrabold">{texts.title}</h2>{hasOutstanding ? <p className="mt-0.5 text-body-sm text-on-surface-variant">{texts.amount}: <strong>{formattedOutstanding}</strong></p> : null}</div>
              <button aria-label={texts.close} className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary" disabled={blocked} onClick={() => setOpen(false)} type="button"><Icon className="size-5" name="cancel" /></button>
            </div>
            <form action={action} className="grid gap-4">
              <input name="order_number" type="hidden" value={orderNumber} />
              <input name="expected_date_updated" type="hidden" value={expectedDateUpdated} />
              <input name="idempotency_key" type="hidden" value={idempotencyKey} />
              <input name="amount" type="hidden" value={outstandingAmount} />
              {hasOutstanding ? <fieldset className="grid gap-2" disabled={blocked}><legend className="text-label-sm text-on-surface-variant">{texts.method}</legend><div className="grid grid-cols-2 gap-2"><Choice checked={method === "cash"} label={texts.cash} onChange={() => setMethod("cash")} value="cash" /><Choice checked={method === "card"} label={texts.card} onChange={() => setMethod("card")} value="card" /></div></fieldset> : <input name="payment_method" type="hidden" value="cash" />}
              <ActionButton className="min-h-12" disabled={blocked} icon="check_circle" type="submit" variant="primary">{pending ? texts.collecting : hasOutstanding ? texts.payAndCollect.replace("{amount}", formattedOutstanding) : texts.confirmCollect}</ActionButton>
              {state.status === "partial" ? <p className="rounded-lg bg-secondary-container px-3 py-2 text-body-sm text-on-secondary-container" role="alert">{texts.partial}</p> : null}
              {state.status === "error" ? <p className="rounded-lg bg-status-cancelled/10 px-3 py-2 text-body-sm text-status-cancelled" role="alert">{texts.errors[state.error]}</p> : null}
              {state.status === "success" && sync.phase === "ready" ? <p className="rounded-lg bg-status-ready/10 px-3 py-2 text-body-sm text-status-ready" role="status">{texts.success}</p> : null}
            </form>
          </section>
        </div></OverlayPortal>
      ) : null}
    </>
  );
}

export function collectRequiresPayment(outstandingAmount: string): boolean {
  return Number(outstandingAmount) > 0;
}

function Choice({ value, label, checked, onChange }: { value: PaymentMethod; label: string; checked: boolean; onChange: () => void }) {
  return <label className="min-w-0 cursor-pointer"><input checked={checked} className="peer sr-only" name="payment_method" onChange={onChange} required type="radio" value={value} /><span className={cx("flex min-h-12 items-center justify-center rounded-lg border border-outline-variant px-3 text-label-md transition", "peer-checked:border-primary peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:ring-2 peer-focus-visible:ring-secondary peer-disabled:opacity-60")}>{label}</span></label>;
}
