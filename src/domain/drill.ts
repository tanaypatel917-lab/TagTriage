import { MOVEMENTS, type EventDraft, type Movement, type Triage, type Vitals } from "./events";
import { newId, newRollCode, tagIdFor } from "./ids";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededBytes(rng: () => number, length: number): Uint8Array {
  return Uint8Array.from({ length }, () => Math.floor(rng() * 256));
}

const PLAN: { category: Triage; complaint: string }[] = [
  { category: "RED", complaint: "Open femur fracture, heavy bleeding" },
  { category: "RED", complaint: "Chest trauma, labored breathing" },
  { category: "RED", complaint: "Unresponsive, head injury" },
  { category: "YELLOW", complaint: "Suspected wrist fracture, anxious" },
  { category: "YELLOW", complaint: "Laceration to scalp, controlled" },
  { category: "YELLOW", complaint: "Lower back pain after impact" },
  { category: "YELLOW", complaint: "Burns to forearm" },
  { category: "GREEN", complaint: "Minor abrasions" },
  { category: "GREEN", complaint: "Ankle sprain, walking" },
  { category: "GREEN", complaint: "Anxiety, no injuries found" },
  { category: "GREEN", complaint: "Bruised shoulder" },
  { category: "BLACK", complaint: "No respirations after airway repositioning" }
];

const MOVEMENT_PLAN: Movement[] = ["handed-off", "transporting", "loaded", "arrived", "transporting", "loaded", "on-scene", "on-scene", "on-scene", "arrived", "on-scene", "on-scene"];

const DESTINATIONS = ["St. Mary Trauma Center", "County General ED", "Riverside Medical Center"];

function vitalsFor(category: Triage, rng: () => number): Vitals {
  const jitter = (base: number, spread: number) => Math.round(base + (rng() - 0.5) * spread);
  switch (category) {
    case "RED":
      return { hr: jitter(128, 16), rr: jitter(30, 6), sbp: jitter(88, 14), dbp: jitter(54, 10), spo2: jitter(89, 4), gcs: jitter(10, 4) };
    case "YELLOW":
      return { hr: jitter(104, 12), rr: jitter(22, 4), sbp: jitter(128, 16), dbp: jitter(80, 10), spo2: jitter(96, 2), gcs: 15 };
    case "GREEN":
      return { hr: jitter(88, 12), rr: jitter(16, 4), sbp: jitter(126, 14), dbp: jitter(78, 10), spo2: jitter(98, 2), gcs: 15 };
    case "BLACK":
      return { hr: 0, rr: 0 };
  }
}

export interface MciDrill {
  drafts: EventDraft[];
  incidentId: string;
  rollId: string;
  rollCode: string;
}

/** Deterministic mass-casualty drill: a dedicated roll, an incident and 12 triaged patients. */
export function buildMciDrill({ seed, now, usedRollCodes = [] }: { seed: number; now: Date; usedRollCodes?: string[] }): MciDrill {
  const rng = mulberry32(seed);
  const id = (prefix: string) => newId(prefix, seededBytes(rng, 16));
  let rollCode = newRollCode(seededBytes(rng, 3));
  while (usedRollCodes.includes(rollCode)) rollCode = newRollCode(seededBytes(rng, 3));
  const rollId = id("roll");
  const incidentId = id("inc");
  const expiry = new Date(now.getTime() + 365 * 86_400_000).toISOString().slice(0, 10);
  const drafts: EventDraft[] = [
    {
      type: "RollAdded",
      payload: { rollId, rollCode, unit: "MCI Drill", batch: `DRILL-${now.toISOString().slice(0, 10)}`, size: 24, preEncoded: 24, adhesiveExpiry: expiry, lowStockAt: 4 }
    },
    { type: "IncidentOpened", payload: { incidentId, name: `MCI drill · bus rollover ${now.toISOString().slice(11, 16)}Z`, drill: true } }
  ];

  PLAN.forEach(({ category, complaint }, index) => {
    const encounterId = id("enc");
    const tagId = tagIdFor(rollCode, index + 1);
    const target = category === "BLACK" ? "on-scene" : MOVEMENT_PLAN[index];
    const destination = DESTINATIONS[index % DESTINATIONS.length];
    drafts.push(
      { type: "EncounterOpened", payload: { encounterId, tagId, tagKind: "encounter", incidentId } },
      { type: "TriageSet", payload: { encounterId, category } },
      { type: "HistoryNoted", payload: { encounterId, field: "symptoms", text: complaint } }
    );
    if (category === "GREEN") drafts.push({ type: "AmbulatorySet", payload: { encounterId, ambulatory: true } });
    const readings = category === "RED" ? 2 : 1;
    for (let r = 0; r < readings; r++) {
      const takenAt = new Date(now.getTime() - (readings - r) * 4 * 60_000).toISOString();
      drafts.push({ type: "VitalsRecorded", payload: { encounterId, vitals: vitalsFor(category, rng), takenAt } });
    }
    if (category === "RED") drafts.push({ type: "InterventionLogged", payload: { encounterId, code: index === 0 ? "TQ" : "O2" } });
    const targetIndex = MOVEMENTS.indexOf(target);
    if (targetIndex >= MOVEMENTS.indexOf("loaded")) {
      drafts.push({ type: "TransportSet", payload: { encounterId, destination, priority: category === "RED" ? "emergent" : "urgent", unit: `Medic ${10 + index}` } });
    }
    const forward = target === "handed-off" ? "arrived" : target;
    if (forward !== "on-scene") drafts.push({ type: "MovementSet", payload: { encounterId, state: forward } });
    if (target === "handed-off") {
      drafts.push({ type: "CustodyTransferred", payload: { encounterId, receiver: "Dr. A. Okafor", facility: destination } });
    }
  });
  return { drafts, incidentId, rollId, rollCode };
}
