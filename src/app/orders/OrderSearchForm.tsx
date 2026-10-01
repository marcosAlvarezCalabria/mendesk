"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/app/_ui/Card";
import { Icon } from "@/app/_ui/Icon";
import type { OrderListView } from "@/app/orders/orderListView";
import { buildOrdersHref } from "@/app/orders/ordersHref";
import type { OrderDateFilter } from "@/domain/orders/orderDateFilter";

const REACTIVE_SEARCH_DELAY_MS = 180;

export type OrderSearchFormTexts = {
  label: string;
  placeholder: string;
  submit: string;
  searching: string;
};

export function OrderSearchForm({
  view,
  date,
  initialQuery,
  texts,
}: {
  view: OrderListView;
  date: OrderDateFilter;
  initialQuery: string;
  texts: OrderSearchFormTexts;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const lastRequestedQuery = useRef(initialQuery.trim());

  useEffect(() => {
    const nextQuery = query.trim();

    if (nextQuery === lastRequestedQuery.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      lastRequestedQuery.current = nextQuery;
      startTransition(() => {
        router.replace(buildOrdersHref({ view, date, q: nextQuery }), { scroll: false });
      });
    }, REACTIVE_SEARCH_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [date, query, router, view]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    lastRequestedQuery.current = nextQuery;
    startTransition(() => {
      router.replace(buildOrdersHref({ view, date, q: nextQuery }), { scroll: false });
    });
  }

  return (
    <Card as="div" className="rounded-xl p-2 shadow-[0_4px_20px_0_rgba(0,0,0,0.04)]">
      <form action="/orders" className="flex min-w-0 items-center gap-2" method="get" onSubmit={submitSearch} role="search">
        <input name="view" type="hidden" value={view} />
        <input name="date" type="hidden" value={date} />
        <Icon name="search" className="ml-2 shrink-0 text-outline" />
        <label className="sr-only" htmlFor="orders-search">
          {texts.label}
        </label>
        <input
          aria-busy={isPending}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-body-md text-on-surface outline-none placeholder:text-on-surface-variant focus-visible:ring-0"
          enterKeyHint="search"
          id="orders-search"
          name="q"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={texts.placeholder}
          type="search"
          value={query}
        />
        <button
          aria-label={texts.submit}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-wait disabled:opacity-70"
          disabled={isPending}
          type="submit"
        >
          <Icon name={isPending ? "progress_activity" : "search"} className={isPending ? "animate-spin" : undefined} />
        </button>
        <span aria-live="polite" className="sr-only">
          {isPending ? texts.searching : ""}
        </span>
      </form>
    </Card>
  );
}
