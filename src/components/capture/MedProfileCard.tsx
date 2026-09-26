import type { OnTagFacts } from "@/domain/facts";
import { approxAge, type EmsSummary } from "@/domain/summary";
import { cx } from "@/lib/format";
import { AllergyPanel, CodeStatusBadge, ThinnerBadge } from "../ui/CriticalBadges";
import { Icon } from "../ui/Icon";

export function MedProfileCard({
  facts,
  summary,
  tagId,
  source,
  headingRef,
  preview,
  now = new Date()
}: {
  facts: OnTagFacts;
  summary?: EmsSummary;
  tagId?: string;
  source?: "on-tag" | "on-tag+lookup";
  headingRef?: React.Ref<HTMLHeadingElement>;
  preview?: boolean;
  now?: Date;
}) {
  const age = approxAge(facts.birthYear, now);
  const contactPhone = facts.emergencyContact.match(/\+?[\d][\d\s().-]{5,}\d/)?.[0];
  return (
    <section aria-labelledby="med-profile-name" className={cx("glass-card glass-card--instant overflow-hidden p-0", !preview && "ring-1 ring-signal/40")}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-5 py-2.5">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-signal">
          <Icon name="heart" className="h-4 w-4" /> Med profile
        </p>
        {tagId && <p className="font-mono text-xs text-white/55">{tagId}</p>}
      </div>
      <div className="space-y-4 p-5">
        <div>
          <h2 id="med-profile-name" ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em] outline-none">
            {facts.name || "Name not on sticker"}
          </h2>
          <p className="mt-1 text-white/70">
            {[age !== undefined ? `~${age} years` : "Age unknown", facts.bloodType ? `Blood type ${facts.bloodType}` : "Blood type unknown"].join(" · ")}
          </p>
        </div>

        {(facts.dnr || facts.polst || facts.anticoagulants) && (
          <div className="flex flex-wrap gap-2">
            <CodeStatusBadge dnr={facts.dnr} polst={facts.polst} large />
            {facts.anticoagulants && <ThinnerBadge large names={summary?.facts.anticoagulantNames} />}
          </div>
        )}

        <AllergyPanel allergies={facts.allergies} nkda={facts.nkda} omitted={facts.allergiesOmitted} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="row-surface px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white/55">Conditions</p>
            <p className="mt-0.5 font-medium text-white/90">
              {facts.conditions.length ? facts.conditions.join(", ") : "None on sticker"}
              {facts.conditionsOmitted > 0 && <span className="text-white/60"> +{facts.conditionsOmitted} more</span>}
            </p>
          </div>
          <div className="row-surface px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-white/55">Emergency contact</p>
            {facts.emergencyContact ? (
              contactPhone && !preview ? (
                <a href={`tel:${contactPhone.replace(/[^\d+]/g, "")}`} className="mt-0.5 inline-flex min-h-[44px] items-center gap-2 font-semibold text-sky-300 underline-offset-4 hover:underline">
                  <Icon name="phone" className="h-4 w-4" /> {facts.emergencyContact}
                </a>
              ) : (
                <p className="mt-0.5 font-medium text-white/90">{facts.emergencyContact}</p>
              )
            ) : (
              <p className="mt-0.5 text-white/60">None on sticker</p>
            )}
          </div>
        </div>

        {source && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60">
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <Icon name="check" className="h-4 w-4" /> On-tag facts
            </span>
            <span>{source === "on-tag+lookup" ? "Full summary on this device" : "Full summary not on this device"}</span>
          </p>
        )}
      </div>
    </section>
  );
}
