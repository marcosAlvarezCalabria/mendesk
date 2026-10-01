"use client";

import { useState } from "react";

import type { TicketData } from "@/domain/orders/buildTicket";
import { WebBluetoothTicketPrinter } from "@/infrastructure/printing/WebBluetoothTicketPrinter";

type SerializableTicketData = Omit<TicketData, "dueDate"> & { dueDate: string };

type PrintThermalButtonTexts = {
  idle: string;
  printing: string;
  success: string;
  error: string;
};

export function PrintThermalButton({ tickets, texts }: { tickets: readonly SerializableTicketData[]; texts: PrintThermalButtonTexts }) {
  const [status, setStatus] = useState<"idle" | "printing" | "success" | "error">("idle");

  async function printThermal() {
    setStatus("printing");

    try {
      await new WebBluetoothTicketPrinter().print(tickets.map(toTicketData));
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={status === "printing" || tickets.length === 0}
        onClick={() => void printThermal()}
        type="button"
      >
        {status === "printing" ? texts.printing : texts.idle}
      </button>
      {status === "success" ? <p className="text-sm font-medium text-emerald-700" role="status">{texts.success}</p> : null}
      {status === "error" ? <p className="text-sm font-medium text-red-700" role="alert">{texts.error}</p> : null}
    </div>
  );
}

function toTicketData(ticket: SerializableTicketData): TicketData {
  return { ...ticket, dueDate: new Date(ticket.dueDate) };
}
