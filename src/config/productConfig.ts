export type ProductConfig = Readonly<{
  id: "mendesk";
  name: "Mendesk";
  attribution: Readonly<{
    internalLabel: string | null;
    makerName: string | null;
    showOnCustomerArtifacts: false;
  }>;
}>;

export const productConfig: ProductConfig = Object.freeze({
  id: "mendesk",
  name: "Mendesk",
  attribution: Object.freeze({
    internalLabel: null,
    makerName: null,
    showOnCustomerArtifacts: false,
  }),
});
