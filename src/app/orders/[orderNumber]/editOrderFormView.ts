export type EditOrderFormView = {
  buttonLabel: "save" | "saved" | "saving";
  disabled: boolean;
  showUnsavedWarning: boolean;
  tone: "saved" | "saving" | "unsaved";
};

export function editOrderFormView({ dirty, pending }: { dirty: boolean; pending: boolean }): EditOrderFormView {
  if (pending) {
    return {
      buttonLabel: "saving",
      disabled: true,
      showUnsavedWarning: false,
      tone: "saving",
    };
  }

  if (dirty) {
    return {
      buttonLabel: "save",
      disabled: false,
      showUnsavedWarning: true,
      tone: "unsaved",
    };
  }

  return {
    buttonLabel: "saved",
    disabled: true,
    showUnsavedWarning: false,
    tone: "saved",
  };
}
