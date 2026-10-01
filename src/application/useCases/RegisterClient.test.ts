import { describe, expect, it, vi } from "vitest";
import { RegisterClient } from "./RegisterClient";
import type { ClientRepository } from "@/application/ports/ClientRepository";
import { PhoneNumber } from "@/domain/values/PhoneNumber";
import { ClientRegistrationValidationError } from "@/domain/errors/ClientRegistrationValidationError";
import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import { isAuthError } from "@/infrastructure/auth/authError";

const input = { name: " Test Client ", phoneRaw: "+353 85 000 0001", gdprConsent: true };
const client = { id: "00000000-0000-4000-8000-000000000001", name: "Test Client", phone: PhoneNumber.fromRaw(input.phoneRaw), gdprConsent: true };
function setup() {
  const repo = { create: vi.fn().mockResolvedValue(client), getByPhone: vi.fn().mockResolvedValue(null), getWithHistory: vi.fn(), anonymize: vi.fn() } satisfies ClientRepository;
  return { repo, useCase: new RegisterClient(repo) };
}
describe("RegisterClient", () => {
  it.each(["", "   "])("rejects blank name %j before I/O", async name => {
    const { repo, useCase } = setup();
    await expect(useCase.execute({ ...input, name })).rejects.toMatchObject({ field: "name" });
    expect(repo.getByPhone).not.toHaveBeenCalled(); expect(repo.create).not.toHaveBeenCalled();
  });
  it("requires consent before I/O", async () => {
    const { repo, useCase } = setup();
    await expect(useCase.execute({ ...input, gdprConsent: false })).rejects.toBeInstanceOf(ClientRegistrationValidationError);
    expect(repo.getByPhone).not.toHaveBeenCalled();
  });
  it("rejects invalid phone before I/O", async () => {
    const { repo, useCase } = setup();
    await expect(useCase.execute({ ...input, phoneRaw: "123" })).rejects.toThrow();
    expect(repo.getByPhone).not.toHaveBeenCalled();
  });
  it.each(["+353 85 000 0001", "00353850000001"])("normalizes %s before lookup and creates without notes", async phoneRaw => {
    const { repo, useCase } = setup();
    await expect(useCase.execute({ ...input, phoneRaw })).resolves.toEqual({ type: "created", client });
    expect(repo.getByPhone.mock.calls[0]![0].value).toBe("353850000001");
    expect(repo.create).toHaveBeenCalledExactlyOnceWith({ name: "Test Client", phone: client.phone, gdprConsent: true });
  });
  it("offers a preexisting exact match without creating", async () => {
    const { repo, useCase } = setup(); repo.getByPhone.mockResolvedValue(client);
    await expect(useCase.execute(input)).resolves.toEqual({ type: "existing", client });
    expect(repo.create).not.toHaveBeenCalled();
  });
  it.each([undefined, "", null])("reconciles lost response with empty notes %j", async notes => {
    const { repo, useCase } = setup(); const stored = { ...client, notes };
    repo.create.mockRejectedValue(new Error("lost")); repo.getByPhone.mockResolvedValueOnce(null).mockResolvedValueOnce(stored);
    await expect(useCase.execute(input)).resolves.toEqual({ type: "created", client: stored });
    expect(repo.create).toHaveBeenCalledTimes(1);
  });
  it.each([{ name: "Another client" }, { notes: "Existing note" }, { gdprConsent: false }])("does not overwrite a concurrent incompatible match %j", async changes => {
    const { repo, useCase } = setup(); const stored = { ...client, ...changes };
    repo.create.mockRejectedValue({ code: "RECORD_NOT_UNIQUE" }); repo.getByPhone.mockResolvedValueOnce(null).mockResolvedValueOnce(stored);
    await expect(useCase.execute(input)).resolves.toEqual({ type: "existing", client: stored });
    expect(repo.create).toHaveBeenCalledTimes(1);
  });
  it("confirms absence after a failed create", async () => {
    const { repo, useCase } = setup(); repo.create.mockRejectedValue(new Error("lost"));
    await expect(useCase.execute(input)).rejects.toBeInstanceOf(MutationConfirmedNotSavedError);
  });
  it("keeps outcome unknown and auth causes when reconciliation fails", async () => {
    const { repo, useCase } = setup(); repo.create.mockRejectedValue({ status: 401 });
    repo.getByPhone.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("network"));
    const error = await useCase.execute(input).catch(error => error);
    expect(error).toBeInstanceOf(MutationOutcomeUnknownError); expect(isAuthError(error)).toBe(true);
  });
  it.each([client, null])("reconciles using only phone without any writes", async stored => {
    const { repo, useCase } = setup(); repo.getByPhone.mockResolvedValue(stored);
    await expect(useCase.reconcile(input.phoneRaw)).resolves.toBe(stored);
    expect(repo.create).not.toHaveBeenCalled();
  });
});
