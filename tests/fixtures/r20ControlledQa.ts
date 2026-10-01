import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import type { GarmentRepository, NewGarment, UpdateGarment } from "@/application/ports/GarmentRepository";
import type { OrderRepository, NewOrder, UpdateOrderDetails, UpdateOrderStatus } from "@/application/ports/OrderRepository";
import type { OrderSequenceProvider } from "@/application/ports/OrderSequenceProvider";
import type { NewPayment, PaymentRepository } from "@/application/ports/PaymentRepository";
import type { PhotoStorage, PhotoUpload } from "@/application/ports/PhotoStorage";
import type { OrderPoint, PaymentPoint, StatsProvider } from "@/application/ports/StatsProvider";
import { AddOrderGarments, type OrderGarmentInput } from "@/application/useCases/AddOrderGarments";
import { CreateOrder } from "@/application/useCases/CreateOrder";
import { GetIncomeStats, type IncomeStats } from "@/application/useCases/GetIncomeStats";
import { RecordPayment } from "@/application/useCases/RecordPayment";
import { preserveGarmentPhotos } from "@/app/orders/new/newOrderSubmission";
import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import type { Payment } from "@/domain/entities/Payment";
import { assertPaymentAllowed } from "@/domain/orders/orderRules";
import type { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { Money } from "@/domain/values/Money";
import { OrderStatus, type OrderStatusValue } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

const RECEIVED_AT = new Date("2026-09-21T10:00:00.000Z");
const DUE_AT = new Date("2026-09-28T10:00:00.000Z");
const ORDER_KEY = "550e8400-e29b-41d4-a716-446655440001";
const GARMENT_KEYS = [
  "550e8400-e29b-41d4-a716-446655440002",
  "550e8400-e29b-41d4-a716-446655440003",
] as const;
const PAYMENT_KEY = "550e8400-e29b-41d4-a716-446655440004";

export class ControlledOrderConfirmationScenario {
  private readonly orders = new InMemoryOrderRepository();
  private readonly garments = new InMemoryGarmentRepository();
  private readonly payments = new InMemoryPaymentRepository();
  private readonly sequence = new IncrementingOrderSequence();
  private readonly photos = new ControlledPhotoStorage();

  async confirm(): Promise<Order> {
    const order = await new CreateOrder(this.orders, this.sequence).execute({
      idempotencyKey: ORDER_KEY,
      clientId: "client-qa",
      receivedDate: RECEIVED_AT,
      dueDate: DUE_AT,
    });

    await new AddOrderGarments(this.garments, this.photos).execute({
      orderId: order.id,
      garments: [
        garmentInput(GARMENT_KEYS[0], "Blue dress", 25),
        garmentInput(GARMENT_KEYS[1], "Grey trousers", 30),
      ],
    });
    await new RecordPayment(this.payments).execute({
      orderId: order.id,
      idempotencyKey: PAYMENT_KEY,
      type: "deposit",
      amountEuros: 20,
      method: "cash",
    });

    return order;
  }

  snapshot(): { orders: number; garments: number; payments: number } {
    return {
      orders: this.orders.size,
      garments: this.garments.size,
      payments: this.payments.size,
    };
  }
}

export class ControlledGarmentRepairScenario {
  private readonly garments: InMemoryGarmentRepository;
  private readonly photos: ControlledPhotoStorage;
  private readonly inputs: readonly OrderGarmentInput[];

  constructor(failureStage: "photo" | "garment") {
    this.garments = new InMemoryGarmentRepository(
      failureStage === "garment" ? "550e8400-e29b-41d4-a716-446655440006" : undefined,
    );
    this.photos = new ControlledPhotoStorage(failureStage === "photo" ? "grey.jpg" : undefined);
    this.inputs = [
      garmentInput("550e8400-e29b-41d4-a716-446655440005", "Blue dress", 25),
      garmentInput("550e8400-e29b-41d4-a716-446655440006", "Grey trousers", 30, "grey.jpg"),
      garmentInput("550e8400-e29b-41d4-a716-446655440007", "Wool coat", 40),
    ];
  }

  saveAll(): Promise<Garment[]> {
    return this.save(this.inputs);
  }

  retryFailedOnly(): Promise<Garment[]> {
    return this.save([this.inputs[1]!]);
  }

  savedDescriptions(): string[] {
    return this.garments.values.map((garment) => garment.description).sort();
  }

  createCounts(): Record<string, number> {
    return Object.fromEntries(
      ["Blue dress", "Grey trousers", "Wool coat"].map((description) => [
        description,
        this.garments.createAttempts.get(description) ?? 0,
      ]),
    );
  }

  private save(garments: readonly OrderGarmentInput[]): Promise<Garment[]> {
    return new AddOrderGarments(this.garments, this.photos).execute({ orderId: "order-qa", garments });
  }
}

export class ControlledPhotoRetryScenario {
  private readonly sessionToken = "qa-session-token";
  private readonly cachedPhoto = new File(
    [new Uint8Array([4, 8, 15, 16, 23, 42])],
    "dress.jpg",
    { type: "image/jpeg" },
  );
  private readonly formData = new FormData();
  private readonly photos = new ControlledPhotoStorage("dress.jpg");

  constructor() {
    this.formData.set("client_id", "client-qa");
    this.formData.set("garment_description", "Blue dress");
    this.formData.set("garment_price", "45.50");
    this.formData.set("due_date", "2026-09-28");
    this.formData.set("deposit", "15.50");
    this.formData.set("garment_idempotency_key", "550e8400-e29b-41d4-a716-446655440011");
    this.formData.set("garment_photo", new File([], ""));
  }

  get uploadAttempts(): number {
    return this.photos.uploadAttempts;
  }

  async submit(): Promise<string> {
    this.authenticate(this.sessionToken);
    preserveGarmentPhotos(this.formData, [this.cachedPhoto]);
    const photo = this.formData.get("garment_photo");
    if (!(photo instanceof File)) throw new Error("Controlled photo is missing");

    return this.photos.upload({
      bytes: new Uint8Array(await photo.arrayBuffer()),
      filename: photo.name,
      contentType: photo.type,
    });
  }

  async snapshot(): Promise<{
    sessionToken: string;
    clientId: string;
    description: string;
    idempotencyKey: string;
    price: string;
    dueDate: string;
    deposit: string;
    filename: string;
    bytes: number[];
  }> {
    const photo = this.formData.get("garment_photo");
    if (!(photo instanceof File)) throw new Error("Controlled photo is missing");

    return {
      sessionToken: this.sessionToken,
      clientId: String(this.formData.get("client_id")),
      description: String(this.formData.get("garment_description")),
      idempotencyKey: String(this.formData.get("garment_idempotency_key")),
      price: String(this.formData.get("garment_price")),
      dueDate: String(this.formData.get("due_date")),
      deposit: String(this.formData.get("deposit")),
      filename: photo.name,
      bytes: [...new Uint8Array(await photo.arrayBuffer())],
    };
  }

  private authenticate(token: string): void {
    if (token !== this.sessionToken) throw new Error("Controlled session expired");
  }
}

export class ControlledPaymentScenario {
  private readonly payments = new InMemoryPaymentRepository();
  private readonly order: Order;

  constructor(status: OrderStatusValue) {
    this.order = makeOrder({ status: orderStatus(status) });
  }

  get createdPayments(): number {
    return this.payments.size;
  }

  async record(amountEuros: number): Promise<Payment> {
    const amount = Money.fromEuros(amountEuros);
    assertPaymentAllowed(this.order, amount);

    return new RecordPayment(this.payments).execute({
      orderId: this.order.id,
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440012",
      type: "final",
      amountEuros,
      method: "card",
    });
  }
}

export class KnownPaymentsStatsScenario {
  async read(): Promise<IncomeStats> {
    const provider = new FixedStatsProvider([
      paymentPoint(10.1, "2026-09-21T08:00:00.000Z"),
      paymentPoint(20.2, "2026-09-21T22:30:00.000Z"),
      paymentPoint(30.3, "2026-09-21T23:30:00.000Z"),
      paymentPoint(5.26, "2026-09-22T12:00:00.000Z"),
    ]);

    return new GetIncomeStats(provider).execute({
      from: new Date("2026-09-20T23:00:00.000Z"),
      to: new Date("2026-09-22T23:00:00.000Z"),
      bucket: "day",
    });
  }
}

class InMemoryOrderRepository implements OrderRepository {
  private readonly byKey = new Map<string, Order>();

  get size(): number {
    return this.byKey.size;
  }

  async getByIdempotencyKey(idempotencyKey: IdempotencyKey): Promise<Order | null> {
    return this.byKey.get(idempotencyKey.value) ?? null;
  }

  async getByOrderNumber(orderNumber: string): Promise<Order | null> {
    return [...this.byKey.values()].find((order) => order.orderNumber.value === orderNumber) ?? null;
  }

  async create(input: NewOrder): Promise<Order> {
    if (this.byKey.has(input.idempotencyKey.value)) throw new Error("Controlled unique order conflict");
    const order = makeOrder({
      id: `order-${this.byKey.size + 1}`,
      orderNumber: input.orderNumber,
      status: input.status,
      receivedDate: input.receivedDate,
      dateUpdated: input.receivedDate,
      dueDate: input.dueDate,
      notes: input.notes,
      client: {
        id: input.clientId,
        name: "QA Client",
        phone: PhoneNumber.fromRaw("353871234567"),
        gdprConsent: true,
      },
    });
    this.byKey.set(input.idempotencyKey.value, order);
    return order;
  }

  async updateDetails(_input: UpdateOrderDetails): Promise<Order> {
    void _input;
    throw new Error("Not used by controlled QA");
  }

  async updateStatus(_input: UpdateOrderStatus): Promise<Order> {
    void _input;
    throw new Error("Not used by controlled QA");
  }
}

class InMemoryGarmentRepository implements GarmentRepository {
  private readonly byKey = new Map<string, Garment>();
  readonly createAttempts = new Map<string, number>();
  private failed = false;

  constructor(private readonly failOnceKey?: string) {}

  get size(): number {
    return this.byKey.size;
  }

  get values(): Garment[] {
    return [...this.byKey.values()];
  }

  async getByIdempotencyKey(idempotencyKey: IdempotencyKey): Promise<Garment | null> {
    return this.byKey.get(idempotencyKey.value) ?? null;
  }

  async create(input: NewGarment): Promise<Garment> {
    this.createAttempts.set(input.description, (this.createAttempts.get(input.description) ?? 0) + 1);
    if (input.idempotencyKey.value === this.failOnceKey && !this.failed) {
      this.failed = true;
      throw new MutationConfirmedNotSavedError({ cause: new Error("Controlled garment failure") });
    }
    if (this.byKey.has(input.idempotencyKey.value)) throw new Error("Controlled unique garment conflict");
    const garment: Garment = {
      id: `garment-${this.byKey.size + 1}`,
      orderId: input.orderId,
      description: input.description,
      alterationType: input.alterationType,
      measurements: input.measurements,
      price: input.price,
      photoId: input.photoId,
      dateUpdated: RECEIVED_AT,
    };
    this.byKey.set(input.idempotencyKey.value, garment);
    return garment;
  }

  async update(_input: UpdateGarment): Promise<Garment> {
    void _input;
    throw new Error("Not used by controlled QA");
  }

  async delete(_garmentId: string, _expectedDateUpdated: Date): Promise<void> {
    void _garmentId;
    void _expectedDateUpdated;
    throw new Error("Not used by controlled QA");
  }
}

class InMemoryPaymentRepository implements PaymentRepository {
  private readonly byKey = new Map<string, Payment>();

  get size(): number {
    return this.byKey.size;
  }

  async getByIdempotencyKey(idempotencyKey: IdempotencyKey): Promise<Payment | null> {
    return this.byKey.get(idempotencyKey.value) ?? null;
  }

  async create(input: NewPayment): Promise<Payment> {
    if (this.byKey.has(input.idempotencyKey.value)) throw new Error("Controlled unique payment conflict");
    const payment: Payment = {
      id: `payment-${this.byKey.size + 1}`,
      orderId: input.orderId,
      type: input.type,
      amount: input.amount,
      method: input.method,
      createdAt: RECEIVED_AT,
    };
    this.byKey.set(input.idempotencyKey.value, payment);
    return payment;
  }

  async delete(_paymentId: string): Promise<void> {
    void _paymentId;
    throw new Error("Not used by controlled QA");
  }
}

class IncrementingOrderSequence implements OrderSequenceProvider {
  private current = 100;

  async next(): Promise<number> {
    this.current += 1;
    return this.current;
  }
}

class ControlledPhotoStorage implements PhotoStorage {
  uploadAttempts = 0;
  private failed = false;

  constructor(private readonly failOnceFilename?: string) {}

  async upload(photo: PhotoUpload): Promise<string> {
    this.uploadAttempts += 1;
    if (photo.filename === this.failOnceFilename && !this.failed) {
      this.failed = true;
      throw new Error("Controlled photo failure");
    }
    return `file-${photo.filename}`;
  }

  async delete(): Promise<void> {}

  async getSignedUrl(photoId: string): Promise<string> {
    return photoId;
  }

  async matches(): Promise<boolean> {
    return true;
  }
}

class FixedStatsProvider implements StatsProvider {
  constructor(private readonly payments: PaymentPoint[]) {}

  async paymentsBetween(from: Date, to: Date): Promise<PaymentPoint[]> {
    return this.payments.filter((payment) => payment.createdAt >= from && payment.createdAt < to);
  }

  async ordersBetween(_from: Date, _to: Date): Promise<OrderPoint[]> {
    void _from;
    void _to;
    return [];
  }

  async activeOrders(): Promise<OrderPoint[]> {
    return [];
  }

  async newClientsBetween(_from: Date, _to: Date): Promise<number> {
    void _from;
    void _to;
    return 0;
  }
}

function garmentInput(
  idempotencyKey: string,
  description: string,
  priceEuros: number,
  filename?: string,
): OrderGarmentInput {
  return {
    idempotencyKey,
    description,
    alterationType: "hem",
    priceEuros,
    photo: filename
      ? {
          load: async () => ({
            bytes: new Uint8Array([1, 2, 3]),
            filename,
            contentType: "image/jpeg",
          }),
        }
      : undefined,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-qa",
    orderNumber: { value: "260921-0100" } as Order["orderNumber"],
    client: {
      id: "client-qa",
      name: "QA Client",
      phone: PhoneNumber.fromRaw("353871234567"),
      gdprConsent: true,
    },
    status: OrderStatus.RECEIVED,
    receivedDate: RECEIVED_AT,
    dateUpdated: RECEIVED_AT,
    dueDate: DUE_AT,
    garments: [
      {
        id: "garment-payment-qa",
        orderId: "order-qa",
        description: "Blue dress",
        alterationType: "hem",
        price: Money.fromEuros(50),
        dateUpdated: RECEIVED_AT,
      },
    ],
    payments: [
      {
        id: "payment-existing-qa",
        orderId: "order-qa",
        type: "deposit",
        amount: Money.fromEuros(7.5),
        method: "cash",
        createdAt: RECEIVED_AT,
      },
    ],
    ...overrides,
  };
}

function orderStatus(status: OrderStatusValue): OrderStatus {
  return {
    received: OrderStatus.RECEIVED,
    ready: OrderStatus.READY,
    collected: OrderStatus.COLLECTED,
    cancelled: OrderStatus.CANCELLED,
  }[status];
}

function paymentPoint(euros: number, createdAt: string): PaymentPoint {
  return { amount: Money.fromEuros(euros), createdAt: new Date(createdAt), method: "cash" };
}
