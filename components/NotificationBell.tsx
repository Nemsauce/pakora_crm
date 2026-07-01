"use client";

import { EmptyState } from "@/components/EmptyState";
import { useCountry } from "@/components/CountryProvider";
import { supabase } from "@/lib/supabase";
import type { AppNotification } from "@/lib/types";
import { Bell, CheckCheck, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

function relativeTime(value?: string | null) {
  if (!value) return "Sin fecha";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Sin fecha";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  if (hours < 48) return "ayer";

  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export function NotificationBell() {
  const router = useRouter();
  const { concreteCountry } = useCountry();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);

    let listQuery = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    let countQuery = supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("leida", false);

    if (concreteCountry) {
      listQuery = listQuery.eq("pais", concreteCountry);
      countQuery = countQuery.eq("pais", concreteCountry);
    }

    const [listResult, countResult] = await Promise.all([listQuery, countQuery]);

    if (!listResult.error) {
      setNotifications((listResult.data ?? []) as AppNotification[]);
    }

    if (!countResult.error) {
      setUnreadCount(countResult.count ?? 0);
    }

    setLoading(false);
  }, [concreteCountry]);

  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel("notifications-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, loadNotifications)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  const unreadLabel = useMemo(() => {
    if (unreadCount > 99) return "99+";
    return String(unreadCount);
  }, [unreadCount]);

  async function handleOpenNotification(notification: AppNotification) {
    if (!notification.leida) {
      await supabase
        .from("notifications")
        .update({ leida: true })
        .eq("id", notification.id);
    }

    setOpen(false);
    if (notification.order_id) {
      router.push(`/ordenes/${notification.order_id}`);
    }
  }

  async function markAllRead() {
    setBusy(true);

    let query = supabase
      .from("notifications")
      .update({ leida: true })
      .eq("leida", false);

    if (concreteCountry) {
      query = query.eq("pais", concreteCountry);
    }

    await query;
    await loadNotifications();
    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-400/10 bg-white/[0.06] text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-primary/30 hover:text-slate-50"
        aria-label="Abrir notificaciones"
      >
        <Bell aria-hidden="true" className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full border border-[#020817] bg-danger px-1 text-[10px] font-bold text-white shadow-[0_0_16px_rgba(248,113,113,0.35)]">
            {unreadLabel}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Cerrar notificaciones"
            className="absolute inset-0 bg-[#020817]/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-[28rem] flex-col border-l border-slate-400/10 bg-[#0F172A]/95 shadow-[0_0_40px_rgba(2,8,23,0.45)] backdrop-blur-xl">
            <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-50">Notificaciones</h2>
                <p className="mt-1 text-xs text-muted">
                  {unreadCount ? `${unreadCount} sin leer` : "Todo al día"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={busy || unreadCount === 0}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-white/[0.06] px-3 text-xs font-medium text-muted transition hover:border-primary/30 hover:text-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCheck aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  Marcar todas
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white/[0.06] text-muted transition hover:border-primary/30 hover:text-slate-50"
                  aria-label="Cerrar"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-24 animate-pulse rounded-2xl border border-border bg-white/[0.05]"
                    />
                  ))}
                </div>
              ) : notifications.length ? (
                <div className="space-y-3">
                  {notifications.map((notification) => {
                    const unread = !notification.leida;

                    return (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => handleOpenNotification(notification)}
                        className={`w-full rounded-2xl border p-4 text-left transition hover:border-sky-400/30 ${
                          unread
                            ? "border-primary/20 bg-primary/[0.08]"
                            : "border-border bg-white/[0.045]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                              unread ? "bg-primary shadow-[0_0_14px_rgba(56,189,248,0.45)]" : "bg-slate-500/40"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="line-clamp-2 text-sm font-semibold text-slate-50">
                                {notification.titulo}
                              </p>
                              <span className="shrink-0 text-xs text-muted">
                                {relativeTime(notification.created_at)}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted">
                              {notification.mensaje}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={Bell}
                  title="Sin notificaciones"
                  message="Los cambios nuevos de estado Dropi aparecerán aquí."
                />
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
