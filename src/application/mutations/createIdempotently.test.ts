import { describe, expect, it, vi } from "vitest";

import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import { createIdempotently } from "@/application/mutations/createIdempotently";
import { IdempotencyConflictError } from "@/domain/errors/IdempotencyConflictError";

type Value = { id: string; content: string };

describe("createIdempotently", () => {
  it("returns a compatible existing value without creating", async () => {
    const create = vi.fn<() => Promise<Value>>();

    await expect(createIdempotently({
      lookup: async () => ({ id: "existing", content: "same" }),
      create,
      isCompatible: ({ content }) => content === "same",
    })).resolves.toEqual({ id: "existing", content: "same" });

    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an incompatible existing value without overwriting", async () => {
    const create = vi.fn<() => Promise<Value>>();

    await expect(createIdempotently({
      lookup: async () => ({ id: "existing", content: "different" }),
      create,
      isCompatible: ({ content }) => content === "same",
    })).rejects.toBeInstanceOf(IdempotencyConflictError);

    expect(create).not.toHaveBeenCalled();
  });

  it("creates after a confirmed empty lookup", async () => {
    const created = { id: "new", content: "same" };
    const create = vi.fn(async () => created);

    await expect(createIdempotently({
      lookup: async () => null,
      create,
      isCompatible: ({ content }) => content === "same",
    })).resolves.toBe(created);
  });

  it("recovers a compatible value when create loses its response", async () => {
    const lookup = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "saved", content: "same" });

    await expect(createIdempotently({
      lookup,
      create: async () => { throw new Error("connection lost"); },
      isCompatible: ({ content }) => content === "same",
    })).resolves.toEqual({ id: "saved", content: "same" });
  });

  it("rejects incompatible content found during reconciliation", async () => {
    const lookup = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "saved", content: "different" });

    await expect(createIdempotently({
      lookup,
      create: async () => { throw new Error("connection lost"); },
      isCompatible: ({ content }) => content === "same",
    })).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it("reports confirmed-not-saved after a confirmed empty reconciliation", async () => {
    await expect(createIdempotently({
      lookup: async () => null,
      create: async () => { throw new Error("rejected"); },
      isCompatible: () => true,
    })).rejects.toBeInstanceOf(MutationConfirmedNotSavedError);
  });

  it("preserves the create failure as the cause when reconciliation confirms no save", async () => {
    const authError = Object.assign(new Error("expired"), { status: 401 });

    await expect(createIdempotently({
      lookup: async () => null,
      create: async () => { throw authError; },
      isCompatible: () => true,
    })).rejects.toMatchObject({ cause: authError });
  });

  it("reports outcome-unknown when reconciliation cannot read Directus", async () => {
    const lookup = vi.fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("still offline"));

    await expect(createIdempotently({
      lookup,
      create: async () => { throw new Error("connection lost"); },
      isCompatible: () => true,
    })).rejects.toBeInstanceOf(MutationOutcomeUnknownError);
  });

  it("preserves both failures when the create and reconciliation requests fail", async () => {
    const createError = new Error("write response lost");
    const reconciliationError = Object.assign(new Error("session expired"), { status: 401 });

    const promise = createIdempotently({
      lookup: vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(reconciliationError),
      create: async () => { throw createError; },
      isCompatible: () => true,
    });

    await expect(promise).rejects.toMatchObject({
      cause: expect.objectContaining({ errors: [createError, reconciliationError] }),
    });
  });
});
