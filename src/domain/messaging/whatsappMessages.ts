export type MessageLocale = "en" | "es" | "uk";

export function buildReadyMessage(input: { clientName: string; locale: MessageLocale; storeName: string }): string {
  const name = normalizeName(input.clientName);

  if (input.locale === "uk") {
    return `Вітаємо, ${name}! Ваше замовлення в ${input.storeName} готове до видачі. Чекаємо на вас!`;
  }

  if (input.locale === "es") {
    return `¡Hola, ${name}! Tu encargo en ${input.storeName} está listo para recoger. ¡Te esperamos!`;
  }

  return `Hi ${name}! Your order at ${input.storeName} is ready for collection. See you soon!`;
}

export function buildReviewRequestMessage(input: {
  clientName: string;
  reviewUrl: string;
  locale: MessageLocale;
  storeName: string;
}): string {
  const name = normalizeName(input.clientName);

  if (input.locale === "uk") {
    return `Вітаємо, ${name}! Дякуємо, що обрали ${input.storeName}. Будемо вдячні за ваш відгук: ${input.reviewUrl}`;
  }

  if (input.locale === "es") {
    return `Hola, ${name}. ¡Gracias por elegir ${input.storeName}! Nos encantaría conocer tu opinión: ${input.reviewUrl}`;
  }

  return `Hi ${name}, thank you for choosing ${input.storeName}! We'd love your feedback — please leave us a review: ${input.reviewUrl}`;
}

export function buildIntakeConfirmationMessage(input: { clientName: string; locale: MessageLocale; storeName: string }): string {
  const name = normalizeName(input.clientName);

  if (input.locale === "uk") {
    return `Вітаємо, ${name}! Ми прийняли ваші речі в ${input.storeName}. Повідомимо, щойно все буде готове. Дякуємо!`;
  }

  if (input.locale === "es") {
    return `Hola, ${name}. Hemos recibido tus prendas en ${input.storeName}. Te avisaremos en cuanto estén listas. ¡Gracias!`;
  }

  return `Hi ${name}, we've received your garments at ${input.storeName}. We'll let you know as soon as they're ready. Thank you!`;
}

function normalizeName(clientName: string): string {
  return clientName.trim();
}
