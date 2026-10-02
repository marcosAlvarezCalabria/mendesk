import { describe, expect, it } from "vitest";

import {
  auditDemoAccess,
  demoPermissions,
  demoPolicyName,
  demoRoleName,
  provisionDemoAccess,
  type DemoAccessAdmin,
  type DemoAccessInventory,
  type DemoPermissionDefinition,
} from "./demo-access.ts";

describe("Mendesk demo Directus access", () => {
  it("grants only the collection actions used by the application", () => {
    expect(actions("clients")).toEqual(["create", "read", "update"]);
    expect(actions("orders")).toEqual(["create", "read", "update"]);
    expect(actions("garments")).toEqual(["create", "read", "update", "delete"]);
    expect(actions("payments")).toEqual(["create", "read", "delete"]);
    expect(actions("appointments")).toEqual(["create", "read", "update", "delete"]);
    expect(actions("order_sequences")).toEqual(["create"]);
    expect(actions("shop_settings")).toEqual(["create", "read", "update"]);
    expect(actions("directus_files")).toEqual(["create", "read"]);
  });

  it("reports only the missing role and policy for an empty installation", () => {
    expect(auditDemoAccess(emptyInventory()).issues).toEqual([
      { code: "missing-role" },
      { code: "missing-policy" },
    ]);
  });

  it("refuses an unsafe policy before writing", async () => {
    const inventory = completeInventory();
    inventory.policies[0] = { ...inventory.policies[0], adminAccess: true };
    const admin = fakeAdmin(inventory);
    await expect(provisionDemoAccess(admin, { apply: true })).rejects.toThrow("is incompatible");
    expect(admin.writes).toEqual([]);
  });

  it("refuses to widen or silently replace an existing permission", async () => {
    const inventory = completeInventory();
    inventory.permissions[0] = { ...inventory.permissions[0], fields: ["id"] };
    const admin = fakeAdmin(inventory);
    await expect(provisionDemoAccess(admin, { apply: true })).rejects.toThrow("is incompatible");
    expect(admin.writes).toEqual([]);
  });

  it("creates the access configuration and is idempotent", async () => {
    const admin = fakeAdmin(emptyInventory());
    const first = await provisionDemoAccess(admin, { apply: true });
    expect(first.report.ok).toBe(true);
    expect(admin.writes.filter((item) => item.startsWith("permission:"))).toHaveLength(demoPermissions.length);

    const writesAfterFirstApply = admin.writes.length;
    const second = await provisionDemoAccess(admin, { apply: true });
    expect(second.report.ok).toBe(true);
    expect(admin.writes).toHaveLength(writesAfterFirstApply);
  });
});

function actions(collection: string): string[] {
  return demoPermissions.filter((item) => item.collection === collection).map((item) => item.action);
}

function emptyInventory(): MutableInventory {
  return { roles: [], policies: [], permissions: [] };
}

type MutableInventory = {
  roles: { id: string; name: string }[];
  policies: { id: string; name: string; adminAccess: boolean; appAccess: boolean; roleIds: string[] }[];
  permissions: {
    id: number; policyId: string; collection: string; action: string; fields: string[] | null;
    permissions: unknown; validation: unknown; presets: unknown;
  }[];
};

function completeInventory(): MutableInventory {
  return {
    roles: [{ id: "role-1", name: demoRoleName }],
    policies: [{
      id: "policy-1", name: demoPolicyName, adminAccess: false, appAccess: false, roleIds: ["role-1"],
    }],
    permissions: demoPermissions.map((item, index) => ({
      id: index + 1,
      policyId: "policy-1",
      collection: item.collection,
      action: item.action,
      fields: [...item.fields],
      permissions: null,
      validation: null,
      presets: null,
    })),
  };
}

function fakeAdmin(initial: DemoAccessInventory): DemoAccessAdmin & { writes: string[] } {
  const state: MutableInventory = {
    roles: initial.roles.map((item) => ({ ...item })),
    policies: initial.policies.map((item) => ({ ...item, roleIds: [...item.roleIds] })),
    permissions: initial.permissions.map((item) => ({ ...item, fields: item.fields ? [...item.fields] : null })),
  };
  const writes: string[] = [];
  return {
    writes,
    async readInventory() {
      return state;
    },
    async createRole() {
      writes.push("role");
      state.roles.push({ id: "role-1", name: demoRoleName });
      return "role-1";
    },
    async createPolicy(roleId) {
      writes.push("policy");
      state.policies.push({
        id: "policy-1", name: demoPolicyName, adminAccess: false, appAccess: false, roleIds: [roleId],
      });
      return "policy-1";
    },
    async attachPolicyToRole(policyId, roleId) {
      writes.push("link");
      const policy = state.policies.find((item) => item.id === policyId);
      if (policy) policy.roleIds = [roleId];
    },
    async createPermission(policyId, definition: DemoPermissionDefinition) {
      writes.push(`permission:${definition.collection}:${definition.action}`);
      state.permissions.push({
        id: state.permissions.length + 1,
        policyId,
        collection: definition.collection,
        action: definition.action,
        fields: [...definition.fields],
        permissions: null,
        validation: null,
        presets: null,
      });
    },
  };
}
