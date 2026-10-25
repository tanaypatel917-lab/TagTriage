import type { ReactNode } from "react";
import { cx } from "@/lib/format";
import { Icon, type IconName } from "./Icon";

type Tone = "success" | "error" | "info" | "warning";

const STYLES: Record<Tone, { box: string; icon: IconName }> = {
  success: { box: "bg-emerald-50 text-emerald-900 border-emerald-900", icon: "check" },
  error: { box: "bg-red-50 text-red-900 border-signal", icon: "alert" },
  info: { box: "bg-sky-150 text-sky-900 border-sky-900", icon: "sparkles" },
  warning: { box: "bg-amber-50 text-amber-900 border-amber-800", icon: "alert" }
};

export function Banner({ tone, title, children, onDismiss, className }: { tone: Tone; title?: ReactNode; children?: ReactNode; onDismiss?: () => void; className?: string }) {
  const style = STYLES[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("flex animate-fade-in items-start gap-3 rounded-control border-[1.5px] border-l-[6px] px-4 py-3", style.box, className)}>
      <Icon name={style.icon} className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(Boolean(title) && "mt-0.5", "opacity-90")}>{children}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="-m-2 grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-fg/10" aria-label="Dismiss">
          <Icon name="x" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
