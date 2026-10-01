"use client";

import { useActionState, useContext, useEffect, useRef, useState } from "react";
import { OrderSyncContext } from "@/app/sync/OrderSyncProvider";
import { useMutationSync } from "@/app/sync/useMutationSync";

import { cx } from "@/app/_ui/classNames";
import { Icon } from "@/app/_ui/Icon";
import { editOrderDetailsAction, type EditState } from "@/app/orders/[orderNumber]/edit-actions";
import { editOrderFormView, type EditOrderFormView } from "@/app/orders/[orderNumber]/editOrderFormView";
import {
  confirmEditOrderNavigation,
  guardEditOrderBeforeUnload,
  handleEditOrderPopNavigation,
  isEditOrderLeaveGuardActive,
} from "@/app/orders/[orderNumber]/editOrderUnsavedGuard";

const initialState: EditState = { status: "idle", error: null };
const inputClassName = "form-input";

export type EditOrderDetailsTexts = {
  title: string;
  dueDate: string;
  notes: string;
  notesPlaceholder: string;
  save: string;
  saved: string;
  saving: string;
  checkSaved: string;
  checkingSaved: string;
  unsaved: string;
  error: string;
};

export function EditOrderDetailsForm({ editable = true, orderNumber, dateUpdated, dueDateValue, notes, texts }: { editable?: boolean; orderNumber: string; dateUpdated: string; dueDateValue: string; notes: string; texts: EditOrderDetailsTexts }) {
  const session = useContext(OrderSyncContext);
  const [state, formAction, isPending] = useActionState(async (prev: EditState, data: FormData) => {
    const result = await editOrderDetailsAction(prev, data);
    if (result.sync) session?.consume(result.sync);
    return result;
  }, initialState);
  const sync = useMutationSync(state.sync);
  const [dueDate, setDueDate] = useState(dueDateValue);
  const [notesValue, setNotesValue] = useState(notes);
  const [originalVersion, setOriginalVersion] = useState(dateUpdated);
  const [touched, setTouched] = useState(false);
  const lastEditorFocus = useRef<HTMLElement | null>(null);
  const reconciling = state.status === "error" && state.mutationResult === "outcome-unknown";
  const saved = state.status === "success" && state.saved ? state.saved : { dueDate: dueDateValue, notes: notes.trim() };
  const dirty = touched && (dueDate !== saved.dueDate || notesValue.trim() !== saved.notes);
  const view = editOrderFormView({ dirty, pending: isPending });

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
    <details className="group mt-2 scroll-mt-24 rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-2" id="edit-order" name="order-detail-editor">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-[0.75rem] font-bold text-on-surface outline-none transition hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <Icon className="size-4" name="edit" />
        <span>{texts.title}</span>
      </summary>

      <form action={formAction} onFocusCapture={(event) => { if (event.target instanceof HTMLElement) lastEditorFocus.current = event.target; }} onInput={() => { if (!touched) setOriginalVersion(dateUpdated); setTouched(true); }} className="grid gap-3 border-t border-outline-variant/40 px-1 pb-3 pt-3 sm:grid-cols-2">
        <input name="orderNumber" type="hidden" value={orderNumber} />
        <input name="expected_date_updated" type="hidden" value={touched ? state.sync?.snapshot?.dateUpdated ?? originalVersion : dateUpdated} />

        <label className="grid gap-1.5 text-label-sm text-on-surface-variant">
          {texts.dueDate}
          <input className={inputClassName} disabled={!editable || isPending || reconciling} name="due_date" onChange={(event) => { if (!touched) setNotesValue(notes); setDueDate(event.target.value); }} required type="date" value={touched ? dueDate : dueDateValue} />
        </label>

        <label className="grid gap-1.5 text-label-sm text-on-surface-variant sm:col-span-2">
          {texts.notes}
          <textarea className={`${inputClassName} min-h-24 resize-y py-3`} disabled={!editable || isPending || reconciling} name="notes" onChange={(event) => { if (!touched) setDueDate(dueDateValue); setNotesValue(event.target.value); }} placeholder={texts.notesPlaceholder} value={touched ? notesValue : notes} />
        </label>

        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center">
          <SubmitButton
            disabled={!editable || view.disabled || sync.phase === "refreshing" || sync.phase === "error"}
            label={reconciling ? (isPending ? texts.checkingSaved : texts.checkSaved) : texts[view.buttonLabel]}
            tone={view.tone}
          />
          {view.showUnsavedWarning ? (
            <p aria-live="polite" className="text-sm font-semibold text-status-received" role="status">
              {texts.unsaved}
            </p>
          ) : null}
        </div>

        {state.status === "error" && state.error ? <ErrorMessage message={texts.error} /> : null}
      </form>
    </details>
  );
}

function SubmitButton({ disabled, label, tone }: { disabled: boolean; label: string; tone: EditOrderFormView["tone"] }) {
  return (
    <button
      className={cx(
        "min-h-12 w-full rounded-lg border px-5 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 sm:w-auto sm:min-w-40",
        tone === "saved" && "cursor-default border-status-ready/30 bg-status-ready/10 text-status-ready",
        tone === "unsaved" && "border-secondary bg-secondary text-white hover:bg-secondary/90",
        tone === "saving" && "cursor-wait border-primary bg-primary text-on-primary opacity-70",
      )}
      disabled={disabled}
      type="submit"
    >
      <span aria-live="polite">{label}</span>
    </button>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:col-span-2" role="alert" aria-live="polite">
      {message}
    </p>
  );
}
