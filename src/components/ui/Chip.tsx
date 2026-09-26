import type { ReactNode } from "react";
import type { Triage } from "@/domain/events";
import { cx } from "@/lib/format";
import { Icon, type IconName } from "./Icon";

export type ChipTone = "sky" | "red" | "emerald" | "amber" | "neutral";

export function Chip({ tone = "neutral", icon, children, className }: { tone?: ChipTone; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <span className={cx("chip", `chip-${tone}`, className)}>
      {icon && <Icon name={icon} className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

export function TriageChip({ category, large }: { category?: Triage; large?: boolean }) {
  if (!category) return <span className={cx("chip chip-neutral", large && "min-h-[36px] px-4 text-sm")}>UNTRIAGED</span>;
  return <span className={cx("chip font-bold tracking-wide", `triage-${category}`, large && "min-h-[36px] px-4 text-sm")}>{category}</span>;
}
