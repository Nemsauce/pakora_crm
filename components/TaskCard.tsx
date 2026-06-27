"use client";

import { Badge } from "@/components/Badge";
import { glassClass } from "@/components/Glass";
import { formatDateTime, formatPhone, fullName, orderNumber } from "@/lib/format";
import type { TaskWithOrder } from "@/lib/types";
import { Ban, CalendarClock, Check, Phone } from "lucide-react";
import Link from "next/link";

interface TaskCardProps {
  task: TaskWithOrder;
  onComplete: (task: TaskWithOrder) => void;
  onOmit: (task: TaskWithOrder) => void;
  onOpen?: (task: TaskWithOrder) => void;
  busy?: boolean;
  showOrderLink?: boolean;
}

export function TaskCard({
  task,
  onComplete,
  onOmit,
  onOpen,
  busy = false,
  showOrderLink = true
}: TaskCardProps) {
  const order = task.orders ?? task.order ?? null;
  const canAct = task.estado === "pendiente";
  const interactive = Boolean(onOpen);

  function handleOpen() {
    onOpen?.(task);
  }

  return (
    <article
      className={`${glassClass("task", true, "p-4")} ${
        interactive ? "cursor-pointer" : ""
      }`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? handleOpen : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleOpen();
              }
            }
          : undefined
      }
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {showOrderLink && !interactive ? (
              <Link
                href={`/ordenes/${task.order_id}`}
                className="text-sm font-semibold text-primary transition hover:text-primary/80"
              >
                {orderNumber(order)}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-primary">{orderNumber(order)}</span>
            )}
            <Badge kind="taskType" value={task.tipo} />
            {task.intento_numero ? (
              <span className="rounded-full border border-border bg-white/[0.07] px-2 py-1 text-xs font-medium text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                Intento {task.intento_numero}
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 truncate text-sm font-semibold text-slate-50">
            {task.titulo || "Tarea pendiente"}
          </h3>
          {task.descripcion ? (
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{task.descripcion}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <span className="font-medium text-slate-100">{fullName(order)}</span>
            <span className="inline-flex items-center gap-1.5">
              <Phone aria-hidden="true" className="h-3.5 w-3.5" />
              {formatPhone(order?.telefono)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
              {formatDateTime(task.fecha_limite)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canAct ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onComplete(task);
                }}
                disabled={busy}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary text-slate-950 transition hover:bg-primaryHover disabled:cursor-not-allowed disabled:opacity-50"
                title="Completar"
                aria-label="Completar tarea"
              >
                <Check aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOmit(task);
                }}
                disabled={busy}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white/[0.07] text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-danger/30 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                title="Omitir"
                aria-label="Omitir tarea"
              >
                <Ban aria-hidden="true" className="h-4 w-4" />
              </button>
            </>
          ) : (
            <Badge kind="taskStatus" value={task.estado} />
          )}
        </div>
      </div>
    </article>
  );
}
