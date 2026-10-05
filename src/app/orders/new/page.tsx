import { NewOrderForm } from "@/app/orders/new/NewOrderClientForm";
import { safeNewOrderReturnTo } from "@/app/routeContext";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { t } from "@/i18n/t";

type NewOrderPageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function NewOrderPage({ searchParams }: NewOrderPageProps) {
  const params = await searchParams;
  const locale = await getLocale();
  const dict = dictionaries[locale];

  return (
    <NewOrderForm
      cancelHref={safeNewOrderReturnTo(params.returnTo)}
      initialGarmentIdempotencyKey={crypto.randomUUID()}
      initialPaymentIdempotencyKey={crypto.randomUUID()}
      locale={locale}
      orderIdempotencyKey={crypto.randomUUID()}
      texts={{
        backToOrders: t(dict, "nav.backToOrders"),
        cancel: t(dict, "common.cancel"),
        unsavedWarning: t(dict, "orders.edit.unsaved"),
        title: t(dict, "orders.new.title"),
        dueDate: t(dict, "orders.fields.dueDate"),
        deposit: t(dict, "orders.payments.deposit"),
        paymentMethod: t(dict, "orders.payments.method"),
        cash: t(dict, "orders.payments.cash"),
        card: t(dict, "orders.payments.card"),
        outstanding: t(dict, "orders.outstanding"),
        notes: t(dict, "orders.fields.notes"),
        notesPlaceholder: t(dict, "orders.fields.notesPlaceholder"),
        garments: t(dict, "orders.garments.title"),
        addGarment: t(dict, "orders.garments.add"),
        saveGarment: t(dict, "orders.new.saveGarment"),
        editGarment: t(dict, "orders.new.editGarment"),
        garment: t(dict, "orders.garments.singular"),
        remove: t(dict, "common.remove"),
        description: t(dict, "orders.garments.description"),
        descriptionPlaceholder: t(dict, "orders.garments.descriptionPlaceholder"),
        alterationType: t(dict, "orders.garments.alterationType"),
        alterationLabels: {
          hem: t(dict, "alterations.hem"),
          waist: t(dict, "alterations.waist"),
          zipper: t(dict, "alterations.zipper"),
          sleeves: t(dict, "alterations.sleeves"),
          take_in: t(dict, "alterations.takeIn"),
          other: t(dict, "alterations.other"),
        },
        price: t(dict, "orders.garments.price"),
        measurements: t(dict, "orders.garments.measurements"),
        measurementsPlaceholder: t(dict, "orders.garments.measurementsPlaceholder"),
        photo: t(dict, "orders.garments.photo"),
        takePhoto: t(dict, "orders.garments.takePhoto"),
        choosePhoto: t(dict, "orders.garments.choosePhoto"),
        viewPhoto: t(dict, "orders.garments.viewPhoto"),
        closePhoto: t(dict, "orders.garments.closePhoto"),
        createOrder: t(dict, "orders.new.create"),
        creatingOrder: t(dict, "orders.new.creating"),
        flow: {
          step: t(dict, "orders.new.flow.step"),
          clientTitle: t(dict, "orders.new.flow.clientTitle"),
          clientHelp: t(dict, "orders.new.flow.clientHelp"),
          detailsTitle: t(dict, "orders.new.flow.detailsTitle"),
          detailsHelp: t(dict, "orders.new.flow.detailsHelp"),
          deliveryTitle: t(dict, "orders.new.flow.deliveryTitle"),
          deliveryHelp: t(dict, "orders.new.flow.deliveryHelp"),
          reviewTitle: t(dict, "orders.new.flow.reviewTitle"),
          reviewHelp: t(dict, "orders.new.flow.reviewHelp"),
          continueWithClient: t(dict, "orders.new.flow.continueWithClient"),
          checkingClient: t(dict, "orders.new.flow.checkingClient"),
          clientLookupError: t(dict, "orders.new.flow.clientLookupError"),
          continueToDelivery: t(dict, "orders.new.flow.continueToDelivery"),
          reviewOrder: t(dict, "orders.new.flow.reviewOrder"),
          editDetails: t(dict, "orders.new.flow.editDetails"),
          back: t(dict, "orders.new.flow.back"),
          afterSave: t(dict, "orders.new.flow.afterSave"),
          client: t(dict, "orders.new.flow.client"),
          phone: t(dict, "orders.new.flow.phone"),
          total: t(dict, "orders.new.flow.total"),
          noNotes: t(dict, "orders.new.flow.noNotes"),
          noMeasurements: t(dict, "orders.new.flow.noMeasurements"),
          reconcileOrder: {
            en: "Check Directus and continue",
            es: "Comprobar Directus y continuar",
            uk: "Перевірити Directus і продовжити",
          }[locale],
          noPhoto: t(dict, "orders.new.flow.noPhoto"),
          openCreatedOrder: t(dict, "orders.new.flow.openCreatedOrder"),
          clientError: t(dict, "orders.new.flow.clientError"),
          dueDateError: t(dict, "orders.new.flow.dueDateError"),
          descriptionError: t(dict, "orders.new.flow.descriptionError"),
          priceError: t(dict, "orders.new.flow.priceError"),
          depositError: t(dict, "orders.new.flow.depositError"),
          paymentMethodError: t(dict, "orders.new.flow.paymentMethodError"),
          errors: {
            chooseClient: t(dict, "orders.new.errors.chooseClient"),
            privacyConsent: t(dict, "orders.new.errors.privacyConsent"),
            dueDate: t(dict, "orders.new.errors.dueDate"),
            garmentMissing: t(dict, "orders.new.errors.garmentMissing"),
            garmentDescription: t(dict, "orders.new.errors.garmentDescription"),
            garmentPrice: t(dict, "orders.new.errors.garmentPrice"),
            deposit: t(dict, "orders.new.flow.depositError"),
            paymentMethod: t(dict, "orders.new.flow.paymentMethodError"),
            invalidPhone: t(dict, "orders.new.errors.invalidPhone"),
            clientName: t(dict, "orders.new.errors.clientName"),
            partialGarments: t(dict, "orders.new.errors.partialGarments"),
            partialGarmentsUnknown: t(dict, "orders.new.errors.partialGarmentsUnknown"),
            partialPayment: t(dict, "orders.new.errors.partialPayment"),
            partialPaymentUnknown: t(dict, "orders.new.errors.partialPaymentUnknown"),
            paymentConflict: t(dict, "orders.new.errors.paymentConflict"),
            staleSubmission: t(dict, "orders.new.errors.staleSubmission"),
            createFailed: t(dict, "orders.new.errors.createFailed"),
          },
        },
        clientPicker: {
          title: t(dict, "clients.singular"),
          existingClient: t(dict, "orders.new.existingClient"),
          newClient: t(dict, "orders.new.newClient"),
          searchClient: t(dict, "clients.search.label"),
          searchPlaceholder: t(dict, "clients.search.placeholder"),
          selected: t(dict, "common.selected"),
          changeClient: t(dict, "orders.new.changeClient"),
          searching: t(dict, "common.searching"),
          noClients: t(dict, "clients.empty"),
          searchError: t(dict, "clients.search.error"),
          retrySearch: t(dict, "common.retry"),
          existingPhoneFound: t(dict, "orders.new.existingPhoneFound"),
          useExistingClient: t(dict, "orders.new.useExistingClient"),
          name: t(dict, "clients.fields.name"),
          namePlaceholder: t(dict, "clients.fields.namePlaceholder"),
          phone: t(dict, "clients.fields.phone"),
          phonePlaceholder: t(dict, "clients.fields.phonePlaceholder"),
          gdpr: t(dict, "clients.gdprConsent"),
        },
      }}
    />
  );
}
