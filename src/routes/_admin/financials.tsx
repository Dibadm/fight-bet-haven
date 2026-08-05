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
import { Wallet, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

export const Route = createFileRoute("/_admin/financials")({
  head: () => ({ meta: [{ title: "Financials — Admin" }] }),
  component: AdminFinancials,
});

function AdminFinancials() {
  const fetchOverview = useServerFn(adminOverview);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-overview"], queryFn: () => fetchOverview() });
  const qc = useQueryClient();
  const [tab, setTab] = useState("deposits");

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-overview"] });
    await refetch();
  };

  const review = async (id: string, type: "deposit" | "withdrawal", approve: boolean) => {
    try {
      if (type === "deposit") {
        const { reviewDeposit } = await import("@/lib/admin.functions");
        const fn = useServerFn(reviewDeposit);
        await fn({ data: { depositId: id, approve } });
      } else {
        const { reviewWithdrawal } = await import("@/lib/admin.functions");
        const fn = useServerFn(reviewWithdrawal);
        await fn({ data: { withdrawalId: id, decision: approve ? "approve" : "reject" } });
      }
      toast.success(approve ? "Approved" : "Rejected");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const markWithdrawalPaid = async (id: string) => {
    try {
      const { reviewWithdrawal } = await import("@/lib/admin.functions");
      const fn = useServerFn(reviewWithdrawal);
      await fn({ data: { withdrawalId: id, decision: "paid" } });
      toast.success("Marked as paid");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const deposits = data?.deposits ?? [];
  const withdrawals = data?.withdrawals ?? [];
  const transactions = data?.transactions ?? [];

  const depositStatusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      approved: "default",
      rejected: "destructive",
    };
    return <Badge variant={map[status] ?? "secondary"}>{status}</Badge>;
  };

  const withdrawalStatusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      approved: "default",
      rejected: "destructive",
      paid: "default",
    };
    return <Badge variant={map[status] ?? "secondary"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl leading-none">FINANCIALS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Deposits, withdrawals, and ledger.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pending Deposits</p>
          <p className="mt-1 text-xl font-bold">{deposits.filter((d: any) => d.status === "pending").length}</p>
        </Card>
        <Card className="surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pending Withdrawals</p>
          <p className="mt-1 text-xl font-bold">{withdrawals.filter((w: any) => w.status === "pending").length}</p>
        </Card>
        <Card className="surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Deposited</p>
          <p className="tabular mt-1 text-xl font-bold">{ETB(deposits.filter((d: any) => d.status === "approved").reduce((s: number, d: any) => s + Number(d.amount), 0))}</p>
        </Card>
        <Card className="surface p-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Withdrawn</p>
          <p className="tabular mt-1 text-xl font-bold">{ETB(withdrawals.filter((w: any) => w.status === "paid").reduce((s: number, w: any) => s + Number(w.amount), 0))}</p>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:grid-cols-none md:flex">
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="deposits" className="mt-4">
          <Card className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">SMS</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No deposits.</td></tr>
                  )}
                  {deposits.map((d: any) => (
                    <tr key={d.id} className="border-b border-border/50">
                      <td className="px-4 py-3 text-xs">{d.user_id}</td>
                      <td className="px-4 py-3 tabular font-semibold">{ETB(d.amount)}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground">{d.sms_text}</td>
                      <td className="px-4 py-3 text-xs">{shortDate(d.submitted_at)}</td>
                      <td className="px-4 py-3">{depositStatusBadge(d.status)}</td>
                      <td className="px-4 py-3">
                        {d.status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => review(d.id, "deposit", true)}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => review(d.id, "deposit", false)}>Reject</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-4">
          <Card className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Requested</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No withdrawals.</td></tr>
                  )}
                  {withdrawals.map((w: any) => (
                    <tr key={w.id} className="border-b border-border/50">
                      <td className="px-4 py-3 text-xs">{w.user_id}</td>
                      <td className="px-4 py-3 tabular font-semibold">{ETB(w.amount)}</td>
                      <td className="px-4 py-3 text-xs">{w.payout_method}</td>
                      <td className="px-4 py-3 text-xs">{shortDate(w.requested_at)}</td>
                      <td className="px-4 py-3">{withdrawalStatusBadge(w.status)}</td>
                      <td className="px-4 py-3">
                        {w.status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => review(w.id, "withdrawal", true)}>Approve</Button>
                            <Button size="sm" variant="destructive" onClick={() => review(w.id, "withdrawal", false)}>Reject</Button>
                          </div>
                        )}
                        {w.status === "approved" && (
                          <Button size="sm" onClick={() => markWithdrawalPaid(w.id)}>Mark Paid</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <Card className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Balance After</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No transactions.</td></tr>
                  )}
                  {transactions.map((t: any) => (
                    <tr key={t.id} className="border-b border-border/50">
                      <td className="px-4 py-3 text-xs">{t.type}</td>
                      <td className="px-4 py-3 tabular font-semibold">{ETB(t.amount)}</td>
                      <td className="px-4 py-3 tabular text-xs">{ETB(t.balance_after)}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground">{t.notes}</td>
                      <td className="px-4 py-3 text-xs">{shortDate(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
