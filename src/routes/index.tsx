import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Flame, ChevronRight } from "lucide-react";
import { getEvents } from "@/lib/public.functions";
import { AppShell } from "@/components/AppShell";
import { shortDate, FIGHT_STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: () => getEvents(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HFC Predict — Combat Sports Predictions & Fight Cards" },
      {
        name: "description",
        content:
          "Browse upcoming combat-sports fight cards, follow live odds on winners, method of victory and round markets, and track your predictions in one place.",
      },
      { property: "og:title", content: "HFC Predict — Combat Sports Predictions" },
      {
        property: "og:description",
        content: "Upcoming fight cards, live odds and a clear prediction history. Demo mode.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(eventsQuery),
  component: Home,
  errorComponent: ({ error }) => (
    <AppShell>
      <p className="surface p-4 text-sm text-muted-foreground">{error.message}</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="surface p-4 text-sm text-muted-foreground">Nothing here.</p>
    </AppShell>
  ),
});

function Home() {
  const { data: events } = useSuspenseQuery(eventsQuery);

  return (
    <AppShell>
      <section className="hero-gradient surface animate-rise mb-6 overflow-hidden p-5">
        <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Fight card predictions</p>
        <h1 className="mt-2 text-4xl leading-none">
          READ THE FIGHT.
          <br />
          BACK YOUR CALL.
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          Winner, method of victory and round markets on every bout, with your odds locked in the
          moment you place a prediction.
        </p>
      </section>

      {events.length === 0 && (
        <p className="surface p-5 text-sm text-muted-foreground">
          No published events yet. Check back soon.
        </p>
      )}

      <div className="space-y-8">
        {events.map((event) => (
          <section key={event.id}>
            <div className="mb-3">
              <h2 className="text-2xl leading-none">{event.name}</h2>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" /> {shortDate(event.starts_at)}
                </span>
                {event.venue && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> {event.venue}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {event.fights.map((fight) => (
                <Link
                  key={fight.id}
                  to="/fight/$fightId"
                  params={{ fightId: fight.id }}
                  className="surface animate-rise block p-4 transition-all hover:border-primary/50 hover:shadow-[var(--shadow-glow)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {fight.is_main_event && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold">
                          <Flame className="size-3" /> Main event
                        </span>
                      )}
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {fight.weight_class?.name} · {fight.scheduled_rounds} rounds
                      </span>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        fight.status === "open"
                          ? "bg-success/15 text-success"
                          : fight.status === "settled"
                            ? "bg-muted text-muted-foreground"
                            : "bg-warning/15 text-warning",
                      )}
                    >
                      {FIGHT_STATUS_LABEL[fight.status]}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-xl leading-tight">
                        {fight.fighter_a?.full_name}
                      </p>
                      <p className="tabular text-xs text-muted-foreground">
                        {fight.fighter_a?.record_w}-{fight.fighter_a?.record_l}-
                        {fight.fighter_a?.record_d}
                      </p>
                    </div>
                    <span className="font-display text-sm text-primary">VS</span>
                    <div className="min-w-0 flex-1 text-right">
                      <p className="truncate font-display text-xl leading-tight">
                        {fight.fighter_b?.full_name}
                      </p>
                      <p className="tabular text-xs text-muted-foreground">
                        {fight.fighter_b?.record_w}-{fight.fighter_b?.record_l}-
                        {fight.fighter_b?.record_d}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    <span>{shortDate(fight.starts_at)}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      View markets <ChevronRight className="size-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
