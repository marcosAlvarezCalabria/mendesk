export const technicalKeys = Object.freeze({
  sessionCookie: "mendesk_session",
  refreshCookie: "mendesk_refresh",
  localeCookie: "mendesk_locale",
  appointmentDraft: "mendesk:appointment:new:draft:v1",
  clientRegistrationRecovery: "mendesk:client-registration:recovery:v1",
  orderInvalidationChannel: "mendesk-order-invalidation-v1",
});

export const idempotencyKeys = Object.freeze({
  newOrder: "mendesk:idempotency:new-order",
  newOrderPayment: "mendesk:idempotency:new-order:payment",
  newOrderGarment: (garmentId: string | number) => `mendesk:idempotency:new-order:garment:${garmentId}`,
  addGarment: (orderNumber: string) => `mendesk:idempotency:add-garment:${orderNumber}`,
  collectOrder: (orderNumber: string) => `mendesk:idempotency:collect:${orderNumber}`,
  payment: (orderNumber: string) => `mendesk:idempotency:payment:${orderNumber}`,
});
