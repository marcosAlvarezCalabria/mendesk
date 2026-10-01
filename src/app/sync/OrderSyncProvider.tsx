"use client";

import { createContext, useEffect, useMemo, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { dictionaries } from "@/i18n/dictionaries";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import type { InvalidationSignal, MutationSyncReceipt } from "./contracts";
import { isSyncReadPath, parseInvalidationSignal } from "./orderInvalidation";

type Phase = "idle" | "refreshing" | "ready" | "error";

// Internal context shared only by the provider, receipt hook and server-read marker.
export const OrderSyncContext = createContext<ReturnType<typeof createSession> | null>(null);

function createSession(refresh: () => void) {
  let phase: Phase = "idle";
  let revision = 0;
  let active = false;
  let pathname = "";
  let channel: BroadcastChannel | undefined;
  let inFlight = false;
  let timedOut = false;
  let queuedRead = false;
  let dirty = false;
  let pending = false;
  let readId: string | undefined;
  let startRead: string | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let focusTimer: ReturnType<typeof setTimeout> | undefined;
  const seen = new Set<string>();
  const outgoing: InvalidationSignal[] = [];
  const listeners = new Set<() => void>();
  const notify = () => { revision++; listeners.forEach((listener) => listener()); };
  const visible = () => typeof document !== "undefined" && document.visibilityState === "visible";
  function remember(id: string) {
    if (seen.has(id)) return false;
    seen.add(id);
    if (seen.size > 256) seen.delete(seen.values().next().value!);
    return true;
  }
  function request() {
    dirty = true;
    if (!isSyncReadPath(pathname)) return;
    phase = "refreshing";
    notify();
    if (inFlight) { queuedRead = true; return; }
    if (!active || !visible()) return;
    dirty = false;
    queuedRead = false;
    timedOut = false;
    inFlight = true;
    startRead = readId;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      phase = "error";
      timedOut = true;
      dirty = true;
      // A stalled transition still owns its request; do not launch a parallel read.
      if (!pending) inFlight = false;
      notify();
    }, 15_000);
    try { refresh(); } catch {
      clearTimeout(timeout);
      phase = "error"; dirty = true; inFlight = false; notify();
    }
  }
  function complete() {
    if (!inFlight || pending || !readId || readId === startRead) return;
    clearTimeout(timeout);
    inFlight = false;
    if (dirty) request();
    else { phase = "ready"; notify(); }
  }
  function onFocus() {
    clearTimeout(focusTimer);
    if (!visible()) { dirty = true; return; }
    focusTimer = setTimeout(request, 100);
  }
  function receive(value: unknown) {
    const signal = parseInvalidationSignal(value);
    if (!signal || !remember(signal.eventId)) return;
    request();
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    snapshot: () => revision,
    phase: () => phase,
    hasSeen: (id: string) => seen.has(id),
    receive,
    consume(receipt: MutationSyncReceipt) {
      const signal = parseInvalidationSignal({ version: 1, eventId: receipt.eventId, target: receipt.target });
      if (!signal || !remember(signal.eventId)) return;
      if (!active) outgoing.push(signal);
      else {
        try { channel?.postMessage(signal); } catch { /* Focus/navigation remains available. */ }
      }
      if (isSyncReadPath(pathname)) request();
      else { phase = "ready"; notify(); }
    },
    markRead(id: string) { readId = id; complete(); },
    setPending(value: boolean) {
      const transitionEnded = pending && !value;
      pending = value;
      // A completed partial response has no success marker, but no longer owns a read.
      // Initial pending=false is not evidence that a requested transition has ended.
      if (inFlight && transitionEnded && (!readId || readId === startRead)) {
        clearTimeout(timeout);
        inFlight = false;
        timedOut = false;
        dirty = true;
        if (queuedRead) request();
        else { phase = "error"; notify(); }
        return;
      }
      if (!pending && timedOut) {
        inFlight = false;
        timedOut = false;
        if (queuedRead) {
          queuedRead = false;
          request();
        } else if (readId && readId !== startRead) {
          dirty = false;
          phase = "ready";
          notify();
        } else {
          phase = "error";
          notify();
        }
        return;
      }
      complete();
    },
    retry: request,
    navigate(path: string) {
      pathname = path;
      // Navigating away discards ownership of the previous route's marker.
      inFlight = false; pending = false; timedOut = false; queuedRead = false; clearTimeout(timeout);
      if (isSyncReadPath(path)) request();
    },
    start() {
      active = true;
      try {
        if (typeof BroadcastChannel !== "undefined") {
          channel = new BroadcastChannel("koko-order-invalidation-v1");
          channel.onmessage = (event) => receive(event.data);
        }
      } catch { channel = undefined; }
      for (const signal of outgoing.splice(0)) {
        try { channel?.postMessage(signal); } catch { /* Focus/navigation remains available. */ }
      }
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onFocus);
      return () => {
        active = false;
        channel?.close(); channel = undefined;
        clearTimeout(timeout); clearTimeout(focusTimer);
        inFlight = false;
        timedOut = false; queuedRead = false;
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onFocus);
      };
    },
  };
}

export function OrderSyncProvider({ children, locale = DEFAULT_LOCALE }: { children: ReactNode; locale?: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const [pending, startTransition] = useTransition();
  const session = useMemo(() => createSession(() => startTransition(() => router.refresh())), [router, startTransition]);
  useSyncExternalStore(session.subscribe, session.snapshot, () => 0);
  useEffect(() => session.start(), [session]);
  useEffect(() => { session.navigate(pathname); }, [session, pathname, query]);
  useEffect(() => { session.setPending(pending); }, [session, pending]);
  const text = dictionaries[locale];
  return (
    <OrderSyncContext.Provider value={session}>
      {session.phase() === "error" ? (
        <div role="status" aria-live="polite" className="max-w-full overflow-hidden border-b border-outline-variant bg-background">
          <div className="mx-auto flex min-h-11 w-full min-w-0 max-w-[640px] items-center gap-2 px-margin-mobile text-body-sm">
            <p className="min-w-0 flex-1 leading-tight">{text["sync.pending"]}</p>
            <button type="button" className="min-h-11 min-w-0 max-w-[45%] whitespace-normal break-words px-2 text-right font-semibold leading-tight underline underline-offset-4" onClick={session.retry}>{text["sync.retry"]}</button>
          </div>
        </div>
      ) : null}
      {children}
    </OrderSyncContext.Provider>
  );
}
