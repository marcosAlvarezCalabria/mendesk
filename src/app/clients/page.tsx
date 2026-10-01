import { redirect } from "next/navigation";

import { AppHeader } from "@/app/_ui/AppHeader";
import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { ClientsSearch, type ClientListView } from "@/app/clients/ClientsSearch";
import { buildClientsHref, parseClientsAnchor, parseClientsPage } from "@/app/clients/clientsHref";
import { isAuthError } from "@/infrastructure/auth/authError";
import type { ClientListItem } from "@/application/dtos/ClientListItem";
import type { ClientListPage } from "@/application/ports/ClientListReader";
import { ListClients } from "@/application/useCases/ListClients";
import { makeClientListReader } from "@/composition/directus";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { ReadSyncMarker } from "@/app/sync/ReadSyncMarker";
import { t } from "@/i18n/t";

type ClientsPageProps = {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[]; anchor?: string | string[] }>;
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const q = (readParam(params.q) ?? "").trim();
  const page = parseClientsPage(readParam(params.page));
  const anchor = parseClientsAnchor(readParam(params.anchor));
  const path = buildClientsHref({ q, page, anchor });
  const token = await getSessionToken();

  if (!token) {
    redirect(`/login?${new URLSearchParams({ next: path })}`);
  }

  const locale = await getLocale();
  const dict = dictionaries[locale];
  let clients: ClientListPage = { items: [], hasNextPage: false };
  let initialError = false;
  try { clients = await new ListClients(makeClientListReader(token)).execute({ page, search: q }); }
  catch (error) {
    if (isAuthError(error)) return redirectToLoginForAuthError(error, path);
    initialError = true;
  }

  return (
    <main className="min-h-screen bg-background text-on-surface">
      {initialError ? null : <ReadSyncMarker readId={crypto.randomUUID()} />}
      <AppHeader title={t(dict, "clients.title")} />
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-[720px] flex-col px-margin-mobile pb-8">
        <ClientsSearch
          initialError={initialError}
          initialAnchor={anchor}
          initialPage={{ items: clients.items.map(toClientListView), hasNextPage: clients.hasNextPage }}
          initialPageNumber={page}
          initialQuery={q}
          texts={{
            title: t(dict, "clients.title"),
            searchLabel: t(dict, "clients.search.label"),
            searchPlaceholder: t(dict, "clients.search.placeholder"),
            searching: t(dict, "clients.search.updating"),
            updated: t(dict, "clients.search.updated"),
            error: t(dict, "clients.search.error"),
            retry: t(dict, "clients.search.retry"),
            clear: t(dict, "clients.search.clear"),
            noResults: t(dict, "clients.search.noResults"),
            newClient: t(dict, "clients.new.title"),
            empty: t(dict, "clients.empty"),
            previous: t(dict, "clients.pagination.previous"),
            next: t(dict, "clients.pagination.next"),
          }}
        />
      </div>
    </main>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? undefined : value;
}

function toClientListView(client: ClientListItem): ClientListView {
  return { id: client.id, name: client.name, phone: client.phone?.value ?? null, gdprConsent: client.gdprConsent };
}
