import { describe, expect, it } from "vitest";

import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import type { AppointmentListItem } from "@/application/dtos/AppointmentListItem";
import type { AppointmentListQuery, AppointmentListReader } from "@/application/ports/AppointmentListReader";
import type { AppointmentRepository, NewAppointment } from "@/application/ports/AppointmentRepository";
import { ListAppointments } from "@/application/useCases/ListAppointments";
import { ScheduleAppointment } from "@/application/useCases/ScheduleAppointment";
import { UpdateAppointmentStatus } from "@/application/useCases/UpdateAppointmentStatus";
import type { Appointment } from "@/domain/entities/Appointment";
import type { Client } from "@/domain/entities/Client";
import { AppointmentConflictError } from "@/domain/errors/AppointmentConflictError";
import { IdempotencyConflictError } from "@/domain/errors/IdempotencyConflictError";
import type { AppointmentStatus } from "@/domain/values/AppointmentStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

const VALID_KEY = "123e4567-e89b-42d3-a456-426614174000";

describe("ScheduleAppointment", () => {
  it("creates a valid appointment", async () => {
    const repository = new FakeAppointmentRepository();
    const useCase = new ScheduleAppointment(repository);
    const scheduledAt = new Date("2026-09-01T10:30:00.000Z");

    const appointment = await useCase.execute({ clientId: "client-1", appointmentId: VALID_KEY, orderId: "order-1", scheduledAt, notes: "Fitting" });

    expect(repository.created).toEqual([{ id: VALID_KEY, clientId: "client-1", orderId: "order-1", scheduledAt, notes: "Fitting" }]);
    expect(appointment.client?.id).toBe("client-1");
    expect(appointment.scheduledAt).toBe(scheduledAt);
  });
  it("returns the compatible saved appointment before retrying create with the same UUID", async () => {
    const scheduledAt = new Date("2026-09-01T10:30:00.000Z");
    const existing = makeAppointment({
      clientId: "client-1",
      scheduledAt,
      notes: "Fitting",
    });
    const repository = new FakeAppointmentRepository([], existing);
    const useCase = new ScheduleAppointment(repository);

    await expect(useCase.execute({
      clientId: "client-1", appointmentId: VALID_KEY, scheduledAt, notes: "Fitting",
    })).resolves.toBe(existing);

    expect(repository.created).toEqual([]);
    expect(repository.lookups).toBe(1);
  });


  it("rejects blank client ids without calling the repository", async () => {
    const repository = new FakeAppointmentRepository();
    const useCase = new ScheduleAppointment(repository);

    await expect(useCase.execute({ clientId: "   ", appointmentId: VALID_KEY, scheduledAt: new Date("2026-09-01T10:30:00.000Z") })).rejects.toThrow("Client is required");
    expect(repository.created).toEqual([]);
  });

  it("rejects missing appointment dates without calling the repository", async () => {
    const repository = new FakeAppointmentRepository();
    const useCase = new ScheduleAppointment(repository);

    await expect(useCase.execute({ clientId: "client-1", appointmentId: VALID_KEY, scheduledAt: null })).rejects.toThrow("A date and time is required");
    expect(repository.created).toEqual([]);
  });
});

describe("ListAppointments", () => {
  it("passes the date range through to the repository", async () => {
    const from = new Date("2026-09-01T00:00:00.000Z");
    const to = new Date("2026-09-07T23:59:59.000Z");
    const appointments = [makeAppointmentListItem({ id: "appointment-1" })];
    const reader = new FakeAppointmentListReader(appointments);
    const useCase = new ListAppointments(reader);

    await expect(useCase.execute({ from, to, statuses: ["scheduled"] })).resolves.toEqual(appointments);
    expect(reader.lastListQuery).toEqual({ from, to, statuses: ["scheduled"] });
  });
});

describe("ScheduleAppointment conflicts", () => {
  it("identifies only the fields that differ from a saved appointment", async () => {
    const repository = new FakeAppointmentRepository([], makeAppointment({ clientId: "another-client", notes: "" }));

    const error = await new ScheduleAppointment(repository).execute({ clientId: "client-1", appointmentId: VALID_KEY, scheduledAt: new Date("2026-09-01T10:30:00.000Z") }).catch(value => value);

    expect(error).toBeInstanceOf(IdempotencyConflictError);
    expect((error as IdempotencyConflictError).mismatchedFields).toEqual(["client"]);
    expect((error as IdempotencyConflictError).mismatchDetails).toEqual([]);
  });
});

describe("UpdateAppointmentStatus", () => {
  it.each(["scheduled", "completed", "cancelled"] as const)("updates a valid %s appointment status", async (status) => {
    const repository = new FakeAppointmentRepository([makeAppointment({ id: "appointment-1" })]);
    const useCase = new UpdateAppointmentStatus(repository);

    const appointment = await useCase.execute({ appointmentId: "appointment-1", expectedStatus: "scheduled", status });

    expect(repository.updatedStatuses).toEqual([{ appointmentId: "appointment-1", expectedStatus: "scheduled", status }]);
    expect(appointment.status).toBe(status);
  });

  it("rejects invalid appointment statuses without calling the repository", async () => {
    const repository = new FakeAppointmentRepository([makeAppointment({ id: "appointment-1" })]);
    const useCase = new UpdateAppointmentStatus(repository);

    await expect(useCase.execute({ appointmentId: "appointment-1", expectedStatus: "scheduled", status: "lost" })).rejects.toThrow("Invalid appointment status");
    expect(repository.updatedStatuses).toEqual([]);
  });

  it("returns the persisted target after an uncertain update response", async () => {
    const persisted = makeAppointment({ status: "completed" });
    const repository = new FakeAppointmentRepository([], null, {
      updateError: new Error("timeout"),
      reads: [persisted],
    });

    await expect(new UpdateAppointmentStatus(repository).execute({
      appointmentId: "appointment-1",
      expectedStatus: "scheduled",
      status: "completed",
    })).resolves.toBe(persisted);
  });

  it("confirms the update was not saved when reconciliation still sees the expected status", async () => {
    const scheduled = makeAppointment({ status: "scheduled" });
    const repository = new FakeAppointmentRepository([], null, {
      updateError: new Error("timeout"),
      reads: [scheduled],
    });

    await expect(new UpdateAppointmentStatus(repository).execute({
      appointmentId: "appointment-1",
      expectedStatus: "scheduled",
      status: "completed",
    })).rejects.toBeInstanceOf(MutationConfirmedNotSavedError);
  });

  it("keeps the result unknown when both update and reconciliation fail", async () => {
    const repository = new FakeAppointmentRepository([], null, {
      updateError: new Error("timeout"),
      reads: [new Error("Directus unavailable")],
    });

    await expect(new UpdateAppointmentStatus(repository).execute({
      appointmentId: "appointment-1",
      expectedStatus: "scheduled",
      status: "completed",
    })).rejects.toBeInstanceOf(MutationOutcomeUnknownError);
  });

  it("reports a conflict when reconciliation finds a different terminal status", async () => {
    const repository = new FakeAppointmentRepository([], null, {
      updateError: new Error("timeout"),
      reads: [makeAppointment({ status: "cancelled" })],
    });

    await expect(new UpdateAppointmentStatus(repository).execute({
      appointmentId: "appointment-1",
      expectedStatus: "scheduled",
      status: "completed",
    })).rejects.toBeInstanceOf(AppointmentConflictError);
  });
});

class FakeAppointmentRepository implements AppointmentRepository {
  readonly created: NewAppointment[] = [];
  readonly updatedStatuses: { appointmentId: string; expectedStatus: AppointmentStatus; status: AppointmentStatus }[] = [];
  lookups = 0;

  private readonly reads: unknown[];

  constructor(
    private readonly appointments: readonly Appointment[] = [],
    private readonly idempotentMatch: Appointment | null = null,
    private readonly options: { updateError?: unknown; reads?: unknown[] } = {},
  ) {
    this.reads = [...(options.reads ?? [])];
  }

  async getById(): Promise<Appointment | null> {
    this.lookups += 1;
    if (this.reads.length > 0) {
      const result = this.reads.shift();
      if (result instanceof Error) throw result;
      return (result as Appointment | null | undefined) ?? null;
    }
    return this.idempotentMatch;
  }

  async create(appointment: NewAppointment): Promise<Appointment> {
    this.created.push(appointment);

    return makeAppointment({
      client: makeClient({ id: appointment.clientId }),
      clientId: appointment.clientId,
      orderId: appointment.orderId,
      scheduledAt: appointment.scheduledAt,
      notes: appointment.notes,
    });
  }

  async updateStatus(input: { appointmentId: string; expectedStatus: AppointmentStatus; status: AppointmentStatus }): Promise<Appointment> {
    this.updatedStatuses.push(input);
    if (this.options.updateError !== undefined) throw this.options.updateError;
    const appointment = this.appointments.find((candidate) => candidate.id === input.appointmentId) ?? makeAppointment({ id: input.appointmentId });

    return { ...appointment, status: input.status };
  }

  async updateDetails(): Promise<Appointment> { return makeAppointment(); }

  async deleteScheduled(): Promise<void> {}
}

class FakeAppointmentListReader implements AppointmentListReader {
  lastListQuery: AppointmentListQuery | null = null;

  constructor(private readonly appointments: readonly AppointmentListItem[]) {}

  async list(query: AppointmentListQuery): Promise<AppointmentListItem[]> {
    this.lastListQuery = query;
    return [...this.appointments];
  }
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appointment-1",
    client: makeClient(),
    scheduledAt: new Date("2026-09-01T10:30:00.000Z"),
    status: "scheduled",
    ...overrides,
  };
}

function makeAppointmentListItem(overrides: Partial<AppointmentListItem> = {}): AppointmentListItem {
  return {
    id: "appointment-1",
    clientId: "client-1",
    clientName: "Mary",
    scheduledAt: new Date("2026-09-01T10:30:00.000Z"),
    status: "scheduled",
    notes: "Fitting",
    ...overrides,
  };
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    name: "Mary",
    phone: PhoneNumber.fromRaw("085 200 9225"),
    gdprConsent: true,
    ...overrides,
  };
}
