import type { HTMLAttributes } from "react";

import { cx } from "@/app/_ui/classNames";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "section" | "div";
};

export function Card({ as = "section", className, children, ...props }: CardProps) {
  const Component = as;

  return (
    <Component
      className={cx("min-w-0 max-w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-card-padding shadow-[0_4px_20px_0_rgba(0,0,0,0.04)]", className)}
      {...props}
    >
      {children}
    </Component>
  );
}