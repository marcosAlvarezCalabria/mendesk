import {
  createDirectus,
  createUser,
  readRoles,
  readUsers,
  rest,
  staticToken,
} from "@directus/sdk";
import { pathToFileURL } from "node:url";

import { validateDirectusUrl } from "./base-schema.ts";
import { demoRoleName } from "./demo-access.ts";

export type DemoUserInventory = Readonly<{
  roles: readonly { id: string; name: string }[];
  users: readonly { id: string; email: string; status: string; roleId: string | null }[];
}>;

export type DemoUserIssue =
  | { code: "missing-role" }
  | { code: "duplicate-role" }
  | { code: "missing-user" }
  | { code: "duplicate-user" }
  | { code: "wrong-role" }
  | { code: "inactive-user"; status: string };

export type DemoUserReport = Readonly<{ ok: boolean; issues: readonly DemoUserIssue[] }>;

export interface DemoUserAdmin {
  readInventory(email: string): Promise<DemoUserInventory>;
  createDemoUser(input: { email: string; password: string; roleId: string }): Promise<void>;
}

export function normalizeDemoEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("DEMO_STAFF_EMAIL must be a valid email address");
  }
  return email;
}

export function validateDemoPassword(value: string): string {
  if (value.length < 16) throw new Error("DEMO_STAFF_PASSWORD must contain at least 16 characters");
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    throw new Error("DEMO_STAFF_PASSWORD must include upper, lower, number and symbol characters");
  }
  return value;
}

export function auditDemoUser(inventory: DemoUserInventory): DemoUserReport {
  const issues: DemoUserIssue[] = [];
  const roles = inventory.roles.filter((role) => role.name === demoRoleName);
  if (roles.length === 0) issues.push({ code: "missing-role" });
  if (roles.length > 1) issues.push({ code: "duplicate-role" });

  if (inventory.users.length === 0) issues.push({ code: "missing-user" });
  if (inventory.users.length > 1) issues.push({ code: "duplicate-user" });

  const role = roles.length === 1 ? roles[0] : undefined;
  const user = inventory.users.length === 1 ? inventory.users[0] : undefined;
  if (role && user && user.roleId !== role.id) issues.push({ code: "wrong-role" });
  if (user && user.status !== "active") issues.push({ code: "inactive-user", status: user.status });
  return { ok: issues.length === 0, issues };
}

export async function provisionDemoUser(
  admin: DemoUserAdmin,
  input: { email: string; password?: string; apply: boolean },
): Promise<{ applied: boolean; report: DemoUserReport }> {
  const email = normalizeDemoEmail(input.email);
  let inventory = await admin.readInventory(email);
  let report = auditDemoUser(inventory);
  if (!input.apply) return { applied: false, report };

  const nonRepairable = report.issues.filter((issue) => issue.code !== "missing-user");
  if (nonRepairable.length > 0) {
    throw new Error("Demo user configuration is incompatible; user was not changed");
  }
  if (inventory.users.length === 0) {
    const password = validateDemoPassword(input.password ?? "");
    const role = inventory.roles.find((item) => item.name === demoRoleName);
    if (!role) throw new Error("Demo user role is missing; user was not created");
    await admin.createDemoUser({ email, password, roleId: role.id });
  }

  inventory = await admin.readInventory(email);
  report = auditDemoUser(inventory);
  if (!report.ok) throw new Error("Final demo user verification failed");
  return { applied: true, report };
}

export function createDemoUserAdmin(url: string, token: string): DemoUserAdmin {
  const client = createDirectus<Record<string, unknown[]>>(url).with(staticToken(token)).with(rest());
  return {
    async readInventory(email) {
      const [roles, users] = await Promise.all([
        client.request(readRoles({
          filter: { name: { _eq: demoRoleName } },
          fields: ["id", "name"],
          limit: 2,
        } as never)),
        client.request(readUsers({
          filter: { email: { _eq: email } },
          fields: ["id", "email", "status", "role"],
          limit: 2,
        } as never)),
      ]);
      return {
        roles: (roles as unknown as { id: string; name: string }[]).map((item) => ({ id: item.id, name: item.name })),
        users: (users as unknown as { id: string; email: string; status: string; role: string | null }[]).map((item) => ({
          id: item.id,
          email: item.email,
          status: item.status,
          roleId: item.role,
        })),
      };
    },
    async createDemoUser(input) {
      await client.request(createUser({
        email: input.email,
        password: input.password,
        first_name: "Demo",
        last_name: "Staff",
        status: "active",
        role: input.roleId,
      }));
    },
  };
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || (args[0] !== "--audit" && args[0] !== "--apply")) {
    throw new Error("Usage: pnpm directus:user:audit | pnpm directus:user:apply");
  }
  const url = process.env.DIRECTUS_URL;
  const token = process.env.DIRECTUS_ADMIN_TOKEN;
  const email = process.env.DEMO_STAFF_EMAIL;
  const password = process.env.DEMO_STAFF_PASSWORD;
  if (!url || !token || !email) {
    throw new Error("DIRECTUS_URL, DIRECTUS_ADMIN_TOKEN and DEMO_STAFF_EMAIL are required");
  }
  if (args[0] === "--apply" && !password) throw new Error("DEMO_STAFF_PASSWORD is required for apply");
  validateDirectusUrl(url);
  const result = await provisionDemoUser(createDemoUserAdmin(url, token), {
    email,
    password,
    apply: args[0] === "--apply",
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Directus demo user operation failed";
    const safe = /^(Usage:|DIRECTUS_|DEMO_STAFF_|Demo user|Final demo user)/.test(message)
      ? message
      : "Directus demo user operation failed; no credentials or user data were printed";
    process.stderr.write(`${safe}\n`);
    process.exitCode = 1;
  });
}
