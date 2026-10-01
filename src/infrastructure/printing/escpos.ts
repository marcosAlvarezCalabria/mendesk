import type { TicketData } from "@/domain/orders/buildTicket";

const INIT = [0x1b, 0x40] as const;
const ALIGN_CENTER = [0x1b, 0x61, 0x01] as const;
const ALIGN_LEFT = [0x1b, 0x61, 0x00] as const;
const QR_MODEL_2 = [0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00] as const;
const QR_MODULE_SIZE = [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x05] as const;
const QR_ERROR_CORRECTION_M = [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31] as const;
const QR_PRINT = [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30] as const;
const CUT_PARTIAL = [0x1d, 0x56, 0x01] as const;
const encoder = new TextEncoder();

export function buildTicketBytes(ticket: TicketData, storeName: string): Uint8Array {
  const lines = [
    storeName,
    ticket.orderNumber,
    "",
    `Client: ${ticket.clientName}`,
    `Garment: ${ticket.garmentDescription}`,
    `Alteration: ${formatSnakeLabel(ticket.alterationType)}`,
    ticket.measurements ? `Measurements: ${ticket.measurements}` : null,
    `Due: ${formatDate(ticket.dueDate)}`,
    `Price: EUR ${ticket.price}`,
    `Deposit paid: EUR ${ticket.depositPaid}`,
    `Outstanding: EUR ${ticket.outstanding}`,
    "",
  ].filter((line): line is string => line !== null);

  return concatBytes([
    Uint8Array.from(INIT),
    Uint8Array.from(ALIGN_LEFT),
    encoder.encode(`${lines.join("\n")}\n`),
    ...buildQrCode(ticket.deepLinkUrl),
    encoder.encode("\n\n"),
    Uint8Array.from(CUT_PARTIAL),
  ]);
}

export function buildTicketsBytes(tickets: readonly TicketData[], storeName: string): Uint8Array {
  return concatBytes(tickets.map(ticket => buildTicketBytes(ticket, storeName)));
}

function buildQrCode(payload: string): Uint8Array[] {
  const data = encoder.encode(payload);
  const commandLength = data.length + 3;
  const store = Uint8Array.from([0x1d, 0x28, 0x6b, commandLength & 0xff, (commandLength >> 8) & 0xff, 0x31, 0x50, 0x30, ...data]);
  return [
    Uint8Array.from(ALIGN_CENTER),
    Uint8Array.from(QR_MODEL_2),
    Uint8Array.from(QR_MODULE_SIZE),
    Uint8Array.from(QR_ERROR_CORRECTION_M),
    store,
    Uint8Array.from(QR_PRINT),
    Uint8Array.from(ALIGN_LEFT),
  ];
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

function formatDate(date: Date): string { return date.toISOString().slice(0, 10); }
function formatSnakeLabel(value: string): string { return value.replaceAll("_", " "); }
