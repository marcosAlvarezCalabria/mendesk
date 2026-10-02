"use client";

import { useActionState, useContext, useEffect, useRef, useState } from "react";

import { initialCreationReconciliationState } from "@/app/_ui/CreationReconciliation";
import { ActionButton } from "@/app/_ui/ActionButton";
import { Card } from "@/app/_ui/Card";
import { cx } from "@/app/_ui/classNames";
import { Icon } from "@/app/_ui/Icon";
import { useModalFocus } from "@/app/_ui/useModalFocus";
import { mobileDialogPanelClassName, mobileOverlayClassName } from "@/app/_ui/mobileOverlay";
import { OverlayPortal } from "@/app/_ui/OverlayPortal";
import { useSessionIdempotencyKey } from "@/app/_ui/sessionIdempotency";
import { paymentAmountIssue } from "@/app/orders/[orderNumber]/paymentFormView";
import { reconcileRecordedPaymentAction, recordPaymentAction, type PaymentErrorCode, type PaymentState } from "@/app/orders/[orderNumber]/payment-actions";
import { OrderSyncContext } from "@/app/sync/OrderSyncProvider";
import { useMutationSync } from "@/app/sync/useMutationSync";
import { idempotencyKeys } from "@/config/technicalKeys";
import { Money } from "@/domain/values/Money";
import type { PaymentMethod } from "@/domain/values/PaymentMethod";
import type { PaymentType } from "@/domain/values/PaymentType";

const initialState: PaymentState = { status: "idle", error: null };

export type RecordPaymentTexts = {
  ariaLabel: string;
  type: string;
  deposit: string;
  final: string;
  amount: string;
  amountHint: string;
  method: string;
  cash: string;
  card: string;
  addDeposit: string;
  finalPayment: string;
  close: string;
  confirm: string;
  confirming: string;
  success: string;
  amountRequired: string;
  amountTooHigh: string;
  checkSaved: string;
  checkingSaved: string;
  confirmedAbsent: string;
  confirmedSaved: string;
  errors: Record<PaymentErrorCode, string>;
};

export function RecordPaymentForm({
  editable = true,
  orderId,
  orderNumber,
  defaultAmount,
  outstandingAmount,
  defaultType,
  idempotencyKey: initialIdempotencyKey,
  texts,
}: {
  editable?: boolean;
  orderId: string;
  orderNumber: string;
  defaultAmount: string;
  outstandingAmount: string;
  defaultType: PaymentType;
  idempotencyKey: string;
  texts: RecordPaymentTexts;
}) {
  const session = useContext(OrderSyncContext);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(defaultAmount);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState(async (prev: PaymentState, data: FormData) => {
    const result = await recordPaymentAction(prev, data);
    if (result.sync) session?.consume(result.sync);
    if (result.status === "success") {
      setOpen(false);
      setAmount(defaultAmount);
      setMethod("cash");
    }
    return result;
  }, initialState);
  const [reconciliation, reconcileAction, isReconciling] = useActionState<Awaited<ReturnType<typeof reconcileRecordedPaymentAction>>, FormData>(async (prev, data) => {
    const result = await reconcileRecordedPaymentAction(prev, data);
    if (result.sync) session?.consume(result.sync);
    if (result.status === "saved") {
      setOpen(false);
      setAmount(defaultAmount);
      setMethod("cash");
    }
    return result;
  }, initialCreationReconciliationState);
  const sync = useMutationSync(reconciliation.sync ?? state.sync);

  const confirmedNextKey = state.status === "success"
    ? state.nextIdempotencyKey
    : reconciliation.status === "saved" ? reconciliation.nextIdempotencyKey : undefined;
  const { idempotencyKey, ready: idempotencyReady } = useSessionIdempotencyKey(
    idempotencyKeys.payment(orderNumber),
    initialIdempotencyKey,
    confirmedNextKey,
  );
  const outstanding = Money.fromEuros(Number(outstandingAmount));
  const amountIssue = paymentAmountIssue(amount, outstanding);
  const amountValid = amountIssue === null;
  const outcomeUnknown = state.status === "error" && state.mutationResult === "outcome-unknown";
  const retryConfirmedSafe = reconciliation.status === "absent";
  const submissionBlocked = !editable || !amountValid || sync.phase === "refreshing" || sync.phase === "error" || !idempotencyReady || isPending || isReconciling || (outcomeUnknown && !retryConfirmedSafe);
  const closeBlocked = isPending || isReconciling || (outcomeUnknown && !retryConfirmedSafe);
  const panelTitle = defaultType === "deposit" ? texts.addDeposit : texts.finalPayment;
  useModalFocus(open, panelRef, triggerRef);

  useEffect(() => {
    if (!open) return;

    amountRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeBlocked) setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeBlocked, open]);

  if (!editable && !open) return null;

  return (
    <>
      <Card as="div" className="p-2 sm:p-2">
        <button
          ref={triggerRef}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-[0.75rem] font-bold text-on-surface outline-none transition hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!editable}
          onClick={() => setOpen(true)}
          type="button"
        >
          <span>{panelTitle}</span>
          <span aria-hidden="true" className="flex size-8 items-center justify-center text-secondary"><Icon className="size-5" name="add_circle" /></span>
        </button>
        {state.status === "success" && sync.phase === "ready" ? (
          <p className="px-2 pb-2 text-body-sm font-bold text-status-ready" role="status" aria-live="polite">{texts.success}</p>
        ) : null}
      </Card>

      {open ? (
        <OverlayPortal><div className={mobileOverlayClassName} role="presentation">
          <button aria-label={texts.close} className="absolute inset-0 cursor-default" disabled={closeBlocked} onClick={() => setOpen(false)} tabIndex={-1} type="button" />
          <section
            ref={panelRef}
            aria-label={texts.ariaLabel}
            aria-modal="true"
            className={`${mobileDialogPanelClassName} w-full`}
            role="dialog"
            tabIndex={-1}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-title-md font-extrabold text-on-surface">{panelTitle}</h3>
                <p className="mt-0.5 text-body-sm text-on-surface-variant">{texts.amountHint}</p>
              </div>
              <button aria-label={texts.close} className="flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-50" disabled={closeBlocked} onClick={() => setOpen(false)} type="button">
                <Icon className="size-5" name="cancel" />
              </button>
            </div>

            <form action={formAction} className="grid gap-4">
              <input name="order_id" type="hidden" value={orderId} />
              <input name="order_number" type="hidden" value={orderNumber} />
              <input name="idempotency_key" type="hidden" value={idempotencyKey} />
              <input name="payment_type" type="hidden" value={defaultType} />

              <label className="grid gap-2 text-label-sm text-on-surface-variant" htmlFor="payment-amount">
                <span>{texts.amount}</span>
                <span className="relative min-w-0">
                  <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-body-md text-on-surface-variant">€</span>
                  <input
                    aria-describedby="payment-amount-hint"
                    className="form-input form-input-with-prefix tabular-nums"
                    disabled={!editable || isPending || isReconciling || (outcomeUnknown && !retryConfirmedSafe)}
                    id="payment-amount"
                    inputMode="decimal"
                    max={outstandingAmount}
                    min="0.01"
                    name="amount"
                    onChange={(event) => setAmount(event.target.value)}
                    ref={amountRef}
                    required
                    step="0.01"
                    type="number"
                    value={amount}
                  />
                </span>
                <span className="sr-only" id="payment-amount-hint">{texts.amountHint}</span>
              </label>

              <fieldset className="grid gap-2" disabled={!editable || isPending || isReconciling || (outcomeUnknown && !retryConfirmedSafe)}>
                <legend className="text-label-sm text-on-surface-variant">{texts.method}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <Choice checked={method === "cash"} label={texts.cash} onChange={() => setMethod("cash")} value="cash" />
                  <Choice checked={method === "card"} label={texts.card} onChange={() => setMethod("card")} value="card" />
                </div>
              </fieldset>

              {amountIssue ? (
                <p className="rounded-lg bg-secondary-container px-3 py-2 text-body-sm font-medium text-on-secondary-container" id="payment-validation" role="status" aria-live="polite">
                  {amountIssue === "overOutstanding" ? texts.amountTooHigh : texts.amountRequired}
                </p>
              ) : null}

              <ActionButton aria-describedby={amountIssue ? "payment-validation" : undefined} className="min-h-12" disabled={submissionBlocked} icon="check_circle" type="submit" variant="primary">
                <span aria-live="polite">{isPending ? texts.confirming : texts.confirm}</span>
              </ActionButton>
              {outcomeUnknown && !retryConfirmedSafe ? (
                <ActionButton className="min-h-12" disabled={!idempotencyReady || isReconciling} formAction={reconcileAction} icon="refresh" type="submit" variant="secondary">
                  <span aria-live="polite">{isReconciling ? texts.checkingSaved : texts.checkSaved}</span>
                </ActionButton>
              ) : null}
              {reconciliation.status === "absent" ? <Notice tone="ready" text={texts.confirmedAbsent} /> : null}
              {reconciliation.status === "saved" && sync.phase === "ready" ? <Notice tone="ready" text={texts.confirmedSaved} /> : null}
              {reconciliation.status === "error" ? <p className="text-body-sm text-status-cancelled" role="alert">{texts.errors.saveFailed}</p> : null}
              {state.status === "error" && state.error ? <Notice tone="error" text={texts.errors[state.error]} /> : null}
            </form>
          </section>
        </div></OverlayPortal>
      ) : null}
    </>
  );
}

function Choice({ value, label, checked, onChange }: { value: PaymentMethod; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="min-w-0 cursor-pointer">
      <input className="peer sr-only" checked={checked} name="payment_method" onChange={onChange} required type="radio" value={value} />
      <span className={cx(
        "flex min-h-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-center text-label-md text-on-surface transition",
        "hover:bg-surface-container-low peer-checked:border-primary peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-secondary peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
      )}>{label}</span>
    </label>
  );
}

function Notice({ tone, text }: { tone: "ready" | "error"; text: string }) {
  return (
    <p className={cx("rounded-lg px-3 py-2 text-body-sm", tone === "ready" ? "bg-status-ready/10 text-status-ready" : "bg-status-cancelled/10 text-status-cancelled")} role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"}>
      {text}
    </p>
  );
}
