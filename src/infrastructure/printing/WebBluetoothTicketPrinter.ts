import type {
  TicketPrinter,
  TicketPrintObserver,
} from "@/application/ports/TicketPrinter";
import type { TicketData } from "@/domain/orders/buildTicket";
import { buildTicketBytes } from "@/infrastructure/printing/escpos";

const PRINTER_SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const PRINTER_CHARACTERISTIC_UUID = "00002af1-0000-1000-8000-00805f9b34fb";
const BLE_WRITE_CHUNK_SIZE = 20;

export class BluetoothNotSupportedError extends Error {
  constructor() {
    super("Web Bluetooth is not supported in this browser.");
    this.name = "BluetoothNotSupportedError";
  }
}

export class WebBluetoothTicketPrinter implements TicketPrinter {
  async print(
    tickets: readonly TicketData[],
    observer?: TicketPrintObserver,
  ): Promise<void> {
    if (!navigator.bluetooth) {
      throw new BluetoothNotSupportedError();
    }

    const device = await navigator.bluetooth.requestDevice({ filters: [{ services: [PRINTER_SERVICE_UUID] }] });
    const server = await device.gatt?.connect();

    if (!server) {
      throw new Error("Bluetooth printer GATT server is not available.");
    }

    try {
      const service = await server.getPrimaryService(PRINTER_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(PRINTER_CHARACTERISTIC_UUID);
      await observer?.onReady?.();

      for (const [ticketIndex, ticket] of tickets.entries()) {
        observer?.onTicketStarted?.(ticketIndex + 1, tickets.length);
        const bytes = buildTicketBytes(ticket);

        for (let offset = 0; offset < bytes.length; offset += BLE_WRITE_CHUNK_SIZE) {
          const chunk = bytes.slice(offset, offset + BLE_WRITE_CHUNK_SIZE);

          if (characteristic.writeValueWithoutResponse) {
            await characteristic.writeValueWithoutResponse(chunk);
          } else {
            await characteristic.writeValue(chunk);
          }
        }

        observer?.onTicketPrinted?.(ticketIndex + 1, tickets.length);
      }
    } finally {
      if (server.connected) {
        server.disconnect();
      }
    }
  }
}
