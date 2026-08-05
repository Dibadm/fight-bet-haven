import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { adminCatalog, adminFights, upsertEvent, upsertFight, upsertFighter } from "@/lib/admin.functions";
import { Btn, Field, Panel, Pill, Select, TextInput, statusTone } from "@/components/admin/AdminUI";
import { FIGHT_STATUS_LABEL, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/events")({
  head: () => ({
    meta: [
      { title: "Events & fights — HFC Predict admin" },
      {
        name: "description",
        content: "Create and edit events, fighters and bouts, and control each fight's betting status.",
      },
      { property: "og:title", content: "Events & fights — HFC Predict admin" },
      { property: "og:description", content: "Event, fighter and bout management." },
    ],
  }),
  component: AdminEvents,
});

const toLocalInput = (iso?: string) =>
  iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

function AdminEvents() {
  const qc = useQueryClient();
  const fetchCatalog = useServerFn(adminCatalog);
  const fetchFights = useServerFn(adminFights);
  const saveEvent = useServerFn(upsertEvent);
  const saveFighter = useServerFn(upsertFighter);
  const saveFight = useServerFn(upsertFight);

  const catalog = useQuery({ queryKey: ["admin-catalog"], queryFn: () => fetchCatalog() });
  const fights = useQuery({ queryKey: ["admin-fights"], queryFn: () => fetchFights() });
  const [busy, setBusy] = useState(false);

  const [ev, setEv] = useState({
    id: "",
    name: "",
    promotion: "",
    venue: "",
    country: "",
    startsAt: "",
    status: "draft" as "draft" | "published" | "cancelled",
  });
  const [fighter, setFighter] = useState({ id: "", fullName: "", nickname: "", nationality: "", w: "0", l: "0", d: "0" });
  const [fight, setFight] = useState({
    id: "",
    eventId: "",
    fighterAId: "",
    fighterBId: "",
    weightClassId: "",
    scheduledRounds: "3",
    startsAt: "",
    isMainEvent: false,
    boutOrder: "1",
    status: "upcoming",
  });

  const run = async (fn: () => Promise<unknown>, ok: string, after?: () => void) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      after?.();
      await qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Panel title={ev.id ? "Edit event" : "New event"}>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                saveEvent({
                  data: {
                    ...(ev.id ? { id: ev.id } : {}),
                    name: ev.name,
                    promotion: ev.promotion || undefined,
                    venue: ev.venue || undefined,
                    country: ev.country || undefined,
                    startsAt: ev.startsAt,
                    status: ev.status,
                  },
                }),
              "Event saved",
              () => setEv({ id: "", name: "", promotion: "", venue: "", country: "", startsAt: "", status: "draft" }),
            );
          }}
        >
          <Field label="Name">
            <TextInput required value={ev.name} onChange={(e) => setEv({ ...ev, name: e.target.value })} />
          </Field>
          <Field label="Promotion">
            <TextInput value={ev.promotion} onChange={(e) => setEv({ ...ev, promotion: e.target.value })} />
          </Field>
          <Field label="Venue">
            <TextInput value={ev.venue} onChange={(e) => setEv({ ...ev, venue: e.target.value })} />
          </Field>
          <Field label="Country">
            <TextInput value={ev.country} onChange={(e) => setEv({ ...ev, country: e.target.value })} />
          </Field>
          <Field label="Starts at">
            <TextInput
              required
              type="datetime-local"
              value={ev.startsAt}
              onChange={(e) => setEv({ ...ev, startsAt: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <Select value={ev.status} onChange={(e) => setEv({ ...ev, status: e.target.value as typeof ev.status })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <Btn type="submit" disabled={busy}>
              {ev.id ? "Update event" : "Create event"}
            </Btn>
            {ev.id ? (
              <Btn
                type="button"
                variant="ghost"
                onClick={() =>
                  setEv({ id: "", name: "", promotion: "", venue: "", country: "", startsAt: "", status: "draft" })
                }
              >
                Cancel
              </Btn>
            ) : null}
          </div>
        </form>

        <div className="mt-4 space-y-2">
          {(catalog.data?.events ?? []).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{e.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {shortDate(e.starts_at)} · {e.venue ?? "—"} · <Pill tone={statusTone(e.status)}>{e.status}</Pill>
                </p>
              </div>
              <Btn
                variant="ghost"
                onClick={() =>
                  setEv({
                    id: e.id,
                    name: e.name,
                    promotion: e.promotion ?? "",
                    venue: e.venue ?? "",
                    country: e.country ?? "",
                    startsAt: toLocalInput(e.starts_at),
                    status: e.status as typeof ev.status,
                  })
                }
              >
                Edit
              </Btn>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={fighter.id ? "Edit fighter" : "New fighter"}>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                saveFighter({
                  data: {
                    ...(fighter.id ? { id: fighter.id } : {}),
                    fullName: fighter.fullName,
                    nickname: fighter.nickname || undefined,
                    nationality: fighter.nationality || undefined,
                    recordW: Number(fighter.w),
                    recordL: Number(fighter.l),
                    recordD: Number(fighter.d),
                  },
                }),
              "Fighter saved",
              () =>
                setFighter({ id: "", fullName: "", nickname: "", nationality: "", w: "0", l: "0", d: "0" }),
            );
          }}
        >
          <Field label="Full name">
            <TextInput required value={fighter.fullName} onChange={(e) => setFighter({ ...fighter, fullName: e.target.value })} />
          </Field>
          <Field label="Nickname">
            <TextInput value={fighter.nickname} onChange={(e) => setFighter({ ...fighter, nickname: e.target.value })} />
          </Field>
          <Field label="Nationality">
            <TextInput value={fighter.nationality} onChange={(e) => setFighter({ ...fighter, nationality: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="W">
              <TextInput type="number" min={0} value={fighter.w} onChange={(e) => setFighter({ ...fighter, w: e.target.value })} />
            </Field>
            <Field label="L">
              <TextInput type="number" min={0} value={fighter.l} onChange={(e) => setFighter({ ...fighter, l: e.target.value })} />
            </Field>
            <Field label="D">
              <TextInput type="number" min={0} value={fighter.d} onChange={(e) => setFighter({ ...fighter, d: e.target.value })} />
            </Field>
          </div>
          <Btn className="sm:col-span-2" type="submit" disabled={busy}>
            {fighter.id ? "Update fighter" : "Create fighter"}
          </Btn>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {(catalog.data?.fighters ?? []).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() =>
                setFighter({
                  id: f.id,
                  fullName: f.full_name,
                  nickname: f.nickname ?? "",
                  nationality: f.nationality ?? "",
                  w: String(f.record_w),
                  l: String(f.record_l),
                  d: String(f.record_d),
                })
              }
              className="rounded-md border border-border px-2 py-1 text-xs hover:border-primary/60"
            >
              {f.full_name} ({f.record_w}-{f.record_l}-{f.record_d})
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={fight.id ? "Edit bout" : "New bout"} subtitle="Fighters, rounds and betting status">
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                saveFight({
                  data: {
                    ...(fight.id ? { id: fight.id } : {}),
                    eventId: fight.eventId,
                    fighterAId: fight.fighterAId,
                    fighterBId: fight.fighterBId,
                    ...(fight.weightClassId ? { weightClassId: fight.weightClassId } : {}),
                    scheduledRounds: Number(fight.scheduledRounds),
                    startsAt: fight.startsAt,
                    isMainEvent: fight.isMainEvent,
                    boutOrder: Number(fight.boutOrder),
                    status: fight.status as "upcoming",
                  },
                }),
              "Bout saved",
              () =>
                setFight({
                  id: "",
                  eventId: "",
                  fighterAId: "",
                  fighterBId: "",
                  weightClassId: "",
                  scheduledRounds: "3",
                  startsAt: "",
                  isMainEvent: false,
                  boutOrder: "1",
                  status: "upcoming",
                }),
            );
          }}
        >
          <Field label="Event">
            <Select required value={fight.eventId} onChange={(e) => setFight({ ...fight, eventId: e.target.value })}>
              <option value="">Select event</option>
              {(catalog.data?.events ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Weight class">
            <Select value={fight.weightClassId} onChange={(e) => setFight({ ...fight, weightClassId: e.target.value })}>
              <option value="">Unspecified</option>
              {(catalog.data?.weightClasses ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fighter A">
            <Select required value={fight.fighterAId} onChange={(e) => setFight({ ...fight, fighterAId: e.target.value })}>
              <option value="">Select fighter</option>
              {(catalog.data?.fighters ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fighter B">
            <Select required value={fight.fighterBId} onChange={(e) => setFight({ ...fight, fighterBId: e.target.value })}>
              <option value="">Select fighter</option>
              {(catalog.data?.fighters ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.full_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Scheduled rounds">
            <TextInput
              type="number"
              min={1}
              max={12}
              value={fight.scheduledRounds}
              onChange={(e) => setFight({ ...fight, scheduledRounds: e.target.value })}
            />
          </Field>
          <Field label="Bout order">
            <TextInput
              type="number"
              min={1}
              value={fight.boutOrder}
              onChange={(e) => setFight({ ...fight, boutOrder: e.target.value })}
            />
          </Field>
          <Field label="Starts at">
            <TextInput
              required
              type="datetime-local"
              value={fight.startsAt}
              onChange={(e) => setFight({ ...fight, startsAt: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <Select value={fight.status} onChange={(e) => setFight({ ...fight, status: e.target.value })}>
              {["draft", "upcoming", "open", "suspended", "live", "postponed", "cancelled"].map((s) => (
                <option key={s} value={s}>
                  {FIGHT_STATUS_LABEL[s] ?? s}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-xs sm:col-span-2">
            <input
              type="checkbox"
              checked={fight.isMainEvent}
              onChange={(e) => setFight({ ...fight, isMainEvent: e.target.checked })}
            />
            Main event
          </label>
          <Btn className="sm:col-span-2" type="submit" disabled={busy}>
            {fight.id ? "Update bout" : "Create bout"}
          </Btn>
        </form>

        <div className="mt-4 space-y-2">
          {(fights.data ?? []).map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {f.fighter_a?.full_name} vs {f.fighter_b?.full_name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {f.event?.name} · {shortDate(f.starts_at)} ·{" "}
                  <Pill tone={statusTone(f.status)}>{FIGHT_STATUS_LABEL[f.status] ?? f.status}</Pill>
                </p>
              </div>
              <Btn
                variant="ghost"
                onClick={() =>
                  setFight({
                    id: f.id,
                    eventId: f.event_id,
                    fighterAId: f.fighter_a_id,
                    fighterBId: f.fighter_b_id,
                    weightClassId: f.weight_class_id ?? "",
                    scheduledRounds: String(f.scheduled_rounds),
                    startsAt: toLocalInput(f.starts_at),
                    isMainEvent: f.is_main_event,
                    boutOrder: String(f.bout_order),
                    status: f.status === "settled" || f.status === "result_pending" ? "upcoming" : f.status,
                  })
                }
              >
                Edit
              </Btn>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
