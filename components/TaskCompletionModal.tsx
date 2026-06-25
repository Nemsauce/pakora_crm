"use client";

import { completeTask } from "@/lib/task-actions";
import type { TaskWithOrder } from "@/lib/types";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface TaskCompletionModalProps {
  task: TaskWithOrder | null;
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
}

export function TaskCompletionModal({
  task,
  open,
  onClose,
  onCompleted
}: TaskCompletionModalProps) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNotes("");
      setError(null);
      setSaving(false);
    }
  }, [open]);

  if (!open || !task) return null;

  async function handleSubmit() {
    if (!task || !notes.trim()) return;

    setSaving(true);
    setError(null);

    try {
      await completeTask(task, notes);
      onCompleted();
      onClose();
    } catch (completeError) {
      setError(
        completeError instanceof Error
          ? completeError.message
          : "No se pudo completar la tarea"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 py-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg bg-white/[0.04] backdrop-blur-xl border border-slate-400/10 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-50">Completar tarea</p>
            <p className="mt-1 text-sm text-muted">{task.titulo || "Seguimiento de orden"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-white/[0.03] p-2 text-muted transition hover:border-primary/30 hover:text-slate-50"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-5 block text-xs font-medium uppercase text-muted">
          Comentario
        </label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={5}
          className="mt-2 w-full resize-none rounded-2xl border border-border bg-slate-950/40 px-3 py-3 text-sm text-slate-50 outline-none transition placeholder:text-muted focus:border-primary/50"
          placeholder="Resultado de la gestión..."
        />

        {error && (
          <div className="mt-3 rounded-2xl border border-danger/30 bg-danger/[0.15] px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-primary/30 hover:text-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !notes.trim()}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-primaryHover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Check aria-hidden="true" className="h-4 w-4" />
            )}
            Completar
          </button>
        </div>
      </div>
    </div>
  );
}
