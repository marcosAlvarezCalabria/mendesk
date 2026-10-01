"use client";

import { useActionState, useContext, useEffect, useRef, useState } from "react";
import { OrderSyncContext } from "@/app/sync/OrderSyncProvider";
import { useMutationSync } from "@/app/sync/useMutationSync";
import { useFormStatus } from "react-dom";

import { Icon } from "@/app/_ui/Icon";
import { editGarmentAction, type EditState } from "@/app/orders/[orderNumber]/edit-actions";
import {
  isEditGarmentDraftDirty,
  makeEditGarmentDraft,
  updateEditGarmentDraft,
} from "@/app/orders/[orderNumber]/editGarmentDraft";
import {
  confirmEditOrderNavigation,
  guardEditOrderBeforeUnload,
  handleEditOrderPopNavigation,
  isEditOrderLeaveGuardActive,
} from "@/app/orders/[orderNumber]/editOrderUnsavedGuard";
import { ALTERATION_TYPE_OPTIONS } from "@/app/orders/new/newOrderForm";

const initialState: EditState = { status: "idle", error: null };
const inputClassName = "form-input";

export type EditableGarment = {
  id: string;
  dateUpdated: string;
  description: string;
  alterationType: string;
  measurements: string;
  price: string;
};

export type EditGarmentTexts = {
  edit: string;
  description: string;
  descriptionPlaceholder: string;
  alterationType: string;
  alterationLabels: Record<string, string>;
  price: string;
  measurements: string;
  measurementsPlaceholder: string;
  save: string;
  saving: string;
  checkSaved: string;
  checkingSaved: string;
  unsaved: string;
  errors: { notEditable: string; description: string; price: string; saveFailed: string };
};

export function EditGarmentForm({ editable = true, orderNumber, garment, texts }: { editable?: boolean; orderNumber: string; garment: EditableGarment; texts: EditGarmentTexts }) {
  const session = useContext(OrderSyncContext);
  const [originalVersion] = useState(garment.dateUpdated);
  const [touched, setTouched] = useState(false);
  const [savedDraft, setSavedDraft] = useState(() => makeEditGarmentDraft(garment));
  const [draft, setDraft] = useState(() => makeEditGarmentDraft(garment));
  const [state, formAction, isPending] = useActionState(async (prev: EditState, data: FormData) => {
    const result = await editGarmentAction(prev, data);
    if (result.sync) session?.consume(result.sync);
    if (result.status === "success") {
      setSavedDraft(draft);
      setTouched(false);
    }
    return result;
  }, initialState);
  const sync = useMutationSync(state.sync);
  const reconciling = state.status === "error" && state.mutationResult === "outcome-unknown";
  const descriptionRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const lastEditorFocus = useRef<HTMLElement | null>(null);
  const errorKind = state.status === "error" ? editGarmentErrorKind(state.error) : null;
  const dirty = touched && isEditGarmentDraftDirty(draft, savedDraft);

  useEffect(() => {
    if (errorKind === "description") descriptionRef.current?.focus();
    if (errorKind === "price") priceRef.current?.focus();
  }, [errorKind]);

  useEffect(() => {
    const guardState = { dirty, pending: isPending };
    if (!isEditOrderLeaveGuardActive(guardState)) return;

    const guardedHref = window.location.href;
    const guardedHistoryState = window.history.state;
    const restoreEditorFocus = () => lastEditorFocus.current?.focus({ preventScroll: true });
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      guardEditOrderBeforeUnload(event, guardState);
    }
    function confirmInternalNavigation(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.download || (anchor.target && anchor.target !== "_self")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      if (!confirmEditOrderNavigation(guardState, () => window.confirm(texts.unsaved))) {
        event.preventDefault();
        event.stopPropagation();
        restoreEditorFocus();
        return;
      }
      setTouched(false);
    }
    function confirmBrowserNavigation() {
      const canLeave = handleEditOrderPopNavigation(
        guardState,
        () => window.confirm(texts.unsaved),
        () => window.history.pushState(guardedHistoryState, "", guardedHref),
        restoreEditorFocus,
      );
      if (canLeave) setTouched(false);
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("popstate", confirmBrowserNavigation);
    document.addEventListener("click", confirmInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("popstate", confirmBrowserNavigation);
      document.removeEventListener("click", confirmInternalNavigation, true);
    };
  }, [dirty, isPending, texts.unsaved]);

  if (!editable && !touched) return null;

  return (
    <details className="group min-w-0 flex-1 open:basis-full" name="order-detail-editor">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1.5 rounded-lg px-2.5 text-[0.75rem] font-bold text-on-surface-variant outline-none transition hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <Icon className="size-4" name="edit" />
        <span>{texts.edit}</span>
      </summary>
      <form action={formAction} onFocusCapture={(event) => { if (event.target instanceof HTMLElement) lastEditorFocus.current = event.target; }} onInput={() => setTouched(true)} className="grid gap-3 border-t border-outline-variant/40 px-1 pb-2 pt-3 sm:grid-cols-2">
        <input name="orderNumber" type="hidden" value={orderNumber} />
        <input name="garment_id" type="hidden" value={garment.id} />
        <input name="expected_date_updated" type="hidden" value={state.sync?.snapshot?.garments.find((item) => item.id === garment.id)?.dateUpdated ?? originalVersion} />

        <label className="grid gap-1.5 text-label-sm text-on-surface-variant sm:col-span-2">
          {texts.description}
          <input aria-describedby={errorKind === "description" ? `garment-${garment.id}-error` : undefined} aria-invalid={errorKind === "description" || undefined} className={inputClassName} disabled={isPending || reconciling} name="description" ref={descriptionRef} required type="text" value={draft.description} onChange={(event) => setDraft((current) => updateEditGarmentDraft(current, "description", event.target.value))} placeholder={texts.descriptionPlaceholder} />
        </label>

        <label className="grid gap-1.5 text-label-sm text-on-surface-variant">
          {texts.alterationType}
          <select className={inputClassName} disabled={isPending || reconciling} name="alteration_type" value={draft.alterationType} onChange={(event) => {
            setTouched(true);
            setDraft((current) => updateEditGarmentDraft(current, "alterationType", event.target.value));
          }}>
            {ALTERATION_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {texts.alterationLabels[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-label-sm text-on-surface-variant">
          {texts.price}
          <input aria-describedby={errorKind === "price" ? `garment-${garment.id}-error` : undefined} aria-invalid={errorKind === "price" || undefined} className={inputClassName} disabled={isPending || reconciling} name="price" ref={priceRef} required type="number" step="0.01" min="0" value={draft.price} onChange={(event) => setDraft((current) => updateEditGarmentDraft(current, "price", event.target.value))} inputMode="decimal" />
        </label>

        <label className="grid gap-1.5 text-label-sm text-on-surface-variant sm:col-span-2">
          {texts.measurements}
          <input className={inputClassName} disabled={isPending || reconciling} name="measurements" type="text" value={draft.measurements} onChange={(event) => setDraft((current) => updateEditGarmentDraft(current, "measurements", event.target.value))} placeholder={texts.measurementsPlaceholder} />
        </label>

        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center">
          <SubmitButton disabled={!editable || sync.phase === "refreshing" || sync.phase === "error"} label={reconciling ? texts.checkSaved : texts.save} pendingLabel={reconciling ? texts.checkingSaved : texts.saving} />
          {dirty && !isPending ? (
            <p aria-live="polite" className="text-sm font-semibold text-status-received" role="status">
              {texts.unsaved}
            </p>
          ) : null}
        </div>

        {state.status === "error" && state.error ? (
          <p className="rounded-lg bg-error-container px-4 py-3 text-sm font-medium text-on-error-container sm:col-span-2" id={`garment-${garment.id}-error`} role="alert" aria-live="polite">
            {texts.errors[errorKind ?? "saveFailed"]}
          </p>
        ) : null}
      </form>
    </details>
  );
}

function editGarmentErrorKind(error: string): keyof EditGarmentTexts["errors"] {
  if (error === "This order can no longer be edited.") return "notEditable";
  if (error === "Each garment needs a description.") return "description";
  if (error === "Enter a valid price.") return "price";
  return "saveFailed";
}

function SubmitButton({ disabled, label, pendingLabel }: { disabled: boolean; label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="min-h-11 w-full rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:min-w-40"
      type="submit"
      disabled={disabled || pending}
    >
      <span aria-live="polite">{pending ? pendingLabel : label}</span>
    </button>
  );
}
