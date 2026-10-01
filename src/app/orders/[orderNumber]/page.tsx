/**
 * THESIS: The order detail is a working ticket, not an administrative record.
 * OWN-WORLD: Ink summary, paper garment slips, amber status, green completion, red urgency.
 * STORY: Confirm the balance, inspect the garments, review payments, take the next safe action.
 * FIRST VIEWPORT: Client identity, outstanding balance, due state, then garment work.
 * FORM: Operate mode; compact order ticket pinned by the supplied September 2026 detail reference.
 */

import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/app/_ui/AppHeader";
import { Card } from "@/app/_ui/Card";
import { cx } from "@/app/_ui/classNames";
import { formatShortDate } from "@/app/_ui/dateFormat";
import { Icon } from "@/app/_ui/Icon";
import { formatPhoneForDisplay } from "@/app/_ui/phoneDisplay";
import { redirectToLoginForAuthError } from "@/app/authRedirect";
import { AddGarmentForm } from "@/app/orders/[orderNumber]/AddGarmentForm";
import { EditGarmentForm, type EditGarmentTexts } from "@/app/orders/[orderNumber]/EditGarmentForm";
import { EditOrderDetailsForm } from "@/app/orders/[orderNumber]/EditOrderDetailsForm";
import { GarmentPhoto } from "@/app/orders/[orderNumber]/GarmentPhoto";
import { RecordPaymentForm } from "@/app/orders/[orderNumber]/RecordPaymentForm";
import { RemovePaymentForm, type RemovePaymentTexts } from "@/app/orders/[orderNumber]/RemovePaymentForm";
import { RemoveGarmentForm, type RemoveGarmentTexts } from "@/app/orders/[orderNumber]/RemoveGarmentForm";
import { StatusBar } from "@/app/orders/[orderNumber]/StatusBar";
import { CollectOrderPanel } from "@/app/orders/[orderNumber]/CollectOrderPanel";
import { OrderHeaderActions } from "@/app/orders/[orderNumber]/OrderHeaderActions";
import { canEditOrder } from "@/app/orders/[orderNumber]/editView";
import { paymentFormDefaults, shouldShowPaymentForm } from "@/app/orders/[orderNumber]/paymentFormView";
import { buildOrderDetailHref, buildOrderTicketsHref } from "@/app/orders/orderNavigation";
import { safeOrderReturnTo } from "@/app/routeContext";
import { buildReviewWhatsappUrl } from "@/app/orders/[orderNumber]/reviewWhatsappUrl";
import { availableStatusActions } from "@/app/orders/[orderNumber]/statusActions";
import { garmentActionRowClassName, orderBalanceView, orderSummaryClassName } from "@/app/orders/[orderNumber]/orderDetailView";
import { GetOrder } from "@/application/useCases/GetOrder";
import { makeOrderRepository, makePhotoStorage } from "@/composition/directus";
import { storeConfig } from "@/config/currentStore";
import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import type { Payment } from "@/domain/entities/Payment";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { isOverdue, outstandingBalance } from "@/domain/orders/orderRules";
import { Money } from "@/domain/values/Money";
import { getSessionToken } from "@/infrastructure/auth/sessionCookie";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { ReadSyncMarker } from "@/app/sync/ReadSyncMarker";
import type { Locale } from "@/i18n/locale";
import { t } from "@/i18n/t";
import { buildWhatsappUrl } from "@/domain/messaging/buildWhatsappUrl";
import { buildReadyMessage } from "@/domain/messaging/whatsappMessages";

type OrderDetailPageProps = {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function OrderDetailPage({ params, searchParams }: OrderDetailPageProps) {
  const { orderNumber } = await params;
  const requestedReturnTo = (await searchParams).returnTo;
  const loginReturnHref = buildOrderDetailHref(orderNumber, undefined);
  const token = await getSessionToken();

  if (!token) {
    redirect(`/login?next=${encodeURIComponent(loginReturnHref)}`);
  }

  const locale = await getLocale();
  const dict = dictionaries[locale];
  const order = await getOrderOrNotFound(token, orderNumber, loginReturnHref);
  const returnTo = safeOrderReturnTo(requestedReturnTo, order.client.id);
  const overdue = isOverdue(order, new Date());
  const editable = canEditOrder(order);
  const statusActions = availableStatusActions(order);
  const primaryStatusActions = statusActions.filter((action) => action === "ready");
  const reviewWhatsappUrl = buildReviewWhatsappUrl(order, storeConfig.urls.reviewUrl, locale, storeConfig.identity.name);
  const readyWhatsappUrl = order.status.value === "ready" && order.client.phone
    ? buildWhatsappUrl(order.client.phone, buildReadyMessage({ clientName: order.client.name, locale, storeName: storeConfig.identity.name }))
    : undefined;
  const balance = outstandingBalance(order);
  const paymentDefaults = paymentFormDefaults(order.status.value, balance);
  const editGarmentTexts = {
    edit: t(dict, "orders.garments.edit"),
    description: t(dict, "orders.garments.description"),
    descriptionPlaceholder: t(dict, "orders.garments.descriptionPlaceholder"),
    alterationType: t(dict, "orders.garments.alterationType"),
    alterationLabels: alterationLabels(dict),
    price: t(dict, "orders.garments.price"),
    measurements: t(dict, "orders.garments.measurements"),
    measurementsPlaceholder: t(dict, "orders.garments.measurementsPlaceholder"),
    save: t(dict, "common.save"),
    saving: t(dict, "common.savingDots"),
    checkSaved: t(dict, "common.checkSaved"),
    checkingSaved: t(dict, "common.checkingSaved"),
    unsaved: t(dict, "orders.edit.unsaved"),
    errors: {
      notEditable: t(dict, "orders.garments.errors.notEditable"),
      description: t(dict, "orders.garments.errors.description"),
      price: t(dict, "orders.garments.errors.price"),
      saveFailed: t(dict, "orders.garments.errors.saveFailed"),
    },
  };
  const addGarmentTexts = {
    ariaLabel: t(dict, "orders.garments.addAria"),
    title: t(dict, "orders.garments.add"),
    description: t(dict, "orders.garments.description"),
    descriptionPlaceholder: t(dict, "orders.garments.descriptionPlaceholder"),
    alterationType: t(dict, "orders.garments.alterationType"),
    alterationLabels: alterationLabels(dict),
    price: t(dict, "orders.garments.price"),
    measurements: t(dict, "orders.garments.measurements"),
    measurementsPlaceholder: t(dict, "orders.garments.measurementsPlaceholder"),
    photo: t(dict, "orders.garments.photoOptional"),
    submit: t(dict, "orders.garments.add"),
    submitting: t(dict, "orders.garments.adding"),
    success: t(dict, "orders.garments.addSuccess"),
    checkSaved: t(dict, "common.checkSaved"),
    checkingSaved: t(dict, "common.checkingSaved"),
    confirmedAbsent: t(dict, "common.confirmedAbsent"),
    confirmedSaved: t(dict, "common.confirmedSaved"),
    errors: {
      notEditable: t(dict, "orders.garments.errors.notEditable"),
      description: t(dict, "orders.garments.errors.description"),
      price: t(dict, "orders.garments.errors.price"),
      saveFailed: t(dict, "orders.garments.errors.saveFailed"),
    },
  };
  const removeGarmentTexts = {
    remove: t(dict, "orders.garments.remove"),
    cancel: t(dict, "common.cancel"),
    confirmation: t(dict, "orders.garments.removeConfirmation"),
    confirm: t(dict, "orders.garments.confirmRemoval"),
    removing: t(dict, "orders.garments.removing"),
    checkSaved: t(dict, "common.checkSaved"),
    checkingSaved: t(dict, "common.checkingSaved"),
    success: t(dict, "orders.garments.removeSuccess"),
    lastGarmentHint: t(dict, "orders.garments.lastGarmentHint"),
    errors: {
      lastGarment: t(dict, "orders.garments.removeErrors.lastGarment"),
      notEditable: t(dict, "orders.garments.removeErrors.notEditable"),
      notFound: t(dict, "orders.garments.removeErrors.notFound"),
      deleteFailed: t(dict, "orders.garments.removeErrors.deleteFailed"),
      conflict: t(dict, "orders.garments.removeErrors.conflict"),
    },
  };
  const statusLabels = {
    received: t(dict, "orders.status.received"),
    ready: t(dict, "orders.status.ready"),
    collected: t(dict, "orders.status.collected"),
    cancelled: t(dict, "orders.status.cancelled"),
    overdue: t(dict, "orders.status.overdue"),
  };
  const paymentTexts = {
    types: { deposit: t(dict, "orders.payments.deposit"), final: t(dict, "orders.payments.final") },
    methods: { cash: t(dict, "orders.payments.cash"), card: t(dict, "orders.payments.card") },
  };
  const removePaymentTexts: RemovePaymentTexts = {
    remove: t(dict, "orders.payments.remove"),
    cancel: t(dict, "orders.payments.keep"),
    confirmation: t(dict, "orders.payments.removeConfirmation"),
    confirm: t(dict, "orders.payments.confirmRemoval"),
    removing: t(dict, "orders.payments.removing"),
    checkSaved: t(dict, "common.checkSaved"),
    checkingSaved: t(dict, "common.checkingSaved"),
    success: t(dict, "orders.payments.removeSuccess"),
    errors: {
      notEditable: t(dict, "orders.payments.removeErrors.notEditable"),
      notFound: t(dict, "orders.payments.removeErrors.notFound"),
      deleteFailed: t(dict, "orders.payments.removeErrors.deleteFailed"),
    },
  };

  return (
    <main className="min-h-screen bg-background text-on-surface">
      <ReadSyncMarker readId={crypto.randomUUID()} />
      <AppHeader
        backHref={returnTo}
        mobileAction={<OrderHeaderActions
          canCancel={statusActions.includes("cancelled")}
          clientName={order.client.name}
          expectedDateUpdated={order.dateUpdated.toISOString()}
          orderNumber={order.orderNumber.value}
          printHref={buildOrderTicketsHref(order.orderNumber.value, returnTo, order.client.id)}
          sourceStatus={order.status.value}
          texts={{ print: t(dict, "orders.tickets.printTickets"), more: t(dict, "nav.more"), cancel: t(dict, "orders.status.cancelOrder"), title: t(dict, "orders.status.cancelTitle"), warning: t(dict, "orders.status.cancelWarning"), keep: t(dict, "orders.status.keepOrder"), cancelling: t(dict, "orders.status.cancelling"), cancelled: t(dict, "orders.status.cancelledSuccess"), error: t(dict, "orders.status.unexpectedError") }}
        />}
        subtitle={order.client.phone ? `${order.client.name} · ${formatPhoneForDisplay(order.client.phone.value)}` : order.client.name}
        title={order.orderNumber.value}
        variant="back"
      />

      <div className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-[640px] flex-col px-3 pb-72 pt-3 sm:px-4 sm:pb-56 sm:pt-4 md:pb-56">
        <BalanceSummary
          receivedDateText={formatShortDate(order.receivedDate, locale)}
          receivedLabel={t(dict, "orders.receivedOn")}
          dueDateText={formatShortDate(order.dueDate, locale)}
          dueLabel={t(dict, "orders.due")}
          collectedDateText={order.collectedAt ? formatShortDate(order.collectedAt, locale) : undefined}
          collectedLabel={t(dict, "orders.detail.collectedOn")}
          order={order}
          overdue={overdue}
          statusLabel={statusLabels[order.status.value]}
          status={order.status.value}
          texts={{ ariaLabel: t(dict, "orders.detail.overviewAria"), total: t(dict, "orders.total"), paid: t(dict, "orders.paid"), paidInFull: t(dict, "orders.payments.paidInFull"), outstanding: t(dict, "orders.outstanding") }}
        />
          <div className="mt-2">
            {order.notes ? (
              <details className="group rounded-lg px-2 text-[0.75rem] text-on-surface-variant">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-secondary [&::-webkit-details-marker]:hidden">
                  <Icon className="size-4 shrink-0" name="notes" />
                  <span className="truncate"><strong className="text-on-surface">{t(dict, "orders.fields.notes")}:</strong> {order.notes}</span>
                </summary>
                <p className="pb-2 pl-6 leading-5">{order.notes}</p>
              </details>
            ) : null}
            <EditOrderDetailsForm
              editable={editable}
              orderNumber={order.orderNumber.value}
              dateUpdated={order.dateUpdated.toISOString()}
              dueDateValue={formatDateInput(order.dueDate)}
              notes={order.notes ?? ""}
              texts={{
                title: t(dict, "orders.edit.title"),
                dueDate: t(dict, "orders.fields.dueDate"),
                notes: t(dict, "orders.fields.notes"),
                notesPlaceholder: t(dict, "orders.fields.notesPlaceholder"),
                save: t(dict, "orders.edit.save"),
                saved: t(dict, "orders.edit.saved"),
                saving: t(dict, "common.savingDots"),
                checkSaved: t(dict, "common.checkSaved"),
                checkingSaved: t(dict, "common.checkingSaved"),
                unsaved: t(dict, "orders.edit.unsaved"),
                error: t(dict, "orders.new.errors.createFailed"),
              }}
            />
          </div>

        <section className="mt-3 space-y-2" aria-labelledby="garments-heading">
          <SectionHeading id="garments-heading" title={`${t(dict, "orders.garments.title")} · ${order.garments.length}`} />

          {order.garments.length === 0 ? (
            <Card as="div">
              <p className="text-body-md text-on-surface-variant">{t(dict, "orders.garments.empty")}</p>
            </Card>
          ) : (
            <div className="relative space-y-2 before:absolute before:bottom-5 before:left-2 before:top-5 before:w-px before:bg-outline-variant">
              {order.garments.map((garment) => (
                <GarmentBubble canRemove={order.garments.length > 1} editable={editable} garment={garment} key={garment.id} orderNumber={order.orderNumber.value} token={token} texts={editGarmentTexts} removeTexts={removeGarmentTexts} photoAlt={t(dict, "orders.garments.photoAlt")} photoClose={t(dict, "orders.garments.closePhoto")} photoOpen={t(dict, "orders.garments.viewPhoto")} photoRetry={t(dict, "orders.garments.photoRetry")} />
              ))}
            </div>
          )}

          <AddGarmentForm editable={editable} idempotencyKey={crypto.randomUUID()} orderNumber={order.orderNumber.value} texts={addGarmentTexts} />
        </section>

        <section className="mt-4 space-y-2" aria-labelledby="payments-heading">
          <SectionHeading id="payments-heading" title={`${t(dict, "orders.payments.title")} · ${order.payments.length}`} />

            <RecordPaymentForm
              editable={editable && shouldShowPaymentForm(balance)}
              defaultAmount={paymentDefaults.amount}
              outstandingAmount={balance.toString()}
              defaultType={paymentDefaults.type}
              idempotencyKey={crypto.randomUUID()}
              orderId={order.id}
              orderNumber={order.orderNumber.value}
              texts={{
                ariaLabel: t(dict, "orders.payments.recordAria"),
                type: t(dict, "orders.payments.type"),
                deposit: t(dict, "orders.payments.deposit"),
                final: t(dict, "orders.payments.final"),
                amount: t(dict, "orders.payments.amount"),
                amountHint: t(dict, "orders.payments.amountHint", { amount: formatMoney(balance) }),
                method: t(dict, "orders.payments.method"),
                cash: t(dict, "orders.payments.cash"),
                card: t(dict, "orders.payments.card"),
                addDeposit: t(dict, "orders.payments.addDeposit"),
                finalPayment: t(dict, "orders.payments.finalPayment"),
                close: t(dict, "orders.payments.close"),
                confirm: t(dict, "orders.payments.confirm"),
                confirming: t(dict, "orders.payments.submitting"),
                success: t(dict, "orders.payments.success"),
                amountRequired: t(dict, "orders.payments.amountRequired", { amount: formatMoney(balance) }),
                amountTooHigh: t(dict, "orders.payments.amountTooHigh", { amount: formatMoney(balance) }),
                checkSaved: t(dict, "common.checkSaved"),
                checkingSaved: t(dict, "common.checkingSaved"),
                confirmedAbsent: t(dict, "common.confirmedAbsent"),
                confirmedSaved: t(dict, "common.confirmedSaved"),
                errors: {
                  invalidAmount: t(dict, "orders.payments.errors.invalidAmount"),
                  overOutstanding: t(dict, "orders.payments.errors.overOutstanding"),
                  notEditable: t(dict, "orders.payments.errors.notEditable"),
                  invalidType: t(dict, "orders.payments.errors.invalidType"),
                  invalidMethod: t(dict, "orders.payments.errors.invalidMethod"),
                  saveFailed: t(dict, "orders.payments.errors.saveFailed"),
                },
              }}
            />
          {!shouldShowPaymentForm(balance) && order.payments.length > 0 ? (
            <p className="rounded-lg border border-status-ready/30 bg-status-ready/10 px-4 py-3 text-body-sm text-status-ready" role="status">
              {t(dict, "orders.payments.paidInFull")}
            </p>
          ) : null}

          {order.payments.length === 0 ? (
            <Card as="div">
              <p className="text-body-md text-on-surface-variant">{t(dict, "orders.payments.empty")}</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {order.payments.map((payment) => (
                <PaymentBubble editable={editable} locale={locale} orderNumber={order.orderNumber.value} payment={payment} key={payment.id} texts={paymentTexts} removeTexts={removePaymentTexts} />
              ))}
            </div>
          )}
        </section>
      </div>

      <StatusBar
        actions={primaryStatusActions}
        orderNumber={order.orderNumber.value}
        sourceStatus={order.status.value}
        expectedDateUpdated={order.dateUpdated.toISOString()}
        readyWhatsappUrl={readyWhatsappUrl}
        reviewWhatsappUrl={reviewWhatsappUrl}
        collectPanel={order.status.value === "ready" ? <CollectOrderPanel
          expectedDateUpdated={order.dateUpdated.toISOString()}
          formattedOutstanding={formatMoney(balance)}
          initialIdempotencyKey={crypto.randomUUID()}
          orderNumber={order.orderNumber.value}
          outstandingAmount={balance.toString()}
          texts={{ collect: t(dict, "orders.status.collectOrder"), title: t(dict, "orders.status.collectTitle"), amount: t(dict, "orders.payments.amount"), method: t(dict, "orders.payments.method"), cash: t(dict, "orders.payments.cash"), card: t(dict, "orders.payments.card"), payAndCollect: t(dict, "orders.status.payAndCollect"), confirmCollect: t(dict, "orders.status.confirmCollect"), collecting: t(dict, "orders.status.collecting"), close: t(dict, "orders.payments.close"), partial: t(dict, "orders.status.collectPartial"), success: t(dict, "orders.status.collectedSuccess"), errors: { invalid: t(dict, "orders.status.collectInvalid"), conflict: t(dict, "orders.status.conflictError"), "payment-failed": t(dict, "orders.status.collectPaymentFailed"), unexpected: t(dict, "orders.status.unexpectedError") } }}
        /> : undefined}
        texts={{
          ariaLabel: t(dict, "orders.status.actionsAria"),
          openWhatsapp: t(dict, "orders.status.openWhatsapp"),
          askReview: t(dict, "orders.status.askReview"),
          readyConfirmation: t(dict, "orders.status.readyConfirmation"),
          keepOrder: t(dict, "orders.status.keepOrder"),
          notNow: t(dict, "orders.status.notNow"),
          actionLabels: { ready: t(dict, "orders.status.markReady"), collected: t(dict, "orders.status.markCollected"), cancelled: t(dict, "orders.status.cancelOrder") },
          pendingLabels: { ready: t(dict, "orders.status.markingReady"), collected: t(dict, "orders.status.collecting"), cancelled: t(dict, "orders.status.cancelling") },
          checkSaved: t(dict, "common.checkSaved"),
          checkingSaved: t(dict, "common.checkingSaved"),
          successLabels: { ready: t(dict, "orders.status.readySuccess"), collected: t(dict, "orders.status.collectedSuccess"), cancelled: t(dict, "orders.status.cancelledSuccess") },
          errorLabels: { "invalid-transition": t(dict, "orders.status.invalidTransitionError"), conflict: t(dict, "orders.status.conflictError"), unexpected: t(dict, "orders.status.unexpectedError") },
        }}
      />
    </main>
  );
}

async function getOrderOrNotFound(token: string, orderNumber: string, currentHref: string): Promise<Order> {
  try {
    return await new GetOrder(makeOrderRepository(token)).execute(orderNumber);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      notFound();
    }

    return await redirectToLoginForAuthError(error, currentHref);
  }
}

function BalanceSummary({ order, receivedLabel, receivedDateText, dueLabel, dueDateText, collectedLabel, collectedDateText, overdue, status, statusLabel, texts }: { order: Order; receivedLabel: string; receivedDateText: string; dueLabel: string; dueDateText: string; collectedLabel: string; collectedDateText?: string; overdue: boolean; status: Order["status"]["value"]; statusLabel: string; texts: { ariaLabel: string; total: string; paid: string; paidInFull: string; outstanding: string } }) {
  const garmentsTotal = order.garments.reduce((total, garment) => total.add(garment.price), Money.zero());
  const paidTotal = order.payments.reduce((total, payment) => total.add(payment.amount), Money.zero());
  const balance = outstandingBalance(order);
  const balanceView = orderBalanceView(balance, texts);

  return (
    <section className={orderSummaryClassName(status)} aria-label={texts.ariaLabel}>
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-white/75">{balanceView.label}</p>
          <p className="mt-1 text-headline-md font-extrabold leading-none tracking-tight">{balanceView.value}</p>
        </div>
        <dl className="shrink-0 space-y-1 pt-1 text-[0.6875rem] leading-4">
          <div className="flex justify-end gap-1.5">
            <dt className="text-white/75">{texts.paid}</dt>
            <dd className="font-bold">{formatMoney(paidTotal)}</dd>
          </div>
          <div className="flex justify-end gap-1.5">
            <dt className="text-white/75">{texts.total}</dt>
            <dd className="font-bold">{formatMoney(garmentsTotal)}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-on-primary/15 pt-3 text-[0.6875rem] font-bold">
        <span className={statusSummaryClassName(status)}>{statusLabel}</span>
        <time dateTime={order.receivedDate.toISOString()} className="rounded-full bg-on-primary/10 px-2.5 py-1 text-on-primary">{receivedLabel} {receivedDateText}</time>
        <time dateTime={order.dueDate.toISOString()} className={overdue ? "rounded-full bg-status-overdue px-2.5 py-1 text-white" : "rounded-full bg-on-primary/10 px-2.5 py-1 text-on-primary"}>{dueLabel} {dueDateText}</time>
        {collectedDateText && order.collectedAt ? <time dateTime={order.collectedAt.toISOString()} className="rounded-full bg-on-primary/10 px-2.5 py-1 text-on-primary">{collectedLabel} {collectedDateText}</time> : null}
      </div>
    </section>
  );
}

function statusSummaryClassName(status: Order["status"]["value"]): string {
  const base = "rounded-full px-2.5 py-1";

  if (status === "cancelled") {
    return `${base} bg-white/15 text-white`;
  }

  if (status === "ready") {
    return `${base} bg-white/15 text-white`;
  }

  if (status === "collected") {
    return `${base} bg-white/15 text-white`;
  }

  return `${base} bg-secondary-container text-on-secondary-container`;
}

function SectionHeading({ id, title }: { id: string; title: string }) {
  return (
    <h2 id={id} className="text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-on-surface-variant">
      {title}
    </h2>
  );
}

async function GarmentBubble({ garment, token, editable, canRemove, orderNumber, texts, removeTexts, photoAlt, photoClose, photoOpen, photoRetry }: { garment: Garment; token: string; editable: boolean; canRemove: boolean; orderNumber: string; texts: EditGarmentTexts; removeTexts: RemoveGarmentTexts; photoAlt: string; photoClose: string; photoOpen: string; photoRetry: string }) {
  const photoUrl = garment.photoId ? await makePhotoStorage(token).getSignedUrl(garment.photoId) : null;

  return (
    <article className="relative ml-5 rounded-xl bg-surface-container-lowest p-2.5 shadow-[0_1px_3px_rgba(31,27,23,0.08)]">
      <span className="absolute -left-[15px] top-5 size-2 rounded-full bg-secondary" aria-hidden="true" />
      <div className="flex items-start gap-2.5">
        <GarmentPhoto photoUrl={photoUrl} alt={photoAlt.replace("{description}", garment.description)} closeLabel={photoClose} openLabel={photoOpen} retryLabel={photoRetry} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[0.8125rem] font-extrabold leading-4 text-on-surface">{garment.description}</h3>
            <p className="shrink-0 text-[0.75rem] font-extrabold leading-4 text-on-surface">{formatMoney(garment.price)}</p>
          </div>
          <p className="mt-0.5 text-[0.6875rem] leading-4 text-on-surface-variant">{texts.alterationLabels[garment.alterationType] ?? garment.alterationType}</p>
          {garment.measurements ? <p className="mt-1 text-[0.6875rem] leading-4 text-on-surface-variant">{garment.measurements}</p> : null}
        </div>
      </div>

        <div className={garmentActionRowClassName()}>
        <EditGarmentForm
          editable={editable}
          orderNumber={orderNumber}
          garment={{
            id: garment.id,
            dateUpdated: garment.dateUpdated.toISOString(),
            description: garment.description,
            alterationType: garment.alterationType,
            measurements: garment.measurements ?? "",
            price: garment.price.toString(),
          }}
          texts={texts}
        />
        {editable ? <RemoveGarmentForm
          canRemove={canRemove}
          description={garment.description}
          garmentId={garment.id}
          expectedDateUpdated={garment.dateUpdated.toISOString()}
          orderNumber={orderNumber}
          texts={removeTexts}
        /> : null}
        </div>
    </article>
  );
}

function PaymentBubble({ locale, orderNumber, payment, editable, texts, removeTexts }: { locale: Locale; orderNumber: string; payment: Payment; editable: boolean; texts: { types: Record<Payment["type"], string>; methods: Record<Payment["method"], string> }; removeTexts: RemovePaymentTexts }) {
  const amount = formatMoney(payment.amount);
  return (
    <article className={cx("relative ml-7 rounded-xl bg-surface-container-low py-2.5 pl-3 text-on-surface", editable ? "pr-12" : "pr-3")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[0.75rem] font-extrabold leading-4">{texts.types[payment.type]} · {texts.methods[payment.method]}</h3>
          <p className="mt-0.5 text-[0.6875rem] leading-4 text-on-surface-variant">{formatShortDate(payment.createdAt, locale)}</p>
        </div>
        <p className="shrink-0 text-[0.75rem] font-extrabold leading-4">{amount}</p>
      </div>
      {editable ? <RemovePaymentForm amount={amount} orderNumber={orderNumber} paymentId={payment.id} paymentType={texts.types[payment.type]} texts={removeTexts} /> : null}
    </article>
  );
}

function formatMoney(money: Money): string {
  return `€${money.toString()}`;
}

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function alterationLabels(dict: typeof dictionaries.en): Record<string, string> {
  return {
    hem: t(dict, "alterations.hem"),
    waist: t(dict, "alterations.waist"),
    zipper: t(dict, "alterations.zipper"),
    sleeves: t(dict, "alterations.sleeves"),
    take_in: t(dict, "alterations.takeIn"),
    other: t(dict, "alterations.other"),
  };
}
