"use client";

import { useState } from "react";
import { demoRollDrafts, hasDemoStickers } from "@/lib/demo";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { useAppState } from "../providers/AppDataProvider";
import { useWriter } from "../providers/OperatorProvider";

export function DemoStickersButton({ variant = "secondary" }: { variant?: "secondary" | "ghost" }) {
  const { state, ready } = useAppState();
  const write = useWriter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (!ready || hasDemoStickers(state)) return null;
  const load = async () => {
    setBusy(true);
    setError(undefined);
    const result = await write(demoRollDrafts(state, new Date()));
    setBusy(false);
    if (!result.ok) setError(result.message);
  };
  return (
    <div className="space-y-2">
      <Button variant={variant} icon="box" onClick={load} busy={busy}>
        Load demo stickers
      </Button>
      {error && <Banner tone="error" title="Demo stickers were not added">{error}</Banner>}
    </div>
  );
}
