import { useEffect, type RefObject } from "react";

export function useDismissibleDetails(
  open: boolean,
  detailsRef: RefObject<HTMLDetailsElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
  onOpenChange: (open: boolean) => void,
) {
  useEffect(() => {
    if (!open || !detailsRef.current) return;
    const details = detailsRef.current;

    function close(restoreFocus: boolean) {
      if (!details.open) return;
      details.open = false;
      onOpenChange(false);
      if (restoreFocus) triggerRef.current?.focus();
    }
    function handlePointerDown(event: PointerEvent) {
      if (event.target && details.contains(event.target as Node)) return;
      close(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(true);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [detailsRef, onOpenChange, open, triggerRef]);
}
