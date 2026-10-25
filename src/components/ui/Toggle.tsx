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
    <div className="flex min-h-[52px] items-center justify-between gap-4 rounded-2xl px-1">
      <div className="min-w-0">
        <p id={`${id}-label`} className="font-semibold text-white">
          {label}
        </p>
        {description && (
          <p id={`${id}-desc`} className="text-sm text-white/60">
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
          "relative inline-flex h-11 w-[72px] shrink-0 items-center rounded-full p-1 transition-colors duration-200 disabled:opacity-50",
          checked ? on : "bg-white/15"
        )}
      >
        <span
          className={cx(
            "inline-block h-9 w-9 rounded-full bg-white shadow-md transition-transform duration-200 ease-out-expo",
            checked ? "translate-x-7" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}
