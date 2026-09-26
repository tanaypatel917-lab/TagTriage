import type { Vitals } from "./events";

export type VitalKey = keyof Vitals;

interface VitalLimit {
  label: string;
  unit: string;
  min: number;
  max: number;
  integer: boolean;
  warnLow?: number;
  warnHigh?: number;
}

export const VITAL_LIMITS: Record<VitalKey, VitalLimit> = {
  hr: { label: "Heart rate", unit: "bpm", min: 0, max: 300, integer: true, warnLow: 50, warnHigh: 120 },
  rr: { label: "Resp. rate", unit: "/min", min: 0, max: 80, integer: true, warnLow: 10, warnHigh: 29 },
  sbp: { label: "Systolic BP", unit: "mmHg", min: 30, max: 300, integer: true, warnLow: 90, warnHigh: 180 },
  dbp: { label: "Diastolic BP", unit: "mmHg", min: 10, max: 200, integer: true, warnHigh: 110 },
  spo2: { label: "SpO₂", unit: "%", min: 50, max: 100, integer: true, warnLow: 92 },
  gcs: { label: "GCS", unit: "", min: 3, max: 15, integer: true, warnLow: 13 },
  tempF: { label: "Temp", unit: "°F", min: 80, max: 112, integer: false, warnLow: 95, warnHigh: 100.4 },
  glucose: { label: "Glucose", unit: "mg/dL", min: 10, max: 800, integer: true, warnLow: 70, warnHigh: 300 },
  pain: { label: "Pain", unit: "/10", min: 0, max: 10, integer: true }
};

export const VITAL_KEYS = Object.keys(VITAL_LIMITS) as VitalKey[];

export interface VitalsCheck {
  ok: boolean;
  errors: Partial<Record<VitalKey | "form", string>>;
  warnings: Partial<Record<VitalKey, string>>;
}

function isVitalKey(key: string): key is VitalKey {
  return key in VITAL_LIMITS;
}

export function validateVitals(vitals: Vitals): VitalsCheck {
  const errors: VitalsCheck["errors"] = {};
  const warnings: VitalsCheck["warnings"] = {};
  let count = 0;
  for (const [key, value] of Object.entries(vitals)) {
    if (value === undefined) continue;
    if (!isVitalKey(key)) {
      errors.form = `Unknown vital "${key}"`;
      continue;
    }
    count++;
    const limit = VITAL_LIMITS[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors[key] = `${limit.label} must be a number`;
    } else if (limit.integer && !Number.isInteger(value)) {
      errors[key] = `${limit.label} must be a whole number`;
    } else if (value < limit.min || value > limit.max) {
      errors[key] = `${limit.label} must be ${limit.min}–${limit.max}${limit.unit ? ` ${limit.unit}` : ""}`;
    } else if (limit.warnLow !== undefined && value < limit.warnLow) {
      warnings[key] = "Low";
    } else if (limit.warnHigh !== undefined && value > limit.warnHigh) {
      warnings[key] = "High";
    }
  }
  if (count === 0) errors.form = "Enter at least one vital sign";
  if (
    vitals.sbp !== undefined &&
    vitals.dbp !== undefined &&
    !errors.sbp &&
    !errors.dbp &&
    vitals.dbp >= vitals.sbp
  ) {
    errors.dbp = "Diastolic must be lower than systolic";
  }
  return { ok: Object.keys(errors).length === 0, errors, warnings };
}

/** Converts raw form strings into numbers; blank fields are omitted, garbage becomes NaN (and fails validation). */
export function parseVitalsInput(raw: Partial<Record<VitalKey, string>>): Vitals {
  const vitals: Vitals = {};
  for (const key of VITAL_KEYS) {
    const text = raw[key]?.trim();
    if (text) vitals[key] = Number(text);
  }
  return vitals;
}
