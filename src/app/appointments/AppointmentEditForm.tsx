"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/app/_ui/Icon";
import { updateAppointmentDetailsAction, type EditAppointmentState } from "@/app/appointments/actions";
import type { AppointmentOrderOption } from "@/app/appointments/AppointmentForm";
import type { OrderStatusValue } from "@/domain/values/OrderStatus";

const initialState: EditAppointmentState = { status: "idle", error: null };
const inputClassName = "form-input";

export type AppointmentEditTexts = {
  title: string;
  date: string;
  time: string;
  linkedOrder: string;
  noLinkedOrder: string;
  loadingOrders: string;
  notes: string;
  notesPlaceholder: string;
  save: string;
  saving: string;
  saved: string;
  unsaved: string;
  error: string;
  orderStatuses: Record<OrderStatusValue, string>;
};

type Values = { date: string; time: string; orderId: string; notes: string };

export function AppointmentEditForm({
  appointmentId,
  clientId,
  initialValues,
  initialOrders,
  texts,
}: {
  appointmentId: string;
  clientId: string;
  initialValues: Values;
  initialOrders: readonly AppointmentOrderOption[];
  texts: AppointmentEditTexts;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateAppointmentDetailsAction, initialState);
  const [values, setValues] = useState(initialValues);
  const [orders, setOrders] = useState<AppointmentOrderOption[]>([...initialOrders]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const scheduledAt = values.date && values.time ? `${values.date}T${values.time}` : "";
  const saved = state.status === "success"
    ? { dateTime: state.saved.scheduledAt, orderId: state.saved.orderId, notes: state.saved.notes }
    : { dateTime: `${initialValues.date}T${initialValues.time}`, orderId: initialValues.orderId, notes: initialValues.notes };
  const dirty = scheduledAt !== saved.dateTime || values.orderId !== saved.orderId || values.notes.trim() !== saved.notes.trim();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/clients/${encodeURIComponent(clientId)}/orders`, { signal: controller.signal })
      .then(async response => response.ok ? (await response.json()) as { items: AppointmentOrderOption[] } : { items: [] })
      .then(page => { if (!controller.signal.aborted) setOrders(page.items); })
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setOrdersLoading(false); });
    return () => controller.abort();
  }, [clientId]);

  useEffect(() => {
    if (!dirty || isPending) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, isPending]);

  useEffect(() => {
    if (state.status !== "success") return;
    router.refresh();
  }, [router, state.status]);

  return (
    <details className="group mt-3 rounded-xl border border-outline-variant/60 px-2" name="appointment-detail-editor">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-sm font-bold text-primary outline-none hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-secondary [&::-webkit-details-marker]:hidden">
        <Icon className="size-4" name="edit" />
        <span>{texts.title}</span>
      </summary>
      <form action={formAction} className="grid gap-3 border-t border-outline-variant/40 px-1 pb-3 pt-3 sm:grid-cols-2">
        <input name="appointment_id" type="hidden" value={appointmentId} />
        <input name="expected_scheduled_at" type="hidden" value={saved.dateTime} />
        <input name="expected_order_id" type="hidden" value={saved.orderId} />
        <input name="expected_notes" type="hidden" value={saved.notes} />
        <input name="scheduled_at" type="hidden" value={scheduledAt} />
        <label className="grid gap-1.5 text-sm font-bold text-on-surface-variant">
          {texts.date}
          <input className={inputClassName} disabled={isPending} required type="date" value={values.date} onChange={event => setValues(current => ({ ...current, date: event.target.value }))} />
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-on-surface-variant">
          {texts.time}
          <input className={inputClassName} disabled={isPending} required type="time" value={values.time} onChange={event => setValues(current => ({ ...current, time: event.target.value }))} />
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-on-surface-variant sm:col-span-2">
          {texts.linkedOrder}
          <select className={inputClassName} disabled={isPending || ordersLoading} name="order_id" value={values.orderId} onChange={event => setValues(current => ({ ...current, orderId: event.target.value }))}>
            <option value="">{ordersLoading ? texts.loadingOrders : texts.noLinkedOrder}</option>
            {orders.map(order => <option key={order.id} value={order.id}>{order.orderNumber} · {texts.orderStatuses[order.status]}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-on-surface-variant sm:col-span-2">
          {texts.notes}
          <textarea className={`${inputClassName} min-h-20 resize-y py-3`} disabled={isPending} name="notes" placeholder={texts.notesPlaceholder} value={values.notes} onChange={event => setValues(current => ({ ...current, notes: event.target.value }))} />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button className="min-h-11 rounded-lg bg-primary px-5 text-sm font-bold text-on-primary focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:opacity-50" disabled={!dirty || isPending || !scheduledAt} type="submit">
            {isPending ? texts.saving : state.status === "success" && !dirty ? texts.saved : texts.save}
          </button>
          {dirty && !isPending ? <p className="text-sm font-semibold text-status-received" role="status">{texts.unsaved}</p> : null}
        </div>
        {state.status === "error" ? <p className="rounded-lg bg-error-container px-4 py-3 text-sm font-medium text-on-error-container sm:col-span-2" role="alert">{texts.error}</p> : null}
      </form>
    </details>
  );
}
