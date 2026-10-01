import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  cursor: 0,
  slots: [] as unknown[],
}));

vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useActionState: (_action: unknown, initialState: unknown) => [initialState, vi.fn(), false],
  useContext: () => null,
  useEffect: () => undefined,
  useRef: (initial: unknown) => ({ current: initial }),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.slots)) {
      hooks.slots[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
    }
    return [hooks.slots[index], (value: unknown) => {
      hooks.slots[index] = typeof value === "function"
        ? (value as (current: unknown) => unknown)(hooks.slots[index])
        : value;
    }];
  },
}));
vi.mock("react-dom", () => ({ useFormStatus: () => ({ pending: false }) }));
vi.mock("@/app/sync/useMutationSync", () => ({
  useMutationSync: () => ({ phase: "ready" }),
}));

import { EditGarmentForm, type EditGarmentTexts } from "@/app/orders/[orderNumber]/EditGarmentForm";

const texts: EditGarmentTexts = {
  edit: "Edit garment",
  description: "Description",
  descriptionPlaceholder: "Blue dress",
  alterationType: "Alteration type",
  alterationLabels: { hem: "Hem", waist: "Waist", zipper: "Zipper", sleeves: "Sleeves", take_in: "Take in", other: "Other" },
  price: "Price",
  measurements: "Measurements",
  measurementsPlaceholder: "Optional measurements",
  save: "Save",
  saving: "Saving...",
  checkSaved: "Check saved",
  checkingSaved: "Checking...",
  unsaved: "Unsaved changes",
  errors: { notEditable: "Not editable", description: "Add a description", price: "Enter a valid price", saveFailed: "Save failed" },
};

type Element = React.ReactElement<Record<string, unknown>>;

function nodes(node: unknown): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(nodes)];
}

function render(): Element[] {
  hooks.cursor = 0;
  return nodes(EditGarmentForm({
    orderNumber: "260910-0020",
    garment: {
      id: "garment-1",
      dateUpdated: "2026-09-10T10:00:00.000Z",
      description: "Dress",
      alterationType: "hem",
      measurements: "4 cm",
      price: "20.00",
    },
    texts,
  }));
}

describe("EditGarmentForm interactions", () => {
  beforeEach(() => {
    hooks.slots = [];
  });

  it("shows the unsaved warning when only the alteration type changes", () => {
    const select = render().find((node) => node.type === "select" && node.props.name === "alteration_type");

    expect(select).toBeDefined();
    (select!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "waist" } });

    const warning = render().find((node) => node.type === "p" && node.props.role === "status");
    expect(warning?.props.children).toBe("Unsaved changes");
  });
});
