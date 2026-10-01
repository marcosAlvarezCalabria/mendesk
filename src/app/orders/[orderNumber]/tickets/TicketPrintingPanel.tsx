"use client";

import Link from "next/link";
import { useState } from "react";

import { formatShortDate } from "@/app/_ui/dateFormat";
import {
  createTicketPrintState,
  retryTicketIndexes,
  startTicketJob,
  toggleTicket,
  type TicketPrintState,
} from "@/app/orders/[orderNumber]/tickets/ticketPrintState";
import type { TicketData } from "@/domain/orders/buildTicket";
import {
  BluetoothNotSupportedError,
  WebBluetoothTicketPrinter,
} from "@/infrastructure/printing/WebBluetoothTicketPrinter";
import type { Locale } from "@/i18n/locale";

type SerializableTicketData = Omit<TicketData, "dueDate"> & { dueDate: string };

export type TicketView = {
  ticket: SerializableTicketData;
  qrSvg: string;
};

type TicketLabels = {
  client: string;
  garment: string;
  alteration: string;
  measurements: string;
  due: string;
  price: string;
  deposit: string;
  outstanding: string;
};

const copy = {
  en: {
    title: "Print garment tickets",
    back: "Back to order",
    queue: "Print queue",
    selected: "selected",
    printSelected: "Print selected",
    printOne: "Print one",
    browser: "Print from browser",
    notConnected: "Not connected",
    connecting: "Connecting…",
    ready: "Thermal printer ready",
    printing: "Printing",
    of: "of",
    unsupported: "Bluetooth is not supported. Use Print from browser.",
    cancelled: "Printer selection was cancelled.",
    failed: "Printer disconnected. Retry the remaining tickets.",
    success: "Tickets printed",
    error: "Printing stopped",
    retry: "Retry remaining",
    none: "Select at least one garment.",
    empty: "There are no garment tickets to print.",
    printable: "Printable garment tickets",
  },
  uk: {
    title: "Друк квитанцій для виробів",
    back: "Назад до замовлення",
    queue: "Черга друку",
    selected: "вибрано",
    printSelected: "Друкувати вибрані",
    printOne: "Друкувати одну",
    browser: "Друк із браузера",
    notConnected: "Не підключено",
    connecting: "Підключення…",
    ready: "Термопринтер готовий",
    printing: "Друк",
    of: "із",
    unsupported: "Bluetooth не підтримується. Використайте друк із браузера.",
    cancelled: "Вибір принтера скасовано.",
    failed: "Принтер відключено. Повторіть друк решти квитанцій.",
    success: "Квитанції надруковано",
    error: "Друк зупинено",
    retry: "Повторити решту",
    none: "Виберіть принаймні один виріб.",
    empty: "Немає квитанцій для друку.",
    printable: "Квитанції для друку",
  },
} as const;

export function TicketPrintingPanel({
  tickets,
  labels,
  locale,
  returnTo,
}: {
  tickets: readonly TicketView[];
  labels: TicketLabels;
  locale: Locale;
  returnTo: string;
}) {
  const text = copy[locale];
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAllowed, setRetryAllowed] = useState(true);
  const [state, setState] = useState<TicketPrintState>(() =>
    createTicketPrintState(tickets.length),
  );
  const selectedIndexes = state.selected.flatMap((selected, index) =>
    selected ? [index] : [],
  );
  const busy = ["connecting", "ready", "printing"].includes(state.phase);

  async function printThermal(indexes: readonly number[]) {
    setErrorMessage(null);
    setRetryAllowed(true);
    if (indexes.length === 0 || busy) return;

    let confirmed = 0;
    setState((current) => startTicketJob(current, indexes));

    try {
      await new WebBluetoothTicketPrinter().print(
        indexes.map((index) => toTicketData(tickets[index].ticket)),
        {
          onReady: async () => {
            setState((current) => ({ ...current, phase: "ready" }));
            await waitForPaint();
          },
          onTicketStarted: () =>
            setState((current) => ({ ...current, phase: "printing" })),
          onTicketPrinted: () => {
            confirmed += 1;
            setState((current) => ({
              ...current,
              confirmed,
              phase: confirmed === indexes.length ? "success" : "printing",
            }));
          },
        },
      );
    } catch (error) {
      setErrorMessage(getPrintErrorMessage(error, text));
      setRetryAllowed(!(error instanceof BluetoothNotSupportedError));
      setState((current) => ({
        ...current,
        job: [...indexes],
        confirmed,
        phase: "error",
      }));
    }
  }

  function printBrowser() {
    if (selectedIndexes.length > 0) window.print();
  }

  return (
    <>
      <header className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <div className="min-w-0">
          <p className="font-wordmark text-[1.0625rem] font-medium leading-none text-secondary">
            Koko Atelier
          </p>
          <h1 className="truncate text-xl font-extrabold text-on-surface">{text.title}</h1>
        </div>
        <Link
          className="min-h-11 shrink-0 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm font-bold text-on-surface transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background"
          href={returnTo}
        >
          {text.back}
        </Link>
      </header>

      {tickets.length === 0 ? (
        <p className="rounded-[10px] border border-outline-variant bg-surface-container-lowest px-5 py-8 text-center text-sm font-medium text-on-surface-variant shadow-sm print:hidden">
          {text.empty}
        </p>
      ) : (
        <>
          <section className="overflow-hidden rounded-[10px] border border-outline-variant bg-surface-container-lowest shadow-sm print:hidden">
            <div className="border-b border-outline-variant bg-surface-container-lowest px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div>
                  <h2 className="font-extrabold text-on-surface">{text.queue}</h2>
                  <p className="mt-0.5 text-sm text-on-surface-variant">
                    {selectedIndexes.length}/{tickets.length} {text.selected}
                  </p>
                </div>
                <PrinterStatus errorMessage={errorMessage} state={state} text={text} />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  className="min-h-11 rounded-full bg-primary px-4 py-3 text-sm font-bold text-on-primary transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface-container-lowest disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={busy || selectedIndexes.length === 0}
                  onClick={() => void printThermal(selectedIndexes)}
                  type="button"
                >
                  {text.printSelected} ({selectedIndexes.length})
                </button>
                <button
                  className="min-h-11 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm font-bold text-on-surface transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-surface-container-lowest disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={busy || selectedIndexes.length === 0}
                  onClick={printBrowser}
                  type="button"
                >
                  {text.browser}
                </button>
              </div>

              {state.phase === "error" && retryAllowed && retryTicketIndexes(state).length > 0 ? (
                <button
                  className="mt-2 min-h-11 w-full rounded-full bg-error-container px-4 py-3 text-sm font-bold text-on-error-container transition hover:bg-error-container/80 focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2 focus:ring-offset-surface-container-lowest"
                  onClick={() => void printThermal(retryTicketIndexes(state))}
                  type="button"
                >
                  {text.retry} ({retryTicketIndexes(state).length})
                </button>
              ) : null}
            </div>

            <ul className="divide-y divide-outline-variant">
              {tickets.map(({ ticket }, index) => (
                <li className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-5" key={`${ticket.orderNumber}-${index}`}>
                  <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg focus-within:ring-2 focus-within:ring-secondary focus-within:ring-offset-2">
                    <input
                      checked={state.selected[index]}
                      className="h-5 w-5 shrink-0 accent-primary"
                      disabled={busy}
                      onChange={() => setState((current) => toggleTicket(current, index))}
                      type="checkbox"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-extrabold text-on-surface">
                        {ticket.garmentDescription}
                      </span>
                      <span className="block truncate text-xs font-medium text-on-surface-variant">
                        {formatAlterationLabel(ticket.alterationType, locale)} · €{ticket.price}
                      </span>
                    </span>
                  </label>
                  <button
                    className="min-h-11 shrink-0 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-bold text-on-surface transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={busy}
                    onClick={() => void printThermal([index])}
                    type="button"
                  >
                    {text.printOne}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {selectedIndexes.length === 0 ? (
            <p className="mt-3 text-center text-sm font-bold text-secondary print:hidden">
              {text.none}
            </p>
          ) : null}

          <section className="hidden print:block" aria-label={text.printable}>
            {tickets.map(({ ticket, qrSvg }, index) => (
              <TicketCard
                key={`${ticket.orderNumber}-${index}`}
                labels={labels}
                locale={locale}
                qrSvg={qrSvg}
                selected={state.selected[index]}
                ticket={ticket}
              />
            ))}
          </section>
        </>
      )}
    </>
  );
}

function PrinterStatus({
  state,
  text,
  errorMessage,
}: {
  state: TicketPrintState;
  text: (typeof copy)[Locale];
  errorMessage: string | null;
}) {
  let label: string = text.notConnected;
  if (state.phase === "connecting") label = text.connecting;
  if (state.phase === "ready") label = text.ready;
  if (state.phase === "printing") label = `${text.printing} ${state.confirmed + 1} ${text.of} ${state.job.length}`;
  if (state.phase === "success") label = `${text.success}: ${state.confirmed}/${state.job.length}`;
  if (state.phase === "error") label = errorMessage ?? `${text.error}: ${state.confirmed}/${state.job.length}`;

  const dot = state.phase === "ready" || state.phase === "success"
    ? "bg-status-ready"
    : state.phase === "error"
      ? "bg-error"
      : "bg-outline";

  return (
    <p
      className="flex min-h-7 w-fit max-w-full items-center gap-2 whitespace-normal rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-on-surface"
      role={state.phase === "error" ? "alert" : "status"}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </p>
  );
}

function TicketCard({
  ticket,
  qrSvg,
  labels,
  locale,
  selected,
}: {
  ticket: SerializableTicketData;
  qrSvg: string;
  labels: TicketLabels;
  locale: Locale;
  selected: boolean;
}) {
  if (!selected) return null;

  return (
    <article className="mx-auto w-full max-w-[78mm] break-after-page overflow-hidden bg-white px-4 py-5 text-black last:break-after-auto">
      <div className="text-center">
        <p className="text-lg font-bold">Koko Atelier</p>
        <p className="mt-1 text-sm font-semibold">{ticket.orderNumber}</p>
      </div>

      <dl className="mt-4 min-w-0 space-y-2 text-sm">
        <TicketRow label={labels.client} value={ticket.clientName} />
        <TicketRow label={labels.garment} value={ticket.garmentDescription} />
        <TicketRow label={labels.alteration} value={formatAlterationLabel(ticket.alterationType, locale)} />
        {ticket.measurements ? <TicketRow label={labels.measurements} value={ticket.measurements} /> : null}
        <TicketRow label={labels.due} value={formatShortDate(new Date(ticket.dueDate), locale)} />
        <TicketRow label={labels.price} value={`€${ticket.price}`} />
        <TicketRow label={labels.deposit} value={`€${ticket.depositPaid}`} />
        <TicketRow label={labels.outstanding} value={`€${ticket.outstanding}`} />
      </dl>

      <div className="mt-4 flex justify-center" dangerouslySetInnerHTML={{ __html: qrSvg }} />
    </article>
  );
}

function TicketRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,78px)_minmax(0,1fr)] items-start gap-2">
      <dt className="min-w-0 break-words font-semibold text-slate-600">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words font-medium text-slate-950 [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

function formatAlterationLabel(value: TicketData["alterationType"], locale: Locale): string {
  const labels: Record<TicketData["alterationType"], Record<Locale, string>> = {
    hem: { en: "Hem", uk: "Підгин" }, waist: { en: "Waist", uk: "Талія" },
    zipper: { en: "Zipper", uk: "Блискавка" }, sleeves: { en: "Sleeves", uk: "Рукави" },
    take_in: { en: "Take in", uk: "Звуження" }, other: { en: "Other", uk: "Інше" },
  };
  return labels[value][locale];
}

function toTicketData(ticket: SerializableTicketData): TicketData {
  return { ...ticket, dueDate: new Date(ticket.dueDate) };
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
}

function getPrintErrorMessage(error: unknown, text: (typeof copy)[Locale]): string {
  if (error instanceof BluetoothNotSupportedError) return text.unsupported;
  if (
    error instanceof DOMException
    && ["NotFoundError", "NotAllowedError"].includes(error.name)
  ) {
    return text.cancelled;
  }
  return text.failed;
}
