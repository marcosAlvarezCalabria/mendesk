import { describe, expect, it } from "vitest";

import { en } from "./en";
import { uk } from "./uk";

describe("English dictionary", () => {
  it("uses the euro symbol in the outstanding balance label", () => {
    expect(en["orders.dueAmount"]).toBe("\u20ac{amount} due");
  });
});

describe("Order due-group labels", () => {
  it("provides concise English and Ukrainian labels", () => {
    expect([en["orders.groups.late"], en["orders.groups.today"], en["orders.groups.next"]]).toEqual(["Late", "Today", "Next"]);
    expect([uk["orders.groups.late"], uk["orders.groups.today"], uk["orders.groups.next"]]).toEqual(["Прострочені", "Сьогодні", "Наступні"]);
  });
});

describe("Order status confirmations", () => {
  it("provides English and Ukrainian success messages", () => {
    expect([en["orders.status.readySuccess"], en["orders.status.collectedSuccess"], en["orders.status.cancelledSuccess"]]).toEqual([
      "Order marked Ready.", "Order marked Collected.", "Order cancelled.",
    ]);
    expect([uk["orders.status.readySuccess"], uk["orders.status.collectedSuccess"], uk["orders.status.cancelledSuccess"]]).toEqual([
      "Замовлення позначено як готове.", "Замовлення позначено як забране.", "Замовлення скасовано.",
    ]);
  });
});

describe("Order card next actions", () => {
  it("provides concise English and Ukrainian guidance", () => {
    expect([en["orders.card.next"], en["orders.card.paymentHint"], en["orders.card.takePayment"]]).toEqual([
      "Next",
      "Collect {amount} before closing",
      "Take payment",
    ]);
    expect([uk["orders.card.next"], uk["orders.card.paymentHint"], uk["orders.card.takePayment"]]).toEqual([
      "Далі",
      "Отримайте {amount} перед закриттям",
      "Прийняти оплату",
    ]);
  });
});

describe("Localized operational labels", () => {
  it("provides English and Ukrainian order status labels", () => {
    expect([
      en["orders.status.received"],
      en["orders.status.ready"],
      en["orders.status.collected"],
      en["orders.status.cancelled"],
      en["orders.status.overdue"],
    ]).toEqual(["Received", "Ready", "Collected", "Cancelled", "Overdue"]);
    expect([
      uk["orders.status.received"],
      uk["orders.status.ready"],
      uk["orders.status.collected"],
      uk["orders.status.cancelled"],
      uk["orders.status.overdue"],
    ]).toEqual(["Прийнято", "Готово", "Забрано", "Скасовано", "Прострочено"]);
  });

  it("provides localized payment and appointment labels", () => {
    expect([
      en["orders.payments.deposit"],
      en["orders.payments.final"],
      en["orders.payments.cash"],
      en["orders.payments.card"],
      en["appointments.status.scheduled"],
      en["appointments.status.completed"],
      en["appointments.status.cancelled"],
    ]).toEqual(["Deposit", "Final payment", "Cash", "Card", "Scheduled", "Completed", "Cancelled"]);
    expect([
      uk["orders.payments.deposit"],
      uk["orders.payments.final"],
      uk["orders.payments.cash"],
      uk["orders.payments.card"],
      uk["appointments.status.scheduled"],
      uk["appointments.status.completed"],
      uk["appointments.status.cancelled"],
    ]).toEqual(["Завдаток", "Остаточний платіж", "Готівка", "Картка", "Заплановано", "Виконано", "Скасовано"]);
  });
});

describe("International client phone guidance", () => {
  it("accepts Irish and international phones in English and Ukrainian", () => {
    expect([en["orders.new.errors.invalidPhone"], en["clients.fields.phonePlaceholder"]]).toEqual([
      "Enter a valid Irish or international phone number, including the country code.",
      "+34 612 345 678 or 085 200 9225",
    ]);
    expect([uk["orders.new.errors.invalidPhone"], uk["clients.fields.phonePlaceholder"]]).toEqual([
      "Введіть дійсний ірландський або міжнародний номер телефону з кодом країни.",
      "+34 612 345 678 або 085 200 9225",
    ]);
  });
});

describe("Accessible interface messages", () => {
  it("localizes language controls and mutation errors", () => {
    expect([en["nav.language"], en["appointments.error"], en["appointments.delete.error"], en["kiosk.error"], en["login.error"]]).toEqual([
      "Language", "The appointment could not be saved. Check the details and try again.", "The appointment could not be deleted. Check the connection and try again.", "We couldn't save your details. Please ask for help.", "Invalid email or password.",
    ]);
    expect([uk["nav.language"], uk["appointments.error"], uk["appointments.delete.error"], uk["kiosk.error"], uk["login.error"]]).toEqual([
      "Мова", "Не вдалося зберегти зустріч. Перевірте дані та спробуйте ще раз.", "Не вдалося видалити зустріч. Перевірте з’єднання та спробуйте ще раз.", "Не вдалося зберегти ваші дані. Будь ласка, попросіть допомоги.", "Неправильна електронна адреса або пароль.",
    ]);
  });
    expect(en["stats.loading"]).toBe("Loading statistics");
    expect(uk["stats.loading"]).toBe("Завантаження статистики");
});

describe("Order edit save states", () => {
  it("warns about unsaved changes in English and Ukrainian", () => {
    expect([en["orders.edit.save"], en["orders.edit.saved"], en["orders.edit.unsaved"]]).toEqual([
      "Save changes",
      "Changes saved",
      "Unsaved changes — leaving now will discard them.",
    ]);
    expect([uk["orders.edit.save"], uk["orders.edit.saved"], uk["orders.edit.unsaved"]]).toEqual([
      "Зберегти зміни",
      "Зміни збережено",
      "Незбережені зміни — якщо вийти зараз, вони будуть втрачені.",
    ]);
  });
});
