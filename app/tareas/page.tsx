"use client";

import { EmptyState } from "@/components/EmptyState";
import { useCountry } from "@/components/CountryProvider";
import { ListSkeleton } from "@/components/Skeleton";
import { TaskCard } from "@/components/TaskCard";
import { TaskCompletionModal } from "@/components/TaskCompletionModal";
import { TaskSlideOver } from "@/components/TaskSlideOver";
import { labelFromMap, taskStatusLabels, taskTypeLabels } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { omitTask } from "@/lib/task-actions";
import type { TaskStatus, TaskType, TaskWithOrder } from "@/lib/types";
import { ClipboardCheck, Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type TipoFilter = "todos" | TaskType;
type EstadoFilter = "todos" | TaskStatus;

const taskTypeOrder: TaskType[] = [
  "llamar_confirmacion",
  "mensaje_confirmacion",
  "nota_voz",
  "notificar_guia",
  "presionar_entrega",
  "cerrar_orden",
  "manual"
];

const statusOptions: Array<{ value: EstadoFilter; label: string }> = [
  { value: "pendiente", label: "Pendientes" },
  { value: "hecha", label: "Hechas" },
  { value: "omitida", label: "Omitidas" },
  { value: "todos", label: "Todas" }
];

export default function TasksPage() {
  const { concreteCountry } = useCountry();
  const [tasks, setTasks] = useState<TaskWithOrder[]>([]);
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("pendiente");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithOrder | null>(null);
  const [previewTask, setPreviewTask] = useState<TaskWithOrder | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);

      let tasksQuery = supabase
        .from("tasks")
        .select(concreteCountry ? "*, orders!inner(*)" : "*, orders(*)")
        .order("fecha_limite", { ascending: true, nullsFirst: false });

      if (concreteCountry) {
        tasksQuery = tasksQuery.eq("orders.pais", concreteCountry);
      }

      const { data, error: tasksError } = await tasksQuery;

      if (tasksError) throw tasksError;

      setTasks((data ?? []) as TaskWithOrder[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las tareas");
    } finally {
      setLoading(false);
    }
  }, [concreteCountry]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("tasks-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tipo = params.get("tipo");
    const estado = params.get("estado");

    if (tipo === "todos" || taskTypeOrder.includes(tipo as TaskType)) {
      setTipoFilter(tipo as TipoFilter);
    }

    if (estado === "todos" || statusOptions.some((option) => option.value === estado)) {
      setEstadoFilter(estado as EstadoFilter);
    }
  }, []);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const matchesType = tipoFilter === "todos" || task.tipo === tipoFilter;
        const matchesStatus = estadoFilter === "todos" || task.estado === estadoFilter;
        return matchesType && matchesStatus;
      }),
    [tasks, tipoFilter, estadoFilter]
  );

  const groupedTasks = useMemo(() => {
    const groups = filteredTasks.reduce<Record<string, TaskWithOrder[]>>((accumulator, task) => {
      const key = task.tipo || "manual";
      accumulator[key] = [...(accumulator[key] ?? []), task];
      return accumulator;
    }, {});

    return Object.entries(groups).sort(([first], [second]) => {
      const firstIndex = taskTypeOrder.indexOf(first as TaskType);
      const secondIndex = taskTypeOrder.indexOf(second as TaskType);
      return (firstIndex === -1 ? 99 : firstIndex) - (secondIndex === -1 ? 99 : secondIndex);
    });
  }, [filteredTasks]);

  async function handleOmit(task: TaskWithOrder) {
    setBusyTaskId(task.id);
    try {
      await omitTask(task.id);
      await loadData();
    } catch (omitError) {
      setError(omitError instanceof Error ? omitError.message : "No se pudo omitir la tarea");
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Cola operativa</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50 sm:text-3xl">Tareas</h1>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-2xl border border-border bg-white/[0.04] px-3 py-2 backdrop-blur-xl">
            <Filter aria-hidden="true" className="h-4 w-4 text-muted" />
            <select
              value={tipoFilter}
              onChange={(event) => setTipoFilter(event.target.value as TipoFilter)}
              className="w-full bg-transparent text-sm text-slate-50 outline-none"
            >
              <option value="todos">Todos los tipos</option>
              {taskTypeOrder.map((type) => (
                <option key={type} value={type}>
                  {taskTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="rounded-2xl border border-border bg-white/[0.04] px-3 py-2 backdrop-blur-xl">
            <select
              value={estadoFilter}
              onChange={(event) => setEstadoFilter(event.target.value as EstadoFilter)}
              className="w-full bg-transparent text-sm text-slate-50 outline-none"
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-danger/30 bg-danger/[0.15] px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={7} />
      ) : groupedTasks.length ? (
        <div className="space-y-7">
          {groupedTasks.map(([type, group]) => (
            <section key={type} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-50">
                  {labelFromMap(type, taskTypeLabels)}
                </h2>
                <span className="rounded-full border border-border bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-muted">
                  {group.length}
                </span>
              </div>
              <div className="space-y-3">
                {group.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={setSelectedTask}
                    onOmit={handleOmit}
                    onOpen={setPreviewTask}
                    busy={busyTaskId === task.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ClipboardCheck}
          title={estadoFilter === "pendiente" ? "Sin tareas pendientes" : "Sin tareas"}
          message={
            estadoFilter === "pendiente"
              ? "No hay acciones abiertas con los filtros seleccionados."
              : "Cambia los filtros para revisar otra parte de la cola."
          }
        />
      )}

      <TaskCompletionModal
        open={Boolean(selectedTask)}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onCompleted={loadData}
      />
      <TaskSlideOver
        task={previewTask}
        busy={previewTask ? busyTaskId === previewTask.id : false}
        onClose={() => setPreviewTask(null)}
        onComplete={(task) => {
          setPreviewTask(null);
          setSelectedTask(task);
        }}
        onOmit={async (task) => {
          setPreviewTask(null);
          await handleOmit(task);
        }}
      />
    </div>
  );
}
