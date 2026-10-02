import {
  createDirectus,
  createPermission,
  createPolicy,
  createRole,
  readPermissions,
  readPolicies,
  readRoles,
  rest,
  staticToken,
  updatePolicy,
} from "@directus/sdk";
import { pathToFileURL } from "node:url";

import { validateDirectusUrl } from "./base-schema.ts";

export const demoRoleName = "Mendesk Demo Staff";
export const demoPolicyName = "Mendesk Demo Application";

export type DemoAction = "create" | "read" | "update" | "delete";

export type DemoPermissionDefinition = Readonly<{
  collection: string;
  action: DemoAction;
  fields: readonly string[];
}>;

export const demoPermissions: readonly DemoPermissionDefinition[] = [
  permission("clients", "create"),
  permission("clients", "read"),
  permission("clients", "update"),
  permission("orders", "create"),
  permission("orders", "read"),
  permission("orders", "update"),
  permission("garments", "create"),
  permission("garments", "read"),
  permission("garments", "update"),
  permission("garments", "delete"),
  permission("payments", "create"),
  permission("payments", "read"),
  permission("payments", "delete"),
  permission("appointments", "create"),
  permission("appointments", "read"),
  permission("appointments", "update"),
  permission("appointments", "delete"),
  permission("order_sequences", "create"),
  permission("shop_settings", "create"),
  permission("shop_settings", "read"),
  permission("shop_settings", "update"),
  permission("directus_files", "create"),
  permission("directus_files", "read"),
] as const;

export type DemoAccessInventory = Readonly<{
  roles: readonly { id: string; name: string }[];
  policies: readonly {
    id: string;
    name: string;
    adminAccess: boolean;
    appAccess: boolean;
    roleIds: readonly string[];
  }[];
  permissions: readonly {
    id: number;
    policyId: string;
    collection: string;
    action: string;
    fields: readonly string[] | null;
    permissions: unknown;
    validation: unknown;
    presets: unknown;
  }[];
}>;

export type DemoAccessIssue =
  | { code: "missing-role" }
  | { code: "duplicate-role" }
  | { code: "missing-policy" }
  | { code: "duplicate-policy" }
  | { code: "unsafe-policy"; adminAccess: boolean; appAccess: boolean }
  | { code: "missing-role-policy-link" }
  | { code: "unexpected-policy-role"; roleId: string }
  | { code: "missing-permission"; collection: string; action: DemoAction }
  | { code: "duplicate-permission"; collection: string; action: DemoAction }
  | { code: "incompatible-permission"; collection: string; action: DemoAction };

export type DemoAccessReport = Readonly<{ ok: boolean; issues: readonly DemoAccessIssue[] }>;

export interface DemoAccessAdmin {
  readInventory(): Promise<DemoAccessInventory>;
  createRole(): Promise<string>;
  createPolicy(roleId: string): Promise<string>;
  attachPolicyToRole(policyId: string, roleId: string): Promise<void>;
  createPermission(policyId: string, definition: DemoPermissionDefinition): Promise<void>;
}

export function auditDemoAccess(inventory: DemoAccessInventory): DemoAccessReport {
  const issues: DemoAccessIssue[] = [];
  const roles = inventory.roles.filter((role) => role.name === demoRoleName);
  const policies = inventory.policies.filter((policy) => policy.name === demoPolicyName);

  if (roles.length === 0) issues.push({ code: "missing-role" });
  if (roles.length > 1) issues.push({ code: "duplicate-role" });
  if (policies.length === 0) issues.push({ code: "missing-policy" });
  if (policies.length > 1) issues.push({ code: "duplicate-policy" });

  const role = roles.length === 1 ? roles[0] : undefined;
  const policy = policies.length === 1 ? policies[0] : undefined;
  if (policy && (policy.adminAccess || policy.appAccess)) {
    issues.push({ code: "unsafe-policy", adminAccess: policy.adminAccess, appAccess: policy.appAccess });
  }
  if (role && policy) {
    if (!policy.roleIds.includes(role.id)) issues.push({ code: "missing-role-policy-link" });
    for (const roleId of policy.roleIds) {
      if (roleId !== role.id) issues.push({ code: "unexpected-policy-role", roleId });
    }
    for (const definition of demoPermissions) {
      const matches = inventory.permissions.filter(
        (item) => item.policyId === policy.id && item.collection === definition.collection && item.action === definition.action,
      );
      if (matches.length === 0) {
        issues.push({ code: "missing-permission", collection: definition.collection, action: definition.action });
      } else if (matches.length > 1) {
        issues.push({ code: "duplicate-permission", collection: definition.collection, action: definition.action });
      } else if (!permissionMatches(matches[0], definition)) {
        issues.push({ code: "incompatible-permission", collection: definition.collection, action: definition.action });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

export async function provisionDemoAccess(
  admin: DemoAccessAdmin,
  options: { apply: boolean },
): Promise<{ applied: boolean; report: DemoAccessReport }> {
  let inventory = await admin.readInventory();
  let report = auditDemoAccess(inventory);
  if (!options.apply) return { applied: false, report };

  const incompatible = report.issues.filter((issue) => !isRepairable(issue));
  if (incompatible.length > 0) {
    throw new Error("Demo access configuration is incompatible; access control was not changed");
  }

  let role = inventory.roles.find((item) => item.name === demoRoleName);
  if (!role) {
    const id = await admin.createRole();
    role = { id, name: demoRoleName };
  }

  let policy = inventory.policies.find((item) => item.name === demoPolicyName);
  if (!policy) {
    const id = await admin.createPolicy(role.id);
    policy = { id, name: demoPolicyName, adminAccess: false, appAccess: false, roleIds: [role.id] };
  } else if (!policy.roleIds.includes(role.id)) {
    await admin.attachPolicyToRole(policy.id, role.id);
  }

  inventory = await admin.readInventory();
  const existing = new Set(
    inventory.permissions
      .filter((item) => item.policyId === policy.id)
      .map((item) => `${item.collection}:${item.action}`),
  );
  for (const definition of demoPermissions) {
    if (!existing.has(`${definition.collection}:${definition.action}`)) {
      await admin.createPermission(policy.id, definition);
    }
  }

  report = auditDemoAccess(await admin.readInventory());
  if (!report.ok) throw new Error("Final demo access verification failed");
  return { applied: true, report };
}

export function createDemoAccessAdmin(url: string, token: string): DemoAccessAdmin {
  const client = createDirectus<Record<string, unknown[]>>(url).with(staticToken(token)).with(rest());
  return {
    async readInventory() {
      const [roles, policies, permissions] = await Promise.all([
        client.request(readRoles({ fields: ["id", "name"], limit: -1 } as never)),
        client.request(readPolicies({
          fields: ["id", "name", "admin_access", "app_access", { roles: ["role"] }],
          limit: -1,
        } as never)),
        client.request(readPermissions({
          fields: ["id", "policy", "collection", "action", "fields", "permissions", "validation", "presets"],
          limit: -1,
        } as never)),
      ]);
      return {
        roles: (roles as unknown as { id: string; name: string }[]).map((item) => ({ id: item.id, name: item.name })),
        policies: (policies as unknown as {
          id: string; name: string; admin_access: boolean; app_access: boolean; roles?: { role: string | null }[];
        }[]).map((item) => ({
          id: item.id,
          name: item.name,
          adminAccess: item.admin_access,
          appAccess: item.app_access,
          roleIds: (item.roles ?? []).flatMap((access) => access.role ? [access.role] : []),
        })),
        permissions: (permissions as unknown as {
          id: number; policy: string | null; collection: string; action: string; fields: string[] | null;
          permissions: unknown; validation: unknown; presets: unknown;
        }[]).flatMap((item) => item.policy ? [{
          id: item.id,
          policyId: item.policy,
          collection: item.collection,
          action: item.action,
          fields: item.fields,
          permissions: item.permissions,
          validation: item.validation,
          presets: item.presets,
        }] : []),
      };
    },
    async createRole() {
      const role = await client.request(createRole({
        name: demoRoleName,
        icon: "store",
        description: "Authenticated staff using the Mendesk application. No Directus Studio access.",
      }));
      return String(role.id);
    },
    async createPolicy(roleId) {
      const policy = await client.request(createPolicy({
        name: demoPolicyName,
        icon: "shield",
        description: "Least-privilege API access required by the Mendesk application.",
        admin_access: false,
        app_access: false,
        enforce_tfa: false,
        ip_access: null,
        roles: [{ role: roleId }],
      } as never));
      return String(policy.id);
    },
    async attachPolicyToRole(policyId, roleId) {
      await client.request(updatePolicy(policyId, { roles: [{ role: roleId }] } as never));
    },
    async createPermission(policyId, definition) {
      await client.request(createPermission({
        policy: policyId,
        collection: definition.collection,
        action: definition.action,
        permissions: null,
        validation: null,
        presets: null,
        fields: [...definition.fields],
      } as never));
    },
  };
}

function permission(collection: string, action: DemoAction): DemoPermissionDefinition {
  return { collection, action, fields: ["*"] };
}

function permissionMatches(
  actual: DemoAccessInventory["permissions"][number],
  expected: DemoPermissionDefinition,
): boolean {
  return sameStringSet(actual.fields, expected.fields)
    && actual.permissions === null
    && actual.validation === null
    && actual.presets === null;
}

function sameStringSet(actual: readonly string[] | null, expected: readonly string[]): boolean {
  if (!actual || actual.length !== expected.length) return false;
  const actualSet = new Set(actual);
  return expected.every((field) => actualSet.has(field));
}

function isRepairable(issue: DemoAccessIssue): boolean {
  return issue.code === "missing-role"
    || issue.code === "missing-policy"
    || issue.code === "missing-role-policy-link"
    || issue.code === "missing-permission";
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || (args[0] !== "--audit" && args[0] !== "--apply")) {
    throw new Error("Usage: pnpm directus:access:audit | pnpm directus:access:apply");
  }
  const url = process.env.DIRECTUS_URL;
  const token = process.env.DIRECTUS_ADMIN_TOKEN;
  if (!url || !token) throw new Error("DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN are required");
  validateDirectusUrl(url);
  const result = await provisionDemoAccess(createDemoAccessAdmin(url, token), { apply: args[0] === "--apply" });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Directus demo access operation failed";
    const safe = /^(Usage:|DIRECTUS_|Demo access|Final demo access)/.test(message)
      ? message
      : "Directus demo access operation failed; no user or record data was printed";
    process.stderr.write(`${safe}\n`);
    process.exitCode = 1;
  });
}
