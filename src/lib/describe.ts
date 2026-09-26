import { INTERVENTIONS, type AppEvent, type HistoryField, type Vitals } from "@/domain/events";
import { VITAL_KEYS, VITAL_LIMITS } from "@/domain/vitals";

export const HISTORY_LABELS: Record<HistoryField, string> = {
  symptoms: "Signs & symptoms",
  allergies: "Allergies",
  medications: "Medications",
  pastHistory: "Past history",
  lastIntake: "Last oral intake",
  events: "Events leading up"
};

export function interventionLabel(code: string): string {
  return INTERVENTIONS.find((item) => item.code === code)?.label ?? code;
}

export function vitalsSummary(vitals: Vitals): string {
  const parts: string[] = [];
  if (vitals.sbp !== undefined || vitals.dbp !== undefined) parts.push(`BP ${vitals.sbp ?? "?"}/${vitals.dbp ?? "?"}`);
  for (const key of VITAL_KEYS) {
    if (key === "sbp" || key === "dbp") continue;
    const value = vitals[key];
    if (value === undefined) continue;
    const limit = VITAL_LIMITS[key];
    const short = { hr: "HR", rr: "RR", spo2: "SpO₂", gcs: "GCS", tempF: "T", glucose: "BGL", pain: "Pain" }[key];
    parts.push(`${short} ${value}${limit.unit === "%" ? "%" : limit.unit === "°F" ? "°F" : ""}`);
  }
  return parts.join(" · ");
}

export function describeEvent(event: AppEvent): string {
  switch (event.type) {
    case "RollAdded":
      return `Roll ${event.payload.rollCode} added for ${event.payload.unit} (${event.payload.size} stickers, batch ${event.payload.batch})`;
    case "BatchRecalled":
      return `Batch ${event.payload.batch} recalled: ${event.payload.reason}`;
    case "TagEncoded":
      return `Sticker ${event.payload.tagId} encoded`;
    case "ProfileRegistered":
      return `Personal sticker ${event.payload.tagId} registered (${event.payload.payloadBytes} bytes on tag, ${event.payload.rewriter} rewriter)`;
    case "EncounterOpened":
      return `Encounter started on ${event.payload.tagKind} sticker ${event.payload.tagId}`;
    case "TriageSet":
      return `Triage set to ${event.payload.category}`;
    case "AmbulatorySet":
      return event.payload.ambulatory ? "Marked ambulatory" : "Marked non-ambulatory";
    case "VitalsRecorded":
      return `Vitals: ${vitalsSummary(event.payload.vitals)}`;
    case "HistoryNoted":
      return `${HISTORY_LABELS[event.payload.field]}: ${event.payload.text}`;
    case "InterventionLogged":
      return `Intervention: ${interventionLabel(event.payload.code)}${event.payload.note ? ` (${event.payload.note})` : ""}`;
    case "TransportSet":
      return `Transport to ${event.payload.destination} (${event.payload.priority})`;
    case "MovementSet":
      return `Movement: ${event.payload.state}`;
    case "CustodyTransferred":
      return `Custody transferred to ${event.payload.receiver}, ${event.payload.facility}. Crew record locked`;
    case "EncounterClosed":
      return `Encounter closed (${event.payload.disposition})`;
    case "TagRetired":
      return `Sticker ${event.payload.tagId} retired`;
    case "IncidentOpened":
      return `Incident opened: ${event.payload.name}`;
  }
}
