import type { Client } from "@/domain/entities/Client";
import type { Order } from "@/domain/entities/Order";
import type { PhoneNumber } from "@/domain/values/PhoneNumber";

export type NewClient = { name: string; phone: PhoneNumber; gdprConsent: boolean; notes?: string };
export type ClientWithHistory = { client: Client; orders: Order[] };

export interface ClientRepository {
  create(client: NewClient): Promise<Client>;
  getWithHistory(clientId: string): Promise<ClientWithHistory | null>;
  getByPhone(phone: PhoneNumber): Promise<Client | null>;
  anonymize(clientId: string): Promise<void>;
}
