"use client";

import { EmptyState } from "@/components/EmptyState";
import { GlassCard, glassClass } from "@/components/Glass";
import { MetricCard } from "@/components/MetricCard";
import { CardSkeleton, ListSkeleton, SkeletonLine } from "@/components/Skeleton";
import { TaskCard } from "@/components/TaskCard";
import { TaskCompletionModal } from "@/components/TaskCompletionModal";
import { TaskSlideOver } from "@/components/TaskSlideOver";
import { useCountry } from "@/components/CountryProvider";
import { countryLabel } from "@/lib/country";
import {
  buildPipelineStages,
  buildRecentActivity,
  type DashboardPipelineStage,
  type RecentActivityItem
} from "@/lib/dashboard";
import {
  buildCourierPerformance,
  buildDashboardIntelligenceSummary,
  buildIntelligenceCountrySummaries,
  buildLogisticsPipeline,
  buildLogisticsRiskAlerts,
  buildOrderIntelligence,
  buildUnifiedActionInbox,
  severityClasses,
  type ActionInboxItem,
  type CourierPerformance,
  type IntelligenceCountrySummary,
  type LogisticsPipelineStage,
  type LogisticsRiskAlert
} from "@/lib/order-intelligence";
import { formatDateTime, formatToday, orderNumber, orderNumberClass } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { omitTask } from "@/lib/task-actions";
import type { Order, OrderComment, StatusHistory, TaskWithOrder } from "@/lib/types";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Globe2,
  MessageSquare,
  PackageCheck,
  ShieldAlert,
  Truck,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

interface DashboardData {
  orders: Order[];
  tasks: TaskWithOrder[];
  comments: OrderComment[];
  history: StatusHistory[];
}

const initialDashboardData: DashboardData = {
  orders: [],
  tasks: [],
  comments: [],
  history: []
};

export default function DashboardPage() {
  const { countryMode, concreteCountry } = useCountry();
  const [data, setData] = useState<DashboardData>(initialDashboardData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithOrder | null>(null);
  const [previewTask, setPreviewTask] = useState<TaskWithOrder | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let ordersQuery = supabase.from("orders").select("*").order("fecha", { ascending: false });
      let tasksQuery = supabase
        .from("tasks")
        .select(concreteCountry ? "*, orders!inner(*)" : "*, orders(*)")
        .eq("estado", "pendiente")
        .order("fecha_limite", { ascending: true, nullsFirst: false });

      if (concreteCountry) {
        ordersQuery = ordersQuery.eq("pais", concreteCountry);
        tasksQuery = tasksQuery.eq("orders.pais", concreteCountry);
      }

      const [ordersResult, tasksResult, commentsResult] = await Promise.all([
        ordersQuery,
        tasksQuery,
        supabase
          .from("comentarios")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(24)
      ]);

      const firstError = ordersResult.error ?? tasksResult.error ?? commentsResult.error;
      if (firstError) throw firstError;

      const loadedOrders = (ordersResult.data ?? []) as Order[];
      const orderIds = loadedOrders.map((order) => order.id);
      const historyResult = orderIds.length
        ? await supabase
            .from("status_history")
            .select("*")
            .in("order_id", orderIds)
            .order("registrado_en", { ascending: false })
        : { data: [], error: null };

      if (historyResult.error) throw historyResult.error;

      setData({
        orders: loadedOrders,
        tasks: (tasksResult.data ?? []) as TaskWithOrder[],
        comments: (commentsResult.data ?? []) as OrderComment[],
        history: (historyResult.data ?? []) as StatusHistory[]
      });
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
      .on("postgres_changes", { event: "*", schema: "public", table: "comentarios" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "status_history" }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const countryQuery = concreteCountry ? `pais=${concreteCountry}&` : "";
  const taskHref = (query: string) => `/tareas?${countryQuery}${query}`;
  const orderHref = (filter: string) => `/ordenes?${countryQuery}filter=${filter}`;

  const intelligence = useMemo(
    () => buildOrderIntelligence(data.orders, data.tasks, data.history, data.comments, concreteCountry),
    [data.orders, data.tasks, data.history, data.comments, concreteCountry]
  );
  const totals = useMemo(
    () => buildDashboardIntelligenceSummary(intelligence),
    [intelligence]
  );
  const pipelineStages = useMemo(
    () => buildPipelineStages(data.orders, concreteCountry),
    [data.orders, concreteCountry]
  );
  const countrySummaries = useMemo(
    () => buildIntelligenceCountrySummaries(intelligence),
    [intelligence]
  );
  const recentActivity = useMemo(
    () => buildRecentActivity(data.comments, data.history, data.orders, concreteCountry),
    [data.comments, data.history, data.orders, concreteCountry]
  );
  const actionInbox = useMemo(
    () => buildUnifiedActionInbox(intelligence),
    [intelligence]
  );
  const dropiPipeline = useMemo(
    () => buildLogisticsPipeline(intelligence, concreteCountry),
    [intelligence, concreteCountry]
  );
  const dropiRiskAlerts = useMemo(
    () => buildLogisticsRiskAlerts(intelligence, concreteCountry),
    [intelligence, concreteCountry]
  );
  const courierScores = useMemo(
    () => buildCourierPerformance(intelligence),
    [intelligence]
  );

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
            Command Center {countryLabel(countryMode)}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Prioridad operativa, tareas urgentes y riesgos COD en una sola vista.
          </p>
        </div>
        <Link
          href="/finanzas"
          className={glassClass(
            "control",
            true,
            "inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted hover:text-slate-50"
          )}
        >
          <CircleDollarSign aria-hidden="true" className="h-4 w-4 text-primary" />
          Ver Finanzas
        </Link>
      </section>

      {error && (
        <div className="rounded-2xl border border-danger/30 bg-danger/[0.15] px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Pedidos activos"
              value={totals.activeOrders}
              icon={PackageCheck}
              href={orderHref("activas")}
            />
            <MetricCard
              title="En ruta"
              value={totals.enRuta}
              icon={Truck}
              accent="primary"
              href={orderHref("en_ruta")}
            />
            <MetricCard
              title="Novedades"
              value={totals.novedades}
              icon={AlertTriangle}
              accent="danger"
              href={orderHref("novedad")}
            />
            <MetricCard
              title="Tareas vencidas"
              value={totals.overdueTasks}
              icon={Clock3}
              accent="warning"
              href={taskHref("estado=pendiente")}
            />
            <MetricCard
              title="Riesgo alto"
              value={totals.highRiskClients}
              icon={ShieldAlert}
              accent="danger"
              href={orderHref("riesgo_alto")}
            />
            <MetricCard
              title="Tasa entregada"
              value={`${totals.deliveredRate}%`}
              icon={CheckCircle2}
              accent="primary"
              href={orderHref("entregadas")}
            />
          </>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(25rem,0.65fr)]">
        <div className="space-y-6">
          {loading ? <ListSkeleton rows={4} /> : <PipelinePanel stages={pipelineStages} />}
          {loading ? <ListSkeleton rows={3} /> : <DropiPipelinePanel stages={dropiPipeline} />}

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">Unified Action Inbox</h2>
                <p className="mt-1 text-sm text-muted">Tareas reales y señales Dropi priorizadas sin duplicados.</p>
              </div>
              <span className="text-sm text-muted">{actionInbox.length} acciones</span>
            </div>

            {loading ? (
              <ListSkeleton rows={5} />
            ) : actionInbox.length ? (
              <ActionInbox
                items={actionInbox}
                busyTaskId={busyTaskId}
                onComplete={setSelectedTask}
                onOmit={handleOmit}
                onOpen={setPreviewTask}
              />
            ) : (
              <EmptyState
                icon={CheckCircle2}
                title="Sin tareas pendientes"
                message="No hay tareas ni señales Dropi urgentes con los filtros actuales."
              />
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {countryMode === "todos" ? (
            <CountryComparison summaries={countrySummaries} loading={loading} />
          ) : null}
          <LogisticsRiskCenter alerts={dropiRiskAlerts} loading={loading} />
          <CourierScoreboard items={courierScores} loading={loading} />
          <OutcomeRates
            deliveredRate={totals.deliveredRate}
            canceledRate={totals.canceledRate}
            returnedRate={totals.returnedRate}
            loading={loading}
          />
          <RecentActivity items={recentActivity} loading={loading} />
        </aside>
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

function PipelinePanel({ stages }: { stages: DashboardPipelineStage[] }) {
  const maxCount = Math.max(...stages.map((stage) => stage.count), 1);
  const totalCount = stages.reduce((total, stage) => total + stage.count, 0);

  return (
    <GlassCard className="p-5" hover={false} variant="panel">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 aria-hidden="true" className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-slate-50">COD Pipeline</h2>
          </div>
          <p className="mt-1 text-sm text-muted">Estado operativo de pedidos y valor asociado.</p>
        </div>
        <div className="rounded-2xl border border-border bg-white/[0.07] px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <p className="text-xs uppercase tracking-wider text-muted">Pedidos</p>
          <p className="mt-1 text-sm font-semibold text-slate-50">{totalCount}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage) => {
          const width = `${Math.max(7, Math.round((stage.count / maxCount) * 100))}%`;

          return (
            <Link
              key={stage.key}
              href={stage.href}
              className="rounded-2xl border border-border bg-white/[0.055] p-4 transition hover:border-sky-400/30 hover:bg-white/[0.08]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-50">{stage.label}</p>
                  <p className="mt-1 text-xs text-muted">Flujo CRM</p>
                </div>
                <span className="text-lg font-bold text-slate-50">{stage.count}</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.38)]"
                  style={{ width }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </GlassCard>
  );
}

function DropiPipelinePanel({ stages }: { stages: LogisticsPipelineStage[] }) {
  const maxCount = Math.max(...stages.map((stage) => stage.count), 1);
  const totalCount = stages.reduce((total, stage) => total + stage.count, 0);

  return (
    <GlassCard className="p-5" hover={false} variant="panel">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <Truck aria-hidden="true" className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-slate-50">Dropi Pipeline</h2>
          </div>
          <p className="mt-1 text-sm text-muted">Flujo logístico real según estados de Dropi.</p>
        </div>
        <div className="rounded-2xl border border-border bg-white/[0.07] px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <p className="text-xs uppercase tracking-wider text-muted">Pedidos</p>
          <p className="mt-1 text-sm font-semibold text-slate-50">{totalCount}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {stages.map((stage) => {
          const width = `${Math.max(7, Math.round((stage.count / maxCount) * 100))}%`;

          return (
            <Link
              key={stage.key}
              href={stage.href}
              className="rounded-2xl border border-border bg-white/[0.055] p-4 transition hover:border-sky-400/30 hover:bg-white/[0.08]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-50">{stage.label}</p>
                  <p className="mt-1 text-xs text-muted">Flujo Dropi</p>
                </div>
                <span className="text-lg font-bold text-slate-50">{stage.count}</span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-success shadow-[0_0_18px_rgba(52,211,153,0.32)]"
                  style={{ width }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </GlassCard>
  );
}

function ActionInbox({
  items,
  busyTaskId,
  onComplete,
  onOmit,
  onOpen
}: {
  items: ActionInboxItem[];
  busyTaskId: string | null;
  onComplete: (task: TaskWithOrder) => void;
  onOmit: (task: TaskWithOrder) => void;
  onOpen: (task: TaskWithOrder) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        if (item.kind === "task" && item.task) {
          return (
            <TaskCard
              key={item.id}
              task={item.task}
              onComplete={onComplete}
              onOmit={onOmit}
              onOpen={onOpen}
              busy={busyTaskId === item.task.id}
            />
          );
        }

        return (
            <Link
              key={item.id}
              href={item.href}
              className="block rounded-2xl border border-border bg-white/[0.052] p-4 transition hover:border-sky-400/30 hover:bg-white/[0.08]"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-semibold ${orderNumberClass(item.order)}`}>
                      {orderNumber(item.order)}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${severityClasses(item.severity)}`}
                    >
                      {item.logistics.riskLabel}
                    </span>
                    <span className="rounded-full border border-border bg-white/[0.07] px-2.5 py-1 text-xs font-medium text-muted">
                      {item.logistics.ageLabel}
                    </span>
                    {item.priorityReasons.slice(0, 3).map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full border border-primary/20 bg-primary/[0.1] px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-50">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {item.description}
                  </p>
                </div>
                <div className="shrink-0 text-left xl:text-right">
                  <p className="text-sm font-semibold text-slate-50">{item.logistics.stageLabel}</p>
                  <p className="mt-1 text-xs text-muted">{item.logistics.ageLabel}</p>
                  <p className="mt-1 text-xs text-primary">{item.actionLabel}</p>
                </div>
              </div>
            </Link>
        );
      })}
    </div>
  );
}

function CountryComparison({
  summaries,
  loading
}: {
  summaries: IntelligenceCountrySummary[];
  loading: boolean;
}) {
  return (
    <GlassCard className="p-5" hover={false} variant="panel">
      <PanelTitle icon={Globe2} title="CO / MX" />
      {loading ? (
        <div className="mt-5 space-y-3">
          <SkeletonLine className="h-20 w-full" />
          <SkeletonLine className="h-20 w-full" />
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {summaries.map((summary) => (
            <Link
              key={summary.country}
              href={`/ordenes?pais=${summary.country}&filter=activas`}
              className="rounded-2xl border border-border bg-white/[0.055] p-4 transition hover:border-sky-400/30 hover:bg-white/[0.08]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-50">
                    {summary.flag} {summary.label}
                  </p>
                  <p className="mt-1 text-xs text-muted">{summary.pendingTasks} tareas abiertas</p>
                </div>
                <p className="text-2xl font-bold text-slate-50">{summary.activeOrders}</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Ruta" value={summary.enRuta} />
                <MiniStat label="Novedad" value={summary.novedades} />
                <MiniStat label="Vencidas" value={summary.overdueTasks} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function LogisticsRiskCenter({ alerts, loading }: { alerts: LogisticsRiskAlert[]; loading: boolean }) {
  return (
    <GlassCard className="p-5" hover={false} variant="panel">
      <PanelTitle icon={ShieldAlert} title="Logistics Risk Center" />
      {loading ? (
        <div className="mt-5 space-y-3">
          <SkeletonLine className="h-16 w-full" />
          <SkeletonLine className="h-16 w-full" />
          <SkeletonLine className="h-16 w-full" />
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {alerts.map((alert) => (
            <Link
              key={alert.id}
              href={alert.href}
              className="block rounded-2xl border border-border bg-white/[0.052] p-3 transition hover:border-sky-400/30 hover:bg-white/[0.08]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-50">{alert.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-muted">{alert.description}</p>
                </div>
                <span
                  className={`inline-flex min-w-9 justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClasses(alert.severity)}`}
                >
                  {alert.count}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-50">{alert.count} pedidos afectados</p>
            </Link>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function CourierScoreboard({ items, loading }: { items: CourierPerformance[]; loading: boolean }) {
  return (
    <GlassCard className="p-5" hover={false} variant="panel">
      <PanelTitle icon={Truck} title="Courier Scoreboard" />
      {loading ? (
        <div className="mt-5 space-y-3">
          <SkeletonLine className="h-12 w-full" />
          <SkeletonLine className="h-12 w-full" />
          <SkeletonLine className="h-12 w-full" />
        </div>
      ) : items.length ? (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <div key={item.name} className="rounded-2xl border border-border bg-white/[0.052] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-slate-50">{item.name}</p>
                <p className="text-xs text-muted">{Math.round(item.healthScore)} / 100</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-primary shadow-[0_0_18px_rgba(56,189,248,0.28)]"
                  style={{ width: `${Math.max(4, item.healthScore)}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <MiniStat label="Riesgo" value={`${Math.round(item.atRiskRate * 100)}%`} />
                <MiniStat label="Nov." value={`${Math.round(item.noveltyRate * 100)}%`} />
                <MiniStat label="Dev." value={`${Math.round(item.returnRate * 100)}%`} />
                <MiniStat label="Aging" value={item.averageAgeHours === null ? "N/D" : `${item.averageAgeHours}h`} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted">Sin datos de transportadora.</p>
      )}
    </GlassCard>
  );
}

function OutcomeRates({
  deliveredRate,
  canceledRate,
  returnedRate,
  loading
}: {
  deliveredRate: number;
  canceledRate: number;
  returnedRate: number;
  loading: boolean;
}) {
  const rows = [
    { label: "Entregada", value: deliveredRate, color: "bg-success" },
    { label: "Cancelada", value: canceledRate, color: "bg-danger" },
    { label: "Devolución", value: returnedRate, color: "bg-warning" }
  ];

  return (
    <GlassCard className="p-5" hover={false} variant="panel">
      <PanelTitle icon={Activity} title="Resultado COD" />
      {loading ? (
        <div className="mt-5 space-y-3">
          <SkeletonLine className="h-8 w-full" />
          <SkeletonLine className="h-8 w-full" />
          <SkeletonLine className="h-8 w-full" />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{row.label}</span>
                <span className="font-semibold text-slate-50">{row.value}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function RecentActivity({ items, loading }: { items: RecentActivityItem[]; loading: boolean }) {
  return (
    <GlassCard className="p-5" hover={false} variant="panel">
      <PanelTitle icon={MessageSquare} title="Actividad reciente" />
      {loading ? (
        <div className="mt-5 space-y-3">
          <SkeletonLine className="h-12 w-full" />
          <SkeletonLine className="h-12 w-full" />
          <SkeletonLine className="h-12 w-full" />
        </div>
      ) : items.length ? (
        <div className="mt-5 space-y-4">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.orderId ? `/ordenes/${item.orderId}` : "/ordenes"}
              className="block rounded-2xl border border-border bg-white/[0.052] p-3 transition hover:border-sky-400/30 hover:bg-white/[0.08]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-50">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{item.description}</p>
                </div>
                <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
              </div>
              <p className="mt-2 text-xs text-muted">{formatDateTime(item.timestamp)}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted">Sin actividad reciente.</p>
      )}
    </GlassCard>
  );
}

function PanelTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white/[0.07] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </div>
      <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-white/[0.05] px-2 py-2">
      <p className="text-sm font-semibold text-slate-50">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
    </div>
  );
}
