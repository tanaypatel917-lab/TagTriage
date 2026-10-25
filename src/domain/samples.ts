import type { CriticalFacts } from "./facts";

/** Fictional demo data only. 555-01xx numbers are reserved for fiction. */
export const SAMPLE_PATIENT: CriticalFacts = {
  name: "Margaret Chen",
  birthYear: 1947,
  bloodType: "A+",
  allergies: ["penicillin", "latex"],
  nkda: false,
  conditions: ["atrial fibrillation", "type 2 diabetes"],
  anticoagulants: true,
  dnr: false,
  polst: false,
  emergencyContact: "David Chen (son) 555-0142"
};

export const SAMPLE_RECORD = `SAMPLE RECORD (fictional)
Patient: Margaret Chen   DOB: 1947

Allergies: Penicillin (hives), Sulfa
Medications:
- Eliquis 5 mg twice daily
- Metformin 500 mg
- Lisinopril 10 mg

Past medical history: Atrial fibrillation; Type 2 diabetes; Hypertension; CKD stage 3

Code status: DNR order on file (signed 2024)`;
