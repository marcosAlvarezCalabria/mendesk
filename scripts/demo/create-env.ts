import { randomBytes as cryptoRandomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type RandomBytes = (size: number) => Uint8Array;

const DEMO_ENV_PATH = ".env.demo";

export function createDemoEnvironment(randomBytes: RandomBytes = cryptoRandomBytes): string {
  const directusSecret = hexSecret(randomBytes, 32);
  const adminPassword = password(randomBytes, 24);
  const adminToken = hexSecret(randomBytes, 32);
  const postgresPassword = password(randomBytes, 24);

  return [
    "# Generated locally by pnpm demo:env. Never commit this file.",
    "DEMO_DIRECTUS_PORT=8055",
    "DEMO_DIRECTUS_ADMIN_EMAIL=admin@example.com",
    `DEMO_DIRECTUS_ADMIN_PASSWORD=${adminPassword}`,
    `DEMO_DIRECTUS_ADMIN_TOKEN=${adminToken}`,
    `DEMO_DIRECTUS_SECRET=${directusSecret}`,
    "DEMO_POSTGRES_DATABASE=mendesk_demo",
    "DEMO_POSTGRES_USER=mendesk",
    `DEMO_POSTGRES_PASSWORD=${postgresPassword}`,
    "",
  ].join("\n");
}

export async function writeDemoEnvironment(path = resolve(DEMO_ENV_PATH)): Promise<void> {
  try {
    await writeFile(path, createDemoEnvironment(), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (isFileExistsError(error)) {
      throw new Error(`${DEMO_ENV_PATH} already exists; it was not overwritten`);
    }
    throw error;
  }
}

function hexSecret(randomBytes: RandomBytes, size: number): string {
  return Buffer.from(randomBytes(size)).toString("hex");
}

function password(randomBytes: RandomBytes, size: number): string {
  return Buffer.from(randomBytes(size)).toString("base64url");
}

function isFileExistsError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EEXIST");
}

async function runCli(): Promise<void> {
  await writeDemoEnvironment();
  process.stdout.write(`Created ${DEMO_ENV_PATH}. Credentials remain only in that ignored local file.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Could not create the demo environment";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
