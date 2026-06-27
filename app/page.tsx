"use client";

import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { CardSkeleton, ListSkeleton } from "@/components/Skeleton";
import { TaskCard } from "@/components/TaskCard";
import { TaskCompletionModal } from "@/components/TaskCompletionModal";
import { TaskSlideOver } from "@/components/TaskSlideOver";
import { formatToday, isEnRutaOrder } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { omitTask } from "@/lib/task-actions";
import type { TaskWithOrder } from "@/lib/types";
import { AlertTriangle, CheckCircle2, PackageCheck, PhoneCall, Truck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Metrics {
  activeOrdersCO: number;
  activeOrdersMX: number;
  confirmationTasks: number;
  enRuta: number;
  novedades: number;
}

const initialMetrics: Metrics = {
  activeOrdersCO: 0,
  activeOrdersMX: 0,
  confirmationTasks: 0,
  enRuta: 0,
  novedades: 0
};

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [tasks, setTasks] = useState<TaskWithOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithOrder | null>(null);
  const [previewTask, setPreviewTask] = useState<TaskWithOrder | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);

      const [
        activeOrdersCOResult,
        activeOrdersMXResult,
        confirmationTasksResult,
        enRutaOrdersResult,
        novedadesResult,
        pendingTasksResult
      ] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("activo", true)
          .eq("pais", "CO"),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("activo", true)
          .eq("pais", "MX"),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("tipo", "llamar_confirmacion")
          .eq("estado", "pendiente"),
        supabase.from("orders").select("id, estado_crm, estado_dropi"),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("tipo", "presionar_entrega")
          .eq("estado", "pendiente"),
        supabase
          .from("tasks")
          .select("*, orders(*)")
          .eq("estado", "pendiente")
          .order("fecha_limite", { ascending: true, nullsFirst: false })
          .limit(12)
      ]);

      const firstError =
        activeOrdersCOResult.error ??
        activeOrdersMXResult.error ??
        confirmationTasksResult.error ??
        enRutaOrdersResult.error ??
        novedadesResult.error ??
        pendingTasksResult.error;

      if (firstError) throw firstError;

      setMetrics({
        activeOrdersCO: activeOrdersCOResult.count ?? 0,
        activeOrdersMX: activeOrdersMXResult.count ?? 0,
        confirmationTasks: confirmationTasksResult.count ?? 0,
        enRuta: (enRutaOrdersResult.data ?? []).filter(isEnRutaOrder).length,
        novedades: novedadesResult.count ?? 0
      });
      setTasks((pendingTasksResult.data ?? []) as TaskWithOrder[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

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
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">{formatToday()}</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-50 sm:text-3xl">Dashboard</h1>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-white/[0.04] px-3 py-2 text-sm text-muted backdrop-blur-xl">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
          Pakora CRM
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-danger/30 bg-danger/[0.15] px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Pedidos Activos Colombia"
              value={metrics.activeOrdersCO}
              icon={PackageCheck}
              accent="primary"
              href="/ordenes?pais=CO&filter=activas"
            />
            <MetricCard
              title="Pedidos Activos México"
              value={metrics.activeOrdersMX}
              icon={PackageCheck}
              accent="primary"
              href="/ordenes?pais=MX&filter=activas"
            />
            <MetricCard
              title="Por Confirmar"
              value={metrics.confirmationTasks}
              icon={PhoneCall}
              accent="warning"
              href="/tareas?tipo=llamar_confirmacion&estado=pendiente"
            />
            <MetricCard
              title="En Ruta"
              value={metrics.enRuta}
              icon={Truck}
              accent="neutral"
              href="/ordenes?filter=en_ruta"
            />
            <MetricCard
              title="Novedades"
              value={metrics.novedades}
              icon={AlertTriangle}
              accent="danger"
              href="/tareas?tipo=presionar_entrega&estado=pendiente"
            />
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-50">Tareas de Hoy</h2>
          <span className="text-sm text-muted">{tasks.length} pendientes</span>
        </div>

        {loading ? (
          <ListSkeleton rows={5} />
        ) : tasks.length ? (
          <div className="space-y-3">
            {tasks.map((task) => (
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
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="Sin tareas pendientes"
            message="La operación está al día para este corte."
          />
        )}
      </section>

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
