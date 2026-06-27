"use client";

import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { CardSkeleton, ListSkeleton } from "@/components/Skeleton";
import { TaskCard } from "@/components/TaskCard";
import { TaskCompletionModal } from "@/components/TaskCompletionModal";
import { TaskSlideOver } from "@/components/TaskSlideOver";
import { useCountry } from "@/components/CountryProvider";
import { countryLabel } from "@/lib/country";
import { formatToday, isEnRutaOrder } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { omitTask } from "@/lib/task-actions";
import type { TaskWithOrder } from "@/lib/types";
import { AlertTriangle, CheckCircle2, Globe2, PackageCheck, PhoneCall, Truck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface Metrics {
  activeOrdersCO: number;
  activeOrdersMX: number;
  activeOrdersTotal: number;
  confirmationTasks: number;
  enRuta: number;
  novedades: number;
}

const initialMetrics: Metrics = {
  activeOrdersCO: 0,
  activeOrdersMX: 0,
  activeOrdersTotal: 0,
  confirmationTasks: 0,
  enRuta: 0,
  novedades: 0
};

export default function DashboardPage() {
  const { countryMode, concreteCountry } = useCountry();
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

      let confirmationTasksQuery = supabase
        .from("tasks")
        .select(concreteCountry ? "id, orders!inner(pais)" : "id", {
          count: "exact",
          head: true
        })
        .eq("tipo", "llamar_confirmacion")
        .eq("estado", "pendiente");

      let novedadesQuery = supabase
        .from("tasks")
        .select(concreteCountry ? "id, orders!inner(pais)" : "id", {
          count: "exact",
          head: true
        })
        .eq("tipo", "presionar_entrega")
        .eq("estado", "pendiente");

      let pendingTasksQuery = supabase
        .from("tasks")
        .select(concreteCountry ? "*, orders!inner(*)" : "*, orders(*)")
        .eq("estado", "pendiente")
        .order("fecha_limite", { ascending: true, nullsFirst: false })
        .limit(12);

      let enRutaOrdersQuery = supabase.from("orders").select("id, estado_crm, estado_dropi, pais");

      if (concreteCountry) {
        confirmationTasksQuery = confirmationTasksQuery.eq("orders.pais", concreteCountry);
        novedadesQuery = novedadesQuery.eq("orders.pais", concreteCountry);
        pendingTasksQuery = pendingTasksQuery.eq("orders.pais", concreteCountry);
        enRutaOrdersQuery = enRutaOrdersQuery.eq("pais", concreteCountry);
      }

      const [
        activeOrdersCOResult,
        activeOrdersMXResult,
        activeOrdersTotalResult,
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
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("activo", true),
        confirmationTasksQuery,
        enRutaOrdersQuery,
        novedadesQuery,
        pendingTasksQuery
      ]);

      const firstError =
        activeOrdersCOResult.error ??
        activeOrdersMXResult.error ??
        activeOrdersTotalResult.error ??
        confirmationTasksResult.error ??
        enRutaOrdersResult.error ??
        novedadesResult.error ??
        pendingTasksResult.error;

      if (firstError) throw firstError;

      setMetrics({
        activeOrdersCO: activeOrdersCOResult.count ?? 0,
        activeOrdersMX: activeOrdersMXResult.count ?? 0,
        activeOrdersTotal: activeOrdersTotalResult.count ?? 0,
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
  }, [concreteCountry]);

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

  const countryQuery = concreteCountry ? `pais=${concreteCountry}&` : "";
  const countryOrdersQuery = concreteCountry ? `pais=${concreteCountry}&` : "";
  const activeMetricCards =
    countryMode === "todos"
      ? [
          {
            title: "Activos Colombia",
            value: metrics.activeOrdersCO,
            icon: PackageCheck,
            href: "/ordenes?pais=CO&filter=activas"
          },
          {
            title: "Activos México",
            value: metrics.activeOrdersMX,
            icon: PackageCheck,
            href: "/ordenes?pais=MX&filter=activas"
          },
          {
            title: "Activos Totales",
            value: metrics.activeOrdersTotal,
            icon: Globe2,
            href: "/ordenes?filter=activas"
          }
        ]
      : [
          {
            title: `Pedidos Activos ${countryLabel(countryMode)}`,
            value: countryMode === "CO" ? metrics.activeOrdersCO : metrics.activeOrdersMX,
            icon: PackageCheck,
            href: `/ordenes?${countryOrdersQuery}filter=activas`
          }
        ];

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
          <h1 className="mt-2 text-2xl font-semibold text-slate-50 sm:text-3xl">
            Dashboard {countryLabel(countryMode)}
          </h1>
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
            {activeMetricCards.map((card) => (
              <MetricCard
                key={card.title}
                title={card.title}
                value={card.value}
                icon={card.icon}
                accent="primary"
                href={card.href}
              />
            ))}
            <MetricCard
              title="Por Confirmar"
              value={metrics.confirmationTasks}
              icon={PhoneCall}
              accent="warning"
              href={`/tareas?${countryQuery}tipo=llamar_confirmacion&estado=pendiente`}
            />
            <MetricCard
              title="En Ruta"
              value={metrics.enRuta}
              icon={Truck}
              accent="neutral"
              href={`/ordenes?${countryOrdersQuery}filter=en_ruta`}
            />
            <MetricCard
              title="Novedades"
              value={metrics.novedades}
              icon={AlertTriangle}
              accent="danger"
              href={`/tareas?${countryQuery}tipo=presionar_entrega&estado=pendiente`}
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
