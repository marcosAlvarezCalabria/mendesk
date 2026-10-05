"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useCallback, useContext, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { OrderSyncContext } from "@/app/sync/OrderSyncProvider";
import { useMutationSync } from "@/app/sync/useMutationSync";

import { ActionButton } from "@/app/_ui/ActionButton";
import { clearSessionIdempotencyKey, clearSessionIdempotencySlot, restoreSessionIdempotencyKey, storeSessionIdempotencyKey, useSessionIdempotencyKey } from "@/app/_ui/sessionIdempotency";
import { Field } from "@/app/_ui/Field";
import { PhotoPreview } from "@/app/_ui/PhotoPreview";
import { isMutationSubmissionBlocked } from "@/app/_ui/mutationSubmission";
import { formatPhoneForDisplay } from "@/app/_ui/phoneDisplay";
import { createOrderAction, type NewOrderErrorCode, type NewOrderFormState } from "@/app/orders/new/actions";
import { ClientPicker, type ClientPickerSelection, type ClientPickerTexts } from "@/app/orders/new/ClientPicker";
import { lookupExistingClientByPhone, type ExistingClientMatch } from "@/app/orders/new/newClientLookup";
import { NewOrderHeader } from "@/app/orders/new/NewOrderHeader";
import { idempotencyKeys } from "@/config/technicalKeys";
import {
  buildOrderReview,
  canSubmitOrder,
  isGarmentDraftComplete,
  nextOrderStep,
  previousOrderStep,
  validateClientStep,
  validateDeliveryAndDeposit,
  validateOrderDetails,
  type NewOrderStep,
  type OrderReview,
} from "@/app/orders/new/newOrderFlow";
import { garmentIdempotencySlotsToClear, isNewOrderReconciliationRetryBlocked, shouldFinalizeConfirmedOrder } from "@/app/orders/new/newOrderIdempotency";
import { ALTERATION_TYPE_OPTIONS } from "@/app/orders/new/newOrderForm";
import { preserveGarmentPhotos } from "@/app/orders/new/newOrderSubmission";
import {
  confirmNewOrderNavigation,
  guardNewOrderBeforeUnload,
  handleNewOrderPopNavigation,
  isNewOrderLeaveGuardActive,
} from "@/app/orders/new/newOrderUnsavedGuard";
import { PhoneNumber } from "@/domain/values/PhoneNumber";
import { toIntlLocale, type Locale } from "@/i18n/locale";

const initialState: NewOrderFormState = { status: "idle", error: null, errorCode: null };


export function newOrderSuccessDestination(): "/orders" {
  return "/orders";
}

export function revealNewOrderStep(form: HTMLFormElement | null, step: NewOrderStep): void {
  const heading = form?.querySelector<HTMLElement>(`[data-step-heading="${step}"]`);

  if (!heading) return;

  const reducedMotion = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  heading.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  heading.focus({ preventScroll: true });
}

type GarmentRow = {
  id: number;
  idempotencyKey: string;
};

type GarmentDraft = {
  description: string;
  alterationType: string;
  measurements: string;
  price: string;
  photoName: string;
  photo: File | null;
};

export type NewOrderFormTexts = {
  backToOrders: string;
  title: string;
  cancel: string;
  unsavedWarning: string;
  dueDate: string;
  deposit: string;
  paymentMethod: string;
  cash: string;
  card: string;
  outstanding: string;
  notes: string;
  notesPlaceholder: string;
  garments: string;
  addGarment: string;
  saveGarment: string;
  editGarment: string;
  garment: string;
  remove: string;
  description: string;
  descriptionPlaceholder: string;
  alterationType: string;
  alterationLabels: Record<string, string>;
  price: string;
  measurements: string;
  measurementsPlaceholder: string;
  photo: string;
  takePhoto: string;
  choosePhoto: string;
  viewPhoto: string;
  closePhoto: string;
  createOrder: string;
  creatingOrder: string;
  flow: {
    step: string;
    clientTitle: string;
    clientHelp: string;
    detailsTitle: string;
    detailsHelp: string;
    deliveryTitle: string;
    deliveryHelp: string;
    continueToDelivery: string;
    reviewTitle: string;
    reviewHelp: string;
    continueWithClient: string;
    reviewOrder: string;
    editDetails: string;
    back: string;
    afterSave: string;
    client: string;
    phone: string;
    total: string;
    reconcileOrder: string;
    noNotes: string;
    noMeasurements: string;
    noPhoto: string;
    openCreatedOrder: string;
    clientError: string;
    checkingClient: string;
    clientLookupError: string;
    dueDateError: string;
    descriptionError: string;
    priceError: string;
    depositError: string;
    paymentMethodError: string;
    errors: Record<NewOrderErrorCode, string>;
  };
  clientPicker: ClientPickerTexts;
};

const emptyClientSelection: ClientPickerSelection = {
  mode: "existing",
  clientId: "",
  name: "",
  phone: "",
  hasConsent: false,
  label: "",
};

export function NewOrderForm({
  cancelHref,
  initialGarmentIdempotencyKey,
  initialPaymentIdempotencyKey,
  locale,
  orderIdempotencyKey,
  texts,
}: {
  cancelHref: string;
  initialGarmentIdempotencyKey: string;
  initialPaymentIdempotencyKey: string;
  locale: Locale;
  orderIdempotencyKey: string;
  texts: NewOrderFormTexts;
}) {
  const session = useContext(OrderSyncContext);
  const [garments, setGarments] = useState<GarmentRow[]>([{ id: 1, idempotencyKey: initialGarmentIdempotencyKey }]);
  const [state, formAction, isPending] = useActionState(async (prev: NewOrderFormState, data: FormData) => {
    const result = await createOrderAction(prev, data);
    if (result.replacementIdempotencyKeys) {
      const replacements = result.replacementIdempotencyKeys.garments;
      setGarments((current) => current.map((garment, index) => {
        const replacement = replacements[index];
        if (!replacement) return garment;
        if (garment.id !== 1) {
          storeSessionIdempotencyKey(window.sessionStorage, idempotencyKeys.newOrderGarment(garment.id), replacement, garment.idempotencyKey);
        }
        return { ...garment, idempotencyKey: replacement };
      }));
    }

    if (result.sync) session?.consume(result.sync);
    return result;
  }, initialState);
  const sync = useMutationSync(state.sync);
  const router = useRouter();
  const [step, setStep] = useState<NewOrderStep>("client");
  const [clientSelection, setClientSelection] = useState<ClientPickerSelection>(emptyClientSelection);
  const [garmentDrafts, setGarmentDrafts] = useState<Record<number, GarmentDraft>>({ 1: emptyGarmentDraft() });
  const [completedGarmentIds, setCompletedGarmentIds] = useState<number[]>([]);
  const [activeGarmentId, setActiveGarmentId] = useState<number | null>(1);
  const [nextGarmentId, setNextGarmentId] = useState(2);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [existingClientMatch, setExistingClientMatch] = useState<ExistingClientMatch | null>(null);
  const [checkingClient, setCheckingClient] = useState(false);
  const [review, setReview] = useState<OrderReview | null>(null);
  const [depositValue, setDepositValue] = useState("");
  const orderFinalizedRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const clientSelectionRef = useRef(clientSelection);
  const [dirty, setDirty] = useState(false);
  const garmentsRef = useRef<HTMLElement>(null);
  const deliveryRef = useRef<HTMLElement>(null);
  const replacementKeys = state.replacementIdempotencyKeys;
  const { idempotencyKey: persistedOrderKey, ready: orderKeyReady } = useSessionIdempotencyKey(idempotencyKeys.newOrder, orderIdempotencyKey, replacementKeys?.order);
  const { idempotencyKey: persistedFirstGarmentKey, ready: garmentKeyReady } = useSessionIdempotencyKey(
    idempotencyKeys.newOrderGarment(1),
    initialGarmentIdempotencyKey,
    replacementKeys?.garments[0],
  );
  const { idempotencyKey: persistedPaymentKey, ready: paymentKeyReady } = useSessionIdempotencyKey(
    idempotencyKeys.newOrderPayment,
    initialPaymentIdempotencyKey,
    replacementKeys?.payment,
  );
  const reconciliationConflict = state.status === "error" && isNewOrderReconciliationRetryBlocked(state.reconciliationOutcome);
  const submissionBlocked = !orderKeyReady || !garmentKeyReady || !paymentKeyReady || reconciliationConflict || isMutationSubmissionBlocked(isPending, state.status === "error" ? state.mutationResult : undefined);

  useEffect(() => {
    if (!shouldFinalizeConfirmedOrder(state) || orderFinalizedRef.current) {
      return;
    }

    clearSessionIdempotencyKey(window.sessionStorage, idempotencyKeys.newOrder, persistedOrderKey);
    clearSessionIdempotencyKey(window.sessionStorage, idempotencyKeys.newOrderPayment, persistedPaymentKey);
    for (const garmentId of garmentIdempotencySlotsToClear(nextGarmentId, garments.map((garment) => garment.id), state)) {
      clearSessionIdempotencySlot(window.sessionStorage, idempotencyKeys.newOrderGarment(garmentId));
    }
    if (state.status === "success") {
      orderFinalizedRef.current = true;
      router.replace(newOrderSuccessDestination());
    }
  }, [garments, nextGarmentId, persistedOrderKey, persistedPaymentKey, router, state, sync.phase]);

  const handleClientSelection = useCallback((selection: ClientPickerSelection) => {
    clientSelectionRef.current = selection;
    setClientSelection(selection);
    setFlowError(null);

    if (selection.mode !== "new" || existingClientMatch?.phone !== normalizedPhone(selection.phone)) {
      setExistingClientMatch(null);
    }

    if (!isEmptyClientSelection(selection)) {
      setDirty(true);
    }

    if (phoneError && (selection.mode !== "new" || hasValidPhone(selection.phone))) {
      setPhoneError(null);
    }
  }, [existingClientMatch?.phone, phoneError]);

  useEffect(() => {
    revealNewOrderStep(formRef.current, step);
  }, [step]);

  useEffect(() => {
    if (state.status !== "error" || state.errorCode !== "invalidPhone") {
      return;
    }

    let focusFrame: number | undefined;
    const stateFrame = window.requestAnimationFrame(() => {
      setStep("client");
      setFlowError(null);
      setPhoneError(texts.flow.errors.invalidPhone);
      focusFrame = window.requestAnimationFrame(() => focusField(formRef.current, '[name="phone"]'));
    });

    return () => {
      window.cancelAnimationFrame(stateFrame);

      if (focusFrame !== undefined) {
        window.cancelAnimationFrame(focusFrame);
      }
    };
  }, [state.errorCode, state.status, texts.flow.errors.invalidPhone]);


  useEffect(() => {
    const guardState = { dirty, saved: Boolean(state.orderNumber), submitting: isPending };

    if (!isNewOrderLeaveGuardActive(guardState)) {
      return;
    }

    const guardedHref = window.location.href;
    const guardedHistoryState = window.history.state;
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      guardNewOrderBeforeUnload(event, guardState);
    }

    function confirmInternalNavigation(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;

      if (!anchor || anchor.download || (anchor.target && anchor.target !== "_self")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);

      if (destination.origin !== window.location.origin || destination.href === window.location.href) {
        return;
      }

      if (!confirmNewOrderNavigation(guardState, () => window.confirm(texts.unsavedWarning))) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function confirmBrowserNavigation() {
      const canLeave = handleNewOrderPopNavigation(
        guardState,
        () => window.confirm(texts.unsavedWarning),
        () => window.history.pushState(guardedHistoryState, "", guardedHref),
      );

      if (canLeave) {
        setDirty(false);
      }
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    window.addEventListener("popstate", confirmBrowserNavigation);
    document.addEventListener("click", confirmInternalNavigation, true);

    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      window.removeEventListener("popstate", confirmBrowserNavigation);
      document.removeEventListener("click", confirmInternalNavigation, true);
    };
  }, [dirty, isPending, state.orderNumber, texts.unsavedWarning]);

  function revealGarmentsStepAfterUpdate() {
    window.requestAnimationFrame(() => revealNewOrderStep(formRef.current, "garments"));
  }

  function editGarment(id: number) {
    setActiveGarmentId(id);
    revealGarmentsStepAfterUpdate();
  }

  function addGarment() {
    if (activeGarmentId !== null) {
      return;
    }
    setDirty(true);
    const idempotencyKey = restoreSessionIdempotencyKey(
      window.sessionStorage,
      idempotencyKeys.newOrderGarment(nextGarmentId),
      crypto.randomUUID(),
    );
    setGarments((current) => [...current, { id: nextGarmentId, idempotencyKey }]);
    setGarmentDrafts((current) => ({ ...current, [nextGarmentId]: emptyGarmentDraft() }));
    setActiveGarmentId(nextGarmentId);
    setNextGarmentId((current) => current + 1);
    revealGarmentsStepAfterUpdate();
  }

  function removeGarment(id: number) {
    if (garments.length === 1) return;
    setDirty(true);
    setGarments((current) => current.filter((garment) => garment.id !== id));
    setCompletedGarmentIds((current) => current.filter((garmentId) => garmentId !== id));
    setGarmentDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (activeGarmentId === id) setActiveGarmentId(null);
  }

  function updateGarmentDraft(id: number, patch: Partial<GarmentDraft>) {
    setGarmentDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? emptyGarmentDraft()), ...patch },
    }));
  }

  function saveActiveGarment() {
    if (activeGarmentId === null) return;
    const draft = garmentDrafts[activeGarmentId];
    if (!draft || !isGarmentDraftComplete(draft)) return;
    setCompletedGarmentIds((current) => current.includes(activeGarmentId) ? current : [...current, activeGarmentId]);
    setActiveGarmentId(null);
    setFlowError(null);
    setDirty(true);
    revealGarmentsStepAfterUpdate();
  }

  async function continueFromClient() {
    const clientError = validateClientStep(clientSelection);

    if (clientError) {
      const errorCodes: Record<typeof clientError, NewOrderErrorCode> = {
        client: "chooseClient",
        name: "clientName",
        phone: "invalidPhone",
        consent: "privacyConsent",
      };
      const selectors: Record<typeof clientError, string> = {
        client: '[name="client_search"]',
        name: '[name="name"]',
        phone: '[name="phone"]',
        consent: '[name="gdpr"]',
      };

      const message = texts.flow.errors[errorCodes[clientError]] || texts.flow.clientError;

      if (clientError === "phone") {
        setFlowError(null);
        setPhoneError(message);
        focusField(formRef.current, selectors.phone);
      } else {
        setPhoneError(null);
        setFlowError(message);
        reportInvalid(formRef.current, selectors[clientError]);
      }

      return;
    }

    if (clientSelection.mode === "new") {
      const requestedPhone = normalizedPhone(clientSelection.phone);
      setCheckingClient(true);
      const lookup = await lookupExistingClientByPhone(clientSelection.phone);
      setCheckingClient(false);

      const currentSelection = clientSelectionRef.current;
      if (currentSelection.mode !== "new" || normalizedPhone(currentSelection.phone) !== requestedPhone) {
        return;
      }

      if (lookup.status === "error") {
        setExistingClientMatch(null);
        setFlowError(texts.flow.clientLookupError);
        focusField(formRef.current, '[name="phone"]');
        return;
      }

      if (lookup.status === "match") {
        setExistingClientMatch(lookup.client);
        setFlowError(null);
        window.requestAnimationFrame(() => focusField(formRef.current, '[data-use-existing-client="true"]'));
        return;
      }
    }

    setFlowError(null);
    setPhoneError(null);
    setStep(nextOrderStep(step));
  }

  function continueFromGarments() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const descriptions = stringEntries(formData.getAll("garment_description"));
    const alterationTypes = stringEntries(formData.getAll("garment_type"));
    const prices = stringEntries(formData.getAll("garment_price"));
    const validationError = validateOrderDetails({
      garments: descriptions.map((description, index) => ({
        description,
        alterationType: alterationTypes[index],
        price: prices[index] ?? "",
      })),
    });

    if (validationError) {
      const messages = {
        garment: texts.flow.errors.garmentMissing,
        description: texts.flow.descriptionError,
        price: texts.flow.priceError,
      };
      const selectors = {
        garment: "[data-add-garment]",
        description: '[name="garment_description"]:invalid',
        price: '[name="garment_price"]:invalid',
      };

      setFlowError(messages[validationError]);
      reportInvalid(garmentsRef.current, selectors[validationError]);
      return;
    }

    setFlowError(null);
    setStep(nextOrderStep(step));
  }

  function continueToReview() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const dueDate = stringEntry(formData.get("due_date"));
    const deposit = stringEntry(formData.get("deposit"));
    const paymentMethod = stringEntry(formData.get("payment_method"));
    const total = stringEntries(formData.getAll("garment_price"))
      .reduce((sum, value) => sum + (Number(value) || 0), 0);
    const validationError = validateDeliveryAndDeposit({ dueDate, deposit, method: paymentMethod, total });

    if (validationError) {
      const messages = {
        dueDate: texts.flow.dueDateError,
        deposit: texts.flow.depositError,
        method: texts.flow.paymentMethodError,
      };
      const selectors = {
        dueDate: '[name="due_date"]',
        deposit: '[name="deposit"]',
        method: '[name="payment_method"]',
      };

      setFlowError(messages[validationError]);
      reportInvalid(deliveryRef.current, selectors[validationError]);
      return;
    }

    const descriptions = stringEntries(formData.getAll("garment_description"));
    const alterationTypes = stringEntries(formData.getAll("garment_type"));
    const prices = stringEntries(formData.getAll("garment_price"));
    const measurements = stringEntries(formData.getAll("garment_measurements"));
    setReview(buildOrderReview({
      clientLabel: clientSelection.label,
      clientPhone: clientSelection.phone,
      dueDate,
      notes: stringEntry(formData.get("notes")),
      deposit,
      paymentMethod,
      garments: descriptions.map((description, index) => ({
        description,
        alterationType: alterationTypes[index] ?? "other",
        price: prices[index] ?? "0",
        measurements: measurements[index] ?? "",
        photoName: garmentDrafts[garments[index]?.id ?? -1]?.photoName ?? "",
      })),
    }, texts.alterationLabels));
    setFlowError(null);
    setStep(nextOrderStep(step));
  }

  function goBack() {
    setFlowError(null);
    setStep(previousOrderStep(step));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const isSafeReconciliation = submitter?.dataset.safeReconciliation === "true";
    if ((submissionBlocked && !isSafeReconciliation) || (!isSafeReconciliation && !canSubmitOrder(step, Boolean(review), Boolean(state.orderNumber)))) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (submitter?.name) {
      formData.set(submitter.name, submitter.value);
    }
    preserveGarmentPhotos(formData, garments.map((garment) => garmentDrafts[garment.id]?.photo));
    startTransition(() => formAction(formData));
  }

  const actionMessage = state.errorCode === "invalidPhone" ? null : localizeActionError(state, texts);
  const formBottomPadding = step === "review"
    ? "pb-[calc(8.5rem+var(--mobile-navigation-safe-area))] sm:pb-[calc(10rem+var(--mobile-navigation-safe-area))]"
    : "pb-[calc(6rem+var(--mobile-navigation-safe-area))] sm:pb-[calc(7rem+var(--mobile-navigation-safe-area))]";

  return (
    <main className="new-order-flow min-h-screen bg-background text-on-surface">
      <NewOrderHeader
        backLabel={step === "client" ? texts.backToOrders : texts.flow.back}
        cancelHref={cancelHref}
        cancelLabel={texts.cancel}
        current={step}
        onBack={goBack}
        stepLabel={texts.flow.step}
        title={texts.title}
      />

      <form action={formAction} className={`mx-auto flex min-h-[calc(100vh-53px)] min-w-0 w-full max-w-[640px] flex-col px-margin-mobile ${formBottomPadding}`} noValidate onChange={() => setDirty(true)} onSubmit={handleSubmit} ref={formRef}>
        <input name="order_idempotency_key" type="hidden" value={persistedOrderKey} />
        <input name="payment_idempotency_key" type="hidden" value={persistedPaymentKey} />
        {flowError || (state.status === "error" && actionMessage) ? <div className="mt-3" aria-live="assertive">
          {flowError ? <div className="rounded-xl bg-error-container px-4 py-3 text-body-md text-on-error-container" role="alert">{flowError}</div> : null}
          {state.status === "error" && actionMessage ? (
            <div className="rounded-xl bg-error-container px-4 py-3 text-body-md text-on-error-container" role="alert">
              <p>{actionMessage}</p>
              {state.orderNumber ? (
                <Link className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4" href={`/orders/${state.orderNumber}`}>
                  {texts.flow.openCreatedOrder}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div> : null}

        <section className="min-w-0" hidden={step !== "client"} aria-labelledby="client-step-title">
          <StepIntro id="client-step-title" step="client" title={texts.flow.clientTitle} help={texts.flow.clientHelp} />
          <ClientPicker texts={texts.clientPicker} onSelectionChange={handleClientSelection} phoneError={phoneError} existingClientMatch={existingClientMatch} />
        </section>

        <section className="min-w-0" hidden={step !== "garments"} aria-labelledby="garments-step-title" ref={garmentsRef}>
          <StepIntro id="garments-step-title" step="garments" title={texts.flow.detailsTitle} help={texts.flow.detailsHelp} />

          <div className="min-w-0 space-y-6 rounded-xl bg-surface-container-lowest p-4 sm:p-card-padding">
            <div>
              <h2 className="text-title-md text-on-surface">{texts.garments}</h2>

              {completedGarmentIds.some((id) => id !== activeGarmentId) ? (
                <ul className="mt-4 divide-y divide-outline-variant rounded-xl border border-outline-variant">
                  {completedGarmentIds.filter((id) => id !== activeGarmentId).map((id) => {
                    const draft = garmentDrafts[id] ?? emptyGarmentDraft();
                    return (
                      <li className="flex min-h-14 items-center gap-3 px-3 py-2" key={id}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-label-lg text-on-surface">{draft.description}</span>
                          <span className="block text-body-sm text-on-surface-variant">{texts.alterationLabels[draft.alterationType]} · {formatMoney(Number(draft.price), locale)}</span>
                        </span>
                        <button className="min-h-11 rounded-full px-3 text-label-md text-secondary underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-secondary" type="button" onClick={() => editGarment(id)}>{texts.editGarment}</button>
                        {garments.length > 1 ? <button className="min-h-11 rounded-full px-3 text-label-md text-error underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-error" type="button" onClick={() => removeGarment(id)}>{texts.remove}</button> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              <div className="mt-5 grid min-w-0 gap-6">
                {garments.map((garment, index) => (
                  <fieldset className="m-0 grid min-w-0 gap-4 border-0 p-0" hidden={activeGarmentId !== garment.id} key={garment.id}>
                    <input name="garment_idempotency_key" type="hidden" value={replacementKeys?.garments[index] ?? (garment.id === 1 ? persistedFirstGarmentKey : garment.idempotencyKey)} />
                    <legend className="sr-only">{texts.garment} {index + 1}</legend>
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-outline-variant pb-3">
                      <h3 className="text-label-lg text-on-surface">{texts.garment} {index + 1}</h3>
                      {garments.length > 1 ? (
                        <button className="min-h-11 max-w-full whitespace-normal rounded-full px-3 text-center text-label-md text-error transition hover:bg-error-container focus:outline-none focus:ring-2 focus:ring-error focus:ring-offset-2" type="button" onClick={() => removeGarment(garment.id)}>
                          {texts.remove}
                        </button>
                      ) : null}
                    </div>

                    <Field label={texts.description}>
                      <input className="form-input" name="garment_description" required type="text" placeholder={texts.descriptionPlaceholder} value={garmentDrafts[garment.id]?.description ?? ""} onChange={(event) => updateGarmentDraft(garment.id, { description: event.currentTarget.value })} />
                    </Field>

                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <Field label={texts.alterationType}>
                        <select className="form-input" name="garment_type" value={garmentDrafts[garment.id]?.alterationType ?? "other"} onChange={(event) => updateGarmentDraft(garment.id, { alterationType: event.currentTarget.value })}>
                          {ALTERATION_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{texts.alterationLabels[type]}</option>)}
                        </select>
                      </Field>
                      <Field label={texts.price}>
                        <input className="form-input" name="garment_price" required type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={garmentDrafts[garment.id]?.price ?? ""} onChange={(event) => updateGarmentDraft(garment.id, { price: event.currentTarget.value })} />
                      </Field>
                    </div>

                    <Field label={texts.measurements}>
                      <input className="form-input" name="garment_measurements" type="text" placeholder={texts.measurementsPlaceholder} value={garmentDrafts[garment.id]?.measurements ?? ""} onChange={(event) => updateGarmentDraft(garment.id, { measurements: event.currentTarget.value })} />
                    </Field>

                    <Field label={texts.photo}>
                      <GarmentPhotoPicker
                        choosePhotoLabel={texts.choosePhoto}
                        closePhotoLabel={texts.closePhoto}
                        emptyLabel={texts.flow.noPhoto}
                        garmentId={garment.id}
                        onPhotoChange={(photo) => updateGarmentDraft(garment.id, { photo, photoName: photo?.name ?? "" })}
                        photo={garmentDrafts[garment.id]?.photo ?? null}
                        photoAltLabel={texts.photo}
                        takePhotoLabel={texts.takePhoto}
                        viewPhotoLabel={texts.viewPhoto}
                      />
                    </Field>
                  </fieldset>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="min-w-0" hidden={step !== "delivery"} aria-labelledby="delivery-step-title" ref={deliveryRef}>
          <StepIntro id="delivery-step-title" step="delivery" title={texts.flow.deliveryTitle} help={texts.flow.deliveryHelp} />
          <div className="grid min-w-0 gap-5 rounded-xl bg-surface-container-lowest p-4 sm:p-card-padding">
            <Field label={texts.dueDate}>
              <input className="form-input" name="due_date" required type="date" />
            </Field>
            <Field label={texts.notes}>
              <textarea className="form-input min-h-24 resize-y py-3" name="notes" placeholder={texts.notesPlaceholder} />
            </Field>
            <Field label={texts.deposit}>
              <input className="form-input" inputMode="decimal" min="0" name="deposit" onChange={(event) => setDepositValue(event.currentTarget.value)} placeholder="0.00" step="0.01" type="number" value={depositValue} />
            </Field>
            {Number(depositValue) > 0 ? (
              <Field label={texts.paymentMethod}>
                <select className="form-input" defaultValue="" name="payment_method" required>
                  <option value="">—</option>
                  <option value="cash">{texts.cash}</option>
                  <option value="card">{texts.card}</option>
                </select>
              </Field>
            ) : null}
          </div>
        </section>

        <section className="min-w-0" hidden={step !== "review"} aria-labelledby="review-step-title">
          <StepIntro id="review-step-title" step="review" title={texts.flow.reviewTitle} help={texts.flow.reviewHelp} />
          {review ? (
            <>
              <input name="due_date" type="hidden" value={review.dueDate} />
              <input name="notes" type="hidden" value={review.notes} />
              <input name="payment_method" type="hidden" value={review.paymentMethod} />
              <OrderReviewSummary locale={locale} photos={garments.map((garment) => garmentDrafts[garment.id]?.photo ?? null)} review={review} texts={texts} />
            </>
          ) : null}
        </section>

        <div className="fixed inset-x-0 bottom-[calc(4.25rem+var(--mobile-navigation-safe-area))] z-20 border-t border-outline-variant bg-background/95 backdrop-blur md:bottom-0 md:pb-[env(safe-area-inset-bottom)]" data-new-order-actions="">
          <div className="mx-auto grid w-full max-w-[640px] gap-1.5 px-margin-mobile py-2 sm:gap-2 sm:py-3">
            {step === "client" ? <ActionButton size="compact" disabled={checkingClient} icon="arrow_forward" variant="primary" onClick={continueFromClient}>{checkingClient ? texts.flow.checkingClient : texts.flow.continueWithClient}</ActionButton> : null}
            {step === "garments" && activeGarmentId !== null && isGarmentDraftComplete(garmentDrafts[activeGarmentId] ?? emptyGarmentDraft()) ? (
              <ActionButton size="compact" icon="check" variant="primary" onClick={saveActiveGarment}>{texts.saveGarment}</ActionButton>
            ) : null}
            {step === "garments" && activeGarmentId === null ? (
              <>
                <ActionButton size="compact" data-add-garment icon="add" variant="secondary" onClick={addGarment}>{texts.addGarment}</ActionButton>
                <ActionButton size="compact" icon="arrow_forward" variant="primary" onClick={continueFromGarments}>{texts.flow.continueToDelivery}</ActionButton>
              </>
            ) : null}
            {step === "delivery" ? <ActionButton size="compact" icon="fact_check" variant="primary" onClick={continueToReview}>{texts.flow.reviewOrder}</ActionButton> : null}
            {step === "review" ? (
              <>
                <ActionButton size="compact" aria-live="polite" disabled={submissionBlocked || Boolean(state.orderNumber)} icon="check_circle" type="submit" variant="primary">{isPending ? texts.creatingOrder : texts.createOrder}</ActionButton>
                {state.status === "error" && state.mutationResult === "outcome-unknown" ? (
                <ActionButton size="compact" data-safe-reconciliation="true" disabled={isPending || !orderKeyReady || !garmentKeyReady || !paymentKeyReady} icon="sync" name="intent" type="submit" value="reconcile" variant="secondary">{texts.flow.reconcileOrder}</ActionButton>
                ) : null}
                <button className="min-h-11 text-label-md text-secondary underline decoration-1 underline-offset-4 focus:outline-none focus:ring-2 focus:ring-secondary" type="button" onClick={() => setStep("garments")}>{texts.flow.editDetails}</button>
              </>
            ) : null}
          </div>
        </div>
      </form>
    </main>
  );
}

function StepIntro({ id, step, title, help }: { id: string; step: NewOrderStep; title: string; help: string }) {
  return (
    <div className="mb-3 mt-3">
      <h1 className="scroll-mt-16 text-title-lg text-on-surface outline-none" data-step-heading={step} id={id} tabIndex={-1}>{title}</h1>
      <p className="mt-1 max-w-[60ch] text-body-sm text-on-surface-variant">{help}</p>
    </div>
  );
}

type GarmentPhotoPickerProps = {
  choosePhotoLabel: string;
  closePhotoLabel: string;
  emptyLabel: string;
  garmentId: number;
  onPhotoChange: (photo: File | null) => void;
  photo: File | null;
  photoAltLabel: string;
  takePhotoLabel: string;
  viewPhotoLabel: string;
};

export function GarmentPhotoPicker({ choosePhotoLabel, closePhotoLabel, emptyLabel, garmentId, onPhotoChange, photo, photoAltLabel, takePhotoLabel, viewPhotoLabel }: GarmentPhotoPickerProps) {
  const statusId = `garment-photo-status-${garmentId}`;
  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    onPhotoChange(input.files?.[0] ?? null);
    input.value = "";
  };

  return (
    <div className="grid min-w-0 gap-2">
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <label className="flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-full bg-primary px-3 py-2 text-center text-label-md text-on-primary transition hover:bg-primary/90 focus-within:outline-none focus-within:ring-2 focus-within:ring-secondary focus-within:ring-offset-2">
          <input
            accept="image/*"
            aria-describedby={statusId}
            capture="environment"
            className="sr-only"
            data-photo-source="camera"
            type="file"
            onChange={handlePhotoChange}
          />
          <span className="min-w-0 break-words">{takePhotoLabel}</span>
        </label>
        <label className="flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-full border border-outline bg-surface-container-lowest px-3 py-2 text-center text-label-md text-on-surface transition hover:bg-surface-container focus-within:outline-none focus-within:ring-2 focus-within:ring-secondary focus-within:ring-offset-2">
          <input
            accept="image/*"
            aria-describedby={statusId}
            className="sr-only"
            data-photo-source="library"
            type="file"
            onChange={handlePhotoChange}
          />
          <span className="min-w-0 break-words">{choosePhotoLabel}</span>
        </label>
      </div>
      <div aria-live="polite" id={statusId}>
        {photo ? (
          <LocalPhotoPreview
            alt={photoAltLabel}
            closeLabel={closePhotoLabel}
            openLabel={viewPhotoLabel}
            photo={photo}
            showCaption
            sizes="(max-width: 640px) calc(100vw - 2rem), 608px"
            thumbnailClassName="h-28 w-full"
          />
        ) : <p className="text-body-sm text-on-surface-variant">{emptyLabel}</p>}
      </div>
    </div>
  );
}

function LocalPhotoPreview({ alt, closeLabel, openLabel, photo, showCaption = false, sizes, thumbnailClassName }: { alt: string; closeLabel: string; openLabel: string; photo: File; showCaption?: boolean; sizes: string; thumbnailClassName: string }) {
  const previewUrl = usePhotoObjectUrl(photo);

  if (!previewUrl) return null;

  return <PhotoPreview alt={alt} closeLabel={closeLabel} openLabel={openLabel} showCaption={showCaption} sizes={sizes} src={previewUrl} thumbnailClassName={thumbnailClassName} />;
}

function usePhotoObjectUrl(photo: File): string | null {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(photo);
    const frame = window.requestAnimationFrame(() => setPreview({ file: photo, url }));

    return () => {
      window.cancelAnimationFrame(frame);
      URL.revokeObjectURL(url);
    };
  }, [photo]);

  return preview?.file === photo ? preview.url : null;
}
function OrderReviewSummary({ locale, photos, review, texts }: { locale: Locale; photos: Array<File | null>; review: OrderReview; texts: NewOrderFormTexts }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-surface-container-lowest p-3 sm:p-4">
      <div className="flex min-w-0 items-start justify-between gap-3 border-b border-outline-variant pb-3">
        <div className="min-w-0">
          <p className="truncate text-label-lg text-on-surface">{review.clientLabel}</p>
          <p className="truncate text-body-sm text-on-surface-variant">{formatPhoneForDisplay(review.clientPhone)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-label-sm text-on-surface-variant">{texts.dueDate}</p>
          <p className="text-label-md text-on-surface">{formatDate(review.dueDate, locale)}</p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-container px-2 py-3 text-center">
        <div><dt className="text-label-sm text-on-surface-variant">{texts.flow.total}</dt><dd className="m-0 mt-1 text-label-lg tabular-nums text-on-surface">{formatMoney(review.total, locale)}</dd></div>
        <div><dt className="text-label-sm text-on-surface-variant">{texts.deposit}</dt><dd className="m-0 mt-1 text-label-lg tabular-nums text-on-surface">{formatMoney(review.deposit, locale)}</dd></div>
        <div><dt className="text-label-sm text-on-surface-variant">{texts.outstanding}</dt><dd className="m-0 mt-1 text-label-lg tabular-nums text-on-surface">{formatMoney(review.outstanding, locale)}</dd></div>
      </dl>
      {review.deposit > 0 ? <p className="mt-2 text-right text-body-sm text-on-surface-variant">{texts.paymentMethod}: <span className="font-semibold text-on-surface">{review.paymentMethod === "cash" ? texts.cash : texts.card}</span></p> : null}

      <div className="mt-3">
        <h2 className="text-label-md text-on-surface">{texts.garments} · {review.garmentCount}</h2>
        <ul className="mt-1 divide-y divide-outline-variant">
          {review.garments.map((garment, index) => (
            <li className="flex min-w-0 items-start gap-3 py-2" key={`${garment.description}-${index}`}>
              {photos[index] ? (
                <LocalPhotoPreview
                  alt={texts.photo}
                  closeLabel={texts.closePhoto}
                  openLabel={texts.viewPhoto}
                  photo={photos[index]}
                  sizes="56px"
                  thumbnailClassName="size-14"
                />
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-label-md text-on-surface">{garment.description} · {garment.alterationType}</p>
                <p className="truncate text-body-sm text-on-surface-variant">{garment.measurements || texts.flow.noMeasurements}</p>
              </div>
              <p className="ml-auto shrink-0 text-label-md tabular-nums text-on-surface">{formatMoney(garment.price, locale)}</p>
            </li>
          ))}
        </ul>
      </div>

      {review.notes ? <p className="mt-2 border-t border-outline-variant pt-2 text-body-sm text-on-surface-variant"><span className="font-semibold">{texts.notes}:</span> {review.notes}</p> : null}
    </div>
  );
}

function reportInvalid(container: HTMLElement | null, selector: string) {
  const input = container?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>(selector);
  input?.reportValidity();
  if (input instanceof HTMLInputElement && input.type === "date" && typeof input.showPicker === "function") {
    try {
      input.showPicker();
    } catch {
      // Some browsers require a direct user gesture; focus remains the fallback.
    }
  }
  input?.focus();
}

function focusField(container: HTMLElement | null, selector: string) {
  container?.querySelector<HTMLElement>(selector)?.focus();
}

function hasValidPhone(value: string): boolean {
  if (!value.trim()) {
    return false;
  }

  try {
    PhoneNumber.fromRaw(value);
    return true;
  } catch {
    return false;
  }
}

function normalizedPhone(phone: string): string | null {
  try {
    return PhoneNumber.fromRaw(phone).value;
  } catch {
    return null;
  }
}

function isEmptyClientSelection(selection: ClientPickerSelection): boolean {
  return selection.mode === emptyClientSelection.mode
    && selection.clientId === emptyClientSelection.clientId
    && selection.name === emptyClientSelection.name
    && selection.phone === emptyClientSelection.phone
    && selection.hasConsent === emptyClientSelection.hasConsent
    && selection.label === emptyClientSelection.label;
}

function stringEntry(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function stringEntries(values: FormDataEntryValue[]): string[] {
  return values.map((value) => (typeof value === "string" ? value : ""));
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(toIntlLocale(locale), { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatMoney(value: number, locale: Locale): string {
  return new Intl.NumberFormat(toIntlLocale(locale), { style: "currency", currency: "EUR" }).format(value);
}

function localizeActionError(state: NewOrderFormState, texts: NewOrderFormTexts): string | null {
  if (!state.errorCode) {
    return state.error;
  }

  const message = texts.flow.errors[state.errorCode];

  if (state.errorCode === "createFailed" && state.diagnostic) {
    return `${message} [Local diagnostic: ${state.diagnostic}]`;
  }

  if (state.errorCode !== "partialGarments" && state.errorCode !== "partialGarmentsUnknown") {
    return message;
  }

  return message
    .replace("{order}", state.orderNumber ?? "")
    .replace("{positions}", state.failedPositions?.join(", ") ?? "");
}

function emptyGarmentDraft(): GarmentDraft {
  return {
    description: "",
    alterationType: "other",
    measurements: "",
    price: "",
    photoName: "",
    photo: null,
  };
}
