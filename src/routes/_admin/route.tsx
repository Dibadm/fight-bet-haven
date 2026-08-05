import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getMe } from "@/lib/user.functions";
import { adminOverview } from "@/lib/admin.functions";
import { ETB, shortDate } from "@/lib/format";
import { LayoutDashboard, Swords, Wallet, ScrollText, Settings, ArrowLeft, Wallet2, TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  loader: async ({ context }) => {
    const fetchMe = useServerFn(getMe);
    const data = await fetchMe();
    if (!data?.isAdmin) throw redirect({ to: "/" });
    return { me: data };
  },
  component: AdminPage,
});

const NAV = [
  { to: "/_admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/_admin/fights", label: "Fights", icon: Swords },
  { to: "/_admin/financials", label: "Financials", icon: Wallet },
  { to: "/_admin/settlements", label: "Settlements", icon: ScrollText },
  { to: "/_admin/audit", label: "Audit", icon: Settings },
];

function AdminPage() {
  const { me } = Route.useLoaderData();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isIndex = path === "/_admin";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="font-display text-xl leading-none tracking-wide">ADMIN</h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {me.roles?.includes("super_admin") ? "Super Admin" : "Admin"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium">{me.profile?.full_name ?? "Admin"}</p>
            <p className="text-[10px] text-muted-foreground">{me.roles?.join(", ")}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl">
        <nav className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-52 flex-col border-r border-border bg-background/95 py-4 md:flex">
          {NAV.map((item) => {
            const active = item.end ? path === item.to : path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "mx-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 p-4 md:p-6">
          {isIndex ? <AdminDashboard /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const fetchOverview = useServerFn(adminOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="surface h-32 animate-pulse" />
        <div className="surface h-64 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return <p className="surface p-4 text-sm text-destructive">{error.message}</p>;
  }

  const risk = data?.risk ?? {};
  const deposits = data?.deposits ?? [];
  const withdrawals = data?.withdrawals ?? [];
  const transactions = data?.transactions ?? [];

  const pendingDeposits = deposits.filter((d: any) => d.status === "pending");
  const pendingWithdrawals = withdrawals.filter((w: any) => w.status === "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl leading-none">DASHBOARD</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live risk, pending actions, and recent activity.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Staked</p>
          <p className="tabular mt-1 text-xl font-bold">{ETB(risk.total_staked ?? 0)}</p>
        </Card>
        <Card className="surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Potential Payout</p>
          <p className="tabular mt-1 text-xl font-bold">{ETB(risk.potential_payout ?? 0)}</p>
        </Card>
        <Card className="surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Exposure</p>
          <p className="tabular mt-1 text-xl font-bold text-warning">{ETB(risk.exposure ?? 0)}</p>
        </Card>
        <Card className="surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Net Position</p>
          <p className={`tabular mt-1 text-xl font-bold ${(risk.net_position ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
            {ETB(risk.net_position ?? 0)}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:grid-cols-none md:flex">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pending" className="gap-1">
            Pending
            {(pendingDeposits.length + pendingWithdrawals.length) > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                {pendingDeposits.length + pendingWithdrawals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="surface p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Wallet2 className="size-4" /> Pending Deposits
              </div>
              <p className="mt-2 text-2xl font-bold">{pendingDeposits.length}</p>
              <p className="text-xs text-muted-foreground">{ETB(pendingDeposits.reduce((s: number, d: any) => s + Number(d.amount), 0))} awaiting review</p>
            </Card>
            <Card className="surface p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="size-4" /> Pending Withdrawals
              </div>
              <p className="mt-2 text-2xl font-bold">{pendingWithdrawals.length}</p>
              <p className="text-xs text-muted-foreground">{ETB(pendingWithdrawals.reduce((s: number, w: any) => s + Number(w.amount), 0))} awaiting review</p>
            </Card>
          </div>

          <Card className="surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="size-4" /> Liabilities by Selection
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {(risk.liability_by_selection ?? []).slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between border-b border-border/50 pb-2 text-sm last:border-0">
                  <span className="truncate">{item.label ?? item.selection_id}</span>
                  <span className="tabular font-semibold text-warning">{ETB(item.liability)}</span>
                </div>
              ))}
              {!(risk.liability_by_selection ?? []).length && (
                <p className="text-xs text-muted-foreground">No open liabilities.</p>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-4 space-y-4">
          <Card className="surface p-4">
            <h3 className="text-lg font-semibold">Pending Deposits</h3>
            <div className="mt-3 space-y-2">
              {pendingDeposits.length === 0 && <p className="text-sm text-muted-foreground">No pending deposits.</p>}
              {pendingDeposits.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between border-b border-border/50 pb-2">
                  <div>
                    <p className="text-sm font-medium">{ETB(d.amount)}</p>
                    <p className="text-[11px] text-muted-foreground">{shortDate(d.submitted_at)}</p>
                  </div>
                  <Link to="/_admin/financials">
                    <Button size="sm">Review</Button>
                  </Link>
                </div>
              ))}
            </div>
          </Card>

          <Card className="surface p-4">
            <h3 className="text-lg font-semibold">Pending Withdrawals</h3>
            <div className="mt-3 space-y-2">
              {pendingWithdrawals.length === 0 && <p className="text-sm text-muted-foreground">No pending withdrawals.</p>}
              {pendingWithdrawals.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between border-b border-border/50 pb-2">
                  <div>
                    <p className="text-sm font-medium">{ETB(w.amount)}</p>
                    <p className="text-[11px] text-muted-foreground">{shortDate(w.requested_at)}</p>
                  </div>
                  <Link to="/_admin/financials">
                    <Button size="sm">Review</Button>
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card className="surface p-4">
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
            <div className="mt-3 space-y-2">
              {transactions.length === 0 && <p className="text-sm text-muted-foreground">No recent transactions.</p>}
              {transactions.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between border-b border-border/50 pb-2">
                  <div>
                    <p className="text-sm font-medium">{t.type}</p>
                    <p className="text-[11px] text-muted-foreground">{shortDate(t.created_at)}</p>
                  </div>
                  <span className="tabular font-semibold">{ETB(t.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
