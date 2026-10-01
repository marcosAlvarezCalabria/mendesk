import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TicketPrintingPanel } from "@/app/orders/[orderNumber]/tickets/TicketPrintingPanel";

describe("TicketPrintingPanel Ukrainian copy", () => {
  it("localizes the compact queue and alteration type", () => {
    const html = renderToStaticMarkup(
      <TicketPrintingPanel
        labels={{ client: "Клієнт", garment: "Виріб", alteration: "Переробка", measurements: "Мірки", due: "Термін", price: "Ціна", deposit: "Завдаток", outstanding: "До сплати" }}
        locale="uk"
        returnTo="/orders/260913-0007"
        storeName="Demo Atelier"
        tickets={[{
          ticket: {
            orderNumber: "260913-0007", clientName: "Марія", garmentDescription: "Сукня",
            alterationType: "hem", measurements: null, price: "35.00", depositPaid: "10.00",
            outstanding: "25.00", dueDate: "2026-09-20T10:00:00.000Z",
            deepLinkUrl: "https://demo.mendesk.example/orders/260913-0007",
          },
          qrSvg: "<svg></svg>",
        }]}
      />,
    );

    expect(html).toContain("Черга друку");
    expect(html).toContain("Підгин");
    expect(html).not.toContain(">Hem<");
  });
});
