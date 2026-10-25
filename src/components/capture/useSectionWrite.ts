"use client";

import { useState } from "react";
import type { EventDraft } from "@/domain/events";
import { useWriter } from "../providers/OperatorProvider";

export type SectionNotice = { tone: "success" | "error"; text: string } | null;

/** Runs a write and reports success only when the store accepted it. */
export function useSectionWrite() {
  const write = useWriter();
  const [notice, setNotice] = useState<SectionNotice>(null);
  const [busy, setBusy] = useState(false);
  const run = async (drafts: EventDraft[], success: string): Promise<boolean> => {
    setBusy(true);
    const result = await write(drafts);
    setBusy(false);
    setNotice(result.ok ? { tone: "success", text: success } : { tone: "error", text: result.message });
    return result.ok;
  };
  return { run, notice, clear: () => setNotice(null), busy };
}
