import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { adminOverview } from "@/lib/admin.functions";
import { AppShell } from "@/components/AppShell";
import { ETB, shortDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollText, Wallet, TrendingUp, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_admin")({
  head: () => ({
    meta: [{ title: "Admin Dashboard — HFC Predict" }],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const fetchOverview = useServerFn(adminOverview);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
  });
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                <Wallet className="size-4" /> Pending Deposits
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
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => reviewItem(d.id, "deposit", true)}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => reviewItem(d.id, "deposit", false)}>Reject</Button>
                  </div>
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
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => reviewItem(w.id, "withdrawal", true)}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => reviewItem(w.id, "withdrawal", false)}>Reject</Button>
                  </div>
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
