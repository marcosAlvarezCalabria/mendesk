import type { AlterationType } from "@/domain/values/AlterationType";
import type { Money } from "@/domain/values/Money";

export type Garment = {
  readonly id: string;
  readonly orderId?: string;
  readonly description: string;
  readonly dateUpdated: Date;
  readonly alterationType: AlterationType;
  readonly measurements?: string;
  readonly photoId?: string;
  readonly price: Money;
};