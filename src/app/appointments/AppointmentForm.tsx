"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { initialCreationReconciliationState } from "@/app/_ui/CreationReconciliation";
import { formatPhoneForDisplay } from "@/app/_ui/phoneDisplay";
import { isMutationSubmissionBlocked } from "@/app/_ui/mutationSubmission";
import { reconcileScheduledAppointmentAction, scheduleAppointmentAction, type ScheduleState } from "@/app/appointments/actions";
import type { OrderStatusValue } from "@/domain/values/OrderStatus";

export type AppointmentClientOption = { id: string; name: string; phone: string | null };
export type AppointmentOrderOption = { id: string; orderNumber: string; status: OrderStatusValue };
type ClientSearchPage = { items: AppointmentClientOption[]; hasNextPage: boolean };

export type AppointmentFormTexts = {
  title: string;
  client: string;
  searchPlaceholder: string;
  selected: string;
  searching: string;
  noClients: string;
  dateTime: string;
  date: string;
  time: string;
  changeClient: string;
  newClient: string;
  linkedOrder: string;
  noLinkedOrder: string;
  loadingOrders: string;
  startOver: string;
  notes: string;
  notesPlaceholder: string;
  schedule: string;
  scheduling: string;
  checkSaved: string;
  checkingSaved: string;
  confirmedAbsent: string;
  confirmedSaved: string;
  error: string;
  orderStatuses: Record<OrderStatusValue, string>;
};

const initialState: ScheduleState = { status: "idle", error: null };
const DRAFT_KEY = "koko:appointment:new:draft:v1";
const inputClassName = "min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-base text-on-surface outline-none transition placeholder:text-on-surface-variant focus:border-primary focus:ring-2 focus:ring-secondary/40";

export function AppointmentForm({ appointmentId: initialAppointmentId, texts, successHref, initialClient, initialOrders = [] }: { appointmentId: string; texts: AppointmentFormTexts; successHref?: string; initialClient?: AppointmentClientOption; initialOrders?: readonly AppointmentOrderOption[] }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(scheduleAppointmentAction, initialState);
  const [reconciliation, reconcileAction, isReconciling] = useActionState(reconcileScheduledAppointmentAction, initialCreationReconciliationState);
  const [appointmentId, setAppointmentId] = useState(initialAppointmentId);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AppointmentClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<AppointmentClientOption | null>(initialClient ?? null);
  const [orders, setOrders] = useState<AppointmentOrderOption[]>([...initialOrders]);
  const [orderId, setOrderId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const trimmedSearch = useMemo(() => search.trim(), [search]);
  const outcomeUnknown = state.status === "error" && state.mutationResult === "outcome-unknown";
  const retryConfirmedSafe = reconciliation.status === "absent";
  const mutationBlocked = !hydrated || isReconciling || isMutationSubmissionBlocked(isPending, outcomeUnknown && !retryConfirmedSafe ? "outcome-unknown" : undefined);
  const scheduledAt = date && time ? `${date}T${time}` : "";
  const appointmentIdForForm = state.status === "error" && state.appointmentId ? state.appointmentId : appointmentId;
  const submissionBlocked = mutationBlocked || !selectedClient || !scheduledAt;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = window.sessionStorage.getItem(DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw) as { appointmentId?: string; client?: AppointmentClientOption; date?: string; time?: string; notes?: string; orderId?: string };
          if (typeof draft.appointmentId === "string" && isAppointmentId(draft.appointmentId)) setAppointmentId(draft.appointmentId);
          if (!initialClient && draft.client?.id && draft.client.name) { setSelectedClient(draft.client); setOrdersLoading(true); }
          if (typeof draft.date === "string") setDate(draft.date);
          if (typeof draft.time === "string") setTime(draft.time);
          if (typeof draft.notes === "string") setNotes(draft.notes);
          if (typeof draft.orderId === "string") setOrderId(draft.orderId);
        }
      } catch { /* A malformed local draft must not block scheduling. */ }
      setHydrated(true);
    });
    return () => { active = false; };
  }, [initialClient]);

  useEffect(() => {
    if (!hydrated || state.status === "success" || reconciliation.status === "saved") return;
    try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ appointmentId, client: selectedClient, date, time, notes, orderId })); } catch { /* Scheduling still works without draft storage. */ }
  }, [appointmentId, date, hydrated, notes, orderId, reconciliation.status, selectedClient, state.status, time]);

  useEffect(() => {
    if (state.status !== "success" && reconciliation.status !== "saved") return;
    try { window.sessionStorage.removeItem(DRAFT_KEY); } catch { /* The confirmed save is authoritative. */ }
    if (successHref) router.replace(successHref);
  }, [reconciliation.status, router, state.status, successHref]);

  useEffect(() => {
    if (selectedClient) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/clients/search?search=${encodeURIComponent(trimmedSearch)}`, { signal: controller.signal });
        setResults(response.ok ? ((await response.json()) as ClientSearchPage).items : []);
      } catch { if (!controller.signal.aborted) setResults([]); }
      finally { if (!controller.signal.aborted) setIsLoading(false); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [selectedClient, trimmedSearch]);

  useEffect(() => {
    if (!selectedClient || initialClient?.id === selectedClient.id) return;
    const controller = new AbortController();
    fetch(`/api/clients/${encodeURIComponent(selectedClient.id)}/orders`, { signal: controller.signal })
      .then(async response => response.ok ? (await response.json()) as { items: AppointmentOrderOption[] } : { items: [] })
      .then(page => { if (!controller.signal.aborted) setOrders(page.items); })
      .catch(() => { if (!controller.signal.aborted) setOrders([]); })
      .finally(() => { if (!controller.signal.aborted) setOrdersLoading(false); });
    return () => controller.abort();
  }, [initialClient?.id, selectedClient]);

  function chooseClient(client: AppointmentClientOption) {
    setSelectedClient(client); setSearch(""); setResults([]); setOrders([]); setOrderId(""); setOrdersLoading(true);
  }

  function changeClient() {
    setSelectedClient(null); setOrders([]); setOrderId("");
  }

  function startOver() {
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch { /* Clearing visible fields remains useful when storage is unavailable. */ }
    setAppointmentId(crypto.randomUUID()); setSelectedClient(null); setSearch(""); setResults([]); setOrders([]); setOrderId(""); setDate(""); setTime(""); setNotes(""); setOrdersLoading(false);
    window.location.reload();
  }

  return (
    <section aria-labelledby="new-appointment-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="new-appointment-heading" className="text-xl font-bold tracking-[-0.02em] text-primary">{texts.title}</h2>
        <button className="min-h-11 rounded-full px-3 text-sm font-bold text-primary underline underline-offset-4 hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary" onClick={startOver} type="button">{texts.startOver}</button>
      </div>
      <form action={formAction} className="mt-4 grid gap-4">
        {state.status === "error" && state.error ? <p className="rounded-lg bg-error-container px-4 py-3 text-sm font-medium text-on-error-container" role="alert">{texts.error}</p> : null}
        <input name="client_id" type="hidden" value={selectedClient?.id ?? ""} />
        <input name="appointment_id" type="hidden" value={appointmentIdForForm} />
        <input name="scheduled_at" type="hidden" value={scheduledAt} />

        <div>
          <div className="mb-2 flex items-center justify-between gap-3"><span className="text-sm font-bold text-on-surface">{texts.client}</span><Link className="inline-flex min-h-11 items-center text-sm font-bold text-primary underline underline-offset-4" href="/clients/new?returnTo=%2Fappointments%2Fnew">+ {texts.newClient}</Link></div>
          {selectedClient ? (
            <div className="flex items-center justify-between gap-3 rounded-[14px] bg-secondary-container px-4 py-3 text-on-secondary-container">
              <div className="min-w-0"><p className="truncate text-sm font-bold">{selectedClient.name}</p>{selectedClient.phone ? <p className="mt-0.5 text-xs">{formatPhoneForDisplay(selectedClient.phone)}</p> : null}</div>
              <button className="min-h-11 shrink-0 rounded-full px-3 text-sm font-bold underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-primary" onClick={changeClient} type="button">{texts.changeClient}</button>
            </div>
          ) : (
            <div className="space-y-2">
              <input className={inputClassName} name="client_search" type="search" autoComplete="off" placeholder={texts.searchPlaceholder} value={search} onChange={event => setSearch(event.target.value)} />
              <div className="max-h-48 space-y-1 overflow-y-auto" aria-live="polite">
                {isLoading ? <p className="px-1 py-2 text-sm text-on-surface-variant">{texts.searching}</p> : null}
                {!isLoading && results.length === 0 ? <p className="px-1 py-2 text-sm text-on-surface-variant">{texts.noClients}</p> : null}
                {results.map(client => <button className="min-h-11 w-full rounded-lg px-3 py-2.5 text-left hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary" key={client.id} type="button" onClick={() => chooseClient(client)}><span className="block text-sm font-bold">{client.name}</span>{client.phone ? <span className="text-xs text-on-surface-variant">{formatPhoneForDisplay(client.phone)}</span> : null}</button>)}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-bold text-on-surface">{texts.date}<input className={inputClassName} name="appointment_date" required type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
          <label className="grid gap-1.5 text-sm font-bold text-on-surface">{texts.time}<input className={inputClassName} name="appointment_time" required type="time" value={time} onChange={event => setTime(event.target.value)} /></label>
        </div>

        <label className="grid gap-1.5 text-sm font-bold text-on-surface">{texts.linkedOrder}
          <select className={inputClassName} disabled={!selectedClient || ordersLoading} name="order_id" value={orderId} onChange={event => setOrderId(event.target.value)}>
            <option value="">{ordersLoading ? texts.loadingOrders : texts.noLinkedOrder}</option>
            {orders.map(order => <option key={order.id} value={order.id}>{order.orderNumber} · {texts.orderStatuses[order.status]}</option>)}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-bold text-on-surface">{texts.notes}<textarea className={`${inputClassName} min-h-20 resize-y py-3`} name="notes" placeholder={texts.notesPlaceholder} value={notes} onChange={event => setNotes(event.target.value)} /></label>

        <button className="min-h-12 rounded-lg bg-primary px-5 text-base font-bold text-on-primary shadow-[0_3px_10px_rgba(46,38,31,0.18)] transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" disabled={submissionBlocked} type="submit"><span aria-live="polite">{isPending ? texts.scheduling : texts.schedule}</span></button>
        {outcomeUnknown && !retryConfirmedSafe ? <button className="min-h-11 rounded-lg border border-outline-variant bg-surface-container-lowest px-5 font-bold disabled:opacity-60" disabled={!hydrated || isReconciling} formAction={reconcileAction} type="submit"><span aria-live="polite">{isReconciling ? texts.checkingSaved : texts.checkSaved}</span></button> : null}
        {reconciliation.status === "absent" ? <p role="status" aria-live="polite" className="rounded-lg bg-secondary-container px-4 py-3 text-sm font-medium text-on-secondary-container">{texts.confirmedAbsent}</p> : null}
        {reconciliation.status === "saved" ? <p role="status" aria-live="polite" className="rounded-lg bg-secondary-container px-4 py-3 text-sm font-medium text-on-secondary-container">{texts.confirmedSaved}</p> : null}
        {reconciliation.status === "error" ? <p role="alert" className="rounded-lg bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">{texts.error}</p> : null}
      </form>
    </section>
  );
}

function isAppointmentId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
