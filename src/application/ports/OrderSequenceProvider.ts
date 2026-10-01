export interface OrderSequenceProvider {
  next(): Promise<number>;
}