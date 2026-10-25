"use client";

import { useId, type ReactNode } from "react";
import { cx } from "@/lib/format";

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  tone = "signal"
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  tone?: "signal" | "dnr" | "thinner";
}) {
  const id = useId();
  const on = { signal: "bg-signal", dnr: "bg-dnr", thinner: "bg-thinner" }[tone];
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-4 rounded-card px-1">
      <div className="min-w-0">
        <p id={`${id}-label`} className="font-semibold text-fg">
          {label}
        </p>
        {description && (
          <p id={`${id}-desc`} className="text-sm text-fg/60">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative inline-flex h-11 w-[72px] shrink-0 items-center rounded-full border-[1.5px] border-ink p-1 transition-colors duration-200 disabled:opacity-50",
          checked ? on : "bg-fg/15"
        )}
      >
        <span
          className={cx(
            "inline-block h-8 w-8 rounded-full border-[1.5px] border-ink bg-paper-card transition-transform duration-200 ease-out-expo",
            checked ? "translate-x-[29px]" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}
