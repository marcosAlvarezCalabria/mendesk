import { describe, expect, it } from "vitest";

import type { TicketData } from "@/domain/orders/buildTicket";
import { buildTicketBytes, buildTicketsBytes } from "@/infrastructure/printing/escpos";

const baseTicket: TicketData = {
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

const storeName = "Demo Atelier";

describe("ESC/POS ticket formatting", () => {
  it("includes the economic contract and optional measurements", () => {
    const text = decode(buildTicketBytes(baseTicket, storeName));

    expect(text).toContain(storeName);
    expect(text).not.toMatch(/Koko Atelier|Mendesk|Incandi|Incamdi/);
    expect(text).toContain("260824-0001");
    expect(text).toContain("Measurements: Shorten 4cm");
    expect(text).toContain("Deposit paid: EUR 10.00");
    expect(text).toContain("Outstanding: EUR 25.00");
  });

  it("stores the exact canonical URL in one real QR Model 2 command and prints it", () => {
    const bytes = buildTicketBytes(baseTicket, storeName);

    expect(readQrPayloads(bytes)).toEqual([baseTicket.deepLinkUrl]);
    expect(countSequence(bytes, [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30])).toBe(1);
    expect(decode(bytes)).not.toContain("Link:");
  });

  it("omits measurements cleanly when absent", () => {
    expect(decode(buildTicketBytes({ ...baseTicket, measurements: null }, storeName))).not.toContain("Measurements:");
  });

  it("prints and cuts once per ticket when formatting multiple tickets", () => {
    const second = { ...baseTicket, orderNumber: "260824-0002", deepLinkUrl: "https://demo.mendesk.example/orders/260824-0002" };
    const bytes = buildTicketsBytes([baseTicket, second], storeName);

    expect(readQrPayloads(bytes)).toEqual([baseTicket.deepLinkUrl, second.deepLinkUrl]);
    expect(countSequence(bytes, [0x1d, 0x56, 0x01])).toBe(2);
  });
});

function decode(bytes: Uint8Array): string { return new TextDecoder().decode(bytes); }

function readQrPayloads(bytes: Uint8Array): string[] {
  const payloads: string[] = [];
  for (let index = 0; index < bytes.length - 8; index += 1) {
    if (bytes[index] !== 0x1d || bytes[index + 1] !== 0x28 || bytes[index + 2] !== 0x6b || bytes[index + 5] !== 0x31 || bytes[index + 6] !== 0x50 || bytes[index + 7] !== 0x30) continue;
    const commandLength = (bytes[index + 3] ?? 0) + ((bytes[index + 4] ?? 0) << 8);
    payloads.push(decode(bytes.slice(index + 8, index + 5 + commandLength)));
  }
  return payloads;
}

function countSequence(bytes: Uint8Array, sequence: number[]): number {
  let count = 0;
  for (let index = 0; index <= bytes.length - sequence.length; index += 1) {
    if (sequence.every((value, offset) => bytes[index + offset] === value)) count += 1;
  }
  return count;
}
