"use client";

import { Badge } from "@/components/Badge";
import { glassClass } from "@/components/Glass";
import { formatDateTime, formatPhone, fullName, orderNumber, orderNumberClass } from "@/lib/format";
import type { TaskWithOrder } from "@/lib/types";
import { Ban, CalendarClock, Check, ExternalLink, Phone, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface TaskSlideOverProps {
  task: TaskWithOrder | null;
  busy?: boolean;
  onClose: () => void;
  onComplete: (task: TaskWithOrder) => void;
  onOmit: (task: TaskWithOrder) => void;
}

export function TaskSlideOver({
  task,
  busy = false,
  onClose,
  onComplete,
  onOmit
}: TaskSlideOverProps) {
  const [entered, setEntered] = useState(false);
  const order = task?.orders ?? task?.order ?? null;

  useEffect(() => {
    if (!task) {
      setEntered(false);
      return;
    }

    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [task]);

  if (!task) return null;

  const canAct = task.estado === "pendiente";

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Cerrar panel"
        className={`absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-300 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`${glassClass("panel", false, "pakora-slide-panel absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-y-0 border-r-0 transition-transform duration-300 ease-out sm:w-[32rem]")} ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="border-b border-slate-400/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${orderNumberClass(order)}`}>
                {orderNumber(order)}
              </p>
              <h2 className="mt-2 truncate text-xl font-semibold text-slate-50">
                {fullName(order)}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-400/10 bg-white/[0.07] text-muted transition hover:border-sky-400/30 hover:text-slate-50"
              aria-label="Cerrar"
              title="Cerrar"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section>
            <div className="flex flex-wrap items-center gap-2">
              <Badge kind="taskType" value={task.tipo} />
              {task.intento_numero ? (
                <span className="rounded-full border border-slate-400/10 bg-white/[0.07] px-2.5 py-1 text-xs font-medium text-muted">
                  Intento {task.intento_numero}
                </span>
              ) : null}
              {task.creado_por ? (
                <span className="rounded-full border border-slate-400/10 bg-white/[0.07] px-2.5 py-1 text-xs font-medium text-muted">
                  {task.creado_por}
                </span>
              ) : null}
            </div>

            <h3 className="mt-5 text-lg font-semibold leading-7 text-slate-50">
              {task.titulo || "Tarea pendiente"}
            </h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
              {task.descripcion || "Sin descripción registrada."}
            </p>
          </section>

          <section className={glassClass("control", false, "space-y-3 p-4")}>
            <a
              href={order?.telefono ? `tel:${order.telefono.replace(/\s/g, "")}` : undefined}
              className="flex items-center gap-3 text-sm text-slate-100 transition hover:text-primary"
            >
              <Phone aria-hidden="true" className="h-4 w-4 text-primary" />
              {formatPhone(order?.telefono)}
            </a>
            <div className="flex items-center gap-3 text-sm text-muted">
              <CalendarClock aria-hidden="true" className="h-4 w-4 text-primary" />
              {formatDateTime(task.fecha_limite)}
            </div>
          </section>

          <Link
            href={`/ordenes/${task.order_id}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/[0.12] px-4 py-3 text-sm font-semibold text-primary transition hover:bg-sky-400/[0.18]"
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            Ver orden completa
          </Link>
        </div>

        <footer className="border-t border-slate-400/10 p-6">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onOmit(task)}
              disabled={busy || !canAct}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-400/10 bg-white/[0.07] px-4 py-3 text-sm font-semibold text-muted transition hover:border-danger/30 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Ban aria-hidden="true" className="h-4 w-4" />
              Omitir
            </button>
            <button
              type="button"
              onClick={() => onComplete(task)}
              disabled={busy || !canAct}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-primary px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-primaryHover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check aria-hidden="true" className="h-4 w-4" />
              Completar
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
