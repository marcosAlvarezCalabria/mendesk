"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { dictionaries } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locale";
import { withReturnTo } from "@/app/routeContext";
import { mobileNativeDialogClassName } from "@/app/_ui/mobileOverlay";
import { useMutationSync } from "@/app/sync/useMutationSync";
import { registerClientAction } from "./actions";
import { createClientRegistrationSession } from "./clientRegistrationSession";

const control = "min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";
const button = "min-h-11 rounded-lg border border-outline-variant px-4 py-2 font-bold transition-colors duration-150 enabled:cursor-pointer enabled:hover:bg-on-secondary-container enabled:hover:text-secondary-container enabled:active:bg-primary enabled:active:text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";
export function NewClientForm({ locale, returnTo }: { locale: Locale; returnTo: string }) {
  const text = dictionaries[locale];
  const router = useRouter();
  const [session] = useState(() => createClientRegistrationSession(returnTo, {
    storage: () => window.sessionStorage,
    action: registerClientAction,
    login: path => router.replace(path),
    open: (id, origin) => {
      if (origin === "/appointments/new") {
        router.push(`/appointments/new?${new URLSearchParams({ clientId: id })}`);
        return;
      }
      router.push(withReturnTo(`/clients/${encodeURIComponent(id)}`, origin));
    },
  }));
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  useMutationSync(state.result.sync);
  const exitDialog = useRef<HTMLDialogElement>(null);
  const exitAction = useRef<(() => void) | null>(null);
  const approvedTarget = useRef<EventTarget | null>(null);
  const needsExitConfirmation = useCallback(() => {
    const current = session.snapshot();
    return current.pending || (current.result.status !== "success" && Boolean(current.name || current.phone || current.gdprConsent || current.recovery));
  }, [session]);
  const requestExit = useCallback((action: () => void) => {
    if (!needsExitConfirmation()) { if (session.abandon()) action(); return; }
    exitAction.current = action;
    if (!exitDialog.current?.open) exitDialog.current?.showModal();
  }, [session, needsExitConfirmation]);
  useEffect(() => { session.hydrate(); }, [session]);
  useEffect(() => {
    // The destination supplies the read marker; this creation form cannot acknowledge a refresh.
    if (state.result.status === "success" && !state.storageError && !exitAction.current) session.open();
  }, [session, state.result.status, state.storageError]);
  useEffect(() => {
    const errors = state.result.fieldErrors;
    const first = (["name", "phone", "gdprConsent"] as const).find(field => errors?.[field]);
    if (first) document.getElementById(`client-${first}`)?.focus();
  }, [state.result]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      if (approvedTarget.current === anchor) { approvedTarget.current = null; return; }
      event.preventDefault(); event.stopPropagation();
      requestExit(() => { approvedTarget.current = anchor; anchor.click(); });
    };
    const submit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (event.defaultPrevented || !form || form.id === "new-client-form") return;
      if (approvedTarget.current === form) { approvedTarget.current = null; return; }
      event.preventDefault(); event.stopPropagation();
      requestExit(() => { approvedTarget.current = form; form.requestSubmit(event.submitter); });
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (needsExitConfirmation()) { event.preventDefault(); event.returnValue = ""; }
    };
    const path = window.location.href;
    const pop = () => {
      const destination = window.location.href;
      window.history.pushState(window.history.state, "", path);
      requestExit(() => router.push(destination));
    };
    document.addEventListener("click", click, true); document.addEventListener("submit", submit, true);
    window.addEventListener("beforeunload", unload); window.addEventListener("popstate", pop);
    return () => {
      document.removeEventListener("click", click, true); document.removeEventListener("submit", submit, true);
      window.removeEventListener("beforeunload", unload); window.removeEventListener("popstate", pop);
    };
  }, [needsExitConfirmation, requestExit, router]);
  const needsCheck = state.recovery && state.checkedPhone !== state.phone;
  const locked = state.pending || state.frozen || state.result.status === "success";
  const hasDetails = Boolean(state.name || state.phone || state.gdprConsent);
  const error = (field: "name" | "phone" | "gdprConsent") => state.result.fieldErrors?.[field];
  return <><form id="new-client-form" noValidate onSubmit={event => { event.preventDefault(); void session.submit("create"); }} className="space-y-5">
    <div className="sticky top-0 z-10 flex flex-wrap justify-between gap-3 bg-background py-4">
      <button type="button" className={button + (hasDetails ? " bg-secondary-container text-on-secondary-container" : " bg-surface-container-lowest text-on-surface")} onClick={() => requestExit(() => router.push(returnTo))}>{text["clients.new.cancel"]}</button>
      <button type="submit" className={button + " bg-primary text-on-primary"} disabled={!state.hydrated || locked || needsCheck}>{state.pending ? text["clients.new.saving"] : text["clients.new.save"]}</button>
    </div>
    {state.recovery ? <div className="space-y-2"><p>{text["clients.new.recovery"]}</p>
      <button type="button" className={button} disabled={state.pending || !state.phone.trim() || state.result.status === "success"} onClick={() => { void session.submit("reconcile"); }}>{text["clients.new.check"]}</button>
    </div> : null}
    <div><label htmlFor="client-name" className="mb-2 block font-bold">{text["clients.fields.name"]}</label>
      <input id="client-name" name="name" autoComplete="off" value={state.name} disabled={locked || needsCheck} className={control} aria-invalid={Boolean(error("name"))} aria-describedby={error("name") ? "client-name-error" : undefined} onChange={event => session.change("name", event.target.value)} />
      {error("name") ? <p id="client-name-error" className="mt-1 text-error">{text["clients.new.nameError"]}</p> : null}
    </div>
    <div><label htmlFor="client-phone" className="mb-2 block font-bold">{text["clients.fields.phone"]}</label>
      <input id="client-phone" name="phone" type="tel" autoComplete="off" value={state.phone} disabled={locked} className={control} aria-invalid={Boolean(error("phone"))} aria-describedby={error("phone") ? "client-phone-error" : "client-phone-hint"} onChange={event => session.change("phone", event.target.value)} />
      <p id="client-phone-hint" className="mt-1 text-body-sm text-on-surface-variant">{text["clients.new.phoneHint"]}</p>
      {error("phone") ? <p id="client-phone-error" className="mt-1 text-error">{text["clients.new.phoneError"]}</p> : null}
    </div>
    <label className="flex min-h-11 items-start gap-3"><input id="client-gdprConsent" name="gdprConsent" type="checkbox" className="mt-1 size-5" checked={state.gdprConsent} disabled={locked || needsCheck} aria-invalid={Boolean(error("gdprConsent"))} aria-describedby={error("gdprConsent") ? "client-consent-error" : undefined} onChange={event => session.change("gdprConsent", event.target.checked)} /><span>{text["clients.gdprConsent"]}</span></label>
    {error("gdprConsent") ? <p id="client-consent-error" className="text-error">{text["clients.new.consentError"]}</p> : null}
    <div role="status" aria-live="polite" className="min-h-6">
      {state.pending ? text["clients.new.saving"] : state.result.status === "absent" ? text["clients.new.absent"] : state.result.status === "success" ? text["clients.new.saved"] : ""}
    </div>
    {state.storageError ? <p role="alert">{text["clients.new.storageError"]}</p> : null}
    {state.result.status === "error" && !state.result.fieldErrors ? <p role="alert">{state.result.mutationResult === "outcome-unknown" ? text["clients.new.unknown"] : text["clients.new.error"]}</p> : null}
    {state.result.status === "existing" ? <div role="alert" aria-labelledby="existing-client-title" className="space-y-4 rounded-lg border border-outline-variant bg-secondary-container p-4 text-on-secondary-container">
      <div className="space-y-1">
        <h2 id="existing-client-title" className="text-lg font-extrabold">{text["clients.new.duplicateTitle"]}</h2>
        <p>{text["clients.new.duplicate"]}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className={`${button} bg-primary text-on-primary`} onClick={session.open}>{text["clients.new.openExisting"]}</button>
        <button type="button" className={`${button} bg-surface-container-lowest text-on-surface`} onClick={session.keepEditing}>{text["clients.new.keepEditing"]}</button>
      </div>
    </div> : null}
    {state.result.status === "success" ? <button type="button" className={button} onClick={session.open}>{text["clients.new.open"]}</button> : null}
  </form>
    <dialog ref={exitDialog} aria-labelledby="client-leave-title" aria-describedby="client-leave-description"
      className={`${mobileNativeDialogClassName} w-[calc(100%-2rem)] max-w-md space-y-4 rounded-xl border border-outline-variant bg-background p-5 text-on-surface backdrop:bg-black/40`}
      onClose={() => { exitAction.current = null; }}>
      <h2 id="client-leave-title" className="text-lg font-bold">{text["clients.new.leave"]}</h2>
      <p id="client-leave-description">{state.pending || state.recovery ? text["clients.new.leaveUncertain"] : text["clients.new.leaveDetails"]}</p>
      <div className="flex flex-wrap gap-3">
        <button id="client-leave-stay" type="button" className={button} onClick={() => {
          exitAction.current = null; exitDialog.current?.close();
          if (session.snapshot().result.status === "success") session.open();
        }}>{text["clients.new.stay"]}</button>
        <button id="client-leave-confirm" type="button" className={button} onClick={() => {
          const action = exitAction.current;
          if (action && session.abandon()) { exitAction.current = null; exitDialog.current?.close(); action(); }
        }}>{text["clients.new.leaveConfirm"]}</button>
      </div>
      {state.storageError ? <p role="alert">{text["clients.new.storageError"]}</p> : null}
    </dialog>
  </>;
}
