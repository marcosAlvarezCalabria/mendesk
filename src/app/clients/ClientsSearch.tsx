"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { formatPhoneForDisplay } from "@/app/_ui/phoneDisplay";
import { buildClientsHref, clientAnchor, parseClientsAnchor, parseClientsPage } from "./clientsHref";
import { withReturnTo } from "@/app/routeContext";
import { createClientsSearchSession } from "./clientsSearchSession";
import { ReadSyncMarker } from "@/app/sync/ReadSyncMarker";

export type ClientListView = { id: string; name: string; phone: string | null; gdprConsent: boolean };
export type ClientListViewPage = { items: ClientListView[]; hasNextPage: boolean };
type ClientsSearchTexts = {
  title: string; searchLabel: string; searchPlaceholder: string; searching: string;
  empty: string; previous: string; next: string; error: string; retry: string;
  newClient: string; clear: string; noResults: string; updated: string;
};
const buttonClass = "min-h-11 rounded-lg border border-outline-variant px-4 py-2 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

export function ClientsSearch({ initialAnchor, initialPage, initialPageNumber, initialQuery, initialError = false, texts }: {
  initialAnchor?: string; initialPage: ClientListViewPage; initialPageNumber: number;
  initialQuery: string; initialError?: boolean; texts: ClientsSearchTexts;
}) {
  const router = useRouter();
  const [session] = useState(() => createClientsSearchSession(
    { query: initialQuery, page: initialPageNumber, anchor: initialAnchor, result: initialPage, error: initialError },
    {
      fetchPage: (url, options) => fetch(url, options),
      authenticate: path => router.replace(`/login?${new URLSearchParams({ next: path })}`),
      replace: path => window.history.replaceState(window.history.state, "", path),
    },
  ));
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  useEffect(() => {
    const route = currentRoute();
    // Ignore a server response for a URL that the user has already left.
    if (route.query === initialQuery.trim() && route.page === initialPageNumber) {
      session.adopt({ query: initialQuery, page: initialPageNumber, anchor: initialAnchor, result: initialPage, error: initialError });
    }
  }, [session, initialQuery, initialPageNumber, initialAnchor, initialPage, initialError]);
  useEffect(() => {
    const onPop = () => session.navigate(currentRoute());
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("popstate", onPop); session.dispose(); };
  }, [session]);
  useEffect(() => {
    if (state.status === "ready" && state.anchor) document.getElementById(state.anchor)?.scrollIntoView({ block: "center" });
  }, [state.status, state.anchor, state.result]);
  const blocked = state.status !== "ready";
  return <>
    {state.status === "ready" && state.readId ? <ReadSyncMarker readId={state.readId} /> : null}
    <div className="sticky top-0 z-10 space-y-3 bg-background py-4">
      <div className="flex flex-wrap justify-end">
        <Link className={buttonClass + " bg-primary text-on-primary"} href={withReturnTo("/clients/new", buildClientsHref({ q: state.query, page: state.page, anchor: state.anchor }))}>{texts.newClient}</Link>
      </div>
      <label className="sr-only" htmlFor="clients-search">{texts.searchLabel}</label>
      <input id="clients-search" name="search" type="search" autoComplete="off" value={state.query}
        onChange={event => session.search(event.target.value)} placeholder={texts.searchPlaceholder}
        className="min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-base text-on-surface placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2" />
    </div>
    <p role="status" aria-live="polite" className="min-h-6 text-body-sm text-on-surface-variant">
      {state.status === "loading" ? texts.searching : state.status === "ready" ? texts.updated : ""}
    </p>
    {state.status === "error" ? <div role="alert" className="my-3 space-y-2">
      <p>{texts.error}</p><button type="button" className={buttonClass} onClick={session.retry}>{texts.retry}</button>
    </div> : null}
    <section aria-label={texts.title} aria-busy={state.status === "loading"} className="min-h-32 divide-y divide-outline-variant rounded-xl bg-surface-container-lowest">
      {state.status === "ready" && state.result.items.length === 0
        ? <div className="space-y-3 p-5"><p>{state.query.trim() ? texts.noResults : texts.empty}</p>
          {state.query.trim() ? <button type="button" className={buttonClass} onClick={() => session.search("")}>{texts.clear}</button> : null}
        </div>
        : state.result.items.map(client => <ClientRow key={client.id} client={client} page={state.page} query={state.query.trim()} disabled={blocked} />)}
    </section>
    <nav aria-label={texts.title} className="mt-4 grid grid-cols-2 gap-3">
      <button type="button" className={buttonClass} disabled={blocked || state.page === 1} onClick={() => session.page(state.page - 1)}>{texts.previous}</button>
      <button type="button" className={buttonClass} disabled={blocked || !state.result.hasNextPage} onClick={() => session.page(state.page + 1)}>{texts.next}</button>
    </nav>
  </>;
}

export function ClientRow({ client, page, query, disabled = false }: { client: ClientListView; page: number; query: string; disabled?: boolean }) {
  const anchor = clientAnchor(client.id);
  const content = <><p className="break-words font-bold">{client.name}</p>{client.phone ? <p className="mt-1 break-words text-body-sm text-on-surface-variant">{formatPhoneForDisplay(client.phone)}</p> : null}</>;
  const className = "block min-h-11 px-4 py-4 text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2";
  if (disabled) return <div id={anchor} aria-disabled="true" className={className + " opacity-60"}>{content}</div>;
  return <Link id={anchor} className={className} href={withReturnTo(`/clients/${client.id}`, buildClientsHref({ q: query, page, anchor }))}>{content}</Link>;
}

function currentRoute() {
  const params = new URLSearchParams(window.location.search);
  const single = (key: string) => params.getAll(key).length === 1 ? params.get(key)! : undefined;
  return { query: single("q")?.trim() ?? "", page: parseClientsPage(single("page")), anchor: parseClientsAnchor(single("anchor")) };
}
