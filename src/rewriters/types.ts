import type { CriticalFacts } from "@/domain/facts";
import type { EmsSummary } from "@/domain/summary";

export interface RewriteInput {
  documentText: string;
  facts: CriticalFacts;
  documentImage?: string;
}

/** Seam for anything that turns a medical record plus owner facts into an EMS summary. */
export interface SummaryRewriter {
  readonly id: "nim" | "local";
  rewrite(input: RewriteInput): Promise<EmsSummary>;
}

export class ImageNeedsNimError extends Error {
  constructor(readonly reason: string) {
    super(
      "The photo can only be read by the NVIDIA NIM vision model, which isn't available right now. " +
        "Paste the record as text to use the offline extractor."
    );
    this.name = "ImageNeedsNimError";
  }
}
