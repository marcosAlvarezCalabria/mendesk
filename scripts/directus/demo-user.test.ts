import { describe, expect, it } from "vitest";

import {
  auditDemoUser,
  normalizeDemoEmail,
  provisionDemoUser,
  validateDemoPassword,
  type DemoUserAdmin,
  type DemoUserInventory,
} from "./demo-user.ts";
import { demoRoleName } from "./demo-access.ts";

describe("Mendesk demo Directus user", () => {
  it("normalizes email without weakening password requirements", () => {
    expect(normalizeDemoEmail("  Staff@Example.com ")).toBe("staff@example.com");
    expect(() => normalizeDemoEmail("not-an-email")).toThrow("valid email");
    expect(validateDemoPassword("Long-Demo-Password-2026")).toBe("Long-Demo-Password-2026");
    expect(() => validateDemoPassword("short")).toThrow("at least 16");
    expect(() => validateDemoPassword("alllowercasebutlong2026")).toThrow("upper, lower, number and symbol");
  });

  it("audits the role, assignment and active status", () => {
    expect(auditDemoUser({ roles: [], users: [] }).issues).toEqual([
      { code: "missing-role" },
      { code: "missing-user" },
    ]);
    expect(auditDemoUser(completeInventory()).ok).toBe(true);
  });

  it("refuses to take over an existing user with the wrong role", async () => {
    const inventory = completeInventory();
    inventory.users[0].roleId = "another-role";
    const admin = fakeAdmin(inventory);
    await expect(provisionDemoUser(admin, {
      email: "staff@example.com",
      password: "Long-Demo-Password-2026",
      apply: true,
    })).rejects.toThrow("is incompatible");
    expect(admin.writes).toEqual([]);
  });

  it("requires a password only when a missing user is created", async () => {
    const admin = fakeAdmin({
      roles: [{ id: "role-1", name: demoRoleName }],
      users: [],
    });
    await expect(provisionDemoUser(admin, { email: "staff@example.com", apply: true })).rejects.toThrow(
      "at least 16",
    );
    expect(admin.writes).toEqual([]);
  });

  it("creates the user once and never resets an existing password", async () => {
    const admin = fakeAdmin({
      roles: [{ id: "role-1", name: demoRoleName }],
      users: [],
    });
    const first = await provisionDemoUser(admin, {
      email: " STAFF@example.com ",
      password: "Long-Demo-Password-2026",
      apply: true,
    });
    expect(first.report.ok).toBe(true);
    expect(admin.writes).toEqual(["create:staff@example.com"]);

    const second = await provisionDemoUser(admin, {
      email: "staff@example.com",
      password: "Different-Password-2027",
      apply: true,
    });
    expect(second.report.ok).toBe(true);
    expect(admin.writes).toEqual(["create:staff@example.com"]);
  });
});

type MutableInventory = {
  roles: { id: string; name: string }[];
  users: { id: string; email: string; status: string; roleId: string | null }[];
};

function completeInventory(): MutableInventory {
  return {
    roles: [{ id: "role-1", name: demoRoleName }],
    users: [{ id: "user-1", email: "staff@example.com", status: "active", roleId: "role-1" }],
  };
}

function fakeAdmin(initial: DemoUserInventory): DemoUserAdmin & { writes: string[] } {
  const state: MutableInventory = {
    roles: initial.roles.map((item) => ({ ...item })),
    users: initial.users.map((item) => ({ ...item })),
  };
  const writes: string[] = [];
  return {
    writes,
    async readInventory(email) {
      return {
        roles: state.roles,
        users: state.users.filter((user) => user.email === email),
      };
    },
    async createDemoUser(input) {
      writes.push(`create:${input.email}`);
      state.users.push({
        id: "user-1",
        email: input.email,
        status: "active",
        roleId: input.roleId,
      });
    },
  };
}
