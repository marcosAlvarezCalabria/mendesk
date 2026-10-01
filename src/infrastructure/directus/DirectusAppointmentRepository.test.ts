import { describe, expect, it } from "vitest";

import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { DirectusAppointmentRepository } from "@/infrastructure/directus/DirectusAppointmentRepository";
import type { DirectusAppointmentCreatePayload, DirectusAppointmentDetailsPayload, DirectusAppointmentGateway } from "@/infrastructure/directus/DirectusAppointmentGateway";
import type { DirectusAppointmentListRecord, DirectusAppointmentRecord, DirectusClientRecord } from "@/infrastructure/directus/records";

describe("DirectusAppointmentRepository", () => {
  it("creates appointments with client, order_, scheduled_at, and notes", async () => {
    const gateway = new FakeDirectusAppointmentGateway();
    const repository = new DirectusAppointmentRepository(gateway);
    const scheduledAt = new Date("2026-09-01T10:30:00.000Z");

    const appointment = await repository.create({ id: key().value, clientId: "client-1", orderId: "order-1", scheduledAt, notes: "Fitting" });

    expect(gateway.created).toEqual([{ id: key().value, client: "client-1", order_: "order-1", scheduled_at: "2026-09-01T11:30:00", notes: "Fitting" }]);
    expect(appointment.clientId).toBe("client-1");
    expect(appointment.orderId).toBe("order-1");
  });

  it("does not invent a saved appointment after an empty create response", async () => {
    const gateway = new FakeDirectusAppointmentGateway([], true);
    const repository = new DirectusAppointmentRepository(gateway);
    const scheduledAt = new Date("2026-09-01T10:30:00.000Z");

    await expect(
      repository.create({ id: key().value, clientId: "client-1", scheduledAt }),
    ).rejects.toBeInstanceOf(MutationOutcomeUnknownError);
  });

  it("looks up an appointment by its stable primary UUID", async () => {
    const gateway = new FakeDirectusAppointmentGateway([], false, makeRecord({ id: key().value }));
    const repository = new DirectusAppointmentRepository(gateway);
    await expect(repository.getById(key().value)).resolves.toMatchObject({ id: key().value });
    expect(gateway.lookedUpIds).toEqual([key().value]);
  });

  it("returns the client details needed by the appointment page", async () => {
    const gateway = new FakeDirectusAppointmentGateway([], false, makeRecord({ client: makeClient({ name: "Melissa", phone: "353852009225" }) }));
    const repository = new DirectusAppointmentRepository(gateway);

    await expect(repository.getById(key().value)).resolves.toMatchObject({
      client: { name: "Melissa" },
    });
  });

  it("lists appointments with ISO range filters", async () => {
    const record = makeListRecord({ id: "appointment-1" });
    const gateway = new FakeDirectusAppointmentGateway([record]);
    const repository = new DirectusAppointmentRepository(gateway);
    const from = new Date("2026-09-01T00:00:00.000Z");
    const to = new Date("2026-09-07T23:59:59.000Z");

    const appointments = await repository.list({ from, to, statuses: ["scheduled"] });

    expect(gateway.lastListArgs).toEqual({ fromIso: "2026-09-01T00:00:00.000Z", toIso: "2026-09-07T23:59:59.000Z", statuses: ["scheduled"] });
    expect(appointments).toHaveLength(1);
    expect(appointments[0]?.id).toBe("appointment-1");
    expect(appointments[0]?.clientName).toBe("Mary");
  });

  it("returns an accumulated history page and detects earlier records", async () => {
    const records = [makeListRecord({ id: "newer", status: "completed" }), makeListRecord({ id: "earlier", status: "cancelled" })];
    const gateway = new FakeDirectusAppointmentGateway(records);
    const repository = new DirectusAppointmentRepository(gateway);

    await expect(repository.listHistory({ limit: 1, search: "Mary" })).resolves.toEqual({
      items: [expect.objectContaining({ id: "newer" })],
      hasEarlier: true,
    });
    expect(gateway.lastHistoryQuery).toEqual({ limit: 1, search: "Mary" });
  });

  it("updates appointment statuses and returns the refreshed appointment", async () => {
    const gateway = new FakeDirectusAppointmentGateway();
    const repository = new DirectusAppointmentRepository(gateway);

    const appointment = await repository.updateStatus({ appointmentId: "appointment-1", expectedStatus: "scheduled", status: "completed" });

    expect(gateway.updatedStatuses).toEqual([{ id: "appointment-1", expectedStatus: "scheduled", status: "completed" }]);
    expect(appointment.status).toBe("completed");
  });

  it("maps editable details to the Directus field names", async () => {
    const gateway = new FakeDirectusAppointmentGateway();
    const repository = new DirectusAppointmentRepository(gateway);

    await repository.updateDetails({ appointmentId: "appointment-1", expectedStatus: "scheduled", expectedScheduledAt: new Date("2026-09-12T08:00:00.000Z"), expectedOrderId: "order-1", expectedNotes: "Fitting", scheduledAt: new Date("2026-09-13T09:30:00.000Z"), notes: "Second fitting" });

    expect(gateway.updatedDetails).toEqual([{ id: "appointment-1", expectedStatus: "scheduled", expected: { scheduled_at: "2026-09-12T09:00:00", order_: "order-1", notes: "Fitting" }, payload: { scheduled_at: "2026-09-13T10:30:00", order_: null, notes: "Second fitting" } }]);
  });

  it("reports a conditional status update with no matching row as confirmed not saved", async () => {
    const gateway = new FakeDirectusAppointmentGateway([], false, null, true);
    const repository = new DirectusAppointmentRepository(gateway);

    await expect(repository.updateStatus({
      appointmentId: "appointment-1",
      expectedStatus: "scheduled",
      status: "completed",
    })).rejects.toBeInstanceOf(MutationConfirmedNotSavedError);
  });

  it("deletes an appointment only while it is still scheduled", async () => {
    const gateway = new FakeDirectusAppointmentGateway();
    const repository = new DirectusAppointmentRepository(gateway);

    await repository.deleteScheduled("appointment-1");

    expect(gateway.deletedIds).toEqual(["appointment-1"]);
  });

  it("reports a conditional delete conflict as confirmed not saved", async () => {
    const gateway = new FakeDirectusAppointmentGateway([], false, null, false, "conflict");
    const repository = new DirectusAppointmentRepository(gateway);

    await expect(repository.deleteScheduled("appointment-1")).rejects.toBeInstanceOf(MutationConfirmedNotSavedError);
  });
});

class FakeDirectusAppointmentGateway implements DirectusAppointmentGateway {
  readonly created: DirectusAppointmentCreatePayload[] = [];
  readonly updatedStatuses: { id: string; expectedStatus: string; status: string }[] = [];
  readonly updatedDetails: { id: string; expectedStatus: "scheduled"; expected: DirectusAppointmentDetailsPayload; payload: DirectusAppointmentDetailsPayload }[] = [];
  readonly lookedUpIds: string[] = [];
  readonly deletedIds: string[] = [];
  lastListArgs: { fromIso?: string; toIso?: string; statuses?: readonly string[] } | null = null;
  lastHistoryQuery: { limit: number; search?: string; status?: "completed" | "cancelled" } | null = null;

  constructor(
    private readonly records: readonly DirectusAppointmentListRecord[] = [],
    private readonly emptyCreate = false,
    private readonly lookupRecord: DirectusAppointmentRecord | null = null,
    private readonly emptyUpdate = false,
    private readonly deleteResult: "deleted" | "conflict" = "deleted",
  ) {}
  async getAppointment(id: string) { this.lookedUpIds.push(id); return this.lookupRecord; }

  async createAppointment(payload: DirectusAppointmentCreatePayload): Promise<DirectusAppointmentRecord | null> {
    this.created.push(payload);

    if (this.emptyCreate) {
      return null;
    }

    return makeRecord({ id: payload.id, client: payload.client, order_: payload.order_ ?? null, scheduled_at: payload.scheduled_at, notes: payload.notes ?? null });
  }

  async listAppointments(fromIso?: string, toIso?: string, statuses?: readonly string[]): Promise<DirectusAppointmentListRecord[]> {
    this.lastListArgs = { fromIso, toIso, statuses };

    return [...this.records];
  }

  async listAppointmentHistory(query: { limit: number; search?: string; status?: "completed" | "cancelled" }): Promise<DirectusAppointmentListRecord[]> {
    this.lastHistoryQuery = query;
    return [...this.records];
  }

  async updateAppointmentStatus(id: string, expectedStatus: string, status: string): Promise<DirectusAppointmentRecord | null> {
    this.updatedStatuses.push({ id, expectedStatus, status });
    if (this.emptyUpdate) return null;
    return makeRecord({ id, status });
  }

  async updateAppointmentDetails(id: string, expectedStatus: "scheduled", expected: DirectusAppointmentDetailsPayload, payload: DirectusAppointmentDetailsPayload): Promise<DirectusAppointmentRecord | null> {
    this.updatedDetails.push({ id, expectedStatus, expected, payload });
    return makeRecord({ id, order_: payload.order_, scheduled_at: payload.scheduled_at, notes: payload.notes });
  }

  async deleteScheduledAppointment(id: string): Promise<"deleted" | "conflict"> {
    this.deletedIds.push(id);
    return this.deleteResult;
  }
}

function makeListRecord(overrides: Partial<DirectusAppointmentListRecord> = {}): DirectusAppointmentListRecord {
  return {
    id: "appointment-1",
    client: { id: "client-1", name: "Mary" },
    scheduled_at: "2026-09-01T10:30:00.000Z",
    notes: "Fitting",
    status: "scheduled",
    order_: null,
    ...overrides,
  };
}

function makeRecord(overrides: Partial<DirectusAppointmentRecord> = {}): DirectusAppointmentRecord {
  return {
    id: "appointment-1",
    client: makeClient(),
    order_: "order-1",
    scheduled_at: "2026-09-01T10:30:00.000Z",
    notes: "Fitting",
    status: "scheduled",
    date_created: "2026-08-23T10:00:00.000Z",
    ...overrides,
  };
}

function makeClient(overrides: Partial<DirectusClientRecord> = {}): DirectusClientRecord {
  return {
    id: "client-1",
    name: "Mary",
    phone: "353852009225",
    gdpr_consent: true,
    notes: null,
    ...overrides,
  };
}

function key() {
  return IdempotencyKey.fromString("123e4567-e89b-42d3-a456-426614174000");
}
