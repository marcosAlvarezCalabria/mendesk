import type { OrdersAttentionCounts, OrdersOverviewPage, OrdersOverviewQuery, ToCollectSummary } from "@/application/dtos/OrdersOverview";

export interface OrdersOverviewReader {
  readCounts(now: Date): Promise<OrdersAttentionCounts>;
  readToCollect(): Promise<ToCollectSummary>;
  readPage(query: OrdersOverviewQuery): Promise<OrdersOverviewPage>;
}
