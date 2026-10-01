export class ClientRegistrationValidationError extends Error {
  constructor(readonly field: "name" | "gdprConsent") {
    super(field === "name" ? "Client name is required" : "Privacy consent is required");
    this.name = "ClientRegistrationValidationError";
  }
}
