import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import type { AppointmentListItem } from "@/application/dtos/AppointmentListItem";
import type { AppointmentListQuery, AppointmentListReader } from "@/application/ports/AppointmentListReader";
import type { AppointmentHistoryPage, AppointmentHistoryQuery, AppointmentHistoryReader } from "@/application/ports/AppointmentHistoryReader";
import type { AppointmentDetailsUpdate, AppointmentRepository, NewAppointment } from "@/application/ports/AppointmentRepository";
import type { Appointment } from "@/domain/entities/Appointment";
import type { AppointmentStatus } from "@/domain/values/AppointmentStatus";
import { mapAppointmentListItem } from "@/infrastructure/directus/appointmentListMapper";
import type { DirectusAppointmentGateway } from "@/infrastructure/directus/DirectusAppointmentGateway";
import { mapAppointment } from "@/infrastructure/directus/mappers/appointmentMapper";
import { formatDublinDateTime } from "@/domain/time/dublinDateTime";

export class DirectusAppointmentRepository implements AppointmentRepository, AppointmentListReader, AppointmentHistoryReader {
  constructor(private readonly gateway: DirectusAppointmentGateway) {}

  async getById(appointmentId: string): Promise<Appointment | null> {
    const record = await this.gateway.getAppointment(appointmentId);
    return record ? mapAppointment(record) : null;
  }

  async create(appointment: NewAppointment): Promise<Appointment> {
    const record = await this.gateway.createAppointment({
      id: appointment.id,
      client: appointment.clientId,
      order_: appointment.orderId,
      scheduled_at: formatDublinDateTime(appointment.scheduledAt),
      notes: appointment.notes,
    });

    if (!record) {
      throw new MutationOutcomeUnknownError();
    }

    return mapAppointment(record);
  }

  async list(query: AppointmentListQuery): Promise<AppointmentListItem[]> {
    const records = await this.gateway.listAppointments(query.from?.toISOString(), query.to?.toISOString(), query.statuses);

    return records.map(mapAppointmentListItem);
  }

  async listHistory(query: AppointmentHistoryQuery): Promise<AppointmentHistoryPage> {
    const records = await this.gateway.listAppointmentHistory(query);
    return {
      items: records.slice(0, query.limit).map(mapAppointmentListItem),
      hasEarlier: records.length > query.limit,
    };
  }

  async updateStatus(input: {
    appointmentId: string;
    expectedStatus: AppointmentStatus;
    status: AppointmentStatus;
  }): Promise<Appointment> {
    const record = await this.gateway.updateAppointmentStatus(
      input.appointmentId,
      input.expectedStatus,
      input.status,
    );

    if (!record) {
      throw new MutationConfirmedNotSavedError();
    }

    return mapAppointment(record);
  }

  async updateDetails(input: AppointmentDetailsUpdate): Promise<Appointment> {
    const record = await this.gateway.updateAppointmentDetails(input.appointmentId, input.expectedStatus, {
      scheduled_at: formatDublinDateTime(input.expectedScheduledAt),
      order_: input.expectedOrderId ?? null,
      notes: input.expectedNotes ?? null,
    }, {
      scheduled_at: formatDublinDateTime(input.scheduledAt),
      order_: input.orderId ?? null,
      notes: input.notes ?? null,
    });

    if (!record) throw new MutationConfirmedNotSavedError();
    return mapAppointment(record);
  }

  async deleteScheduled(appointmentId: string): Promise<void> {
    const result = await this.gateway.deleteScheduledAppointment(appointmentId);
    if (result === "conflict") throw new MutationConfirmedNotSavedError();
  }
}
