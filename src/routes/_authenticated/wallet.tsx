import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getLedger, getMyDeposits, submitDeposit } from "@/lib/user.functions";
import { AppShell, useMe } from "@/components/AppShell";
import { ETB, TXN_LABEL, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — HFC Predict" },
      {
        name: "description",
        content: "Top up your demo balance, review held stakes and read your full transaction ledger.",
      },
      { property: "og:title", content: "Wallet — HFC Predict" },
      { property: "og:description", content: "Balance, deposits and transaction history." },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const fetchLedger = useServerFn(getLedger);
  const fetchDeposits = useServerFn(getMyDeposits);
  const deposit = useServerFn(submitDeposit);
  const ledger = useQuery({ queryKey: ["ledger"], queryFn: () => fetchLedger() });
  const deposits = useQuery({ queryKey: ["deposits"], queryFn: () => fetchDeposits() });
  const [amount, setAmount] = useState("500");
  const [sms, setSms] = useState("");
  const [busy, setBusy] = useState(false);

  const onDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await deposit({ data: { amount: Number(amount), smsText: sms } });
      toast.success("Deposit submitted for review");
      setSms("");
      await qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <h1 className="text-3xl leading-none">WALLET</h1>

      <div className="surface animate-rise mt-4 grid grid-cols-2 divide-x divide-border p-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Available</p>
          <p className="tabular text-xl font-bold text-gold">{ETB(me?.wallet.available_balance)}</p>
        </div>
        <div className="pl-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Held in bets</p>
          <p className="tabular text-xl font-bold">{ETB(me?.wallet.held_balance)}</p>
        </div>
      </div>

      <form onSubmit={onDeposit} className="surface mt-5 space-y-3 p-4">
        <h2 className="text-xl leading-none">DEPOSIT</h2>
        <p className="text-xs text-muted-foreground">
          Submit the amount and paste your transfer confirmation message. An admin reviews it before
          your balance is credited.
        </p>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
          className="tabular w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <textarea
          required
          minLength={15}
          value={sms}
          onChange={(e) => setSms(e.target.value)}
          placeholder="Paste the transfer confirmation SMS here"
          className="h-24 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          disabled={busy}
          className="w-full rounded-lg bg-primary py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit deposit"}
        </button>
      </form>

      {!!deposits.data?.deposits.length && (
        <section className="surface mt-5 p-4">
          <h2 className="mb-3 text-xl leading-none">DEPOSIT REQUESTS</h2>
          <ul className="space-y-2 text-sm">
            {deposits.data.deposits.map((d) => (
              <li key={d.id} className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-muted-foreground">{shortDate(d.submitted_at)}</span>
                <span className="tabular">{ETB(d.amount)}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {d.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="surface mt-5 p-4">
        <h2 className="mb-3 text-xl leading-none">LEDGER</h2>
        {!ledger.data?.length && <p className="text-sm text-muted-foreground">No transactions yet.</p>}
        <ul className="space-y-2 text-sm">
          {ledger.data?.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
              <span className="min-w-0">
                <span className="block truncate">{TXN_LABEL[t.type] ?? t.type}</span>
                <span className="text-[11px] text-muted-foreground">{shortDate(t.created_at)}</span>
              </span>
              <span className="tabular shrink-0 font-semibold">{ETB(t.amount)}</span>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
