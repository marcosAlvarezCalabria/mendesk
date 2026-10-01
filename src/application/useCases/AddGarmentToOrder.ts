import type { GarmentRepository } from "@/application/ports/GarmentRepository";
import type { OrderRepository } from "@/application/ports/OrderRepository";
import type { PhotoStorage } from "@/application/ports/PhotoStorage";
import {
  AddOrderGarments,
  type OrderGarmentInput,
} from "@/application/useCases/AddOrderGarments";
import type { Garment } from "@/domain/entities/Garment";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { assertEditable } from "@/domain/orders/orderRules";

export type AddGarmentToOrderInput = OrderGarmentInput & {
  orderNumber: string;
};

export class AddGarmentToOrder {
  private readonly addOrderGarments: AddOrderGarments;

  constructor(
    private readonly orders: OrderRepository,
    garments: GarmentRepository,
    photos: PhotoStorage,
  ) {
    this.addOrderGarments = new AddOrderGarments(garments, photos);
  }

  async execute(input: AddGarmentToOrderInput): Promise<Garment> {
    const order = await this.orders.getByOrderNumber(input.orderNumber);

    if (!order) {
      throw new OrderNotFoundError();
    }

    assertEditable(order);

    const [garment] = await this.addOrderGarments.execute({
      orderId: order.id,
      garments: [
        {
          idempotencyKey: input.idempotencyKey,
          description: input.description,
          alterationType: input.alterationType,
          measurements: input.measurements,
          priceEuros: input.priceEuros,
          photo: input.photo,
        },
      ],
    });

    if (!garment) {
      throw new Error("Garment was not created");
    }

    return garment;
  }
}
