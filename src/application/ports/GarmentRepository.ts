import type { Garment } from "@/domain/entities/Garment";
import type { AlterationType } from "@/domain/values/AlterationType";
import type { Money } from "@/domain/values/Money";
import type { IdempotencyKey } from "@/domain/values/IdempotencyKey";

export type NewGarment = {
  idempotencyKey: IdempotencyKey;
  orderId: string;
  description: string;
  alterationType: AlterationType;
  measurements?: string;
  price: Money;
  photoId?: string;
};

export type UpdateGarment = {
  garmentId: string;
  expectedDateUpdated: Date;
  description: string;
  alterationType: AlterationType;
  measurements?: string;
  price: Money;
};

export interface GarmentRepository {
  getByIdempotencyKey(idempotencyKey: IdempotencyKey): Promise<Garment | null>;
  create(garment: NewGarment): Promise<Garment>;
  update(input: UpdateGarment): Promise<Garment>;
  delete(garmentId: string, expectedDateUpdated: Date): Promise<void>;
}
