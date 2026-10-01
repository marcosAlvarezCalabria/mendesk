import { createIdempotently } from "@/application/mutations/createIdempotently";
﻿import type { ClientRepository } from "@/application/ports/ClientRepository";
import type { Client } from "@/domain/entities/Client";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

export type RegisterClientIntakeInput = {
  name: string;
  phoneRaw: string;
  gdprConsent: boolean;
  notes?: string;
};

export class RegisterClientIntake {
  constructor(private readonly clients: ClientRepository) {}

  async execute(input: RegisterClientIntakeInput): Promise<Client> {
    const name = input.name.trim();

    if (!name) {
      throw new Error("Client name is required");
    }

    const phone = PhoneNumber.fromRaw(input.phoneRaw);
    const candidate = {
      name,
      phone,
      gdprConsent: input.gdprConsent,
      notes: input.notes,
    };

    return createIdempotently({
      lookup: () => this.clients.getByPhone(phone),
      create: () => this.clients.create(candidate),
      isCompatible: (client) => client.name === candidate.name
        && client.phone?.value === candidate.phone.value
        && client.gdprConsent === candidate.gdprConsent
        && client.notes === candidate.notes,
    });
  }
}