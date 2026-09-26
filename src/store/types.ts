import type { CriticalFacts } from "@/domain/facts";
import type { EmsSummary } from "@/domain/summary";

/** Full EMS summary kept behind the opaque tag-ID lookup. Never written to the physical tag. */
export interface ProfileRecord {
  tagId: string;
  facts: CriticalFacts;
  summary: EmsSummary;
  onTagPayload: string;
  payloadBytes: number;
  createdAt: string;
  updatedAt: string;
  deviceId: string;
  actor: string;
}

export interface MetaRow {
  key: string;
  value: string | number;
}

export function isProfileRecord(value: unknown): value is ProfileRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const summary = record.summary as Record<string, unknown> | null | undefined;
  return (
    typeof record.tagId === "string" &&
    typeof record.facts === "object" &&
    record.facts !== null &&
    typeof summary === "object" &&
    summary !== null &&
    typeof summary.headline === "string" &&
    Array.isArray(summary.alerts) &&
    typeof record.onTagPayload === "string" &&
    typeof record.payloadBytes === "number" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    typeof record.deviceId === "string" &&
    typeof record.actor === "string"
  );
}
