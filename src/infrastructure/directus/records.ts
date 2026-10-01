export type DirectusClientRecord = {
  id: string;
  name: string;
  phone: string | null;
  gdpr_consent: boolean;
  notes: string | null;
};

export type DirectusClientListRecord = Pick<DirectusClientRecord, "id" | "name" | "phone" | "gdpr_consent">;

export type DirectusGarmentRecord = {
  id: string;
  order?: string | { id: string };
  idempotency_key?: string | null;
  description: string;
  alteration_type: string | null;
  date_updated: string | null;
  date_created?: string;
  measurements: string | null;
  photo?: string | { id: string } | null;
  price: number | string | null;
};

export type DirectusPaymentRecord = {
  id: string;
  order?: string | { id: string };
  idempotency_key?: string | null;
  type: string;
  amount: number | string;
  method: string;
  date_created: string;
};

export type DirectusOrderRecord = {
  date_updated: string | null;
  date_created?: string;
  id: string;
  idempotency_key?: string | null;
  order_number: string;
  client: DirectusClientRecord;
  status: string;
  received_date: string;
  due_date: string;
  collected_at: string | null;
  notes: string | null;
  garments?: DirectusGarmentRecord[];
  payments?: DirectusPaymentRecord[];
};

export type DirectusOrderListRecord = {
  id: string;
  order_number: string;
  client: { name: string };
  status: string;
  due_date: string;
  garments?: { id: string; price: number | string | null }[];
  payments?: { amount: number | string | null }[];
};

export type DirectusAppointmentOrderRecord = Pick<DirectusOrderRecord, "id" | "order_number" | "status">;

export type DirectusAppointmentRecord = {
  id: string;
  client: string | DirectusClientRecord | null;
  order_: string | DirectusAppointmentOrderRecord | null;
  scheduled_at: string;
  notes: string | null;
  status: string;
  date_created: string;
};

export type DirectusAppointmentListRecord = {
  id: string;
  client: { id: string; name: string } | null;
  scheduled_at: string;
  notes: string | null;
  status: string;
  order_: { id: string; order_number: string; status: string } | null;
};
