import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OrderHeaderActions, type OrderHeaderActionTexts } from "@/app/orders/[orderNumber]/OrderHeaderActions";

const texts: OrderHeaderActionTexts = { print: "Print", more: "More", cancel: "Cancel order", title: "Cancel order?", warning: "This cannot be undone.", keep: "Keep order", cancelling: "Cancelling...", cancelled: "Cancelled", error: "Try again" };

describe("OrderHeaderActions", () => {
  it("keeps Cancel inside the More menu for an editable order", () => {
    const html = renderToStaticMarkup(<OrderHeaderActions printHref="/print" canCancel orderNumber="260910-0020" clientName="Mary" sourceStatus="received" expectedDateUpdated="2026-09-10T09:00:00.000Z" texts={texts} />);
    expect(html).toContain("More");
    expect(html).toContain("Cancel order");
    expect(html.indexOf("Print")).toBeLessThan(html.indexOf("Cancel order"));
  });

  it("removes Cancel from terminal orders while retaining Print", () => {
    const html = renderToStaticMarkup(<OrderHeaderActions printHref="/print" canCancel={false} orderNumber="260910-0020" clientName="Mary" sourceStatus="cancelled" expectedDateUpdated="2026-09-10T09:00:00.000Z" texts={texts} />);
    expect(html).toContain("Print");
    expect(html).not.toContain("Cancel order");
  });
});
