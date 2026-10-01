import type { OrdersOverview, OrdersOverviewQuery, OrdersReadSection, OrdersSelection } from "@/application/dtos/OrdersOverview";
import type { OrdersOverviewReader } from "@/application/ports/OrdersOverviewReader";
import { InvalidCredentialsError } from "@/domain/errors/InvalidCredentialsError";

export class GetOrdersOverview {
  constructor(private readonly reader: OrdersOverviewReader) {}

  async execute(query: OrdersOverviewQuery): Promise<OrdersOverview> {
    if (!(query.now instanceof Date) || !Number.isFinite(query.now.getTime())
      || !Number.isSafeInteger(query.page) || query.page < 1 || !Number.isSafeInteger((query.page - 1) * 20)
      || !validSelection(query.selection) || typeof query.search !== "string") {
      throw new RangeError("Invalid orders overview query");
    }
    const [counts, toCollect, list] = await Promise.all([
      readSection(() => this.reader.readCounts(query.now)),
      readSection(() => this.reader.readToCollect()),
      readSection(() => this.reader.readPage({ ...query, search: query.search.trim() })),
    ]);
    return { asOf: query.now.toISOString(), counts, toCollect, list };
  }
}

function validSelection(selection: OrdersSelection): boolean {
  if (!selection || typeof selection !== "object") return false;
  if (selection.kind === "active") return true;
  if (selection.kind === "status") return ["received", "ready", "collected", "cancelled"].includes(selection.value);
  return selection.kind === "attention" && ["overdue", "due_today", "due_tomorrow", "ready_for_pickup"].includes(selection.value);
}

async function readSection<T>(read: () => Promise<T>): Promise<OrdersReadSection<T>> {
  try { return { status: "ready", data: await read() }; }
  catch (error) {
    if (error instanceof InvalidCredentialsError) throw error;
    return { status: "error" };
  }
}
