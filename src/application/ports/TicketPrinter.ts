import type { TicketData } from "@/domain/orders/buildTicket";

export interface TicketPrintObserver {
  onReady?(): void | Promise<void>;
  onTicketStarted?(index: number, total: number): void;
  onTicketPrinted?(index: number, total: number): void;
}

export interface TicketPrinter {
  print(
    tickets: readonly TicketData[],
    observer?: TicketPrintObserver,
  ): Promise<void>;
}
