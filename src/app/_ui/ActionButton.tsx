import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "@/app/_ui/classNames";
import { Icon } from "@/app/_ui/Icon";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: "primary" | "secondary";
  icon: string;
  children: ReactNode;
  size?: "default" | "compact";
};

export function ActionButton({ variant, icon, children, className, size = "default", type = "button", ...props }: ActionButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex w-full max-w-full items-center justify-center gap-2 whitespace-normal rounded-full text-center transition focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
        size === "compact" ? "min-h-12 px-4 text-label-md" : "min-h-14 px-5 text-label-lg",
        variant === "primary" ? "bg-primary text-on-primary hover:bg-primary/90" : "border border-secondary bg-surface-container-lowest text-secondary hover:bg-surface-container-low",
        className,
      )}
      type={type}
      {...props}
    >
      <Icon name={icon} />
      <span className="min-w-0 break-words text-center">{children}</span>
    </button>
  );
}