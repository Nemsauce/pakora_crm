"use client";

import { EmptyState } from "@/components/EmptyState";
import { useCountry } from "@/components/CountryProvider";
import { glassClass } from "@/components/Glass";
import { ListSkeleton } from "@/components/Skeleton";
import { TaskCard } from "@/components/TaskCard";
import { TaskCompletionModal } from "@/components/TaskCompletionModal";
import { TaskSlideOver } from "@/components/TaskSlideOver";
import { labelFromMap, taskStatusLabels, taskTypeLabels } from "@/lib/format";
import { buildOrderIntelligence } from "@/lib/order-intelligence";
import { supabase } from "@/lib/supabase";
import { omitTask } from "@/lib/task-actions";
import type { Order, StatusHistory, TaskStatus, TaskType, TaskWithOrder } from "@/lib/types";
import { ClipboardCheck, Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type TipoFilter = "todos" | TaskType;
type EstadoFilter = "todos" | TaskStatus;

const taskTypeOrder: TaskType[] = [
  "llamar_confirmacion",
  "mensaje_confirmacion",
  "nota_voz",
  "notificar_guia",
  "revisar_novedad",
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
  const [history, setHistory] = useState<StatusHistory[]>([]);
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

      const loadedTasks = (data ?? []) as TaskWithOrder[];
      const orderIds = Array.from(new Set(loadedTasks.map((task) => task.order_id).filter(Boolean)));
      const historyResult = orderIds.length
        ? await supabase
            .from("status_history")
            .select("*")
            .in("order_id", orderIds)
            .order("registrado_en", { ascending: false })
        : { data: [], error: null };

      if (historyResult.error) throw historyResult.error;

      setTasks(loadedTasks);
      setHistory((historyResult.data ?? []) as StatusHistory[]);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "status_history" }, loadData)
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

  const enrichedTasks = useMemo(() => {
    const orders = Array.from(
      new Map(
        tasks
          .map((task) => task.orders ?? task.order)
          .filter((order): order is Order => Boolean(order))
          .map((order) => [order.id, order])
      ).values()
    );
    const intelligenceByOrderId = new Map(
      buildOrderIntelligence(orders, tasks, history, [], concreteCountry).map((item) => [
        item.order.id,
        item
      ])
    );

    return tasks.map((task) => {
      const intelligence = intelligenceByOrderId.get(task.order_id);
      if (!intelligence) return task;

      const overdue =
        task.estado === "pendiente" &&
        Boolean(task.fecha_limite) &&
        new Date(task.fecha_limite as string).getTime() < Date.now();
      const priorityReasons =
        intelligence.logistics.severity === "danger" || intelligence.logistics.severity === "warning"
          ? intelligence.logistics.reasons.slice(0, 2)
          : [];

      return {
        ...task,
        order: task.order ?? intelligence.order,
        orders: task.orders ?? intelligence.order,
        overdue,
        priorityReasons
      } as TaskWithOrder & { overdue: boolean; priorityReasons: string[] };
    });
  }, [tasks, history, concreteCountry]);

  const filteredTasks = useMemo(
    () =>
      enrichedTasks.filter((task) => {
        const matchesType = tipoFilter === "todos" || task.tipo === tipoFilter;
        const matchesStatus = estadoFilter === "todos" || task.estado === estadoFilter;
        return matchesType && matchesStatus;
      }),
    [enrichedTasks, tipoFilter, estadoFilter]
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
          <label className={glassClass("control", false, "flex items-center gap-2 px-3 py-2")}>
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

          <label className={glassClass("control", false, "px-3 py-2")}>
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
                <span className="rounded-full border border-border bg-white/[0.07] px-2.5 py-1 text-xs font-medium text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
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
