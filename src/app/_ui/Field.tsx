import type { ReactNode } from "react";

import { cx } from "@/app/_ui/classNames";
import { Icon } from "@/app/_ui/Icon";

type FieldProps = {
  label: string;
  icon?: string;
  children: ReactNode;
  className?: string;
};

export function Field({ label, icon, children, className }: FieldProps) {
  return (
    <label className={cx("grid min-w-0 gap-2 text-label-sm text-on-surface-variant", className)}>
      <span className="inline-flex items-center gap-2">
        {icon ? <Icon className="text-outline" name={icon} /> : null}
        <span>{label}</span>
      </span>
      {children}
    </label>
  );
}