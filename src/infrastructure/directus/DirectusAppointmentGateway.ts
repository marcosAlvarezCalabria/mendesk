import { createDirectus, createItem, deleteItems, readItems, rest, staticToken, updateItems } from "@directus/sdk";

import type { DirectusAppointmentListRecord, DirectusAppointmentRecord } from "@/infrastructure/directus/records";

export type DirectusAppointmentCreatePayload = { id: string; client: string; order_?: string; scheduled_at: string; notes?: string };
export type DirectusAppointmentDetailsPayload = { order_: string | null; scheduled_at: string; notes: string | null };
export type DirectusAppointmentHistoryQuery = { limit: number; search?: string; status?: "completed" | "cancelled" };

export interface DirectusAppointmentGateway {
  createAppointment(payload: DirectusAppointmentCreatePayload): Promise<DirectusAppointmentRecord | null>;
  getAppointment(id: string): Promise<DirectusAppointmentRecord | null>;
  listAppointments(fromIso?: string, toIso?: string, statuses?: readonly string[]): Promise<DirectusAppointmentListRecord[]>;
  listAppointmentHistory(query: DirectusAppointmentHistoryQuery): Promise<DirectusAppointmentListRecord[]>;
  updateAppointmentDetails(id: string, expectedStatus: "scheduled", expected: DirectusAppointmentDetailsPayload, payload: DirectusAppointmentDetailsPayload): Promise<DirectusAppointmentRecord | null>;
  updateAppointmentStatus(id: string, expectedStatus: string, status: string): Promise<DirectusAppointmentRecord | null>;
  deleteScheduledAppointment(id: string): Promise<"deleted" | "conflict">;
}

type DirectusSchema = {
  appointments: DirectusAppointmentRecord[];
};

const APPOINTMENT_LIST_FIELDS = ["id", "scheduled_at", "notes", "status", { client: ["id", "name"] }, { order_: ["id", "order_number", "status"] }] as const;
const APPOINTMENT_MUTATION_FIELDS = ["id", { client: ["id", "name", "phone", "gdpr_consent", "notes"] }, { order_: ["id", "order_number", "status"] }, "scheduled_at", "notes", "status"] as const;

export function createDirectusAppointmentGateway(url: string, token: string): DirectusAppointmentGateway {
  const client = createDirectus<DirectusSchema>(url).with(staticToken(token)).with(rest());

  return {
    async getAppointment(id: string) {
      const records = await client.request(readItems("appointments", {
        fields: APPOINTMENT_MUTATION_FIELDS as unknown as readonly ("*" | keyof DirectusAppointmentRecord)[],
        filter: { id: { _eq: id } },
        limit: 1,
      }));
      return (records as DirectusAppointmentRecord[])[0] ?? null;
    },

    async createAppointment(payload: DirectusAppointmentCreatePayload) {
      return (await client.request(createItem("appointments", payload, { fields: APPOINTMENT_MUTATION_FIELDS as unknown as readonly ("*" | keyof DirectusAppointmentRecord)[] }))) as DirectusAppointmentRecord | null;
    },

    async listAppointments(fromIso?: string, toIso?: string, statuses?: readonly string[]) {
      return (await client.request(
        readItems("appointments", {
          fields: APPOINTMENT_LIST_FIELDS as unknown as readonly ("*" | keyof DirectusAppointmentRecord)[],
          filter: buildAppointmentListFilter(fromIso, toIso, statuses),
          sort: ["scheduled_at", "id"],
          limit: -1,
        }),
      )) as DirectusAppointmentListRecord[];
    },


    async listAppointmentHistory(query: DirectusAppointmentHistoryQuery) {
      const search = query.search?.trim();
      const phone = search && /^[\d\s+()-]+$/.test(search) ? search.replace(/\D/g, "").replace(/^00/, "") : "";
      const status = query.status ? [query.status] : ["completed", "cancelled"];
      const filter = search ? {
        _and: [
          { status: { _in: status } },
          { _or: [
            { client: { name: { _icontains: search } } },
            ...(phone ? [{ client: { phone: { _contains: phone } } }] : []),
          ] },
        ],
      } : { status: { _in: status } };

      return (await client.request(readItems("appointments", {
        fields: APPOINTMENT_LIST_FIELDS as unknown as readonly ("*" | keyof DirectusAppointmentRecord)[],
        filter,
        sort: ["-scheduled_at", "-id"],
        limit: query.limit + 1,
      }))) as DirectusAppointmentListRecord[];
    },
    async updateAppointmentStatus(id: string, expectedStatus: string, status: string) {
      const records = await client.request(
        updateItems(
          "appointments",
          { filter: { id: { _eq: id }, status: { _eq: expectedStatus } } } as never,
          { status },
          { fields: APPOINTMENT_MUTATION_FIELDS as unknown as readonly ("*" | keyof DirectusAppointmentRecord)[] },
        ),
      );

      return (records as DirectusAppointmentRecord[])[0] ?? null;
    },

    async updateAppointmentDetails(id: string, expectedStatus: "scheduled", expected: DirectusAppointmentDetailsPayload, payload: DirectusAppointmentDetailsPayload) {
      const records = await client.request(
        updateItems(
          "appointments",
          { filter: {
            id: { _eq: id },
            status: { _eq: expectedStatus },
            scheduled_at: { _eq: expected.scheduled_at },
            order_: expected.order_ ? { _eq: expected.order_ } : { _null: true },
            notes: expected.notes ? { _eq: expected.notes } : { _null: true },
          } } as never,
          payload,
          { fields: APPOINTMENT_MUTATION_FIELDS as unknown as readonly ("*" | keyof DirectusAppointmentRecord)[] },
        ),
      );

      return (records as DirectusAppointmentRecord[])[0] ?? null;
    },

    async deleteScheduledAppointment(id: string) {
      await client.request(deleteItems("appointments", { filter: { id: { _eq: id }, status: { _eq: "scheduled" } } } as never));
      const remaining = await client.request(readItems("appointments", { fields: ["id"], filter: { id: { _eq: id } }, limit: 1 }));
      return remaining.length === 0 ? "deleted" : "conflict";
    },
  };
}

function buildAppointmentListFilter(fromIso?: string, toIso?: string, statuses?: readonly string[]): Record<string, unknown> {
  const scheduledAt: Record<string, string> = {};

  if (fromIso) {
    scheduledAt._gte = fromIso;
  }

  if (toIso) {
    scheduledAt._lt = toIso;
  }

  return {
    ...(Object.keys(scheduledAt).length > 0 ? { scheduled_at: scheduledAt } : {}),
    ...(statuses && statuses.length > 0 ? { status: { _in: statuses } } : {}),
  };
}
