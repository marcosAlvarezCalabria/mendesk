import type { Locale } from "@/i18n/locale";

export type StatsCopy = {
  today: string;
  thisWeek: string;
  thisMonth: string;
  more: string;
  from: string;
  to: string;
  apply: string;
  moneyReceived: string;
  moneyHint: string;
  cashflow: string;
  noPayments: string;
  paymentsRecorded: string;
  ordersCreated: string;
  ordersByStatus: string;
  noOrders: string;
  stillToCollect: string;
  averageOrder: string;
  ordersPaid: string;
  newClients: string;
  paymentMethods: string;
  card: string;
  cash: string;
  noPaymentMethods: string;
  paymentBreakdown: string;
  unavailableTitle: string;
  unavailableDescription: string;
  tryAgain: string;
};

const copies: Record<Locale, StatsCopy> = {
  en: {
    today: "Today",
    thisWeek: "This week",
    thisMonth: "This month",
    more: "More",
    from: "From",
    to: "To",
    apply: "Apply",
    moneyReceived: "Money received",
    moneyHint: "Deposits and final payments recorded in this period",
    cashflow: "Money received over time",
    noPayments: "No payments recorded in this period",
    paymentsRecorded: "Payments recorded",
    ordersCreated: "Orders created",
    ordersByStatus: "Orders created by current status",
    noOrders: "No orders were created in this period",
    unavailableTitle: "Stats are temporarily unavailable",
    stillToCollect: "Still to collect",
    averageOrder: "Average order",
    ordersPaid: "Orders paid",
    newClients: "New clients",
    paymentMethods: "Payment methods",
    card: "Card",
    cash: "Cash",
    noPaymentMethods: "No payments recorded by payment method",
    paymentBreakdown: "Payment method breakdown",
    unavailableDescription: "We couldn’t load the workshop figures. Your data is safe; check the connection and try again.",
    tryAgain: "Try again",
  },
  uk: {
    today: "Сьогодні",
    thisWeek: "Цей тиждень",
    thisMonth: "Цей місяць",
    more: "Більше",
    from: "Від",
    to: "До",
    apply: "Застосувати",
    moneyReceived: "Отримано коштів",
    moneyHint: "Завдатки й остаточні платежі, записані за цей період",
    cashflow: "Отримані кошти за часом",
    noPayments: "За цей період платежів не записано",
    paymentsRecorded: "Записано платежів",
    ordersCreated: "Створено замовлень",
    ordersByStatus: "Створені замовлення за поточним статусом",
    noOrders: "За цей період замовлень не створено",
    unavailableTitle: "Статистика тимчасово недоступна",
    stillToCollect: "Ще належить отримати",
    averageOrder: "Середня сума замовлення",
    ordersPaid: "Оплачені замовлення",
    newClients: "Нові клієнти",
    paymentMethods: "Способи оплати",
    card: "Картка",
    cash: "Готівка",
    noPaymentMethods: "Платежів за способами оплати не записано",
    paymentBreakdown: "Розподіл за способами оплати",
    unavailableDescription: "Не вдалося завантажити показники майстерні. Дані в безпеці; перевірте з’єднання та повторіть спробу.",
    tryAgain: "Спробувати ще раз",
  },
};

export function statsCopy(locale: Locale): StatsCopy {
  return copies[locale];
}
