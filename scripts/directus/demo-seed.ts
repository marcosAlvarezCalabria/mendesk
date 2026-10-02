import { createDirectus, createItems, readItems, rest, staticToken } from "@directus/sdk";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { validateDirectusUrl } from "./base-schema.ts";

export const demoSeedVersion = "mendesk-demo-v1";
export const demoSeedCollections = ["clients", "orders", "garments", "payments", "appointments"] as const;
export type DemoSeedCollection = (typeof demoSeedCollections)[number];

type DemoRecord = Readonly<Record<string, unknown> & { id: string }>;
export type DemoSeed = Readonly<Record<DemoSeedCollection, readonly DemoRecord[]>>;
export type DemoSeedInventory = Readonly<Record<DemoSeedCollection, readonly string[]>>;

export type DemoSeedIssue = {
  code: "missing-records";
  collection: DemoSeedCollection;
  count: number;
};

export type DemoSeedReport = Readonly<{ ok: boolean; issues: readonly DemoSeedIssue[] }>;

export interface DemoSeedAdmin {
  readInventory(seed: DemoSeed): Promise<DemoSeedInventory>;
  createRecords(collection: DemoSeedCollection, records: readonly DemoRecord[]): Promise<void>;
}

const clientNames = [
  "Aoife Byrne", "Niamh Kelly", "Sofia Martin", "Lucia Romero", "Emma Walsh", "Clara Doyle",
  "Marta Silva", "Elena Costa", "Grace Murphy", "Laura Vega", "Irene Nolan", "Paula Reyes",
  "Sarah Quinn", "Ana Torres", "Chloe Ryan", "Julia Santos", "Eva Murray", "Carla Flores",
  "Megan Flynn", "Alba Castro", "Rachel Moore", "Nora Gil", "Olivia Hayes", "Ines Vidal",
] as const;

const garmentDescriptions = [
  "Linen trousers", "Wool jacket", "Evening dress", "Cotton shirt", "Pleated skirt", "Wedding guest dress",
  "Denim jeans", "Cashmere coat", "Silk blouse", "School uniform", "Suit trousers", "Summer jumpsuit",
] as const;

const alterationTypes = [
  "hem", "waist", "zipper", "sleeves", "take_in", "other",
] as const;

const garmentPrices = [18, 24, 28, 32, 38, 45, 52, 64] as const;
const paymentMethods = ["card", "cash"] as const;

export function parseDemoSeedDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("DEMO_SEED_DATE must use YYYY-MM-DD");
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("DEMO_SEED_DATE must be a real calendar date");
  }
  return date;
}

export function buildDemoSeed(anchor: Date): DemoSeed {
  const clients: DemoRecord[] = clientNames.map((name, index) => ({
    id: demoId("client", index),
    name,
    phone: `35385${String(index + 1).padStart(7, "0")}`,
    gdpr_consent: index % 4 !== 0,
    notes: index % 5 === 0 ? "Synthetic demo profile · prefers afternoon collection." : "Synthetic demo profile.",
    date_created: at(anchor, -80 + index * 2, 9),
  }));

  const orders: DemoRecord[] = [];
  const garments: DemoRecord[] = [];
  const payments: DemoRecord[] = [];

  for (let index = 0; index < 36; index += 1) {
    const receivedOffset = -45 + index;
    const dueOffset = receivedOffset + 14;
    const status = index % 13 === 0
      ? "cancelled"
      : dueOffset < -7
        ? "collected"
        : dueOffset <= 2
          ? "ready"
          : "received";
    const orderId = demoId("order", index);
    const orderNumber = `${compactDate(anchor, receivedOffset)}-${String(index + 1).padStart(4, "0")}`;
    orders.push({
      id: orderId,
      idempotency_key: demoId("order-key", index),
      order_number: orderNumber,
      client: clients[index % clients.length].id,
      status,
      received_date: at(anchor, receivedOffset, 10),
      due_date: at(anchor, dueOffset, 17),
      collected_at: status === "collected" ? at(anchor, dueOffset + 1, 16) : null,
      notes: index % 6 === 0 ? "Synthetic demo order · customer requested a fitting call." : "Synthetic demo order.",
      date_created: at(anchor, receivedOffset, 10),
    });

    const orderGarments: DemoRecord[] = [];
    const garmentCount = 1 + (index % 3);
    for (let garmentIndex = 0; garmentIndex < garmentCount; garmentIndex += 1) {
      const sequence = index * 3 + garmentIndex;
      const garment: DemoRecord = {
        id: demoId("garment", sequence),
        order: orderId,
        idempotency_key: demoId("garment-key", sequence),
        description: garmentDescriptions[sequence % garmentDescriptions.length],
        alteration_type: alterationTypes[sequence % alterationTypes.length],
        measurements: sequence % 3 === 0 ? "Synthetic fitting notes: shorten 3 cm." : null,
        photo: null,
        price: garmentPrices[sequence % garmentPrices.length],
        date_created: at(anchor, receivedOffset, 10 + garmentIndex),
      };
      garments.push(garment);
      orderGarments.push(garment);
    }

    const total = orderGarments.reduce((sum, garment) => sum + Number(garment.price), 0);
    if (status === "collected") {
      const deposit = Math.round(total * 0.3 * 100) / 100;
      payments.push(payment(index, 0, orderId, "deposit", deposit, at(anchor, receivedOffset, 10)));
      payments.push(payment(index, 1, orderId, "final", total - deposit, at(anchor, dueOffset + 1, 16)));
    } else if (status === "ready") {
      payments.push(payment(index, 0, orderId, "deposit", Math.round(total * 0.4 * 100) / 100, at(anchor, receivedOffset, 10)));
    } else if (status === "received" && index % 2 === 0) {
      payments.push(payment(index, 0, orderId, "deposit", Math.round(total * 0.25 * 100) / 100, at(anchor, receivedOffset, 10)));
    }
  }

  const appointments: DemoRecord[] = Array.from({ length: 16 }, (_, index) => {
    const offset = -12 + index * 2;
    const status = offset < 0 ? (index % 5 === 0 ? "cancelled" : "completed") : "scheduled";
    return {
      id: demoId("appointment", index),
      client: clients[(index * 3) % clients.length].id,
      order_: index % 3 === 0 ? null : orders[(index * 2) % orders.length].id,
      scheduled_at: at(anchor, offset, 11 + (index % 5)),
      notes: index % 4 === 0 ? "Synthetic demo fitting appointment." : "Synthetic demo appointment.",
      status,
      date_created: at(anchor, Math.min(offset - 5, -1), 9),
    };
  });

  return { clients, orders, garments, payments, appointments };
}

export function auditDemoSeed(seed: DemoSeed, inventory: DemoSeedInventory): DemoSeedReport {
  const issues: DemoSeedIssue[] = [];
  for (const collection of demoSeedCollections) {
    const existing = new Set(inventory[collection]);
    const count = seed[collection].filter((record) => !existing.has(record.id)).length;
    if (count > 0) issues.push({ code: "missing-records", collection, count });
  }
  return { ok: issues.length === 0, issues };
}

export async function provisionDemoSeed(
  admin: DemoSeedAdmin,
  seed: DemoSeed,
  options: { apply: boolean },
): Promise<{ applied: boolean; report: DemoSeedReport }> {
  let inventory = await admin.readInventory(seed);
  let report = auditDemoSeed(seed, inventory);
  if (!options.apply) return { applied: false, report };

  for (const collection of demoSeedCollections) {
    const existing = new Set(inventory[collection]);
    const missing = seed[collection].filter((record) => !existing.has(record.id));
    if (missing.length > 0) await admin.createRecords(collection, missing);
  }

  inventory = await admin.readInventory(seed);
  report = auditDemoSeed(seed, inventory);
  if (!report.ok) throw new Error("Final demo seed verification failed");
  return { applied: true, report };
}

export function createDemoSeedAdmin(url: string, token: string): DemoSeedAdmin {
  const client = createDirectus<Record<string, unknown[]>>(url).with(staticToken(token)).with(rest());
  return {
    async readInventory(seed) {
      const entries = await Promise.all(demoSeedCollections.map(async (collection) => {
        const ids = seed[collection].map((record) => record.id);
        const records = await client.request(readItems(collection, {
          filter: { id: { _in: ids } },
          fields: ["id"],
          limit: -1,
        } as never));
        return [collection, (records as unknown as { id: string }[]).map((record) => String(record.id))] as const;
      }));
      return Object.fromEntries(entries) as unknown as DemoSeedInventory;
    },
    async createRecords(collection, records) {
      await client.request(createItems(collection, records as never));
    },
  };
}

function payment(
  orderIndex: number,
  paymentIndex: number,
  orderId: string,
  type: "deposit" | "final",
  amount: number,
  dateCreated: string,
): DemoRecord {
  const sequence = orderIndex * 2 + paymentIndex;
  return {
    id: demoId("payment", sequence),
    order: orderId,
    idempotency_key: demoId("payment-key", sequence),
    type,
    amount,
    method: paymentMethods[sequence % paymentMethods.length],
    date_created: dateCreated,
  };
}

function demoId(kind: string, index: number): string {
  const hex = createHash("sha256").update(`${demoSeedVersion}:${kind}:${index}`).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function at(anchor: Date, dayOffset: number, hour: number): string {
  const value = new Date(anchor);
  value.setUTCDate(value.getUTCDate() + dayOffset);
  value.setUTCHours(hour, 0, 0, 0);
  return value.toISOString();
}

function compactDate(anchor: Date, dayOffset: number): string {
  const value = new Date(at(anchor, dayOffset, 12));
  return value.toISOString().slice(2, 10).replaceAll("-", "");
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || (args[0] !== "--audit" && args[0] !== "--apply")) {
    throw new Error("Usage: pnpm directus:seed:audit | pnpm directus:seed:apply");
  }
  const url = process.env.DIRECTUS_URL;
  const token = process.env.DIRECTUS_ADMIN_TOKEN;
  const seedDate = process.env.DEMO_SEED_DATE;
  if (!url || !token || !seedDate) {
    throw new Error("DIRECTUS_URL, DIRECTUS_ADMIN_TOKEN and DEMO_SEED_DATE are required");
  }
  validateDirectusUrl(url);
  const seed = buildDemoSeed(parseDemoSeedDate(seedDate));
  const result = await provisionDemoSeed(createDemoSeedAdmin(url, token), seed, { apply: args[0] === "--apply" });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Directus demo seed operation failed";
    const safe = /^(Usage:|DIRECTUS_|DEMO_SEED_DATE|Final demo seed)/.test(message)
      ? message
      : "Directus demo seed operation failed; no record or credential data was printed";
    process.stderr.write(`${safe}\n`);
    process.exitCode = 1;
  });
}
