import { PhoneNumber } from "@/domain/values/PhoneNumber";

export type ExistingClientMatch = {
  id: string;
  name: string;
  phone: string;
};

export type ExistingClientLookupResult =
  | { status: "available" }
  | { status: "error" }
  | { status: "match"; client: ExistingClientMatch };

type ClientLookupFetcher = (
  input: string,
  init: { cache: "no-store" },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export async function lookupExistingClientByPhone(
  phoneRaw: string,
  fetcher: ClientLookupFetcher = fetch,
): Promise<ExistingClientLookupResult> {
  let phone: string;

  try {
    phone = PhoneNumber.fromRaw(phoneRaw).value;
  } catch {
    return { status: "error" };
  }

  try {
    const response = await fetcher(
      `/api/clients/search?search=${encodeURIComponent(phone)}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return { status: "error" };
    }

    const payload = await response.json();
    const items = readClientItems(payload);

    if (!items) {
      return { status: "error" };
    }

    const client = items.find((item) => item.phone === phone);
    return client ? { status: "match", client } : { status: "available" };
  } catch {
    return { status: "error" };
  }
}

function readClientItems(payload: unknown): ExistingClientMatch[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return null;
  }

  const items: ExistingClientMatch[] = [];
  for (const item of payload.items) {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") {
      return null;
    }

    if (item.phone !== null && typeof item.phone !== "string") {
      return null;
    }

    if (typeof item.phone === "string") {
      items.push({ id: item.id, name: item.name, phone: item.phone });
    }
  }

  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
