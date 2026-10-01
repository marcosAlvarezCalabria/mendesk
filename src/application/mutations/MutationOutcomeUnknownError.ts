export class MutationOutcomeUnknownError extends Error {
  constructor(options?: ErrorOptions) {
    super("The mutation outcome is unknown.", options);
    this.name = "MutationOutcomeUnknownError";
  }
}
