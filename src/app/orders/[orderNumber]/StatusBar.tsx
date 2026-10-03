"use client";

import { useActionState, useContext, useRef, useState, type ReactNode } from "react";
import { OrderSyncContext } from "@/app/sync/OrderSyncProvider";
import { useMutationSync } from "@/app/sync/useMutationSync";
import { useFormStatus } from "react-dom";

import { Icon } from "@/app/_ui/Icon";
import { mobileDialogPanelClassName, mobileOverlayClassName } from "@/app/_ui/mobileOverlay";
import { OverlayPortal } from "@/app/_ui/OverlayPortal";
import { cx } from "@/app/_ui/classNames";
import { useModalFocus } from "@/app/_ui/useModalFocus";
import { changeStatusAction, type StatusState } from "@/app/orders/[orderNumber]/status-actions";
import { shouldRenderStatusBar, statusActionControlClassName, statusActionLayoutClassName, statusErrorMessage, statusSuccessMessage, type StatusErrorLabels, type StatusSuccessLabels } from "@/app/orders/[orderNumber]/statusBarView";
import type { StatusAction } from "@/app/orders/[orderNumber]/statusActions";
import { ReadyConfirmationSubmitButton } from "@/app/orders/[orderNumber]/ReadyConfirmationSubmitButton";

const initialState: StatusState = { status: "idle", error: null };

const ACTION_ICONS: Record<StatusAction, string> = {
  ready: "check_circle",
  collected: "inventory_2",
  cancelled: "cancel",
};

const ACTION_STYLES: Record<StatusAction, string> = {
  ready: "bg-primary text-on-primary hover:bg-primary/90",
  collected: "bg-primary text-on-primary hover:bg-primary/90",
  cancelled: "border border-status-cancelled bg-surface-container-lowest text-status-cancelled hover:bg-status-cancelled/10",
};

export type StatusBarTexts = {
  ariaLabel: string;
  openWhatsapp: string;
  askReview: string;
  readyConfirmation: string;
  keepOrder: string;
  notNow: string;
  actionLabels: Record<StatusAction, string>;
  pendingLabels: Record<StatusAction, string>;
  checkSaved: string;
  checkingSaved: string;
  successLabels: StatusSuccessLabels;
  errorLabels: StatusErrorLabels;
};

export function StatusBar({
  actions,
  orderNumber,
  sourceStatus,
  expectedDateUpdated,
  readyWhatsappUrl,
  reviewWhatsappUrl,
  collectPanel,
  texts,
}: {
  actions: StatusAction[];
  orderNumber: string;
  sourceStatus: string;
  expectedDateUpdated: string;
  readyWhatsappUrl?: string;
  reviewWhatsappUrl?: string;
  collectPanel?: ReactNode;
  texts: StatusBarTexts;
}) {
  const session = useContext(OrderSyncContext);
  const [confirmReady, setConfirmReady] = useState(false);
  const confirmationRef = useRef<HTMLElement>(null);
  const readyPromptRef = useRef<HTMLElement>(null);
  const [dismissedReadyPrompt, setDismissedReadyPrompt] = useState(false);
  const [state, formAction, isPending] = useActionState(async (prev: StatusState, data: FormData) => {
    const result = await changeStatusAction(prev, data);
    if (result.sync) session?.consume(result.sync);
    if (result.status === "success" && result.target === "ready") setConfirmReady(false);
    return result;
  }, initialState);
  const sync = useMutationSync(state.sync);
  const successMessage = sync.phase === "ready" && state.status === "success" && sourceStatus === state.target
    ? statusSuccessMessage(state, texts.successLabels) : undefined;
  const errorMessage = statusErrorMessage(state, texts.errorLabels);
  const unknownTarget = state.status === "error" && state.mutationResult === "outcome-unknown" ? state.target : undefined;

  const whatsappUrl = state.whatsappUrl ?? readyWhatsappUrl;
  const showReadyPrompt = state.status === "success" && state.target === "ready" && sync.phase === "ready" && !dismissedReadyPrompt;

  useModalFocus(confirmReady, confirmationRef);
  useModalFocus(showReadyPrompt, readyPromptRef);
  if (!shouldRenderStatusBar(actions, reviewWhatsappUrl ?? whatsappUrl, state) && !collectPanel) {
    return null;
  }

  return (
    <section className="fixed inset-x-0 bottom-[calc(4.25rem+var(--mobile-navigation-safe-area))] z-30 border-t border-outline-variant bg-background/95 shadow-[0_-4px_20px_0_rgba(0,0,0,0.04)] backdrop-blur md:bottom-0 md:left-20 lg:left-60" aria-label={texts.ariaLabel}>
      <div className="mx-auto w-full max-w-[720px] space-y-3 px-margin-mobile pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:pb-3">
        {successMessage ? (
          <p className="rounded-lg border border-status-ready/30 bg-status-ready/10 px-4 py-3 text-body-sm text-status-ready" role="status" aria-live="polite">
            {successMessage}
          </p>
        ) : null}

        <div className={statusActionLayoutClassName()}>
          {actions.filter((action) => action === "ready").map((action) => (
            <form action={formAction} key={action}>
              <input name="orderNumber" type="hidden" value={orderNumber} />
              <input name="target" type="hidden" value={action} />
              <input name="source" type="hidden" value={sourceStatus} />
              <input name="expectedDateUpdated" type="hidden" value={expectedDateUpdated} />
              <ActionButton action={action} disabled={isPending || sync.phase === "refreshing" || sync.phase === "error" || Boolean(unknownTarget && unknownTarget !== action)} onConfirm={() => setConfirmReady(true)} reconciling={unknownTarget === action} texts={texts} />
            </form>
          ))}

          {whatsappUrl && !showReadyPrompt ? (
            <a
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-status-ready px-5 text-label-lg text-white transition hover:bg-status-ready/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background"
              href={state.whatsappUrl}
              rel="noreferrer"
              target="_blank"
            >
              <Icon name="chat" />
              <span>{texts.openWhatsapp}</span>
            </a>
          ) : null}

          {collectPanel}

          {reviewWhatsappUrl ? (
            <a
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full border border-secondary bg-surface-container-lowest px-5 text-label-lg text-secondary transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background"
              href={reviewWhatsappUrl}
              rel="noreferrer"
              target="_blank"
            >
              <Icon name="reviews" />
              <span>{texts.askReview}</span>
            </a>
          ) : null}
        </div>

        {errorMessage ? (
          <p className="rounded-lg border border-status-cancelled/30 bg-status-cancelled/10 px-4 py-3 text-body-sm text-status-cancelled" role="alert" aria-live="polite">
            {errorMessage}
          </p>
        ) : null}
      </div>
      {confirmReady ? (
        <OverlayPortal><div className={mobileOverlayClassName} role="presentation">
          <button aria-label={texts.keepOrder} className="absolute inset-0 cursor-default" disabled={isPending} onClick={() => setConfirmReady(false)} tabIndex={-1} type="button" />
          <section ref={confirmationRef} aria-labelledby="ready-confirmation-title" aria-modal="true" className={`${mobileDialogPanelClassName} w-full`} role="dialog" tabIndex={-1}>
            <h2 id="ready-confirmation-title" className="text-title-md font-extrabold text-on-surface">{texts.actionLabels.ready}</h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">{texts.readyConfirmation}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="min-h-11 rounded-full border border-outline-variant px-4 text-label-md font-bold" disabled={isPending} onClick={() => setConfirmReady(false)} type="button">{texts.keepOrder}</button>
              <form action={formAction}>
                <input name="orderNumber" type="hidden" value={orderNumber} /><input name="target" type="hidden" value="ready" /><input name="source" type="hidden" value={sourceStatus} /><input name="expectedDateUpdated" type="hidden" value={expectedDateUpdated} />
                <ReadyConfirmationSubmitButton disabled={isPending} label={texts.actionLabels.ready} pendingLabel={texts.pendingLabels.ready} />
              </form>
            </div>
          </section>
        </div></OverlayPortal>
      ) : null}
      {showReadyPrompt ? (
        <OverlayPortal><div className={mobileOverlayClassName} role="presentation">
          <section ref={readyPromptRef} aria-labelledby="ready-success-title" aria-modal="true" className={`${mobileDialogPanelClassName} w-full`} role="dialog" tabIndex={-1}>
            <h2 id="ready-success-title" className="text-title-md font-extrabold text-status-ready">{texts.successLabels.ready}</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="min-h-11 rounded-full border border-outline-variant px-4 text-label-md font-bold" onClick={() => setDismissedReadyPrompt(true)} type="button">{texts.notNow}</button>
              {whatsappUrl ? <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-status-ready px-4 text-label-md font-bold text-white" href={whatsappUrl} rel="noreferrer" target="_blank"><Icon className="size-4" name="chat" />{texts.openWhatsapp}</a> : null}
            </div>
          </section>
        </div></OverlayPortal>
      ) : null}
    </section>
  );
}

function ActionButton({ action, disabled, onConfirm, reconciling, texts }: { action: StatusAction; disabled: boolean; onConfirm: () => void; reconciling: boolean; texts: StatusBarTexts }) {
  const { pending } = useFormStatus();

  return (
    <button
      className={cx(
        statusActionControlClassName(),
        ACTION_STYLES[action],
      )}
      type={reconciling ? "submit" : "button"}
      disabled={disabled || pending}
      onClick={reconciling ? undefined : onConfirm}
    >
      <Icon className="size-4" name={ACTION_ICONS[action]} />
      <span aria-live="polite">{reconciling ? (pending ? texts.checkingSaved : texts.checkSaved) : pending ? texts.pendingLabels[action] : texts.actionLabels[action]}</span>
    </button>
  );
}
