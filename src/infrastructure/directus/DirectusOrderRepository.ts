import type { OrderListPage, OrderListQuery, OrderListReader } from "@/application/ports/OrderListReader";
import type { NewOrder, OrderRepository, UpdateOrderDetails, UpdateOrderStatus } from "@/application/ports/OrderRepository";
import type { Order } from "@/domain/entities/Order";
import { OrderConflictError } from "@/domain/errors/OrderConflictError";
import type { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import type { DirectusOrderClient } from "@/infrastructure/directus/DirectusOrderClient";
import { mapOrder } from "@/infrastructure/directus/orderMapper";
import { mapOrderListItem } from "@/infrastructure/directus/orderListMapper";
import type { DirectusOrderListRecord } from "@/infrastructure/directus/records";

export class DirectusOrderRepository implements OrderRepository, OrderListReader {
  constructor(private readonly client: DirectusOrderClient) {}

  async listPage(query: OrderListQuery): Promise<OrderListPage> {
    const records = await this.client.listOrders(query);
    const items = mapValidOrderListItems(records);

    return {
      items: items.slice(0, query.pageSize),
      hasNextPage: items.length > query.pageSize,
    };
  }

  async getByOrderNumber(orderNumber: string): Promise<Order | null> {
    const record = await this.client.getOrder(orderNumber);

    return record ? mapOrder(record) : null;
  }
  async getByIdempotencyKey(idempotencyKey: IdempotencyKey): Promise<Order | null> {
    const record = await this.client.getOrderByIdempotencyKey(idempotencyKey.value);

    return record ? mapOrder(record) : null;
  }


  async create(order: NewOrder): Promise<Order> {
    await this.client.createOrder({
      order_number: order.orderNumber.value,
      idempotency_key: order.idempotencyKey.value,
      client: order.clientId,
      status: order.status.value,
      received_date: order.receivedDate.toISOString(),
      due_date: order.dueDate.toISOString(),
      notes: order.notes,
    });

    const created = await this.getByIdempotencyKey(order.idempotencyKey) ?? await this.getByOrderNumber(order.orderNumber.value);

    if (!created) {
      throw new Error("Created Directus order could not be reloaded");
    }

    return created;
  }

  async updateDetails(input: UpdateOrderDetails): Promise<Order> {
    const updated = await this.client.updateOrder(input.orderId, input.expectedDateUpdated.toISOString(), {
      due_date: input.dueDate.toISOString(),
      notes: input.notes,
    });

    if (!updated) {
      throw new OrderConflictError();
    }

    return mapOrder(updated);
  }

  async updateStatus(input: UpdateOrderStatus): Promise<Order> {
    const updated = await this.client.updateOrderStatus(input.orderId, input.expectedStatus.value, input.expectedDateUpdated?.toISOString(), {
      status: input.status.value,
      collected_at: input.collectedAt ? input.collectedAt.toISOString() : null,
    });

    if (!updated) {
      throw new OrderConflictError();
    }

    return mapOrder(updated);
  }
}

function mapValidOrderListItems(records: readonly DirectusOrderListRecord[]) {
  const items = [];

  for (const record of records) {
    try {
      items.push(mapOrderListItem(record));
    } catch (error) {
      console.warn("Skipping malformed Directus order list record", {
        orderId: record.id,
        orderNumber: record.order_number,
        error,
      });
    }
  }

  return items;
}
