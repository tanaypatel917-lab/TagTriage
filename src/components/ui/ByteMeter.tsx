import { cx } from "@/lib/format";

export function ByteMeter({ bytes, capacity }: { bytes: number; capacity: number }) {
  const ratio = Math.min(1, bytes / capacity);
  const tone = ratio > 0.95 ? "bg-red-400" : ratio > 0.85 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-fg/80">Tag memory</span>
        <span className="font-mono tabular-nums text-fg">
          {bytes} / {capacity} bytes
        </span>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-fg/10"
        role="meter"
        aria-label="Tag memory used"
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={bytes}
      >
        <div className={cx("h-full rounded-full transition-[width] duration-300 ease-out-expo", tone)} style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-fg/55">NTAG215 user memory, including the sticker ID record and NDEF framing.</p>
    </div>
  );
}
