"use client";

import { useMemo, useState, type FormEvent } from "react";
import { newId } from "@/domain/ids";
import { batches, defaultLowStockAt } from "@/domain/inventory";
import { uniqueRollCode } from "@/lib/demo";
import { plural } from "@/lib/format";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SelectField, TextField } from "../ui/Field";
import { useAppState } from "../providers/AppDataProvider";
import { useWriter } from "../providers/OperatorProvider";
import { DemoStickersButton } from "./DemoStickersButton";
import { RollCard } from "./RollCard";
import { PageIntro } from "../ui/PageIntro";

type Notice = { tone: "success" | "error"; text: string } | null;

function inOneYear(): string {
  return new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
}

export function InventoryView() {
  const { state, ready } = useAppState();
  const write = useWriter();
  const now = useMemo(() => new Date(), []);
  const rolls = Object.values(state.rolls);
  const units = [...new Set(rolls.map((roll) => roll.unit))].sort();

  const [form, setForm] = useState({ unit: "Medic 12", batch: "", size: "50", preEncoded: "50", expiry: inOneYear(), lowStockAt: "" });
  const [addNotice, setAddNotice] = useState<Notice>(null);
  const [recall, setRecall] = useState({ batch: "", reason: "" });
  const [recallNotice, setRecallNotice] = useState<Notice>(null);
  const recallable = batches(state).filter((batch) => !state.recalledBatches[batch]);

  const addRoll = async (event: FormEvent) => {
    event.preventDefault();
    const size = Number(form.size);
    const result = await write([
      {
        type: "RollAdded",
        payload: {
          rollId: newId("roll"),
          rollCode: uniqueRollCode(rolls.map((roll) => roll.rollCode)),
          unit: form.unit.trim(),
          batch: form.batch.trim(),
          size,
          preEncoded: Number(form.preEncoded),
          adhesiveExpiry: form.expiry,
          lowStockAt: form.lowStockAt.trim() ? Number(form.lowStockAt) : defaultLowStockAt(size)
        }
      }
    ]);
    setAddNotice(result.ok ? { tone: "success", text: `Added a ${plural(size, "sticker")} roll for ${form.unit.trim()}.` } : { tone: "error", text: result.message });
    if (result.ok) setForm({ ...form, batch: "" });
  };

  const recallBatch = async (event: FormEvent) => {
    event.preventDefault();
    const result = await write([{ type: "BatchRecalled", payload: { batch: recall.batch, reason: recall.reason.trim() } }]);
    setRecallNotice(result.ok ? { tone: "success", text: `Batch ${recall.batch} recalled. Its stickers can no longer be registered or claimed.` } : { tone: "error", text: result.message });
    if (result.ok) setRecall({ batch: "", reason: "" });
  };

  return (
    <div className="space-y-8">
      <PageIntro index="04" kicker="Inventory" title={<>Stock the <span className="mark">rolls</span>.</>} lede={<>Sticker rolls per unit. Recalled batches are blocked everywhere, and low stock or expiring adhesive is flagged.</>} action={<DemoStickersButton />} />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-8">
          {ready && rolls.length === 0 && (
            <Card title="No sticker rolls yet" description="Add a roll with the form, or load the demo stickers to try the full flow." />
          )}
          {units.map((unit) => (
            <section key={unit} aria-labelledby={`unit-${unit}`}>
              <h2 id={`unit-${unit}`} className="mb-3 font-display text-lg font-semibold text-fg/85">
                {unit}
              </h2>
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
                {rolls
                  .filter((roll) => roll.unit === unit)
                  .map((roll, index) => (
                    <RollCard key={roll.rollId} roll={roll} state={state} now={now} stagger={index} />
                  ))}
              </div>
            </section>
          ))}
        </div>

        <div className="space-y-6">
          <Card title="Add a roll" stagger={1}>
            <form onSubmit={addRoll} className="space-y-4">
              <TextField label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} required />
              <TextField label="Batch / lot" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} placeholder="LOT-A25-042" required />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Stickers" type="number" inputMode="numeric" min={1} max={500} value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} required />
                <TextField label="Pre-encoded" type="number" inputMode="numeric" min={0} value={form.preEncoded} onChange={(e) => setForm({ ...form, preEncoded: e.target.value })} required />
              </div>
              <TextField label="Adhesive expiry" type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} required />
              <TextField
                label="Low-stock threshold"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.lowStockAt}
                onChange={(e) => setForm({ ...form, lowStockAt: e.target.value })}
                placeholder={`Auto (${defaultLowStockAt(Number(form.size) || 1)})`}
              />
              <Button type="submit" variant="secondary" icon="plus" className="w-full">
                Add roll
              </Button>
              {addNotice && <Banner tone={addNotice.tone} onDismiss={() => setAddNotice(null)}>{addNotice.text}</Banner>}
            </form>
          </Card>

          <Card title="Recall a batch" description="Blocks every sticker from that lot for registration and new encounters." stagger={2}>
            <form onSubmit={recallBatch} className="space-y-4">
              <SelectField label="Batch" value={recall.batch} onChange={(e) => setRecall({ ...recall, batch: e.target.value })} required>
                <option value="">Choose a batch</option>
                {recallable.map((batch) => (
                  <option key={batch}>{batch}</option>
                ))}
              </SelectField>
              <TextField label="Reason" value={recall.reason} onChange={(e) => setRecall({ ...recall, reason: e.target.value })} placeholder="Adhesive failure" required />
              <Button type="submit" variant="danger" icon="alert" className="w-full" disabled={!recall.batch || !recall.reason.trim()}>
                Recall batch
              </Button>
              {recallNotice && <Banner tone={recallNotice.tone} onDismiss={() => setRecallNotice(null)}>{recallNotice.text}</Banner>}
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
