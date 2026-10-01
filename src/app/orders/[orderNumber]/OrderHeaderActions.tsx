"use client";

import Link from "next/link";
import { useActionState, useContext, useRef, useState } from "react";

import { Icon } from "@/app/_ui/Icon";
import { useModalFocus } from "@/app/_ui/useModalFocus";
import { mobileDialogPanelClassName, mobileOverlayClassName } from "@/app/_ui/mobileOverlay";
import { OverlayPortal } from "@/app/_ui/OverlayPortal";
import { changeStatusAction, type StatusState } from "@/app/orders/[orderNumber]/status-actions";
import { OrderSyncContext } from "@/app/sync/OrderSyncProvider";
import { useMutationSync } from "@/app/sync/useMutationSync";

const initialState: StatusState = { status: "idle", error: null };

export type OrderHeaderActionTexts = {
  print: string; more: string; cancel: string; title: string; warning: string;
  keep: string; cancelling: string; cancelled: string; error: string;
};

export function OrderHeaderActions({ printHref, canCancel, orderNumber, clientName, sourceStatus, expectedDateUpdated, texts }: {
  printHref: string; canCancel: boolean; orderNumber: string; clientName: string; sourceStatus: string;
  expectedDateUpdated: string; texts: OrderHeaderActionTexts;
}) {
  const session = useContext(OrderSyncContext);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: StatusState, data: FormData) => {
    const result = await changeStatusAction(prev, data);
    if (result.sync) session?.consume(result.sync);
    if (result.status === "success") setOpen(false);
    return result;
  }, initialState);
  const sync = useMutationSync(state.sync);
  const blocked = pending || sync.phase === "refreshing" || sync.phase === "error";
  useModalFocus(open, panelRef, triggerRef);

  return <div className="flex items-center gap-1">
    <Link aria-label={texts.print} className="inline-flex size-11 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-primary transition hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary" href={printHref}><Icon className="size-[1.125rem]" name="print" /></Link>
    {canCancel ? <details className="group relative" ref={detailsRef}>
      <summary ref={triggerRef} aria-label={texts.more} className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-primary transition hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary group-open:bg-primary group-open:text-on-primary [&::-webkit-details-marker]:hidden"><Icon className="size-[1.125rem]" name="more_horiz" /></summary>
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-56 rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-[0_12px_28px_rgba(31,27,23,0.16)]">
        <button className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-label-md text-status-cancelled transition hover:bg-status-cancelled/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-cancelled" onClick={() => { detailsRef.current?.removeAttribute("open"); setOpen(true); }} type="button"><Icon name="cancel" /><span>{texts.cancel}</span></button>
      </div>
    </details> : null}
    {open ? <OverlayPortal><div className={mobileOverlayClassName} role="presentation">
      <button aria-label={texts.keep} className="absolute inset-0 cursor-default" disabled={blocked} onClick={() => setOpen(false)} tabIndex={-1} type="button" />
      <section ref={panelRef} aria-labelledby={`cancel-order-title-${orderNumber}`} aria-modal="true" className={`${mobileDialogPanelClassName} w-full`} role="dialog" tabIndex={-1}>
        <h2 id={`cancel-order-title-${orderNumber}`} className="text-title-md font-extrabold text-on-surface">{texts.title}</h2>
        <p className="mt-1 [overflow-wrap:anywhere] text-body-sm text-on-surface-variant"><strong>{orderNumber} · {clientName}</strong><br />{texts.warning}</p>
        <form action={action} className="mt-4 grid grid-cols-2 gap-2">
          <input name="orderNumber" type="hidden" value={orderNumber} /><input name="target" type="hidden" value="cancelled" /><input name="source" type="hidden" value={sourceStatus} /><input name="expectedDateUpdated" type="hidden" value={expectedDateUpdated} />
          <button className="min-h-11 rounded-full border border-outline-variant px-4 text-label-md font-bold" disabled={blocked} onClick={() => setOpen(false)} type="button">{texts.keep}</button>
          <button className="min-h-11 rounded-full bg-status-cancelled px-4 text-label-md font-bold text-white disabled:opacity-60" disabled={blocked} type="submit">{pending ? texts.cancelling : texts.cancel}</button>
          {state.status === "error" ? <p className="col-span-2 rounded-lg bg-status-cancelled/10 px-3 py-2 text-body-sm text-status-cancelled" role="alert">{texts.error}</p> : null}
        </form>
      </section>
    </div></OverlayPortal> : null}
    {state.status === "success" && sync.phase === "ready" ? <span className="sr-only" role="status">{texts.cancelled}</span> : null}
  </div>;
}
