import { afterEach, describe, expect, it, vi } from "vitest";

import type { OrderListQuery } from "@/application/ports/OrderListReader";
import type { NewOrder, UpdateOrderDetails } from "@/application/ports/OrderRepository";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { OrderConflictError } from "@/domain/errors/OrderConflictError";
import { OrderStatus, type OrderStatusValue } from "@/domain/values/OrderStatus";
import type {
  DirectusOrderClient,
  DirectusOrderCreatePayload,
  DirectusOrderStatusPayload,
  DirectusOrderUpdatePayload,
} from "@/infrastructure/directus/DirectusOrderClient";
import { DirectusOrderRepository } from "@/infrastructure/directus/DirectusOrderRepository";
import type {
  DirectusClientRecord,
  DirectusGarmentRecord,
  DirectusOrderListRecord,
  DirectusOrderRecord,
  DirectusPaymentRecord,
} from "@/infrastructure/directus/records";

describe("DirectusOrderRepository", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps compact Directus records without loading full orders", async () => {
    const client = new FakeDirectusOrderClient([
      makeRecord({ order_number: "260819-0142", client: makeClient({ name: "Mary" }) }),
      makeRecord({ id: "order-2", order_number: "260819-0143", client: makeClient({ id: "client-2", name: "Anne" }) }),
    ]);
    const repository = new DirectusOrderRepository(client);

    const page = await repository.listPage(listQuery());

    expect(page.hasNextPage).toBe(false);
    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toMatchObject({ clientName: "Mary", garmentCount: 1 });
    expect(page.items[0]?.orderNumber.value).toBe("260819-0142");
    expect(page.items[0]?.outstanding.toEuros()).toBe(5);
    expect(page.items[1]?.orderNumber.value).toBe("260819-0143");
  });

  it("uses the look-ahead record to report a next page", async () => {
    const records = Array.from({ length: 21 }, (_, index) =>
      makeRecord({ id: `order-${index}`, order_number: `260819-${String(1000 + index).padStart(4, "0")}` }),
    );
    const repository = new DirectusOrderRepository(new FakeDirectusOrderClient(records));

    const page = await repository.listPage(listQuery());

    expect(page.items).toHaveLength(20);
    expect(page.hasNextPage).toBe(true);
  });

  it("skips invalid Directus records when listing orders", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new FakeDirectusOrderClient([
      makeRecord({ id: "order-bad", order_number: "bad-order-number" }),
      makeRecord({ id: "order-2", order_number: "260819-0143" }),
    ]);
    const repository = new DirectusOrderRepository(client);

    const page = await repository.listPage(listQuery());

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.orderNumber.value).toBe("260819-0143");
    expect(warn).toHaveBeenCalledWith(
      "Skipping malformed Directus order list record",
      expect.objectContaining({
        orderId: "order-bad",
        orderNumber: "bad-order-number",
      }),
    );
  });

  it("forwards pagination and all filters to the Directus seam", async () => {
    const client = new FakeDirectusOrderClient([
      makeRecord({ order_number: "260819-0142", status: "received" }),
      makeRecord({ id: "order-2", order_number: "260819-0143", status: "ready" }),
    ]);
    const repository = new DirectusOrderRepository(client);

    const query = listQuery({ page: 2, status: ["ready"], dateFilter: "today", search: "Anne" });
    const page = await repository.listPage(query);

    expect(client.lastListQuery).toEqual(query);
    expect(page.items).toHaveLength(2);
  });

  it("gets an existing order by order number", async () => {
    const client = new FakeDirectusOrderClient([makeRecord({ order_number: "260819-0142" })]);
    const repository = new DirectusOrderRepository(client);

    const order = await repository.getByOrderNumber("260819-0142");

    expect(client.lastGetOrderNumber).toBe("260819-0142");
    expect(order?.orderNumber.value).toBe("260819-0142");
    expect(order?.client.name).toBe("Mary");
  });

  it("returns null when an order does not exist", async () => {
    const client = new FakeDirectusOrderClient([makeRecord({ order_number: "260819-0142" })]);
    const repository = new DirectusOrderRepository(client);

    await expect(repository.getByOrderNumber("999999-9999")).resolves.toBeNull();
  });

  it("creates an order and re-reads the expanded aggregate", async () => {
    const client = new FakeDirectusOrderClient([makeRecord({ order_number: "260819-0143" })]);
    const repository = new DirectusOrderRepository(client);
    const input: NewOrder = {
      idempotencyKey: IdempotencyKey.fromString("550e8400-e29b-41d4-a716-446655440000"),
      orderNumber: OrderNumber.fromString("260819-0143"),
      clientId: "client-1",
      status: OrderStatus.RECEIVED,
      receivedDate: new Date("2026-08-19T10:00:00.000Z"),
      dueDate: new Date("2026-08-21T10:00:00.000Z"),
      notes: "Bring hanger",
    };

    const order = await repository.create(input);

    expect(client.lastCreatePayload).toEqual({
      idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
      order_number: "260819-0143",
      client: "client-1",
      status: "received",
      received_date: "2026-08-19T10:00:00.000Z",
      due_date: "2026-08-21T10:00:00.000Z",
      notes: "Bring hanger",
    });
    expect(client.lastGetOrderNumber).toBe("260819-0143");
    expect(order.orderNumber.value).toBe("260819-0143");
  });

  it("updates order details and re-reads the expanded aggregate by id", async () => {
    const client = new FakeDirectusOrderClient([makeRecord({ id: "order-1", order_number: "260819-0142" })]);
    const repository = new DirectusOrderRepository(client);
    const dueDate = new Date("2026-08-24T10:00:00.000Z");
    const input: UpdateOrderDetails = { orderId: "order-1", expectedDateUpdated: new Date("2026-08-19T10:05:00.000Z"), dueDate, notes: "Bring lace" };

    const order = await repository.updateDetails(input);

    expect(client.lastUpdateId).toBe("order-1");
    expect(client.lastUpdatePayload).toEqual({ due_date: "2026-08-24T10:00:00.000Z", notes: "Bring lace" });
    expect(client.lastExpectedDateUpdated).toBe("2026-08-19T10:05:00.000Z");
    expect(client.lastGetOrderById).toBeNull();
    expect(order.id).toBe("order-1");
    expect(order.dueDate).toEqual(dueDate);
    expect(order.notes).toBe("Bring lace");
  });

  it("updates order status to ready and re-reads the expanded aggregate by id", async () => {
    const client = new FakeDirectusOrderClient([makeRecord({ id: "order-1", order_number: "260819-0142" })]);
    const repository = new DirectusOrderRepository(client);

    const order = await repository.updateStatus({ orderId: "order-1", expectedStatus: OrderStatus.RECEIVED, status: OrderStatus.READY });

    expect(client.lastStatusUpdateId).toBe("order-1");
    expect(client.lastStatusUpdatePayload).toEqual({ status: "ready", collected_at: null });
    expect(client.lastExpectedStatus).toBe("received");
    expect(client.lastGetOrderById).toBeNull();
    expect(order.status).toBe(OrderStatus.READY);
    expect(order.collectedAt).toBeUndefined();
  });

  it("updates order status to collected with collected_at and re-reads the expanded aggregate by id", async () => {
    const client = new FakeDirectusOrderClient([makeRecord({ id: "order-1", order_number: "260819-0142", status: "ready" })]);
    const repository = new DirectusOrderRepository(client);
    const collectedAt = new Date("2026-08-24T12:30:00.000Z");

    const order = await repository.updateStatus({ orderId: "order-1", expectedStatus: OrderStatus.READY, status: OrderStatus.COLLECTED, collectedAt });

    expect(client.lastStatusUpdateId).toBe("order-1");
    expect(client.lastStatusUpdatePayload).toEqual({ status: "collected", collected_at: "2026-08-24T12:30:00.000Z" });
    expect(client.lastExpectedStatus).toBe("ready");
    expect(client.lastGetOrderById).toBeNull();
    expect(order.status).toBe(OrderStatus.COLLECTED);
    expect(order.collectedAt).toEqual(collectedAt);
  });

  it("rejects a stale details update instead of overwriting", async () => {
    const client = new FakeDirectusOrderClient([makeRecord()], undefined, true);
    const repository = new DirectusOrderRepository(client);

    await expect(
      repository.updateDetails({
        orderId: "order-1",
        expectedDateUpdated: new Date("2026-08-19T10:05:00.000Z"),
        dueDate: new Date("2026-08-24T10:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(OrderConflictError);
  });

  it("rejects a stale status transition instead of overwriting", async () => {
    const client = new FakeDirectusOrderClient([makeRecord()], undefined, true);
    const repository = new DirectusOrderRepository(client);

    await expect(
      repository.updateStatus({
        orderId: "order-1",
        expectedStatus: OrderStatus.RECEIVED,
        status: OrderStatus.READY,
      }),
    ).rejects.toBeInstanceOf(OrderConflictError);
  });

  it("propagates seam errors from list and getByOrderNumber", async () => {
    const expected = new Error("Directus unavailable");
    const client = new FakeDirectusOrderClient([], expected);
    const repository = new DirectusOrderRepository(client);

    await expect(repository.listPage(listQuery())).rejects.toThrow(expected);
    await expect(repository.getByOrderNumber("260819-0142")).rejects.toThrow(expected);
  });
});

class FakeDirectusOrderClient implements DirectusOrderClient {
  async getOrderByIdempotencyKey(idempotencyKey: string): Promise<DirectusOrderRecord | null> {
    return this.records.find((record) => record.idempotency_key === idempotencyKey) ?? null;
  }
  lastListQuery: OrderListQuery | null = null;
  lastGetOrderNumber: string | null = null;
  lastGetOrderById: string | null = null;
  lastCreatePayload: DirectusOrderCreatePayload | null = null;
  lastUpdateId: string | null = null;
  lastUpdatePayload: DirectusOrderUpdatePayload | null = null;
  lastExpectedDateUpdated: string | null = null;
  lastStatusUpdateId: string | null = null;
  lastStatusUpdatePayload: DirectusOrderStatusPayload | null = null;
  lastExpectedStatus: string | null = null;

  constructor(
    private readonly records: readonly DirectusOrderRecord[],
    private readonly error: Error | undefined = undefined,
    private readonly conflict = false,
  ) {}

  async listOrders(query: OrderListQuery): Promise<DirectusOrderListRecord[]> {
    if (this.error) {
      throw this.error;
    }

    this.lastListQuery = query;

    return this.records.map(toListRecord);
  }

  async getOrder(orderNumber: string): Promise<DirectusOrderRecord | null> {
    if (this.error) {
      throw this.error;
    }

    this.lastGetOrderNumber = orderNumber;

    return this.records.find((record) => record.order_number === orderNumber) ?? null;
  }

  async getOrderById(id: string): Promise<DirectusOrderRecord | null> {
    if (this.error) {
      throw this.error;
    }

    this.lastGetOrderById = id;
    const record = this.records.find((candidate) => candidate.id === id);

    if (!record) {
      return null;
    }

    return {
      ...record,
      due_date: this.lastUpdatePayload?.due_date ?? record.due_date,
      notes: this.lastUpdatePayload?.notes ?? record.notes,
      status: this.lastStatusUpdatePayload?.status ?? record.status,
      collected_at: this.lastStatusUpdatePayload?.collected_at ?? record.collected_at,
    };
  }

  async createOrder(payload: DirectusOrderCreatePayload): Promise<DirectusOrderRecord> {
    if (this.error) {
      throw this.error;
    }

    this.lastCreatePayload = payload;

    return makeRecord({ order_number: payload.order_number, status: payload.status, received_date: payload.received_date, due_date: payload.due_date, notes: payload.notes ?? null });
  }

  async updateOrder(id: string, expectedDateUpdated: string, payload: DirectusOrderUpdatePayload): Promise<DirectusOrderRecord | null> {
    if (this.error) {
      throw this.error;
    }

    this.lastUpdateId = id;
    this.lastExpectedDateUpdated = expectedDateUpdated;
    this.lastUpdatePayload = payload;
    if (this.conflict) return null;
    const record = this.records.find((candidate) => candidate.id === id);
    return record ? { ...record, due_date: payload.due_date, notes: payload.notes ?? null } : null;
  }

  async updateOrderStatus(id: string, expectedStatus: string, _expectedDateUpdated: string | undefined, payload: DirectusOrderStatusPayload): Promise<DirectusOrderRecord | null> {
    if (this.error) {
      throw this.error;
    }

    this.lastStatusUpdateId = id;
    this.lastExpectedStatus = expectedStatus;
    this.lastStatusUpdatePayload = payload;
    if (this.conflict) return null;
    const record = this.records.find((candidate) => candidate.id === id);
    return record ? { ...record, status: payload.status, collected_at: payload.collected_at ?? null } : null;
  }
}

function listQuery(overrides: Partial<OrderListQuery> = {}): OrderListQuery {
  return {
    page: 1,
    pageSize: 20,
    dateFilter: "all",
    search: "",
    today: new Date("2026-08-24T12:00:00.000Z"),
    ...overrides,
  };
}

function toListRecord(record: DirectusOrderRecord): DirectusOrderListRecord {
  return {
    id: record.id,
    order_number: record.order_number,
    client: { name: record.client.name },
    status: record.status,
    due_date: record.due_date,
    garments: record.garments?.map(({ id, price }) => ({ id, price })),
    payments: record.payments?.map(({ amount }) => ({ amount })),
  };
}

function makeRecord(overrides: Partial<DirectusOrderRecord> = {}): DirectusOrderRecord {
  return {
    id: "order-1",
    order_number: "260819-0142",
    client: makeClient(),
    status: "received" satisfies OrderStatusValue,
    received_date: "2026-08-19T10:00:00.000Z",
    date_updated: "2026-08-19T10:05:00.000Z",
    due_date: "2026-08-21T10:00:00.000Z",
    collected_at: null,
    notes: "Bring hanger",
    garments: [makeGarment()],
    payments: [makePayment()],
    ...overrides,
  };
}

function makeClient(overrides: Partial<DirectusClientRecord> = {}): DirectusClientRecord {
  return {
    id: "client-1",
    name: "Mary",
    phone: "+353 85 200 9225",
    gdpr_consent: true,
    notes: null,
    ...overrides,
  };
}

function makeGarment(overrides: Partial<DirectusGarmentRecord> = {}): DirectusGarmentRecord {
  return {
    id: "garment-1",
    description: "Dress",
    alteration_type: "hem",
    date_updated: "2026-08-19T10:05:00.000Z",
    measurements: "Hem 4cm",
    photo: "file-1",
    price: "25.00",
    ...overrides,
  };
}

function makePayment(overrides: Partial<DirectusPaymentRecord> = {}): DirectusPaymentRecord {
  return {
    id: "payment-1",
    type: "deposit",
    amount: "20.00",
    method: "cash",
    date_created: "2026-08-19T11:00:00.000Z",
    ...overrides,
  };
}
