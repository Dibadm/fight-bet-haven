import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Lock } from "lucide-react";
import { getFightDetail } from "@/lib/public.functions";
import { placeBet } from "@/lib/user.functions";
import { AppShell, useMe } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { ETB, odds as fmtOdds, shortDate, FIGHT_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const fightQuery = (fightId: string) =>
  queryOptions({
    queryKey: ["fight", fightId],
    queryFn: () => getFightDetail({ data: { fightId } }),
  });

export const Route = createFileRoute("/fight/$fightId")({
  head: () => ({
    meta: [
      { title: "Fight markets — HFC Predict" },
      {
        name: "description",
        content:
          "Fighter details, winner odds, method of victory and round markets for this bout, with server-locked odds on every prediction.",
      },
      { property: "og:title", content: "Fight markets — HFC Predict" },
      {
        property: "og:description",
        content: "Winner, method of victory and round markets for this bout.",
      },
    ],
  }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(fightQuery(params.fightId)),
  component: FightPage,
  errorComponent: ({ error }) => (
    <AppShell>
      <p className="surface p-4 text-sm text-muted-foreground">{error.message}</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="surface p-4 text-sm text-muted-foreground">Fight not found.</p>
    </AppShell>
  ),
});

type Pick = { id: string; label: string; odds: number; market: string };

function FightPage() {
  const { fightId } = Route.useParams();
  const { data: fight } = useSuspenseQuery(fightQuery(fightId));
  const { session } = useSession();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const submit = useServerFn(placeBet);
  const [pick, setPick] = useState<Pick | null>(null);
  const [stake, setStake] = useState("100");
  const [busy, setBusy] = useState(false);

  if (!fight) {
    return (
      <AppShell>
        <p className="surface p-4 text-sm text-muted-foreground">Fight not found.</p>
      </AppShell>
    );
  }

  const stakeNum = Number(stake) || 0;
  const bettingOpen = fight.status === "open";

  const onPlace = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      await submit({
        data: {
          selectionId: pick.id,
          stake: stakeNum,
          idempotencyKey: `${pick.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      });
      toast.success("Prediction placed", {
        description: `${pick.label} · stake ${ETB(stakeNum)}`,
      });
      setPick(null);
      await qc.invalidateQueries();
    } catch (e) {
      toast.error("Could not place prediction", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <ArrowLeft className="size-3.5" /> All fights
      </Link>

      <section className="hero-gradient surface animate-rise p-5">
        <p className="text-[11px] uppercase tracking-[0.25em] text-primary">{fight.event?.name}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-2xl leading-tight">{fight.fighter_a?.full_name}</p>
            <p className="text-xs text-muted-foreground">{fight.fighter_a?.nickname}</p>
          </div>
          <span className="font-display text-lg text-primary">VS</span>
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate font-display text-2xl leading-tight">{fight.fighter_b?.full_name}</p>
            <p className="text-xs text-muted-foreground">{fight.fighter_b?.nickname}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span>{shortDate(fight.starts_at)}</span>
          <span>{fight.weight_class?.name}</span>
          <span>{fight.scheduled_rounds} rounds</span>
          <span className="font-semibold text-foreground">{FIGHT_STATUS_LABEL[fight.status]}</span>
        </div>
      </section>

      {fight.fight_results && (
        <p className="surface mt-4 p-4 text-sm">
          <span className="text-muted-foreground">Official result: </span>
          {fight.fight_results.outcome.replace("_", " ")} ·{" "}
          {fight.fight_results.method.replace("_", "/")}
          {fight.fight_results.ending_round ? ` · R${fight.fight_results.ending_round}` : ""}
        </p>
      )}

      <div className="mt-6 space-y-5">
        {fight.markets.map((market) => (
          <section key={market.id} className="surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl leading-none">{market.name}</h2>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  market.status === "open"
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {market.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {market.selections.map((sel) => {
                const disabled = !bettingOpen || market.status !== "open" || sel.status !== "active";
                const selected = pick?.id === sel.id;
                return (
                  <button
                    key={sel.id}
                    disabled={disabled}
                    onClick={() => setPick({ id: sel.id, label: sel.label, odds: Number(sel.odds), market: market.name })}
                    className={cn(
                      "surface-elevated flex items-center justify-between gap-2 p-3 text-left transition-all",
                      selected && "border-primary shadow-[var(--shadow-glow)]",
                      disabled ? "opacity-45" : "hover:border-primary/60",
                    )}
                  >
                    <span className="text-xs font-medium leading-tight">{sel.label}</span>
                    <span className="odds-chip shrink-0 text-base font-bold text-gold">
                      {disabled ? <Lock className="size-3.5" /> : fmtOdds(sel.odds)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {pick && (
        <div className="fixed inset-x-0 bottom-[68px] z-40 px-3">
          <div className="surface animate-rise mx-auto max-w-2xl p-4 shadow-[var(--shadow-float)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {pick.market}
                </p>
                <p className="text-sm font-semibold">{pick.label}</p>
              </div>
              <span className="odds-chip text-lg font-bold text-gold">{fmtOdds(pick.odds)}</span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                inputMode="decimal"
                value={stake}
                onChange={(e) => setStake(e.target.value.replace(/[^\d.]/g, ""))}
                className="tabular w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <div className="flex-1 text-right text-xs text-muted-foreground">
                Potential payout
                <span className="tabular block text-base font-bold text-foreground">
                  {ETB(stakeNum * pick.odds)}
                </span>
              </div>
            </div>

            {session ? (
              <button
                disabled={busy || stakeNum <= 0}
                onClick={onPlace}
                className="mt-3 w-full rounded-lg bg-primary py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Placing…" : "Confirm prediction"}
              </button>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Open this fight card inside Telegram to place a prediction.
              </div>
            )}
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Available: {ETB(me?.wallet.available_balance)} · odds are locked when you confirm
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
