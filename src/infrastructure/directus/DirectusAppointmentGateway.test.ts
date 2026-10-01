import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDirectusAppointmentGateway } from "@/infrastructure/directus/DirectusAppointmentGateway";

const sdk = vi.hoisted(() => ({
  request: vi.fn(),
  readItems: vi.fn((collection: string, query: unknown) => ({ collection, query })),
  createItem: vi.fn(),
  deleteItems: vi.fn((collection: string, query: unknown) => ({ collection, query, operation: "delete" })),
  updateItems: vi.fn((collection: string, query: unknown, payload: unknown, options: unknown) => ({ collection, query, payload, options })),
}));

vi.mock("@directus/sdk", () => ({
  createDirectus: () => {
    const client = { with: () => client, request: sdk.request };
    return client;
  },
  rest: () => ({}),
  staticToken: () => ({}),
  readItems: sdk.readItems,
  createItem: sdk.createItem,
  deleteItems: sdk.deleteItems,
  updateItems: sdk.updateItems,
}));

describe("DirectusAppointmentGateway listAppointments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.request.mockResolvedValue([]);
  });

  it("requests only fields rendered by the agenda with a minimal client", async () => {
    const gateway = createDirectusAppointmentGateway("https://directus.example", "token");

    await gateway.listAppointments("2026-09-01T00:00:00.000Z", "2026-09-08T00:00:00.000Z", ["scheduled"]);

    const options = sdk.readItems.mock.calls[0]?.[1];
    expect(options).toEqual({
      fields: ["id", "scheduled_at", "notes", "status", { client: ["id", "name"] }, { order_: ["id", "order_number", "status"] }],
      filter: { scheduled_at: { _gte: "2026-09-01T00:00:00.000Z", _lt: "2026-09-08T00:00:00.000Z" }, status: { _in: ["scheduled"] } },
      sort: ["scheduled_at", "id"],
      limit: -1,
    });
    expect(JSON.stringify(options)).not.toMatch(/garments|photo|payments|phone|gdpr_consent/);
  });

  it("requests newest terminal history with relational name and normalized phone search", async () => {
    const gateway = createDirectusAppointmentGateway("https://directus.example", "token");

    await gateway.listAppointmentHistory({ limit: 40, search: "+353 85 200 9225", status: "cancelled" });

    expect(sdk.readItems).toHaveBeenCalledWith("appointments", {
      fields: ["id", "scheduled_at", "notes", "status", { client: ["id", "name"] }, { order_: ["id", "order_number", "status"] }],
      filter: {
        _and: [
          { status: { _in: ["cancelled"] } },
          { _or: [
            { client: { name: { _icontains: "+353 85 200 9225" } } },
            { client: { phone: { _contains: "353852009225" } } },
          ] },
        ],
      },
      sort: ["-scheduled_at", "-id"],
      limit: 41,
    });
  });

  it("reconciles by primary UUID with a read-only request", async () => {
    const gateway = createDirectusAppointmentGateway("https://directus.example", "token");
    await gateway.getAppointment("550e8400-e29b-41d4-a716-446655440000");
    expect(sdk.readItems).toHaveBeenCalledWith("appointments", {
      fields: ["id", { client: ["id", "name", "phone", "gdpr_consent", "notes"] }, { order_: ["id", "order_number", "status"] }, "scheduled_at", "notes", "status"],
      filter: { id: { _eq: "550e8400-e29b-41d4-a716-446655440000" } },
      limit: 1,
    });
    expect(sdk.createItem).not.toHaveBeenCalled();
    expect(sdk.updateItems).not.toHaveBeenCalled();
  });

  it("treats a missing primary UUID as a confirmed absence", async () => {
    sdk.request.mockResolvedValueOnce([]);
    const gateway = createDirectusAppointmentGateway("https://directus.example", "token");

    await expect(gateway.getAppointment("550e8400-e29b-41d4-a716-446655440000")).resolves.toBeNull();
  });

  it("propagates an unconfirmed primary UUID lookup failure", async () => {
    const unavailable = { response: { status: 503 } };
    sdk.request.mockRejectedValueOnce(unavailable);
    const gateway = createDirectusAppointmentGateway("https://directus.example", "token");

    await expect(
      gateway.getAppointment("550e8400-e29b-41d4-a716-446655440000"),
    ).rejects.toBe(unavailable);
  });

  it("updates a status only while the persisted appointment is still scheduled", async () => {
    const gateway = createDirectusAppointmentGateway("https://directus.example", "token");

    await gateway.updateAppointmentStatus("appointment-1", "scheduled", "completed");

    expect(sdk.updateItems).toHaveBeenCalledWith(
      "appointments",
      { filter: { id: { _eq: "appointment-1" }, status: { _eq: "scheduled" } } },
      { status: "completed" },
      { fields: ["id", { client: ["id", "name", "phone", "gdpr_consent", "notes"] }, { order_: ["id", "order_number", "status"] }, "scheduled_at", "notes", "status"] },
    );
  });

  it("updates editable details only while the appointment is still scheduled", async () => {
    const gateway = createDirectusAppointmentGateway("https://directus.example", "token");

    await gateway.updateAppointmentDetails("appointment-1", "scheduled", {
      scheduled_at: "2026-09-12T09:00:00",
      order_: "order-1",
      notes: "Fitting",
    }, {
      scheduled_at: "2026-09-13T10:30:00",
      order_: null,
      notes: "Second fitting",
    });

    expect(sdk.updateItems).toHaveBeenCalledWith(
      "appointments",
      { filter: { id: { _eq: "appointment-1" }, status: { _eq: "scheduled" }, scheduled_at: { _eq: "2026-09-12T09:00:00" }, order_: { _eq: "order-1" }, notes: { _eq: "Fitting" } } },
      { scheduled_at: "2026-09-13T10:30:00", order_: null, notes: "Second fitting" },
      { fields: ["id", { client: ["id", "name", "phone", "gdpr_consent", "notes"] }, { order_: ["id", "order_number", "status"] }, "scheduled_at", "notes", "status"] },
    );
  });

  it("creates an appointment without requesting restricted system fields", async () => {
    const gateway = createDirectusAppointmentGateway("https://directus.example", "token");
    const payload = { id: "appointment-1", client: "client-1", scheduled_at: "2026-09-11T10:00:00.000Z" };

    await gateway.createAppointment(payload);

    expect(sdk.createItem).toHaveBeenCalledWith("appointments", payload, {
      fields: ["id", { client: ["id", "name", "phone", "gdpr_consent", "notes"] }, { order_: ["id", "order_number", "status"] }, "scheduled_at", "notes", "status"],
    });
  });

  it("deletes only a scheduled appointment and confirms that it is absent", async () => {
    sdk.request.mockResolvedValueOnce(undefined).mockResolvedValueOnce([]);
    const gateway = createDirectusAppointmentGateway("https://directus.example", "token");

    await expect(gateway.deleteScheduledAppointment("appointment-1")).resolves.toBe("deleted");

    expect(sdk.deleteItems).toHaveBeenCalledWith("appointments", {
      filter: { id: { _eq: "appointment-1" }, status: { _eq: "scheduled" } },
    });
    expect(sdk.readItems).toHaveBeenCalledWith("appointments", {
      fields: ["id"],
      filter: { id: { _eq: "appointment-1" } },
      limit: 1,
    });
  });

  it("reports a conflict when the appointment still exists after the conditional delete", async () => {
    sdk.request.mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ id: "appointment-1" }]);
    const gateway = createDirectusAppointmentGateway("https://directus.example", "token");

    await expect(gateway.deleteScheduledAppointment("appointment-1")).resolves.toBe("conflict");
  });

});
