import { afterEach, describe, expect, it, vi } from "vitest";

import type { TicketData } from "@/domain/orders/buildTicket";
import { WebBluetoothTicketPrinter } from "@/infrastructure/printing/WebBluetoothTicketPrinter";

describe("WebBluetoothTicketPrinter ready state", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("waits for the ready observer before starting the first ticket", async () => {
    const events: string[] = [];
    let releaseReady: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => { releaseReady = resolve; });
    const characteristic = { writeValueWithoutResponse: vi.fn(async () => undefined) };
    const server = { connected: true, getPrimaryService: vi.fn(async () => ({ getCharacteristic: vi.fn(async () => characteristic) })), disconnect: vi.fn() };
    vi.stubGlobal("navigator", { bluetooth: { requestDevice: vi.fn(async () => ({ gatt: { connect: vi.fn(async () => server) } })) } });

    const printing = new WebBluetoothTicketPrinter().print([ticket], {
      onReady: async () => {
        events.push("ready");
        await ready;
      },
      onTicketStarted: () => events.push("started"),
    });

    await vi.waitFor(() => expect(events).toEqual(["ready"]));
    releaseReady?.();
    await printing;
    expect(events).toEqual(["ready", "started"]);
  });
});

const ticket: TicketData = {
  orderNumber: "260913-0007",
  clientName: "Mary",
  garmentDescription: "Dress",
  alterationType: "hem",
  measurements: null,
  price: "35.00",
  depositPaid: "10.00",
  outstanding: "25.00",
  dueDate: new Date("2026-09-20T10:00:00.000Z"),
  deepLinkUrl: "https://panel.kokoatelier.ie/orders/260913-0007",
};
