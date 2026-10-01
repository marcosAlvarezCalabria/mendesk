import { describe, expect, it } from "vitest";

import type { AppointmentRepository } from "@/application/ports/AppointmentRepository";
import { DeleteScheduledAppointment } from "@/application/useCases/DeleteScheduledAppointment";
import type { Appointment } from "@/domain/entities/Appointment";
import type { AppointmentStatus } from "@/domain/values/AppointmentStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("DeleteScheduledAppointment", () => {
  it("deletes a scheduled appointment", async () => {
    const repository = new FakeRepository(appointment("scheduled"));
    await new DeleteScheduledAppointment(repository).execute(" appointment-1 ");
    expect(repository.deleted).toEqual(["appointment-1"]);
  });

  it.each(["completed", "cancelled"] as const)("keeps a %s appointment", async status => {
    const repository = new FakeRepository(appointment(status));
    await expect(new DeleteScheduledAppointment(repository).execute("appointment-1")).rejects.toThrow("Only scheduled appointments can be deleted");
    expect(repository.deleted).toEqual([]);
  });

  it("treats an already absent appointment as deleted", async () => {
    const repository = new FakeRepository(null);
    await expect(new DeleteScheduledAppointment(repository).execute("appointment-1")).resolves.toBeUndefined();
    expect(repository.deleted).toEqual([]);
  });
});

class FakeRepository implements AppointmentRepository {
  readonly deleted: string[] = [];
  constructor(private readonly value: Appointment | null) {}
  async getById() { return this.value; }
  async create(): Promise<Appointment> { throw new Error("Not used"); }
  async updateStatus(): Promise<Appointment> { throw new Error("Not used"); }
  async updateDetails(): Promise<Appointment> { throw new Error("Not used"); }
  async deleteScheduled(id: string) { this.deleted.push(id); }
}

function appointment(status: AppointmentStatus): Appointment {
  return { id: "appointment-1", client: { id: "client-1", name: "Test", phone: PhoneNumber.fromRaw("0850000000"), gdprConsent: true }, clientId: "client-1", scheduledAt: new Date("2026-09-12T08:00:00.000Z"), status };
}
