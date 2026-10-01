import type { OrderListItem } from "@/application/dtos/OrderListItem";
import type { OrderDateFilter } from "@/domain/orders/orderDateFilter";
import type { OrderStatusValue } from "@/domain/values/OrderStatus";

export type OrderListSort = "received_desc" | "due_asc";

export type OrderListQuery = {
  page: number;
  pageSize: number;
  status?: readonly OrderStatusValue[];
  dateFilter: OrderDateFilter;
  search: string;
  sort?: OrderListSort;
  today: Date;
};

export type OrderListPage = {
  items: OrderListItem[];
  hasNextPage: boolean;
};

export interface OrderListReader {
  listPage(query: OrderListQuery): Promise<OrderListPage>;
}
