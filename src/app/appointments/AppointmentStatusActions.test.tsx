import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useActionState: (_action: unknown, initial: unknown) => [initial, vi.fn(), false],
}));
vi.mock("react-dom", async original => ({
  ...await original<typeof import("react-dom")>(),
  useFormStatus: () => ({ pending: false }),
}));
vi.mock("@/app/appointments/actions", () => ({ setAppointmentStatusAction: vi.fn() }));

import { AppointmentStatusActions, confirmAppointmentStatusChange } from "./AppointmentStatusActions";

const texts = {
  markCompleted: "Mark completed",
  markingCompleted: "Marking completed...",
  cancel: "Cancel",
  cancelling: "Cancelling...",
  confirmCancel: "Cancel this appointment?",
  undoCompleted: "Undo completion",
  undoingCompleted: "Undoing...",
  checkSaved: "Check saved",
  checkingSaved: "Checking...",
  confirmedSaved: "Saved",
  error: "The appointment could not be saved.",
};

describe("AppointmentStatusActions", () => {
  it("requires confirmation only before cancellation", () => {
    const confirm = vi.fn(() => false);

    expect(confirmAppointmentStatusChange("cancelled", "Cancel this appointment?", confirm)).toBe(false);
    expect(confirm).toHaveBeenCalledWith("Cancel this appointment?");
    confirm.mockClear();
    expect(confirmAppointmentStatusChange("completed", "Cancel this appointment?", confirm)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("offers complete and cancel while scheduled", () => {
    const html = renderToStaticMarkup(<AppointmentStatusActions appointmentId="appointment-1" currentStatus="scheduled" texts={texts} />);
    expect(html).toContain("Mark completed");
    expect(html).toContain("Cancel");
    expect(html).not.toContain("Undo completion");
  });

  it("offers a conditional undo after completion", () => {
    const html = renderToStaticMarkup(<AppointmentStatusActions appointmentId="appointment-1" currentStatus="completed" texts={texts} />);
    expect(html).toContain("Undo completion");
    expect(html).toContain('type="hidden" name="expected_status" value="completed"');
    expect(html).toContain('type="hidden" name="status" value="scheduled"');
    expect(html).not.toContain("Mark completed");
    expect(html).not.toContain(">Cancel<");
  });
});
