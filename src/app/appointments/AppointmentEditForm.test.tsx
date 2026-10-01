import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useActionState: (_action: unknown, initial: unknown) => [initial, vi.fn(), false],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/appointments/actions", () => ({ updateAppointmentDetailsAction: vi.fn() }));

import { AppointmentEditForm, type AppointmentEditTexts } from "@/app/appointments/AppointmentEditForm";

const texts: AppointmentEditTexts = {
  title: "Edit appointment",
  date: "Date",
  time: "Time",
  linkedOrder: "Linked order",
  noLinkedOrder: "No linked order",
  loadingOrders: "Loading orders...",
  notes: "Notes",
  notesPlaceholder: "Optional notes",
  save: "Save changes",
  saving: "Saving...",
  saved: "Changes saved",
  unsaved: "Unsaved changes",
  error: "The appointment could not be saved.",
  orderStatuses: { received: "Received", ready: "Ready", collected: "Collected", cancelled: "Cancelled" },
};

describe("AppointmentEditForm", () => {
  it("starts collapsed with the original values preserved for conditional editing", () => {
    const html = renderToStaticMarkup(
      <AppointmentEditForm
        appointmentId="appointment-1"
        clientId="client-1"
        initialOrders={[{ id: "order-1", orderNumber: "260912-0021", status: "received" }]}
        initialValues={{ date: "2026-09-12", time: "10:30", orderId: "order-1", notes: "Fitting" }}
        texts={texts}
      />,
    );

    expect(html).toContain('name="appointment-detail-editor"');
    expect(html).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
    expect(html).toContain('name="expected_scheduled_at" value="2026-09-12T10:30"');
    expect(html).toContain('name="expected_order_id" value="order-1"');
    expect(html).toContain('name="expected_notes" value="Fitting"');
    expect(html).toContain('value="order-1" selected="">260912-0021 · Received</option>');
  });
});
