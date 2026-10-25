import { newId } from "@/domain/ids";
import type { TagTriageDB } from "./db";

export interface Operator {
  name: string;
  role: string;
  unit: string;
}

export const ROLES = ["EMT", "Paramedic", "Caregiver", "Clinic staff", "Dispatcher"] as const;
export const DEFAULT_OPERATOR: Operator = { name: "Demo EMT", role: "EMT", unit: "Medic 12" };
const OPERATOR_KEY = "tt.operator";

export function actorLabel(operator: Operator): string {
  return `${operator.name.trim() || "Unnamed"} (${operator.role}, ${operator.unit.trim() || "no unit"})`;
}

export function loadOperator(): Operator {
  if (typeof localStorage === "undefined") return DEFAULT_OPERATOR;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(OPERATOR_KEY) ?? "null");
    if (parsed && typeof parsed === "object") {
      const { name, role, unit } = parsed as Record<string, unknown>;
      if (typeof name === "string" && typeof role === "string" && typeof unit === "string") return { name, role, unit };
    }
  } catch {
    // Corrupt value: fall back to the default operator.
  }
  return DEFAULT_OPERATOR;
}

export function saveOperator(operator: Operator): void {
  localStorage.setItem(OPERATOR_KEY, JSON.stringify(operator));
}

/** Stable per-browser device id; call inside a transaction that includes `meta`, or on its own. */
export async function getDeviceId(db: TagTriageDB): Promise<string> {
  const row = await db.meta.get("deviceId");
  if (typeof row?.value === "string") return row.value;
  const deviceId = newId("dev");
  await db.meta.put({ key: "deviceId", value: deviceId });
  return deviceId;
}
