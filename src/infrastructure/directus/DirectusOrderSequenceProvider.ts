import type { OrderSequenceProvider } from "@/application/ports/OrderSequenceProvider";
import type { DirectusOrderSequenceClient } from "@/infrastructure/directus/DirectusOrderSequenceClient";
import { DirectusMappingError } from "@/infrastructure/directus/DirectusMappingError";

export class DirectusOrderSequenceProvider implements OrderSequenceProvider {
  constructor(private readonly client: DirectusOrderSequenceClient) {}

  async next(): Promise<number> {
    const sequence = normalizeSequence(await this.client.allocateOrderSequence());

    if (sequence === null) {
      throw new DirectusMappingError("Invalid Directus order sequence id");
    }

    return sequence;
  }
}

function normalizeSequence(value: unknown): number | null {
  const sequence = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;

  return typeof sequence === "number" && Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}