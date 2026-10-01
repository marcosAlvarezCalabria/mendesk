import { describe, expect, it } from "vitest";

import type { OrderListItem } from "@/application/dtos/OrderListItem";
import type { OrderListPage, OrderListQuery, OrderListReader } from "@/application/ports/OrderListReader";
import { ListOrders } from "@/application/useCases/ListOrders";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";

describe("ListOrders", () => {
  it("requests the first compact page with the current filters", async () => {
    const today = new Date("2026-08-24T12:00:00.000Z");
    const expected = page([makeItem("260824-0142")], true);
    const reader = new FakeOrderListReader(expected);
    const useCase = new ListOrders(reader);

    await expect(
      useCase.execute({
        status: ["received", "ready"],
        dateFilter: "today",
        search: "Mary",
        today,
      }),
    ).resolves.toEqual(expected);

    expect(reader.lastQuery).toEqual({
      page: 1,
      pageSize: 20,
      status: ["received", "ready"],
      dateFilter: "today",
      search: "Mary",
      today,
      sort: "received_desc",
    });
  });

  it("requests the selected page", async () => {
    const reader = new FakeOrderListReader(page([makeItem("260824-0162")], false));
    const useCase = new ListOrders(reader);

    await useCase.execute({ page: 2 });

    expect(reader.lastQuery).toEqual(
      expect.objectContaining({
        page: 2,
        pageSize: 20,
      }),
    );
  });

  it("requests due-date ordering when the presentation prioritizes urgency", async () => {
    const reader = new FakeOrderListReader(page([], false));
    const useCase = new ListOrders(reader);

    await useCase.execute({ sort: "due_asc" });

    expect(reader.lastQuery).toEqual(
      expect.objectContaining({ sort: "due_asc" }),
    );
  });

  it("preserves hasNextPage from the reader", async () => {
    const expected = page([makeItem("260824-0142")], true);
    const useCase = new ListOrders(new FakeOrderListReader(expected));

    await expect(useCase.execute()).resolves.toEqual(expected);
  });

  it("returns an empty page", async () => {
    const useCase = new ListOrders(new FakeOrderListReader(page([], false)));

    await expect(useCase.execute()).resolves.toEqual({ items: [], hasNextPage: false });
  });
});

class FakeOrderListReader implements OrderListReader {
  lastQuery: OrderListQuery | null = null;

  constructor(private readonly result: OrderListPage) {}

  async listPage(query: OrderListQuery): Promise<OrderListPage> {
    this.lastQuery = query;
    return this.result;
  }
}

function page(items: OrderListItem[], hasNextPage: boolean): OrderListPage {
  return { items, hasNextPage };
}

function makeItem(orderNumber: string): OrderListItem {
  return {
    id: orderNumber,
    orderNumber: OrderNumber.fromString(orderNumber),
    clientName: "Mary",
    status: OrderStatus.RECEIVED,
    dueDate: new Date("2026-08-25T12:00:00.000Z"),
    garmentCount: 1,
    outstanding: Money.fromEuros(15),
  };
}
