import { afterEach, describe, expect, it, vi } from "vitest";

import type { TicketData } from "@/domain/orders/buildTicket";
import { WebBluetoothTicketPrinter } from "@/infrastructure/printing/WebBluetoothTicketPrinter";

describe("WebBluetoothTicketPrinter progress", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports ready, started and confirmed once per completely written ticket", async () => {
    const events: string[] = [];
    const characteristic = { writeValueWithoutResponse: vi.fn(async () => undefined) };
    const server = { connected: true, getPrimaryService: vi.fn(async () => ({ getCharacteristic: vi.fn(async () => characteristic) })), disconnect: vi.fn() };
    vi.stubGlobal("navigator", { bluetooth: { requestDevice: vi.fn(async () => ({ gatt: { connect: vi.fn(async () => server) } })) } });

    await new WebBluetoothTicketPrinter().print([ticket("1"), ticket("2")], {
      onReady: () => { events.push("ready"); },
      onTicketStarted: (index, total) => events.push(`start:${index}/${total}`),
      onTicketPrinted: (index, total) => events.push(`done:${index}/${total}`),
    });

    expect(events).toEqual(["ready", "start:1/2", "done:1/2", "start:2/2", "done:2/2"]);
  });
});

function ticket(suffix: string): TicketData {
  return { orderNumber: `260824-000${suffix}`, clientName: "Mary", garmentDescription: "Dress", alterationType: "hem", measurements: null, price: "35.00", depositPaid: "10.00", outstanding: "25.00", dueDate: new Date("2026-08-30T10:00:00.000Z"), deepLinkUrl: `https://panel.kokoatelier.ie/orders/260824-000${suffix}` };
}
