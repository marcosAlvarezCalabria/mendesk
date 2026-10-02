"use client";

import { useActionState, useContext, useEffect, useRef, useState } from "react";
import { OrderSyncContext } from "@/app/sync/OrderSyncProvider";
import { useMutationSync } from "@/app/sync/useMutationSync";

import { initialCreationReconciliationState } from "@/app/_ui/CreationReconciliation";
import { ActionButton } from "@/app/_ui/ActionButton";
import { useSessionIdempotencyKey } from "@/app/_ui/sessionIdempotency";
import { Card } from "@/app/_ui/Card";
import {
  addGarmentToOrderAction,
  type AddGarmentState,
  reconcileAddedGarmentAction,
} from "@/app/orders/[orderNumber]/edit-actions";
import { ALTERATION_TYPE_OPTIONS } from "@/app/orders/new/newOrderForm";
import { idempotencyKeys } from "@/config/technicalKeys";

const initialState: AddGarmentState = { status: "idle", error: null };

export type AddGarmentTexts = {
  ariaLabel: string;
  title: string;
  description: string;
  descriptionPlaceholder: string;
  alterationType: string;
  alterationLabels: Record<string, string>;
  price: string;
  measurements: string;
  measurementsPlaceholder: string;
  photo: string;
  submit: string;
  checkSaved: string;
  checkingSaved: string;
  confirmedAbsent: string;
  confirmedSaved: string;
  submitting: string;
  success: string;
  errors: Record<NonNullable<AddGarmentState["error"]>, string>;
};

export function AddGarmentForm({
  editable = true,
  idempotencyKey: initialIdempotencyKey,
  orderNumber,
  texts,
}: {
  editable?: boolean;
  idempotencyKey: string;
  orderNumber: string;
  texts: AddGarmentTexts;
}) {
  const session = useContext(OrderSyncContext);
  const [state, formAction, isPending] = useActionState(async (prev: AddGarmentState, data: FormData) => {
    const result = await addGarmentToOrderAction(prev, data);
    if (result.sync) session?.consume(result.sync);
    return result;
  }, initialState);
  const [reconciliation, reconcileAction, isReconciling] = useActionState<Awaited<ReturnType<typeof reconcileAddedGarmentAction>>, FormData>(async (prev, data) => {
    const result = await reconcileAddedGarmentAction(prev, data);
    if (result.sync) session?.consume(result.sync);
    return result;
  }, initialCreationReconciliationState);
  const sync = useMutationSync(reconciliation.sync ?? state.sync);
  const [touched, setTouched] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success" || reconciliation.status === "saved") {
      formRef.current?.reset();
    }
  }, [reconciliation.status, state.status, reconciliation.sync?.eventId, state.sync?.eventId]);

  const confirmedNextKey = state.status === "success"
    ? state.nextIdempotencyKey
    : reconciliation.status === "saved" ? reconciliation.nextIdempotencyKey : undefined;
  const { idempotencyKey, ready: idempotencyReady } = useSessionIdempotencyKey(
    idempotencyKeys.addGarment(orderNumber),
    initialIdempotencyKey,
    confirmedNextKey,
  );
  const outcomeUnknown = state.status === "error" && state.mutationResult === "outcome-unknown";
  const retryConfirmedSafe = reconciliation.status === "absent";
  const submissionBlocked = !editable || sync.phase === "refreshing" || sync.phase === "error" || !idempotencyReady || isPending || isReconciling || (outcomeUnknown && !retryConfirmedSafe);

  if (!editable && !touched) return null;

  return (
    <Card as="div" className="p-4 sm:p-card-padding">
      <details className="group" name="order-detail-editor">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 text-on-surface outline-none transition hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 text-title-sm">{texts.title}</span>
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center text-2xl leading-none text-secondary transition-transform group-open:rotate-45">+</span>
        </summary>

      <form
        ref={formRef}
        action={formAction}
        onInput={() => setTouched(true)}
        aria-label={texts.ariaLabel}
        className="mt-5 grid min-w-0 gap-5"
      >
        <input name="order_number" type="hidden" value={orderNumber} />
        <input name="idempotency_key" type="hidden" value={idempotencyKey} />

        <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2" disabled={submissionBlocked}>
          <legend className="sr-only">{texts.title}</legend>

          <label className="grid min-w-0 gap-2 text-label-sm text-on-surface-variant sm:col-span-2" htmlFor="new-garment-description">
            <span>{texts.description}</span>
            <input
              className="form-input"
              id="new-garment-description"
              name="description"
              placeholder={texts.descriptionPlaceholder}
              required
              type="text"
            />
          </label>

          <label className="grid min-w-0 gap-2 text-label-sm text-on-surface-variant" htmlFor="new-garment-alteration">
            <span>{texts.alterationType}</span>
            <select className="form-input" defaultValue="other" id="new-garment-alteration" name="alteration_type">
              {ALTERATION_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {texts.alterationLabels[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-w-0 gap-2 text-label-sm text-on-surface-variant" htmlFor="new-garment-price">
            <span>{texts.price}</span>
            <span className="relative min-w-0">
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-body-md text-on-surface-variant">
                €
              </span>
              <input
                className="form-input form-input-with-prefix tabular-nums"
                id="new-garment-price"
                inputMode="decimal"
                min="0"
                name="price"
                placeholder="0.00"
                required
                step="0.01"
                type="number"
              />
            </span>
          </label>

          <label className="grid min-w-0 gap-2 text-label-sm text-on-surface-variant sm:col-span-2" htmlFor="new-garment-measurements">
            <span>{texts.measurements}</span>
            <input
              className="form-input"
              id="new-garment-measurements"
              name="measurements"
              placeholder={texts.measurementsPlaceholder}
              type="text"
            />
          </label>

          <label className="grid min-w-0 gap-2 text-label-sm text-on-surface-variant sm:col-span-2" htmlFor="new-garment-photo">
            <span>{texts.photo}</span>
            <input
              accept="image/*"
              className="form-input min-w-0 max-w-full cursor-pointer overflow-hidden py-3 text-ellipsis file:mr-3 file:rounded-full file:border-0 file:bg-secondary-container file:px-3 file:py-2 file:text-label-sm file:text-on-secondary-container"
              id="new-garment-photo"
              name="photo"
              type="file"
            />
          </label>
        </fieldset>

        <ActionButton disabled={submissionBlocked} icon="add" type="submit" variant="primary" className="whitespace-normal sm:w-fit sm:min-w-48">
          <span aria-live="polite">{isPending ? texts.submitting : texts.submit}</span>
        </ActionButton>
        {outcomeUnknown && !retryConfirmedSafe ? (
          <ActionButton disabled={!idempotencyReady || isReconciling} formAction={reconcileAction} icon="sync" type="submit" variant="secondary" className="whitespace-normal sm:w-fit sm:min-w-48">
            <span aria-live="polite">{isReconciling ? texts.checkingSaved : texts.checkSaved}</span>
          </ActionButton>
        ) : null}
        {reconciliation.status === "absent" ? (
          <p className="rounded-lg border border-status-ready/30 bg-status-ready/10 px-4 py-3 text-body-sm text-status-ready" role="status" aria-live="polite">{texts.confirmedAbsent}</p>
        ) : null}
        {reconciliation.status === "saved" && sync.phase === "ready" ? (
          <p className="rounded-lg border border-status-ready/30 bg-status-ready/10 px-4 py-3 text-body-sm text-status-ready" role="status" aria-live="polite">{texts.confirmedSaved}</p>
        ) : null}
        {reconciliation.status === "error" ? <p className="text-body-sm text-status-cancelled" role="alert">{texts.errors.saveFailed}</p> : null}


        {state.status === "success" && sync.phase === "ready" ? (
          <p className="rounded-lg border border-status-ready/30 bg-status-ready/10 px-4 py-3 text-body-sm text-status-ready" role="status" aria-live="polite">
            {texts.success}
          </p>
        ) : null}
        {state.status === "error" && state.error ? (
          <p className="rounded-lg border border-status-cancelled/30 bg-status-cancelled/10 px-4 py-3 text-body-sm text-status-cancelled" role="alert" aria-live="assertive">
            {texts.errors[state.error]}
          </p>
        ) : null}
      </form>
      </details>
    </Card>
  );
}
