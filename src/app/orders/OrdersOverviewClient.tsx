"use client";

/**
 * THESIS: A compact queue of work to finish and hand over.
 * OWN-WORLD: Warm paper, ink controls and named operational status colors.
 * STORY: Read global attention, narrow the queue, open one job and return in place.
 * FIRST VIEWPORT: Dublin date, three counts, secondary balance, search and job rows.
 * FORM: Existing atelier job board, precisely scoped by the approved R06 contract.
 */
import React, { useEffect, useRef, useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrdersOverview, OrdersOverviewItem, OrdersSelection } from "@/application/dtos/OrdersOverview";
import { dublinOverdueDays, ordersAttention } from "@/application/queries/ordersOverviewRules";
import { dictionaries, type DictKey } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locale";
import { t } from "@/i18n/t";
import { buildOrderDetailHref } from "./orderNavigation";
import { OrderAnchorRestorer, orderAnchor } from "./OrderAnchorRestorer";
import { buildOrdersOverviewHref, parseOrdersOverviewParams, type OrdersOverviewParams } from "./ordersOverviewParams";
import { formatOrdersDate, formatOrdersToday, formatOrdersMoney, formatOrdersGarmentCount, formatOrdersOverdueDays } from "./ordersOverviewFormat";
import { OrdersReadRetry } from "./OrdersReadRetry";
import { useDismissibleDetails } from "./useDismissibleDetails";

const control = "inline-flex min-h-11 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-bold hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const statuses = ["received", "ready", "collected", "cancelled"] as const;
const attentions = ["overdue", "due_today", "due_tomorrow", "ready_for_pickup"] as const;
const attentionColor = { overdue: "text-status-overdue", due_today: "text-status-received", due_tomorrow: "text-secondary", ready_for_pickup: "text-status-ready" };
const statusColor = { received: "text-status-received", ready: "text-status-ready", collected: "text-status-collected", cancelled: "text-status-cancelled" };
const statusBorder = { received: "border-status-received", ready: "border-status-ready", collected: "border-status-collected", cancelled: "border-status-cancelled" };

export function OrdersOverviewClient({ overview, params, locale }: { overview: OrdersOverview; params: OrdersOverviewParams; locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.q);
  const [requested, setRequested] = useState<string | null>(null);
  const applied = buildOrdersOverviewHref(params);
  const [previousApplied, setPreviousApplied] = useState(applied);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const filter = useRef<HTMLDetailsElement>(null);
  const filterButton = useRef<HTMLElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  useDismissibleDetails(filterOpen, filter, filterButton, setFilterOpen);
  if (previousApplied !== applied) {
    setPreviousApplied(applied);
    if (requested === null) setQuery(params.q);
  }
  if (requested === applied && !pending) setRequested(null);

  useEffect(() => {
    function onPopState() {
      clearTimeout(timer.current);
      const search = new URLSearchParams(window.location.search);
      const raw = Object.fromEntries([...new Set(search.keys())].map(key => {
        const values = search.getAll(key);
        return [key, values.length === 1 ? values[0] : values];
      }));
      const next = parseOrdersOverviewParams(raw);
      setQuery(next.q); setRequested(buildOrdersOverviewHref(next));
    }
    window.addEventListener("popstate", onPopState);
    return () => { clearTimeout(timer.current); window.removeEventListener("popstate", onPopState); };
  }, []);

  const text = (key: string) => t(dictionaries[locale], `orders.overview.${key}` as DictKey);
  const busy = pending || query.trim() !== params.q || (requested !== null && requested !== applied);
  const home = params.selection.kind === "active";
  const title = text(params.selection.kind === "active" ? "active" : params.selection.value);
  const page = overview.list.status === "ready" ? overview.list.data : undefined;
  const reset = (selection: OrdersSelection = params.selection, q = query.trim()): OrdersOverviewParams => ({ selection, q, page: 1 });

  function navigate(next: OrdersOverviewParams, replace = false) {
    clearTimeout(timer.current);
    const href = buildOrdersOverviewHref(next);
    setQuery(next.q); setRequested(href);
    if (filter.current) filter.current.open = false;
    setFilterOpen(false);
    startTransition(() => { if (replace) router.replace(href, { scroll: false }); else router.push(href, { scroll: false }); });
  }
  function handleNavigationClick(event: MouseEvent<HTMLAnchorElement>, next: OrdersOverviewParams) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const menu = event.currentTarget?.closest("details");
    if (menu?.open) menu.querySelector("summary")?.focus();
    event.preventDefault(); navigate(next);
  }
  function changeSearch(value: string) {
    setQuery(value); clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(reset(params.selection, value.trim()), true), 180);
  }
  function navigationLink(next: OrdersOverviewParams, label: React.ReactNode, selected = false) {
    return <Link className={control} href={buildOrdersOverviewHref(next)} onClick={event => handleNavigationClick(event, next)} aria-current={selected ? "page" : undefined}>{label}</Link>;
  }
  function readError() {
    return <div role="status" className="rounded-lg border border-outline-variant p-3 text-sm"><p>{text("error")}</p><OrdersReadRetry label={text("retry")} /></div>;
  }

  return <div className="mx-auto w-full max-w-[640px] space-y-4 px-4 pb-6 pt-3">
    <p className="text-sm text-on-surface-variant"><time dateTime={overview.asOf}>{formatOrdersToday(overview.asOf, locale)}</time></p>
    {overview.counts.status === "ready" ? <nav aria-label={text("today")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {attentions.map((attention) => {
          const data = overview.counts.status === "ready" ? overview.counts.data : null;
          const amount = data ? { overdue: data.overdue, due_today: data.dueToday, due_tomorrow: data.dueTomorrow, ready_for_pickup: data.readyForPickup }[attention] : undefined;
          const next = reset({ kind: "attention", value: attention });
          const selected = params.selection.kind === "attention" && params.selection.value === attention;
          return <Link aria-current={selected ? "page" : undefined} key={attention} href={buildOrdersOverviewHref(next)} onClick={event => handleNavigationClick(event, next)} className={`flex min-h-20 flex-col justify-between gap-1 rounded-lg border bg-surface-container-lowest p-3 focus-visible:outline-2 focus-visible:outline-offset-2 ${selected ? "border-primary ring-1 ring-primary" : "border-outline-variant"} ${attentionColor[attention]}`}>
            <span className="break-words text-xs font-bold">{text(attention)}</span><span className="text-2xl font-extrabold tabular-nums">{amount}</span>
          </Link>;
        })}
      </nav> : readError()}
    {home && <>
      <section aria-label={text("toCollect")} className="text-sm">
        {overview.toCollect.status === "error" ? readError() : overview.toCollect.data.status === "ready"
          ? <p>{text("toCollect")} · <span className="font-bold tabular-nums">{formatOrdersMoney(overview.toCollect.data.amountCents, locale)}</span></p>
          : <div role="status"><p>{text("inconsistent")}</p><ul>{overview.toCollect.data.issues.map(issue => <li key={issue.orderId}><Link className="inline-flex min-h-11 items-center underline" href={buildOrderDetailHref(issue.orderNumber, applied)}>{issue.orderNumber} · {text("reviewBalance")}</Link></li>)}</ul></div>}
      </section>
    </>}

    <form action="/orders" method="get" role="search" onSubmit={event => { event.preventDefault(); navigate(reset(), true); }} className="flex gap-2">
      {params.selection.kind === "attention" && <input type="hidden" name="attention" value={params.selection.value} />}
      {params.selection.kind === "status" && <input type="hidden" name="view" value={params.selection.value} />}
      <label className="sr-only" htmlFor="orders-overview-search">{text("search")}</label>
      <input id="orders-overview-search" name="q" type="search" autoComplete="off" value={query} onChange={event => changeSearch(event.target.value)} placeholder={text("searchPlaceholder")} className="min-h-11 min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary" />
      <button className={control} type="submit">{text("search")}</button>
    </form>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-extrabold">{title}{page && !busy ? ` · ${page.totalCount}` : ""}</h2>
      <details ref={filter} onToggle={event => setFilterOpen(event.currentTarget.open)} className="relative">
        <summary ref={filterButton} className={`${control} cursor-pointer list-none`} aria-expanded={filterOpen}>{text("filter")}</summary>
        <nav aria-label={text("filter")} className="absolute right-0 z-20 mt-2 flex min-w-40 flex-col gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest p-2">
          {statuses.map(status => <React.Fragment key={status}>{navigationLink(reset({ kind: "status", value: status }), text(status), params.selection.kind === "status" && params.selection.value === status)}</React.Fragment>)}
        </nav>
      </details>
    </div>
    {!home && navigationLink(reset({ kind: "active" }), text("showAll"))}
    <p role="status" aria-live="polite" aria-atomic="true" className="min-h-5 text-sm text-on-surface-variant">{busy ? text("searching") : !page ? text("error") : page.items.length === 0 ? text(params.q ? "emptySearch" : home ? "emptyActive" : "emptyFilter") : `${title} · ${page.totalCount}`}</p>
    <section aria-label={title} aria-busy={busy} inert={busy} className={`space-y-2 ${busy ? "opacity-50" : ""}`}>
      <OrderAnchorRestorer anchor={busy ? undefined : params.anchor} />
      {!page ? readError() : page.items.length === 0 ? <div className="rounded-lg border border-outline-variant p-5">
        <p>{text(params.q ? "emptySearch" : home ? "emptyActive" : "emptyFilter")}</p>
        {params.q ? navigationLink(reset(params.selection, ""), text("clearSearch")) : home ? <Link href="/orders/new" className={control}>{text("newOrder")}</Link> : null}
      </div> : page.items.map(order => <OrderRow key={order.id} order={order} params={params} now={overview.asOf} locale={locale} />)}
    </section>
    {(params.page > 1 || page?.hasNextPage) && <nav aria-label={text("pagination")} inert={busy} className="flex flex-wrap justify-between gap-2">
      {params.page > 1 ? navigationLink({ ...params, anchor: undefined, page: params.page - 1 }, text("previous")) : <span />}
      {page?.hasNextPage && navigationLink({ ...params, anchor: undefined, page: params.page + 1 }, text("next"))}
    </nav>}
  </div>;
}

function OrderRow({ order, params, now, locale }: { order: OrdersOverviewItem; params: OrdersOverviewParams; now: string; locale: Locale }) {
  const text = (key: string) => t(dictionaries[locale], `orders.overview.${key}` as DictKey);
  const attention = ordersAttention(order.status, new Date(order.dueDate), new Date(now));
  const overdue = attention === "overdue";
  const returnTo = buildOrdersOverviewHref({ ...params, anchor: orderAnchor(order.id) });
  return <article id={orderAnchor(order.id)} className={`rounded-lg border-2 bg-surface-container-lowest ${overdue ? "border-status-overdue" : statusBorder[order.status]}`}>
    <Link href={buildOrderDetailHref(order.orderNumber, returnTo)} className="block rounded-lg p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 break-words font-extrabold">{order.clientName}</h3>
        <span className="text-sm font-bold tabular-nums">{order.balance.status === "inconsistent" ? text("reviewBalance") : order.balance.outstandingCents === 0 ? text("paidAmount").replace("{amount}", formatOrdersMoney(order.balance.paidCents, locale)) : `${text("outstanding")} ${formatOrdersMoney(order.balance.outstandingCents, locale)}`}</span></div>
      <p className="mt-1 text-xs text-on-surface-variant">{order.orderNumber} · {formatOrdersGarmentCount(order.garmentCount, locale)}</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-2 text-sm">
        <span className={`font-bold ${statusColor[order.status]}`}>{text(order.status)}</span>
        <div className="grid grid-cols-2 gap-x-4 text-right text-xs text-on-surface-variant">
          <time dateTime={order.receivedDate}>{text("receivedOn")} {formatOrdersDate(order.receivedDate, locale)}</time>
          <time dateTime={order.dueDate}>{text("dueDate")} {formatOrdersDate(order.dueDate, locale)}</time>
        </div>
      </div>
      {overdue && <p className="mt-1 text-sm font-bold text-status-overdue">{text("overdue")} · {formatOrdersOverdueDays(dublinOverdueDays(new Date(order.dueDate), new Date(now)), locale)}</p>}
    </Link>
  </article>;
}
