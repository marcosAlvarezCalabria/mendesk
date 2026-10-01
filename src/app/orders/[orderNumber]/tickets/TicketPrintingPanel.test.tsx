import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TicketPrintingPanel } from "@/app/orders/[orderNumber]/tickets/TicketPrintingPanel";

const tickets = [
  {
    ticket: {
      orderNumber: "260913-0007",
      clientName: "Mary",
      garmentDescription: "Blue dress",
      alterationType: "hem" as const,
      measurements: "2 cm",
      price: "45.00",
      depositPaid: "20.00",
      outstanding: "25.00",
      dueDate: "2026-09-20T00:00:00.000Z",
      deepLinkUrl: "https://panel.kokoatelier.ie/orders/260913-0007",
    },
    qrSvg: "<svg aria-label=\"QR\"></svg>",
  },
  {
    ticket: {
      orderNumber: "260913-0007",
      clientName: "Mary",
      garmentDescription: "Black trousers",
      alterationType: "waist" as const,
      measurements: null,
      price: "30.00",
      depositPaid: "20.00",
      outstanding: "25.00",
      dueDate: "2026-09-20T00:00:00.000Z",
      deepLinkUrl: "https://panel.kokoatelier.ie/orders/260913-0007",
    },
    qrSvg: "<svg aria-label=\"QR\"></svg>",
  },
];

describe("TicketPrintingPanel", () => {
  it("starts with every garment selected and exposes compact print actions", () => {
    const html = renderToStaticMarkup(
      <TicketPrintingPanel
        labels={{ client: "Client", garment: "Garment", alteration: "Alteration", measurements: "Measurements", due: "Due", price: "Price", deposit: "Deposit", outstanding: "Outstanding" }}
        locale="en"
        returnTo="/orders/260913-0007"
        tickets={tickets}
      />,
    );

    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html.match(/checked=""/g)).toHaveLength(2);
    expect(html).toContain("Print selected (2)");
    expect(html.match(/Print one/g)).toHaveLength(2);
    expect(html).toContain("Print from browser");
    expect(html).toContain("Not connected");
  });

  it("keeps full ticket sheets out of the on-screen flow", () => {
    const html = renderToStaticMarkup(
      <TicketPrintingPanel
        labels={{ client: "Client", garment: "Garment", alteration: "Alteration", measurements: "Measurements", due: "Due", price: "Price", deposit: "Deposit", outstanding: "Outstanding" }}
        locale="en"
        returnTo="/orders/260913-0007"
        tickets={tickets}
      />,
    );

    expect(html).toContain("hidden print:block");
    expect(html).toContain("€45.00");
    expect(html).toContain("€20.00");
    expect(html).toContain("€25.00");
    expect(html).not.toContain("https://panel.kokoatelier.ie/orders/260913-0007</p>");
  });
});
