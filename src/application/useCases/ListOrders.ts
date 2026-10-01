import type { OrderListPage, OrderListQuery, OrderListReader } from "@/application/ports/OrderListReader";
import type { OrderDateFilter } from "@/domain/orders/orderDateFilter";

export type ListOrdersInput = {
  page?: number;
  status?: OrderListQuery["status"];
  dateFilter?: OrderDateFilter;
  search?: string;
  sort?: OrderListQuery["sort"];
  today?: Date;
};

const ORDER_LIST_PAGE_SIZE = 20;

export class ListOrders {
  constructor(private readonly orders: OrderListReader) {}

  async execute(input: ListOrdersInput = {}): Promise<OrderListPage> {
    const page = input.page ?? 1;

    if (!Number.isInteger(page) || page < 1) {
      throw new RangeError("Order list page must be a positive integer");
    }

    return this.orders.listPage({
      page,
      pageSize: ORDER_LIST_PAGE_SIZE,
      status: input.status,
      dateFilter: input.dateFilter ?? "all",
      search: input.search ?? "",
      sort: input.sort ?? "received_desc",
      today: input.today ?? new Date(),
    });
  }
}
