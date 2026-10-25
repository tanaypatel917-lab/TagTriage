import { cx } from "@/lib/format";
import { Icon } from "./Icon";

/** DNR/POLST in solid violet (US hospital DNR wristband convention). Label carries the meaning, not just color. */
export function CodeStatusBadge({ dnr, polst, large }: { dnr: boolean; polst: boolean; large?: boolean }) {
  if (!dnr && !polst) return null;
  const label = dnr && polst ? "DNR · POLST" : dnr ? "DNR" : "POLST ON FILE";
  return (
    <span className={cx("badge-dnr inline-flex items-center gap-2 rounded-control font-display font-bold uppercase tracking-wide", large ? "min-h-[48px] px-4 text-lg" : "min-h-[32px] px-3 text-sm")}>
      <Icon name="shield" className={large ? "h-6 w-6" : "h-4 w-4"} />
      {label}
    </span>
  );
}

/** Blood thinners in solid orange with a droplet so it never reads as a triage chip. */
export function ThinnerBadge({ large, names }: { large?: boolean; names?: string[] }) {
  return (
    <span className={cx("badge-thinner inline-flex items-center gap-2 rounded-control font-display font-bold uppercase tracking-wide", large ? "min-h-[48px] px-4 text-lg" : "min-h-[32px] px-3 text-sm")}>
      <Icon name="droplet" className={large ? "h-6 w-6" : "h-4 w-4"} />
      Blood thinners
      {names && names.length > 0 && <span className="font-sans text-sm font-semibold normal-case">({names.join(", ")})</span>}
    </span>
  );
}

/** Allergies in a red-tinted panel. "Not recorded" is neutral, never green: absence of data is not absence of allergy. */
export function AllergyPanel({ allergies, nkda, omitted = 0 }: { allergies: string[]; nkda: boolean; omitted?: number }) {
  if (allergies.length === 0) {
    return nkda ? (
      <div className="rounded-control border-[1.5px] border-emerald-900 bg-emerald-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Allergies</p>
        <p className="mt-0.5 font-display text-lg font-semibold text-emerald-800">No known allergies (NKDA)</p>
      </div>
    ) : (
      <div className="rounded-control border-[1.5px] border-dashed border-fg/50 bg-paper px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-fg/60">Allergies</p>
        <p className="mt-0.5 font-display text-lg font-semibold text-fg/85">Not recorded. Ask the patient.</p>
      </div>
    );
  }
  return (
    <div className="rounded-control border-[1.5px] border-l-[8px] border-ink border-l-signal bg-red-50 px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-800">
        <Icon name="alert" className="h-4 w-4" /> Allergies
      </p>
      <p className="mt-0.5 font-display text-lg font-semibold leading-snug text-red-900">
        {allergies.join(", ")}
        {omitted > 0 && <span className="ml-2 text-sm font-medium text-red-800/80">+{omitted} more in full summary</span>}
      </p>
    </div>
  );
}
