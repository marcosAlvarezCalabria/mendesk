import type { ClientRepository } from "@/application/ports/ClientRepository";
import type { Client } from "@/domain/entities/Client";
import { PhoneNumber } from "@/domain/values/PhoneNumber";
import { ClientRegistrationValidationError } from "@/domain/errors/ClientRegistrationValidationError";
import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";

export type RegisterClientInput = { name: string; phoneRaw: string; gdprConsent: boolean };
export type RegisterClientResult = { type: "created"; client: Client } | { type: "existing"; client: Client };

export class RegisterClient {
  constructor(private readonly clients: ClientRepository) {}

  async execute(input: RegisterClientInput): Promise<RegisterClientResult> {
    const name = input.name.trim();
    if (!name) throw new ClientRegistrationValidationError("name");
    const phone = PhoneNumber.fromRaw(input.phoneRaw);
    if (input.gdprConsent !== true) throw new ClientRegistrationValidationError("gdprConsent");
    const existing = await this.clients.getByPhone(phone);
    if (existing) return { type: "existing", client: existing };
    try {
      const client = await this.clients.create({ name, phone, gdprConsent: true });
      return { type: "created", client };
    } catch (createError) {
      let client: Client | null;
      try { client = await this.clients.getByPhone(phone); }
      catch (lookupError) {
        throw new MutationOutcomeUnknownError({ cause: new AggregateError([createError, lookupError], "Client registration could not be reconciled") });
      }
      if (!client) throw new MutationConfirmedNotSavedError({ cause: createError });
      const compatible = client.name === name && client.phone?.value === phone.value
        && client.gdprConsent === true && !client.notes;
      return { type: compatible ? "created" : "existing", client };
    }
  }

  reconcile(phoneRaw: string): Promise<Client | null> {
    return this.clients.getByPhone(PhoneNumber.fromRaw(phoneRaw));
  }
}
