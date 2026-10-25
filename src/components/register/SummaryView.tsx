import type { EmsAlert, EmsSummary } from "@/domain/summary";
import { cx } from "@/lib/format";
import { Chip } from "../ui/Chip";
import { Icon } from "../ui/Icon";

const LEVEL_STYLE: Record<EmsAlert["level"], string> = {
  critical: "bg-red-500/10 ring-red-400/25",
  high: "bg-amber-500/10 ring-amber-400/20",
  info: "bg-white/[0.04] ring-white/10"
};

export function RewriterBadge({ summary }: { summary: EmsSummary }) {
  const { rewriter } = summary;
  if (rewriter.id === "nim") {
    return (
      <Chip tone="emerald" icon="sparkles">
        NVIDIA NIM · {rewriter.model ?? "model"}
        {rewriter.visionModel ? ` + ${rewriter.visionModel.split("/").pop()}` : ""}
      </Chip>
    );
  }
  return (
    <Chip tone="amber" icon="box">
      Local fallback{rewriter.fallbackReason ? ` · ${rewriter.fallbackReason}` : ""}
    </Chip>
  );
}

export function SummaryView({ summary }: { summary: EmsSummary }) {
  return (
    <div className="space-y-4">
      <p className="font-display text-lg font-semibold leading-snug text-white">{summary.headline}</p>
      <ol className="space-y-2" aria-label="Ranked alerts">
        {summary.alerts.map((alert) => (
          <li key={alert.id} className={cx("flex items-start gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset", LEVEL_STYLE[alert.level])}>
            <span className="mt-0.5 font-mono text-xs tabular-nums text-white/50">{alert.rank}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">{alert.label}</p>
              {alert.detail && <p className="text-sm text-white/65">{alert.detail}</p>}
            </div>
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-white/45">{alert.source === "both" ? "form + record" : alert.source === "record" ? "record" : "form"}</span>
          </li>
        ))}
      </ol>
      {summary.transcript && (
        <details className="row-surface px-4 py-3">
          <summary className="flex min-h-[32px] cursor-pointer items-center gap-2 text-sm font-semibold text-white/80">
            <Icon name="camera" className="h-4 w-4" /> What the vision model read from the photo
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-sm text-white/75">{summary.transcript}</pre>
        </details>
      )}
    </div>
  );
}
