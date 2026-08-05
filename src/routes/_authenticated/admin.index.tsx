import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminAuditLogs,
  adminOverview,
  adminAdjustBalance,
  reviewDeposit,
  reviewWithdrawal,
} from "@/lib/admin.functions";
import { Btn, Field, Panel, Pill, TextInput, statusTone } from "@/components/admin/AdminUI";
import { useAdminAccess } from "./admin";
import { ETB, TXN_LABEL, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin overview — HFC Predict" },
      {
        name: "description",
        content: "Risk exposure, pending deposits and withdrawals, ledger activity and audit trail.",
      },
      { property: "og:title", content: "Admin overview — HFC Predict" },
      { property: "og:description", content: "Platform risk, money queues and audit trail." },
    ],
  }),
  component: AdminOverview,
});

type Risk = {
  totals: { open_bets: number; total_wagered: number; open_stakes: number; open_liability: number };
  money: { total_deposits: number; total_withdrawals: number; user_available: number; user_held: number };
  pending: { deposits: number; withdrawals: number };
  by_fight: Array<{ fight_id: string; event_name: string; fighter_a: string; fighter_b: string; status: string; stakes: number; liability: number; bet_count: number }>;
};

function AdminOverview() {
  const qc = useQueryClient();
  const { data: access } = useAdminAccess();
  const fetchOverview = useServerFn(adminOverview);
  const fetchLogs = useServerFn(adminAuditLogs);
  const decideDeposit = useServerFn(reviewDeposit);
  const decideWithdrawal = useServerFn(reviewWithdrawal);
  const adjust = useServerFn(adminAdjustBalance);

  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => fetchOverview() });
  const logs = useQuery({ queryKey: ["admin-logs"], queryFn: () => fetchLogs() });
  const [busy, setBusy] = useState<string | null>(null);
  const [adj, setAdj] = useState({ userId: "", amount: "", reason: "" });

  const risk = overview.data?.risk as Risk | undefined;

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Panel title="Exposure" subtitle="Live risk across all open predictions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Open bets", risk?.totals.open_bets ?? 0],
            ["Open stakes", ETB(risk?.totals.open_stakes)],
            ["Liability", ETB(risk?.totals.open_liability)],
            ["Total wagered", ETB(risk?.totals.total_wagered)],
            ["User available", ETB(risk?.money.user_available)],
            ["User held", ETB(risk?.money.user_held)],
            ["Pending deposits", risk?.pending.deposits ?? 0],
            ["Pending withdrawals", risk?.pending.withdrawals ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-md border border-border bg-secondary/30 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="tabular mt-1 text-sm font-bold">{value}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Fight exposure" subtitle="Stakes and liability per bout">
        <div className="space-y-2">
          {(risk?.by_fight ?? []).slice(0, 8).map((f) => (
            <div key={f.fight_id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {f.fighter_a} vs {f.fighter_b}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {f.event_name} · <Pill tone={statusTone(f.status)}>{f.status}</Pill>
                </p>
              </div>
              <div className="text-right">
                <p className="tabular text-xs">{ETB(f.stakes)} staked</p>
                <p className="tabular text-xs text-gold">{ETB(f.liability)} liability</p>
              </div>
            </div>
          ))}
          {!risk?.by_fight.length ? (
            <p className="text-sm text-muted-foreground">No bets placed yet.</p>
          ) : null}
        </div>
      </Panel>

      <Panel title="Deposits" subtitle="Telebirr confirmations awaiting review">
        <div className="space-y-2">
          {(overview.data?.deposits ?? []).map((d) => (
            <div key={d.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="tabular text-sm font-semibold">{ETB(d.amount)}</p>
                <Pill tone={statusTone(d.status)}>{d.status}</Pill>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{d.sms_text}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{shortDate(d.submitted_at)}</p>
              {d.status === "pending" ? (
                <div className="mt-2 flex gap-2">
                  <Btn
                    disabled={busy === d.id}
                    onClick={() =>
                      run(d.id, () => decideDeposit({ data: { depositId: d.id, approve: true } }), "Deposit approved")
                    }
                  >
                    Approve
                  </Btn>
                  <Btn
                    variant="danger"
                    disabled={busy === d.id}
                    onClick={() =>
                      run(
                        d.id,
                        () =>
                          decideDeposit({
                            data: { depositId: d.id, approve: false, reason: "Could not verify payment" },
                          }),
                        "Deposit rejected",
                      )
                    }
                  >
                    Reject
                  </Btn>
                </div>
              ) : null}
            </div>
          ))}
          {!overview.data?.deposits.length ? (
            <p className="text-sm text-muted-foreground">No deposits yet.</p>
          ) : null}
        </div>
      </Panel>

      <Panel title="Withdrawals" subtitle="Approve, reject or mark as paid out">
        <div className="space-y-2">
          {(overview.data?.withdrawals ?? []).map((w) => (
            <div key={w.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="tabular text-sm font-semibold">{ETB(w.amount)}</p>
                <Pill tone={statusTone(w.status)}>{w.status}</Pill>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {w.payout_method} · {shortDate(w.requested_at)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {w.status === "pending" ? (
                  <Btn
                    disabled={busy === w.id}
                    onClick={() =>
                      run(w.id, () => decideWithdrawal({ data: { withdrawalId: w.id, decision: "approve" } }), "Approved")
                    }
                  >
                    Approve
                  </Btn>
                ) : null}
                {w.status === "approved" ? (
                  <Btn
                    disabled={busy === w.id}
                    onClick={() =>
                      run(w.id, () => decideWithdrawal({ data: { withdrawalId: w.id, decision: "paid" } }), "Marked paid")
                    }
                  >
                    Mark paid
                  </Btn>
                ) : null}
                {w.status === "pending" || w.status === "approved" ? (
                  <Btn
                    variant="danger"
                    disabled={busy === w.id}
                    onClick={() =>
                      run(
                        w.id,
                        () =>
                          decideWithdrawal({
                            data: { withdrawalId: w.id, decision: "reject", reason: "Rejected by admin" },
                          }),
                        "Rejected",
                      )
                    }
                  >
                    Reject
                  </Btn>
                ) : null}
              </div>
            </div>
          ))}
          {!overview.data?.withdrawals.length ? (
            <p className="text-sm text-muted-foreground">No withdrawal requests.</p>
          ) : null}
        </div>
      </Panel>

      {access?.isSuperAdmin ? (
        <Panel title="Balance adjustment" subtitle="Super admin only — every adjustment is logged">
          <form
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                "adjust",
                () =>
                  adjust({
                    data: { userId: adj.userId, amount: Number(adj.amount), reason: adj.reason },
                  }),
                "Balance adjusted",
              ).then(() => setAdj({ userId: "", amount: "", reason: "" }));
            }}
          >
            <Field label="User id">
              <TextInput
                required
                value={adj.userId}
                onChange={(e) => setAdj({ ...adj, userId: e.target.value })}
                placeholder="uuid"
              />
            </Field>
            <Field label="Amount (ETB)">
              <TextInput
                required
                type="number"
                step="0.01"
                value={adj.amount}
                onChange={(e) => setAdj({ ...adj, amount: e.target.value })}
              />
            </Field>
            <Field label="Reason">
              <TextInput
                required
                minLength={5}
                value={adj.reason}
                onChange={(e) => setAdj({ ...adj, reason: e.target.value })}
              />
            </Field>
            <Btn className="sm:col-span-3" disabled={busy === "adjust"} type="submit">
              Apply adjustment
            </Btn>
          </form>
        </Panel>
      ) : null}

      <Panel title="Ledger activity" subtitle="Most recent wallet movements">
        <div className="space-y-1.5">
          {(overview.data?.transactions ?? []).map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-muted-foreground">
                {TXN_LABEL[t.type] ?? t.type} · {shortDate(t.created_at)}
              </span>
              <span className="tabular font-semibold">{ETB(t.amount)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Audit trail" subtitle="Every privileged action, newest first">
        <div className="space-y-1.5">
          {(logs.data ?? []).map((l) => (
            <div key={l.id} className="text-xs">
              <span className="font-semibold">{l.action}</span>{" "}
              <span className="text-muted-foreground">
                {l.entity_type} · {shortDate(l.created_at)}
                {l.reason ? ` · ${l.reason}` : ""}
              </span>
            </div>
          ))}
          {!logs.data?.length ? <p className="text-sm text-muted-foreground">No actions logged.</p> : null}
        </div>
      </Panel>
    </>
  );
}
