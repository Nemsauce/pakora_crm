"use client";

import { Badge } from "@/components/Badge";
import { CountryBadge } from "@/components/CountryBadge";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/Glass";
import { ListSkeleton, SkeletonLine } from "@/components/Skeleton";
import { TaskCard } from "@/components/TaskCard";
import { TaskCompletionModal } from "@/components/TaskCompletionModal";
import {
  buildOrderIntelligence,
  classifyLogisticsStage,
  severityClasses,
  logisticsStageLabel,
  type LogisticsSignal
} from "@/lib/order-intelligence";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMoney,
  formatPhone,
  fullName,
  orderNumber,
  orderNumberClass
} from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { omitTask } from "@/lib/task-actions";
import type { Order, OrderComment, StatusHistory, TaskWithOrder } from "@/lib/types";
import {
  ArrowLeft,
  ClipboardList,
  History,
  Loader2,
  MapPin,
  MessageSquare,
  PackageX,
  Plus,
  ShieldAlert,
  Truck,
  User
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [tasks, setTasks] = useState<TaskWithOrder[]>([]);
  const [comments, setComments] = useState<OrderComment[]>([]);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [customerHistory, setCustomerHistory] = useState<Order[]>([]);
  const [customerHistoryTotal, setCustomerHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithOrder | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.estado === "pendiente"),
    [tasks]
  );
  const intelligence = useMemo(
    () => (order ? buildOrderIntelligence([order], tasks, history, comments)[0] ?? null : null),
    [order, tasks, history, comments]
  );
  const dropiSignal = intelligence?.logistics ?? null;

  const loadData = useCallback(async () => {
    if (!orderId) return;

    try {
      setError(null);

      const [orderResult, tasksResult, commentsResult, historyResult] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).single(),
        supabase
          .from("tasks")
          .select("*, orders(*)")
          .eq("order_id", orderId)
          .order("fecha_limite", { ascending: true, nullsFirst: false }),
        supabase
          .from("comentarios")
          .select("*")
          .eq("order_id", orderId)
          .order("created_at", { ascending: true }),
        supabase
          .from("status_history")
          .select("*")
          .eq("order_id", orderId)
          .order("registrado_en", { ascending: false })
      ]);

      const firstError =
        orderResult.error ?? tasksResult.error ?? commentsResult.error ?? historyResult.error;

      if (firstError) throw firstError;

      const loadedOrder = orderResult.data as Order;
      const phone = loadedOrder.telefono?.trim();
      const customerHistoryResult = phone
        ? await supabase
            .from("orders")
            .select("*", { count: "exact" })
            .eq("telefono", phone)
            .neq("id", loadedOrder.id)
            .order("fecha", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false, nullsFirst: false })
            .limit(10)
        : { data: [], error: null, count: 0 };

      if (customerHistoryResult.error) throw customerHistoryResult.error;

      setOrder(loadedOrder);
      setTasks(
        ((tasksResult.data ?? []) as TaskWithOrder[]).map((task) => ({
          ...task,
          order: loadedOrder
        }))
      );
      setComments((commentsResult.data ?? []) as OrderComment[]);
      setHistory((historyResult.data ?? []) as StatusHistory[]);
      setCustomerHistory((customerHistoryResult.data ?? []) as Order[]);
      setCustomerHistoryTotal(customerHistoryResult.count ?? 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la orden");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        loadData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `order_id=eq.${orderId}` },
        loadData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comentarios", filter: `order_id=eq.${orderId}` },
        loadData
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "status_history",
          filter: `order_id=eq.${orderId}`
        },
        loadData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, orderId]);

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

  async function handleAddComment() {
    if (!commentText.trim() || !orderId) return;

    setSavingComment(true);
    setError(null);

    try {
      const { error: commentError } = await supabase.from("comentarios").insert({
        order_id: orderId,
        comentario: commentText.trim(),
        origen: "manual"
      });

      if (commentError) throw commentError;

      setCommentText("");
      await loadData();
    } catch (commentError) {
      setError(
        commentError instanceof Error ? commentError.message : "No se pudo guardar el comentario"
      );
    } finally {
      setSavingComment(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLine className="h-10 w-28" />
        <GlassCard className="p-6" hover={false} variant="panel">
          <SkeletonLine className="h-5 w-32" />
          <SkeletonLine className="mt-4 h-8 w-72 max-w-full" />
          <SkeletonLine className="mt-5 h-10 w-48" />
        </GlassCard>
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (!order) {
    return (
      <EmptyState
        icon={PackageX}
        title="Orden no encontrada"
        message="La orden solicitada no existe o no está disponible."
      />
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-white/[0.07] px-3 py-2 text-sm font-medium text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition hover:border-primary/30 hover:text-slate-50"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Volver
      </button>

      {error && (
        <div className="rounded-2xl border border-danger/30 bg-danger/[0.15] px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <GlassCard className="p-5 sm:p-6" hover={false} variant="panel">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${orderNumberClass(order)}`}>
              {orderNumber(order)}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-50 sm:text-3xl">
              {fullName(order)}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              {order.nombre_producto || "Sin producto"}
            </p>
          </div>
          <div className="shrink-0 lg:text-right">
            <p className="text-sm text-muted">Total</p>
            <p className="mt-1 text-3xl font-bold text-slate-50">{formatCurrency(order.total)}</p>
            <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
              <CountryBadge country={order.pais} />
              <Badge kind="crmStatus" value={order.estado_crm} />
              <Badge kind="risk" value={order.nivel_riesgo} />
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <InfoCard icon={User} title="Cliente">
            <DetailRow label="Teléfono" value={formatPhone(order.telefono)} />
            <DetailRow label="Dirección" value={order.direccion || "Sin dirección"} />
            <DetailRow label="Referencia" value={order.barrio_referencia || "Sin referencia"} />
            <DetailRow
              label="Ciudad"
              value={`${order.ciudad || "Sin ciudad"}${order.departamento ? `, ${order.departamento}` : ""}`}
            />
          </InfoCard>

          <InfoCard icon={Truck} title="Dropi">
            <DetailRow label="Guía" value={order.guia_envio || "Sin guía"} />
            <DetailRow label="Transportadora" value={order.transportadora || "Sin transportadora"} />
            <div className="flex items-center justify-between gap-4 border-b border-border py-3">
              <span className="text-sm text-muted">Estado</span>
              <Badge kind="dropi" value={order.estado_dropi} />
            </div>
            {dropiSignal ? <DropiSignalSummary signal={dropiSignal} /> : null}
            <DetailRow
              label="ID Dropi"
              value={order.id_orden_dropi ? String(order.id_orden_dropi) : "Sin ID"}
            />
          </InfoCard>

          <InfoCard icon={ShieldAlert} title="Riesgo">
            <div className="flex items-center justify-between gap-4 border-b border-border py-3">
              <span className="text-sm text-muted">Nivel</span>
              <Badge kind="risk" value={order.nivel_riesgo} />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3">
              <RiskStat label="Pedidos" value={order.total_pedidos_cliente ?? 0} />
              <RiskStat label="Entregados" value={order.pedidos_entregados_cliente ?? 0} />
              <RiskStat label="Devueltos" value={order.pedidos_devueltos_cliente ?? 0} />
            </div>
          </InfoCard>

          <CustomerHistoryCard orders={customerHistory} total={customerHistoryTotal} />
        </div>

        <div className="space-y-6">
          <GlassCard className="p-5" hover={false} variant="panel">
            <SectionTitle icon={MapPin} title="Timeline Dropi" />
            {history.length ? (
              <div className="relative mt-5 space-y-5">
                <div className="absolute bottom-2 left-[7px] top-2 w-px bg-border" />
                {history.map((item) => (
                  <div key={item.id} className="relative flex gap-4">
                    <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border border-primary/30 bg-primary shadow-[0_0_18px_rgba(56,189,248,0.28)]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge kind="dropi" value={item.estado} />
                        <span className="rounded-full border border-border bg-white/[0.07] px-2.5 py-1 text-xs font-medium text-muted">
                          {logisticsStageLabel(classifyLogisticsStage(item.estado))}
                        </span>
                        {item.transportadora ? (
                          <span className="text-xs text-muted">{item.transportadora}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-muted">{formatDateTime(item.registrado_en)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">Sin historial registrado.</p>
            )}
          </GlassCard>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle icon={ClipboardList} title="Tareas activas" />
              <span className="text-sm text-muted">{activeTasks.length}</span>
            </div>
            {activeTasks.length ? (
              activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={setSelectedTask}
                  onOmit={handleOmit}
                  busy={busyTaskId === task.id}
                  showOrderLink={false}
                />
              ))
            ) : (
              <GlassCard className="px-4 py-5 text-sm text-muted" hover={false} variant="task">
                Sin tareas activas.
              </GlassCard>
            )}
          </section>

          <GlassCard className="p-5" hover={false} variant="panel">
            <SectionTitle icon={MessageSquare} title="Comentarios" />
            <div className="mt-5 space-y-4">
              {comments.length ? (
                comments.map((comment) => (
                  <div key={comment.id} className="border-b border-border pb-4 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge kind="origin" value={comment.origen} />
                      <span className="text-xs text-muted">{formatDateTime(comment.created_at)}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-100">
                      {comment.comentario}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">Sin comentarios registrados.</p>
              )}
            </div>

            <div className="mt-5 border-t border-border pt-5">
              <textarea
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                rows={4}
                placeholder="Agregar comentario..."
                className="w-full resize-none rounded-2xl border border-border bg-white/[0.06] px-3 py-3 text-sm text-slate-50 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition placeholder:text-muted focus:border-primary/50"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || savingComment}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-primaryHover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingComment ? (
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus aria-hidden="true" className="h-4 w-4" />
                  )}
                  Agregar
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <TaskCompletionModal
        open={Boolean(selectedTask)}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onCompleted={loadData}
      />
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className="p-5" hover={false} variant="panel">
      <SectionTitle icon={Icon} title={title} />
      <div className="mt-3">{children}</div>
    </GlassCard>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof User; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white/[0.07] text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </div>
      <h2 className="text-sm font-semibold text-slate-50">{title}</h2>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium leading-6 text-slate-100">
        {value}
      </span>
    </div>
  );
}

function DropiSignalSummary({ signal }: { signal: LogisticsSignal }) {
  return (
    <div className="border-b border-border py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted">Riesgo detectado</span>
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClasses(signal.severity)}`}
        >
          {signal.riskLabel}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-white/[0.05] px-3 py-2">
          <p className="text-[11px] uppercase tracking-wider text-muted">Etapa</p>
          <p className="mt-1 text-sm font-semibold text-slate-50">{signal.stageLabel}</p>
        </div>
        <div className="rounded-xl border border-border bg-white/[0.05] px-3 py-2">
          <p className="text-[11px] uppercase tracking-wider text-muted">Tiempo en estado</p>
          <p className="mt-1 text-sm font-semibold text-slate-50">{signal.ageLabel}</p>
        </div>
      </div>
      <div className="mt-3 rounded-2xl border border-border bg-white/[0.05] p-3">
        <p className="text-[11px] uppercase tracking-wider text-muted">Último evento Dropi</p>
        <p className="mt-1 text-sm font-semibold text-slate-50">{signal.displayStatus}</p>
        <p className="mt-1 text-xs text-muted">{formatDateTime(signal.latestEventAt)}</p>
      </div>
      <div className="mt-3 rounded-2xl border border-border bg-white/[0.05] p-3">
        <p className="text-sm font-semibold text-slate-50">{signal.suggestedAction.label}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{signal.suggestedAction.description}</p>
      </div>
    </div>
  );
}

function CustomerHistoryCard({ orders, total }: { orders: Order[]; total: number }) {
  const moreCount = Math.max(0, total - orders.length);
  const countLabel = `${total} ${total === 1 ? "pedido" : "pedidos"}`;

  return (
    <GlassCard className="p-5" hover={false} variant="panel">
      <div className="flex items-center justify-between gap-3">
        <SectionTitle icon={History} title="Historial del cliente" />
        <span className="shrink-0 rounded-full border border-border bg-white/[0.07] px-2.5 py-1 text-xs font-medium text-muted">
          {countLabel}
        </span>
      </div>

      {orders.length ? (
        <div className="mt-4 space-y-3">
          {orders.map((historyOrder) => (
            <Link
              key={historyOrder.id}
              href={`/ordenes/${historyOrder.id}`}
              className="block rounded-2xl border border-border bg-white/[0.052] p-3 transition hover:border-sky-400/30 hover:bg-white/[0.08]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`truncate text-sm font-semibold ${orderNumberClass(historyOrder)}`}>
                    {orderNumber(historyOrder)}
                  </p>
                  <p className="mt-1 text-xs text-muted">{formatDate(historyOrder.fecha)}</p>
                </div>
                <Badge kind="crmStatus" value={historyOrder.estado_crm} />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted">{historyOrder.ciudad || "Sin ciudad"}</span>
                <span className="font-semibold text-slate-50">
                  {formatMoney(historyOrder.total, historyOrder.pais)}
                </span>
              </div>
            </Link>
          ))}
          {moreCount > 0 ? (
            <p className="rounded-2xl border border-border bg-white/[0.045] px-3 py-2 text-sm text-muted">
              y {moreCount} más
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-border bg-white/[0.045] px-4 py-5 text-sm text-muted">
          Primer pedido de este cliente
        </p>
      )}
    </GlassCard>
  );
}

function RiskStat({ label, value }: { label: string; value: number }) {
  return (
    <GlassCard className="px-3 py-3 text-center" hover={false} variant="control">
      <p className="text-lg font-semibold text-slate-50">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </GlassCard>
  );
}
