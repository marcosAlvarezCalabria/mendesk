export class InvalidPhoneNumberError extends Error {
  constructor(message = "Invalid phone number") {
    super(message);
    this.name = "InvalidPhoneNumberError";
    Object.setPrototypeOf(this, InvalidPhoneNumberError.prototype);
  }
}
