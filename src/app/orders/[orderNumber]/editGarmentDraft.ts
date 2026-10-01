export type EditGarmentDraft = {
  description: string;
  alterationType: string;
  measurements: string;
  price: string;
};

export function makeEditGarmentDraft(garment: EditGarmentDraft): EditGarmentDraft {
  return { ...garment };
}

export function updateEditGarmentDraft<Field extends keyof EditGarmentDraft>(draft: EditGarmentDraft, field: Field, value: EditGarmentDraft[Field]): EditGarmentDraft {
  return { ...draft, [field]: value };
}

export function isEditGarmentDraftDirty(draft: EditGarmentDraft, saved: EditGarmentDraft): boolean {
  return draft.description.trim() !== saved.description.trim()
    || draft.alterationType !== saved.alterationType
    || draft.measurements.trim() !== saved.measurements.trim()
    || draft.price !== saved.price;
}
