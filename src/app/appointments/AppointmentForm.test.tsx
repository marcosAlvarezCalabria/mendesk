import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AppointmentForm, type AppointmentFormTexts } from "@/app/appointments/AppointmentForm";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const texts: AppointmentFormTexts = {
  title: "New appointment", client: "Client", searchPlaceholder: "Search",
  selected: "Selected", searching: "Searching", noClients: "No clients",
  dateTime: "Date", notes: "Notes", notesPlaceholder: "Notes",
  date: "Date", time: "Time", changeClient: "Change", newClient: "New client",
  linkedOrder: "Linked order", noLinkedOrder: "No linked order", loadingOrders: "Loading orders",
  startOver: "Start over",
  schedule: "Schedule", scheduling: "Scheduling", checkSaved: "Check Directus",
  checkingSaved: "Checking", confirmedAbsent: "Not saved", confirmedSaved: "Saved",
  error: "The appointment could not be saved.",
  orderStatuses: { received: "Received", ready: "Ready", collected: "Collected", cancelled: "Cancelled" },
};

describe("AppointmentForm", () => {
  it("renders the stable appointment primary UUID", () => {
    const html = renderToStaticMarkup(
      <AppointmentForm appointmentId="550e8400-e29b-41d4-a716-446655440000" texts={texts} />,
    );
    expect(html).toContain('name="appointment_id"');
    expect(html).toContain('value="550e8400-e29b-41d4-a716-446655440000"');
    expect(html).toContain('name="appointment_date"');
    expect(html).toContain('name="appointment_time"');
    expect(html).toContain('name="order_id"');
    expect(html).toContain('href="/clients/new?returnTo=%2Fappointments%2Fnew"');
    expect(html).toContain("Start over");
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("min-h-11");
  });

  it("shows translated order statuses instead of persisted identifiers", () => {
    const html = renderToStaticMarkup(
      <AppointmentForm appointmentId="550e8400-e29b-41d4-a716-446655440000" initialClient={{ id: "client-1", name: "Client", phone: null }} initialOrders={[{ id: "order-1", orderNumber: "260913-0022", status: "received" }]} texts={texts} />,
    );
    expect(html).toContain("260913-0022 · Received");
    expect(html).not.toContain("260913-0022 · received");
  });
});
