import { afterEach, describe, expect, it, vi } from "vitest";

import type { TicketData } from "@/domain/orders/buildTicket";
import { buildTicketsBytes } from "@/infrastructure/printing/escpos";
import { WebBluetoothTicketPrinter } from "@/infrastructure/printing/WebBluetoothTicketPrinter";

describe("WebBluetoothTicketPrinter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes exactly the ESC/POS bytes in transport-sized chunks and disconnects", async () => {
    const writes: Uint8Array[] = [];
    const disconnect = vi.fn();
    const characteristic = { writeValueWithoutResponse: vi.fn(async (chunk: BufferSource) => writes.push(Uint8Array.from(new Uint8Array(chunk as ArrayBuffer)))) };
    const service = { getCharacteristic: vi.fn(async () => characteristic) };
    const server = { connected: true, getPrimaryService: vi.fn(async () => service), disconnect };
    const device = { gatt: { connect: vi.fn(async () => server) } };
    vi.stubGlobal("navigator", { bluetooth: { requestDevice: vi.fn(async () => device) } });

    await new WebBluetoothTicketPrinter("Demo Atelier").print([ticket]);

    expect(concat(writes)).toEqual(buildTicketsBytes([ticket], "Demo Atelier"));
    expect(writes.every(chunk => chunk.length <= 20)).toBe(true);
    expect(disconnect).toHaveBeenCalledOnce();
  });
});

const ticket: TicketData = {
  orderNumber: "260824-0001",
  clientName: "Mary Client",
  garmentDescription: "Blue dress",
  alterationType: "hem",
  measurements: "Shorten 4cm",
  price: "35.00",
  depositPaid: "10.00",
  outstanding: "25.00",
  dueDate: new Date("2026-08-30T10:00:00.000Z"),
  deepLinkUrl: "https://demo.mendesk.example/orders/260824-0001",
};

function concat(chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
