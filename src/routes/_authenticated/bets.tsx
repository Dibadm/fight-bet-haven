import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyBets } from "@/lib/user.functions";
import { AppShell } from "@/components/AppShell";
import { ETB, odds, shortDate, BET_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/bets")({
  head: () => ({
    meta: [
      { title: "My predictions — HFC Predict" },
      {
        name: "description",
        content: "Every prediction you have placed, with locked odds, stake, potential payout and settlement status.",
      },
      { property: "og:title", content: "My predictions — HFC Predict" },
      { property: "og:description", content: "Locked odds, stakes and settlement status." },
    ],
  }),
  component: BetsPage,
});

function BetsPage() {
  const fetchBets = useServerFn(getMyBets);
  const { data, isLoading } = useQuery({ queryKey: ["my-bets"], queryFn: () => fetchBets() });

  return (
    <AppShell>
      <h1 className="text-3xl leading-none">MY PREDICTIONS</h1>
      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && !data?.length && (
        <p className="surface mt-4 p-4 text-sm text-muted-foreground">
          No predictions yet — pick a fight to get started.
        </p>
      )}
      <div className="mt-4 space-y-3">
        {data?.map((bet) => (
          <div key={bet.id} className="surface animate-rise p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{bet.selection?.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {bet.market?.name} · {shortDate(bet.placed_at)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  bet.status === "won"
                    ? "bg-success/15 text-success"
                    : bet.status === "lost"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-warning/15 text-warning",
                )}
              >
                {BET_STATUS_LABEL[bet.status] ?? bet.status}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-xs">
              <span>
                <span className="block text-muted-foreground">Stake</span>
                <span className="tabular font-semibold">{ETB(bet.stake)}</span>
              </span>
              <span>
                <span className="block text-muted-foreground">Odds</span>
                <span className="odds-chip font-semibold text-gold">{odds(bet.odds_snapshot)}</span>
              </span>
              <span className="text-right">
                <span className="block text-muted-foreground">Payout</span>
                <span className="tabular font-semibold">{ETB(bet.potential_payout)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
