import { expiryStatus, isLowStock, rollCounts } from "@/domain/inventory";
import type { AppState, RollView } from "@/domain/state";
import { formatDate } from "@/lib/format";
import { Chip } from "../ui/Chip";

export function RollCard({ roll, state, now, stagger }: { roll: RollView; state: AppState; now: Date; stagger: number }) {
  const counts = rollCounts(roll, state);
  const expiry = expiryStatus(roll, now);
  const low = isLowStock(roll, counts);
  const encodedShare = counts.remaining ? (counts.remainingPreEncoded / counts.remaining) * 100 : 0;
  return (
    <article className="glass-card p-5" style={{ ["--stagger" as string]: `${stagger * 60}ms` }} aria-label={`Roll ${roll.rollCode}, ${roll.unit}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold">{roll.unit}</p>
          <p className="font-mono text-sm text-white/60">
            {roll.batch} · roll {roll.rollCode}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {roll.recalled && <Chip tone="red" icon="alert">Recalled</Chip>}
          {expiry === "expired" && <Chip tone="red">Adhesive expired</Chip>}
          {expiry === "soon" && <Chip tone="amber">Expires soon</Chip>}
          {low && !roll.recalled && <Chip tone="amber">Low stock</Chip>}
          {!roll.recalled && expiry === "ok" && !low && <Chip tone="emerald">Ready</Chip>}
        </div>
      </div>

      {roll.recalled && (
        <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">
          Blocked for registration and claims. {roll.recallReason}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
        {[
          { label: "Remaining", value: counts.remaining, strong: true },
          { label: "Claimed", value: counts.claimed },
          { label: "Issued", value: counts.issued },
          { label: "Retired", value: counts.retired }
        ].map((item) => (
          <div key={item.label} className="row-surface px-1 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{item.label}</dt>
            <dd className={item.strong ? "font-display text-2xl font-semibold tabular-nums" : "font-display text-xl tabular-nums text-white/85"}>{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-white/60">
          <span>{counts.remainingPreEncoded} pre-encoded</span>
          <span>{counts.remainingBlank} blank</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <div className="h-full rounded-full bg-sky-400/80" style={{ width: `${encodedShare}%` }} />
        </div>
      </div>

      <p className="mt-3 text-sm text-white/60">
        Adhesive expiry <span className="text-white/85">{formatDate(roll.adhesiveExpiry)}</span> · {roll.size} stickers · low at {roll.lowStockAt}
      </p>
    </article>
  );
}
