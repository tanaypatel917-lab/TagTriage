/** Anticoagulants and antiplatelets EMS crews treat as "blood thinners". Brand names map to generics. */
export const ANTICOAGULANTS: Record<string, string> = {
  warfarin: "warfarin",
  coumadin: "warfarin",
  jantoven: "warfarin",
  apixaban: "apixaban",
  eliquis: "apixaban",
  rivaroxaban: "rivaroxaban",
  xarelto: "rivaroxaban",
  dabigatran: "dabigatran",
  pradaxa: "dabigatran",
  edoxaban: "edoxaban",
  savaysa: "edoxaban",
  enoxaparin: "enoxaparin",
  lovenox: "enoxaparin",
  heparin: "heparin",
  fondaparinux: "fondaparinux",
  arixtra: "fondaparinux",
  clopidogrel: "clopidogrel",
  plavix: "clopidogrel",
  prasugrel: "prasugrel",
  effient: "prasugrel",
  ticagrelor: "ticagrelor",
  brilinta: "ticagrelor"
};

export function anticoagulantsIn(texts: readonly string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
      const generic = ANTICOAGULANTS[word];
      if (generic) found.add(generic);
    }
  }
  return [...found];
}

export const HIGH_RISK_CONDITIONS: { label: string; pattern: RegExp }[] = [
  { label: "Pacemaker / ICD", pattern: /pacemaker|\bicd\b|defibrillator/i },
  { label: "Seizure disorder", pattern: /seizure|epilep/i },
  { label: "Diabetes", pattern: /diabet|\bt[12]dm\b|insulin/i },
  { label: "COPD / home oxygen", pattern: /copd|emphysema|home o2|home oxygen/i },
  { label: "Heart failure", pattern: /heart failure|\bchf\b|\bhfref\b|\bhfpef\b/i },
  { label: "Dementia", pattern: /dementia|alzheimer/i },
  { label: "Prior stroke", pattern: /stroke|\bcva\b|\btia\b/i },
  { label: "Kidney failure / dialysis", pattern: /dialysis|renal failure|kidney failure|\bckd\b|\besrd\b/i },
  { label: "Atrial fibrillation", pattern: /atrial fib|\bafib\b|\ba-fib\b/i },
  { label: "Bleeding disorder", pattern: /hemophilia|von willebrand|bleeding disorder/i },
  { label: "Adrenal insufficiency", pattern: /adrenal insufficiency|addison/i },
  { label: "Sickle cell disease", pattern: /sickle cell/i },
  { label: "Transplant / immunosuppressed", pattern: /transplant|immunosuppress/i },
  { label: "Coronary artery disease", pattern: /coronary|\bcad\b|myocardial infarction|\bmi\b|heart attack|stent/i }
];

export function isHighRiskCondition(condition: string): boolean {
  return HIGH_RISK_CONDITIONS.some(({ pattern }) => pattern.test(condition));
}

export const CONDITION_KEYWORDS: { label: string; pattern: RegExp }[] = [
  ...HIGH_RISK_CONDITIONS,
  { label: "Hypertension", pattern: /hypertension|\bhtn\b|high blood pressure/i },
  { label: "Asthma", pattern: /asthma/i },
  { label: "Cancer", pattern: /cancer|carcinoma|lymphoma|leukemia/i },
  { label: "Parkinson's disease", pattern: /parkinson/i }
];

export const SEVERE_ALLERGY = /anaphyla|epipen|airway|throat swelling/i;
