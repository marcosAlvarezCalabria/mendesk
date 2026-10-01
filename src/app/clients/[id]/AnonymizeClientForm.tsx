"use client";
import { useActionState, useContext, useRef, useState } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { OrderSyncContext } from "@/app/sync/OrderSyncProvider";
import { useMutationSync } from "@/app/sync/useMutationSync";
import { dictionaries } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locale";
import { safeClientsReturnTo } from "@/app/routeContext";
import { mobileNativeDialogClassName } from "@/app/_ui/mobileOverlay";
import { anonymizeClientAction, type AnonymizeState } from "./actions";
const initialState: AnonymizeState = { status: "idle", error: null };
export type AnonymizeClientTexts = { confirmation: string; submitting: string; submit: string };
export function AnonymizeClientForm({ clientId, clientName = "", returnTo = "/clients", locale = "en", texts }: {
  clientId: string; clientName?: string; returnTo?: string; locale?: Locale; texts: AnonymizeClientTexts;
}) {
  const session = useContext(OrderSyncContext);
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const [understood, setUnderstood] = useState(false);
  const [state, formAction, isPending] = useActionState(async (prev: AnonymizeState, data: FormData): Promise<AnonymizeState> => {
    try {
      const result = await anonymizeClientAction(prev, data);
      if (result.sync) session?.consume(result.sync);
      if (result.status === "success") router.replace(safeClientsReturnTo(returnTo));
      return result;
    } catch (error) {
      unstable_rethrow(error);
      return { status: "error", mutationResult: "outcome-unknown", error: "Anonymization could not be confirmed." };
    } finally { inFlight.current = false; }
  }, initialState);
  const sync = useMutationSync(state.sync);
  const text = dictionaries[locale];
  const busy = isPending || sync.phase === "refreshing";
  const button = "min-h-11 rounded-lg border border-outline-variant px-4 py-2 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";
  return <>
    <details className="relative">
      <summary aria-label={text["clients.actions"]} className="flex size-11 cursor-pointer list-none items-center justify-center rounded-lg border border-outline-variant font-bold focus-visible:outline-2">⋮</summary>
      <div className="absolute right-0 z-20 w-60 rounded-xl border border-outline-variant bg-surface-container-lowest p-2">
        <button ref={trigger} type="button" className={button + " w-full text-status-cancelled"} onClick={event => {
          const menu = event.currentTarget.closest("details"); if (menu) menu.open = false;
          setUnderstood(false); dialog.current?.showModal();
        }}>{texts.submit}</button>
      </div>
    </details>
    <dialog ref={dialog} aria-labelledby={`anonymize-title-${clientId}`} className={`${mobileNativeDialogClassName} w-[calc(100%-2rem)] max-w-lg rounded-xl bg-background p-5 text-on-surface backdrop:bg-black/40`}
      onCancel={event => { if (busy || inFlight.current) event.preventDefault(); }}
      onClose={() => { trigger.current?.closest("details")?.querySelector("summary")?.focus(); }}>
      <h2 id={`anonymize-title-${clientId}`} className="mb-4 text-title-lg font-bold">{texts.submit} · {clientName}</h2>
      <form action={formAction} className="space-y-4" onSubmit={event => {
        if (!understood || inFlight.current || busy || state.status === "success") { event.preventDefault(); return; }
        inFlight.current = true;
      }}>
        <input name="client_id" type="hidden" value={clientId} />
        <label className="flex min-h-11 items-start gap-3">
          <input name="understood" value="true" type="checkbox" checked={understood} disabled={busy} className="mt-1 size-5"
            onChange={event => setUnderstood(event.target.checked)} />
          <span>{texts.confirmation}</span>
        </label>
        {state.status === "error" ? <p role="alert">{text["clients.anonymize.error"]}</p> : null}
        <p role="status" aria-live="polite" className="min-h-6">{busy ? texts.submitting : state.status === "success" ? text["clients.anonymize.saved"] : ""}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={button} disabled={busy} onClick={() => dialog.current?.close()}>{text["clients.new.cancel"]}</button>
          <button type="submit" className={button + " bg-status-cancelled text-white"} disabled={!understood || busy || state.status === "success" || sync.phase === "error"}>{isPending ? texts.submitting : texts.submit}</button>
          {sync.phase === "error" ? <button type="button" className={button} onClick={sync.retry}>{text["clients.search.retry"]}</button> : null}
        </div>
      </form>
    </dialog>
  </>;
}
