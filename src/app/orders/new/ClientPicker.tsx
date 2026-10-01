"use client";

import { useEffect, useMemo, useState } from "react";

import { formatPhoneForDisplay } from "@/app/_ui/phoneDisplay";
import type { ExistingClientMatch } from "@/app/orders/new/newClientLookup";
import { shouldChangeClientMode, type ClientStepSnapshot } from "@/app/orders/new/newOrderFlow";

type ClientMode = "existing" | "new";
type ClientSearchStatus = "loading" | "success" | "error";
type ClientSearchResult = { id: string; name: string; phone: string | null };
type ClientSearchPage = { items: ClientSearchResult[]; hasNextPage: boolean };

export type ClientPickerTexts = {
  title: string;
  existingClient: string;
  newClient: string;
  searchClient: string;
  searchPlaceholder: string;
  selected: string;
  changeClient: string;
  searching: string;
  noClients: string;
  searchError: string;
  retrySearch: string;
  existingPhoneFound: string;
  useExistingClient: string;
  name: string;
  namePlaceholder: string;
  phone: string;
  phonePlaceholder: string;
  gdpr: string;
};

export type ClientPickerSelection = ClientStepSnapshot & {
  label: string;
};

type ClientPickerProps = {
  texts: ClientPickerTexts;
  onSelectionChange: (selection: ClientPickerSelection) => void;
  phoneError: string | null;
  existingClientMatch: ExistingClientMatch | null;
};

export function ClientPicker({ texts, onSelectionChange, phoneError, existingClientMatch }: ClientPickerProps) {
  const [mode, setMode] = useState<ClientMode>("existing");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [hasConsent, setHasConsent] = useState(false);
  const [searchStatus, setSearchStatus] = useState<ClientSearchStatus>("loading");
  const [searchRevision, setSearchRevision] = useState(0);

  const trimmedSearch = useMemo(() => search.trim(), [search]);

  useEffect(() => {
    onSelectionChange({
      mode,
      clientId: selectedClient?.id ?? "",
      name,
      phone: mode === "existing" ? selectedClient?.phone ?? "" : phone,
      hasConsent,
      label: mode === "existing" ? selectedClient?.name ?? "" : name.trim(),
    });
  }, [hasConsent, mode, name, onSelectionChange, phone, selectedClient]);

  useEffect(() => {
    if (mode !== "existing") {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/clients/search?search=${encodeURIComponent(trimmedSearch)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Client search failed");
        }

        if (!controller.signal.aborted) {
          setResults(((await response.json()) as ClientSearchPage).items);
          setSearchStatus("success");
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearchStatus("error");
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [mode, searchRevision, trimmedSearch]);

  function changeMode(nextMode: ClientMode) {
    if (!shouldChangeClientMode(mode, nextMode)) {
      return;
    }

    if (nextMode === "existing") {
      setResults([]);
      setSelectedClient(null);
      setSearchStatus("loading");
    }

    setMode(nextMode);
  }

  return (
    <section aria-labelledby="client-picker-heading" className="rounded-xl bg-surface-container-lowest p-card-padding">
      <h2 className="text-title-md text-on-surface" id="client-picker-heading">{texts.title}</h2>
      <input name="client_mode" type="hidden" value={mode} />
      <input name="client_id" type="hidden" value={selectedClient?.id ?? ""} />

      <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-surface-container p-1" role="group" aria-label={texts.title}>
        <button aria-pressed={mode === "existing"} className={mode === "existing" ? activeModeClassName : inactiveModeClassName} type="button" onClick={() => changeMode("existing")}>
          {texts.existingClient}
        </button>
        <button aria-pressed={mode === "new"} className={mode === "new" ? activeModeClassName : inactiveModeClassName} type="button" onClick={() => changeMode("new")}>
          {texts.newClient}
        </button>
      </div>

      {mode === "existing" ? (
        <div className="mt-5 grid gap-3">
          {selectedClient ? (
            <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-secondary-container px-4 py-3 text-on-secondary-container" role="status">
              <span className="min-w-0">
                <span className="block text-label-sm">{texts.selected}</span>
                <span className="mt-1 block truncate font-semibold">{selectedClient.name}{selectedClient.phone ? ` · ${formatPhoneForDisplay(selectedClient.phone)}` : ""}</span>
              </span>
              <button
                className="min-h-11 shrink-0 rounded-full px-3 text-label-md font-semibold text-secondary underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-secondary"
                type="button"
                onClick={() => {
                  setSelectedClient(null);
                  setSearch("");
                  setResults([]);
                  setSearchStatus("loading");
                  setSearchRevision((revision) => revision + 1);
                }}
              >
                {texts.changeClient}
              </button>
            </div>
          ) : (
            <>
              <label className="grid gap-2 text-label-sm text-on-surface-variant">
                {texts.searchClient}
                <input
                  className="form-input"
                  name="client_search"
                  type="search"
                  autoComplete="off"
                  placeholder={texts.searchPlaceholder}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setResults([]);
                    setSearchStatus("loading");
                  }}
                />
              </label>

              <div aria-live="polite">
                {searchStatus === "loading" ? <p className="py-2 text-body-sm text-on-surface-variant">{texts.searching}</p> : null}
                {searchStatus === "success" && results.length === 0 ? <p className="py-2 text-body-sm text-on-surface-variant">{texts.noClients}</p> : null}
                {searchStatus === "error" ? (
                  <div className="rounded-xl border border-error/30 bg-error-container p-4 text-body-sm text-on-error-container" role="alert">
                    <p>{texts.searchError}</p>
                    <button
                      className="mt-3 min-h-11 rounded-lg bg-error px-4 text-label-md text-on-error focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-error-container"
                      type="button"
                      onClick={() => {
                        setResults([]);
                        setSearchStatus("loading");
                        setSearchRevision((revision) => revision + 1);
                      }}
                    >
                      {texts.retrySearch}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2" aria-busy={searchStatus === "loading"}>
                {results.map((client) => (
                  <button
                    className="min-h-14 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-left transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background"
                    key={client.id}
                    type="button"
                    onClick={() => setSelectedClient(client)}
                  >
                    <span className="block text-label-lg text-on-surface">{client.name}</span>
                    {client.phone ? <span className="mt-1 block text-body-sm text-on-surface-variant">{formatPhoneForDisplay(client.phone)}</span> : null}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-label-sm text-on-surface-variant">
            {texts.name}
            <input className="form-input" name="name" required type="text" autoComplete="name" placeholder={texts.namePlaceholder} value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label className="grid gap-2 text-label-sm text-on-surface-variant">
            <span>{texts.phone}</span>
            <input aria-describedby={phoneError ? "new-order-phone-error" : undefined} aria-invalid={phoneError ? true : undefined} className="form-input" id="new-order-phone" name="phone" required type="tel" autoComplete="tel" inputMode="tel" placeholder={texts.phonePlaceholder} value={phone} onChange={(event) => setPhone(event.target.value)} />
            {phoneError ? <span className="text-body-sm text-error" id="new-order-phone-error" role="alert">{phoneError}</span> : null}
          </label>

          {existingClientMatch ? (
            <ExistingClientMatchNotice
              client={existingClientMatch}
              texts={texts}
              onUse={() => {
                  setMode("existing");
                  setSelectedClient(existingClientMatch);
                  setSearch(existingClientMatch.phone);
                  setResults([existingClientMatch]);
                  setSearchStatus("success");
              }}
            />
          ) : null}

          <label className="flex min-h-14 items-start gap-3 rounded-xl border border-outline-variant p-4 text-body-sm text-on-surface-variant">
            <input className="mt-0.5 size-6 shrink-0 accent-secondary" checked={hasConsent} name="gdpr" required type="checkbox" onChange={(event) => setHasConsent(event.target.checked)} />
            <span>{texts.gdpr}</span>
          </label>
        </div>
      )}
    </section>
  );
}

const activeModeClassName =
  "min-h-12 rounded-lg bg-primary px-3 text-label-md text-on-primary focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2";
const inactiveModeClassName =
  "min-h-12 rounded-lg px-3 text-label-md text-on-surface-variant transition hover:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2";

export function ExistingClientMatchNotice({
  client,
  onUse,
  texts,
}: {
  client: ExistingClientMatch;
  onUse: () => void;
  texts: Pick<ClientPickerTexts, "existingPhoneFound" | "useExistingClient">;
}) {
  return (
    <div className="rounded-xl bg-secondary-container p-4 text-body-sm text-on-secondary-container" role="alert">
      <p>{texts.existingPhoneFound.replace("{name}", client.name)}</p>
      <button
        className="mt-3 min-h-11 rounded-full bg-primary px-4 text-label-md font-semibold text-on-primary focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-secondary-container"
        data-use-existing-client="true"
        type="button"
        onClick={onUse}
      >
        {texts.useExistingClient}
      </button>
    </div>
  );
}
