import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Swords, Ticket, Wallet2 } from "lucide-react";
import { getMe } from "@/lib/user.functions";
import { useSession } from "@/hooks/useSession";
import { ETB } from "@/lib/format";
import { cn } from "@/lib/utils";

export function useMe() {
  const { session } = useSession();
  const fetchMe = useServerFn(getMe);
  return useQuery({
    queryKey: ["me", session?.user.id ?? "anon"],
    queryFn: () => fetchMe(),
    enabled: !!session,
    staleTime: 5_000,
  });
}

const NAV = [
  { to: "/", label: "Fights", icon: Swords },
  { to: "/bets", label: "My bets", icon: Ticket },
  { to: "/wallet", label: "Wallet", icon: Wallet2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const { data: me } = useMe();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Swords className="size-4" />
            </span>
            <span className="font-display text-2xl leading-none tracking-wide">HFC PREDICT</span>
          </Link>

          {session ? (
            <Link
              to="/wallet"
              className="surface-elevated px-3 py-1.5 text-right leading-tight transition-colors hover:border-primary/60"
            >
              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
                Balance
              </span>
              <span className="tabular text-sm font-semibold text-gold">
                {ETB(me?.wallet.available_balance)}
              </span>
            </Link>
          ) : (
            <span className="text-[11px] text-muted-foreground">Open in Telegram</span>
          )}
        </div>
        <div className="border-t border-border/60 bg-elevated/60 px-4 py-1 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Demo mode — no real money is accepted or paid out
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-stretch">
          {NAV.map(
            (item) => {
              const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <item.icon className="size-5" />
                  {item.label}
                </Link>
              );
            },
          )}
        </div>
      </nav>
    </div>
  );
}
