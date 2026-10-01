export class AppointmentConflictError extends Error {
  constructor() {
    super("The appointment changed before this action could be saved.");
    this.name = "AppointmentConflictError";
  }
}
