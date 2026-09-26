"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ROLES, type Operator } from "@/store/identity";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { useOperator } from "../providers/OperatorProvider";

export function OperatorDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { operator, setOperator } = useOperator();
  const [draft, setDraft] = useState<Operator>(operator);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setDraft(operator);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, operator]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setOperator({ name: draft.name.trim() || "Unnamed", role: draft.role, unit: draft.unit.trim() });
    onClose();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="operator-title"
      className="w-[min(92vw,28rem)] rounded-card border border-white/10 bg-navy-900/95 p-0 text-white shadow-2xl backdrop:bg-ink/70 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={submit} className="space-y-4 p-6">
        <div>
          <h2 id="operator-title" className="font-display text-xl font-semibold">
            Who is using this device?
          </h2>
          <p className="mt-1 text-sm text-white/65">Every write in the event log is stamped with this name, role and unit.</p>
        </div>
        <TextField label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="name" required />
        <SelectField label="Role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
          {ROLES.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </SelectField>
        <TextField label="Unit or organization" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="Medic 12" />
        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="secondary">
            Save operator
          </Button>
        </div>
      </form>
    </dialog>
  );
}
