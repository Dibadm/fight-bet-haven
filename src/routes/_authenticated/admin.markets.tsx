import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminCatalog,
  adminFights,
  confirmSettlement,
  enterFightResult,
  previewSettlement,
  setFightStatus,
  setMarketStatus,
  updateOdds,
  upsertMarket,
  upsertSelection,
} from "@/lib/admin.functions";
import { Btn, Field, Panel, Pill, Select, TextArea, TextInput, statusTone } from "@/components/admin/AdminUI";
import { FIGHT_STATUS_LABEL, odds as fmtOdds, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/markets")({
  head: () => ({
    meta: [
      { title: "Markets & odds — HFC Predict admin" },
      {
        name: "description",
        content:
          "Open, suspend, close or void markets, price selections, enter fight results and settle payouts.",
      },
      { property: "og:title", content: "Markets & odds — HFC Predict admin" },
      { property: "og:description", content: "Market lifecycle, odds pricing and settlement control." },
    ],
  }),
  component: AdminMarkets,
});

const MARKET_STATUSES = ["draft", "open", "suspended", "closed", "void", "settled"] as const;
const FIGHT_STATUSES = [
  "draft",
  "upcoming",
  "open",
  "suspended",
  "live",
  "result_pending",
  "cancelled",
  "postponed",
] as const;

function AdminMarkets() {
  const qc = useQueryClient();
  const fetchFights = useServerFn(adminFights);
  const fetchCatalog = useServerFn(adminCatalog);
  const saveMarket = useServerFn(upsertMarket);
  const saveSelection = useServerFn(upsertSelection);
  const setOdds = useServerFn(updateOdds);
  const setMktStatus = useServerFn(setMarketStatus);
  const setFStatus = useServerFn(setFightStatus);
  const enterResult = useServerFn(enterFightResult);
  const preview = useServerFn(previewSettlement);
  const settle = useServerFn(confirmSettlement);

  const fights = useQuery({ queryKey: ["admin-fights"], queryFn: () => fetchFights() });
  const catalog = useQuery({ queryKey: ["admin-catalog"], queryFn: () => fetchCatalog() });

  const [openFight, setOpenFight] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [oddsDraft, setOddsDraft] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, Record<string, unknown>>>({});
  const [market, setMarket] = useState({
    id: "",
    fightId: "",
    marketTypeCode: "",
    name: "",
    status: "draft" as (typeof MARKET_STATUSES)[number],
    closesAt: "",
  });
  const [selection, setSelection] = useState({
    id: "",
    marketId: "",
    label: "",
    odds: "2.00",
    sortOrder: "0",
    status: "active" as "active" | "suspended" | "void",
    outcomeSpec: '{"winner":"fighter_a"}',
  });
  const [result, setResult] = useState({
    fightId: "",
    outcome: "fighter_a",
    method: "decision",
    endingRound: "",
    endingTime: "",
    notes: "",
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
      {(fights.data ?? []).map((f) => {
        const expanded = openFight === f.id;
        const res = f.fight_results?.[0];
        const pv = previews[f.id] as
          | { won: number; lost: number; void: number; total_stakes: number; total_payout: number; platform_pl: number }
          | undefined;
        return (
          <Panel
            key={f.id}
            title={`${f.fighter_a?.full_name ?? "?"} vs ${f.fighter_b?.full_name ?? "?"}`}
            subtitle={`${f.event?.name ?? ""} · ${shortDate(f.starts_at)} · ${f.scheduled_rounds} rounds`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={statusTone(f.status)}>{FIGHT_STATUS_LABEL[f.status] ?? f.status}</Pill>
              <Select
                className="w-auto"
                value={f.status}
                disabled={busy || f.status === "settled"}
                onChange={(e) =>
                  run(
                    () => setFStatus({ data: { fightId: f.id, status: e.target.value as "open" } }),
                    "Fight status updated",
                  )
                }
              >
                {FIGHT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {FIGHT_STATUS_LABEL[s] ?? s}
                  </option>
                ))}
              </Select>
              <Btn variant="ghost" onClick={() => setOpenFight(expanded ? null : f.id)}>
                {expanded ? "Hide markets" : `Markets (${f.markets?.length ?? 0})`}
              </Btn>
            </div>

            {expanded ? (
              <div className="mt-4 space-y-3">
                {(f.markets ?? []).map((m) => (
                  <div key={m.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{m.name}</p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {m.market_type_code}
                          {m.closes_at ? ` · closes ${shortDate(m.closes_at)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Pill tone={statusTone(m.status)}>{m.status}</Pill>
                        <Select
                          className="w-auto"
                          value={m.status}
                          disabled={busy}
                          onChange={(e) =>
                            run(
                              () =>
                                setMktStatus({
                                  data: { marketId: m.id, status: e.target.value as "open" },
                                }),
                              "Market status updated",
                            )
                          }
                        >
                          {MARKET_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </Select>
                        <Btn
                          variant="ghost"
                          onClick={() =>
                            setMarket({
                              id: m.id,
                              fightId: f.id,
                              marketTypeCode: m.market_type_code,
                              name: m.name,
                              status: m.status as (typeof MARKET_STATUSES)[number],
                              closesAt: m.closes_at ? m.closes_at.slice(0, 16) : "",
                            })
                          }
                        >
                          Edit
                        </Btn>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {(m.selections ?? [])
                        .slice()
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((s) => (
                          <div key={s.id} className="flex flex-wrap items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-xs">{s.label}</span>
                            <Pill tone={statusTone(s.status)}>{s.status}</Pill>
                            <TextInput
                              className="w-20"
                              type="number"
                              step="0.01"
                              min={1.01}
                              value={oddsDraft[s.id] ?? fmtOdds(s.odds)}
                              onChange={(e) => setOddsDraft({ ...oddsDraft, [s.id]: e.target.value })}
                            />
                            <Btn
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () =>
                                    setOdds({
                                      data: {
                                        selectionId: s.id,
                                        odds: Number(oddsDraft[s.id] ?? s.odds),
                                      },
                                    }),
                                  "Odds updated",
                                )
                              }
                            >
                              Save
                            </Btn>
                            <Btn
                              variant="ghost"
                              onClick={() =>
                                setSelection({
                                  id: s.id,
                                  marketId: m.id,
                                  label: s.label,
                                  odds: fmtOdds(s.odds),
                                  sortOrder: String(s.sort_order),
                                  status:
                                    s.status === "active" || s.status === "suspended" || s.status === "void"
                                      ? s.status
                                      : "active",
                                  outcomeSpec: JSON.stringify(s.outcome_spec),
                                })
                              }
                            >
                              Edit
                            </Btn>
                          </div>
                        ))}
                      <Btn
                        variant="ghost"
                        onClick={() =>
                          setSelection({
                            id: "",
                            marketId: m.id,
                            label: "",
                            odds: "2.00",
                            sortOrder: String((m.selections?.length ?? 0) + 1),
                            status: "active",
                            outcomeSpec: '{"winner":"fighter_a"}',
                          })
                        }
                      >
                        + Add selection
                      </Btn>
                    </div>
                  </div>
                ))}

                <Btn
                  variant="ghost"
                  onClick={() =>
                    setMarket({
                      id: "",
                      fightId: f.id,
                      marketTypeCode: catalog.data?.marketTypes[0]?.code ?? "moneyline",
                      name: "",
                      status: "draft",
                      closesAt: "",
                    })
                  }
                >
                  + Add market to this bout
                </Btn>

                <div className="rounded-md border border-border p-3">
                  <p className="font-display text-lg leading-none tracking-wide">Result & settlement</p>
                  {res ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Recorded: {res.outcome} by {res.method}
                      {res.ending_round ? ` in R${res.ending_round}` : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">No result entered yet.</p>
                  )}

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Field label="Outcome">
                      <Select
                        value={result.fightId === f.id ? result.outcome : "fighter_a"}
                        onChange={(e) => setResult({ ...result, fightId: f.id, outcome: e.target.value })}
                      >
                        {["fighter_a", "fighter_b", "draw", "no_contest", "cancelled"].map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Method">
                      <Select
                        value={result.fightId === f.id ? result.method : "decision"}
                        onChange={(e) => setResult({ ...result, fightId: f.id, method: e.target.value })}
                      >
                        {["ko_tko", "submission", "decision", "dq", "draw", "no_contest", "na"].map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Ending round">
                      <TextInput
                        type="number"
                        min={1}
                        max={f.scheduled_rounds}
                        value={result.fightId === f.id ? result.endingRound : ""}
                        onChange={(e) => setResult({ ...result, fightId: f.id, endingRound: e.target.value })}
                      />
                    </Field>
                    <Field label="Ending time">
                      <TextInput
                        placeholder="3:42"
                        value={result.fightId === f.id ? result.endingTime : ""}
                        onChange={(e) => setResult({ ...result, fightId: f.id, endingTime: e.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn
                      disabled={busy || f.status === "settled"}
                      onClick={() =>
                        run(
                          () =>
                            enterResult({
                              data: {
                                fightId: f.id,
                                outcome: (result.fightId === f.id ? result.outcome : "fighter_a") as "fighter_a",
                                method: (result.fightId === f.id ? result.method : "decision") as "decision",
                                endingRound:
                                  result.fightId === f.id && result.endingRound
                                    ? Number(result.endingRound)
                                    : null,
                                ...(result.fightId === f.id && result.endingTime
                                  ? { endingTime: result.endingTime }
                                  : {}),
                              },
                            }),
                          "Result recorded",
                        )
                      }
                    >
                      Save result
                    </Btn>
                    <Btn
                      variant="ghost"
                      disabled={busy}
                      onClick={async () => {
                        try {
                          const p = (await preview({ data: { fightId: f.id } })) as Record<string, unknown>;
                          setPreviews({ ...previews, [f.id]: p });
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      Preview settlement
                    </Btn>
                    <Btn
                      variant="danger"
                      disabled={busy || !pv || f.status === "settled"}
                      onClick={() =>
                        run(
                          () => settle({ data: { fightId: f.id, confirm: true } }),
                          "Fight settled and payouts credited",
                        )
                      }
                    >
                      Confirm settlement
                    </Btn>
                  </div>

                  {pv ? (
                    <p className="tabular mt-2 text-xs text-muted-foreground">
                      {pv.won} won · {pv.lost} lost · {pv.void} void · stakes {pv.total_stakes} · payout{" "}
                      {pv.total_payout} · P/L {pv.platform_pl}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Panel>
        );
      })}

      {market.fightId ? (
        <Panel title={market.id ? "Edit market" : "New market"}>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  saveMarket({
                    data: {
                      ...(market.id ? { id: market.id } : {}),
                      fightId: market.fightId,
                      marketTypeCode: market.marketTypeCode,
                      name: market.name,
                      status: market.status,
                      ...(market.closesAt ? { closesAt: market.closesAt } : {}),
                    },
                  }),
                "Market saved",
                () =>
                  setMarket({ id: "", fightId: "", marketTypeCode: "", name: "", status: "draft", closesAt: "" }),
              );
            }}
          >
            <Field label="Market type">
              <Select
                required
                value={market.marketTypeCode}
                onChange={(e) => setMarket({ ...market, marketTypeCode: e.target.value })}
              >
                <option value="">Select type</option>
                {(catalog.data?.marketTypes ?? []).map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Name">
              <TextInput required value={market.name} onChange={(e) => setMarket({ ...market, name: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select
                value={market.status}
                onChange={(e) => setMarket({ ...market, status: e.target.value as typeof market.status })}
              >
                {MARKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Closes at">
              <TextInput
                type="datetime-local"
                value={market.closesAt}
                onChange={(e) => setMarket({ ...market, closesAt: e.target.value })}
              />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Btn type="submit" disabled={busy}>
                Save market
              </Btn>
              <Btn
                type="button"
                variant="ghost"
                onClick={() =>
                  setMarket({ id: "", fightId: "", marketTypeCode: "", name: "", status: "draft", closesAt: "" })
                }
              >
                Cancel
              </Btn>
            </div>
          </form>
        </Panel>
      ) : null}

      {selection.marketId ? (
        <Panel
          title={selection.id ? "Edit selection" : "New selection"}
          subtitle='Outcome spec drives settlement, e.g. {"winner":"fighter_a","method":"ko_tko"} or {"ends_in_round":2}'
        >
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  saveSelection({
                    data: {
                      ...(selection.id ? { id: selection.id } : {}),
                      marketId: selection.marketId,
                      label: selection.label,
                      odds: Number(selection.odds),
                      sortOrder: Number(selection.sortOrder),
                      status: selection.status,
                      outcomeSpec: selection.outcomeSpec,
                    },
                  }),
                "Selection saved",
                () =>
                  setSelection({
                    id: "",
                    marketId: "",
                    label: "",
                    odds: "2.00",
                    sortOrder: "0",
                    status: "active",
                    outcomeSpec: '{"winner":"fighter_a"}',
                  }),
              );
            }}
          >
            <Field label="Label">
              <TextInput
                required
                value={selection.label}
                onChange={(e) => setSelection({ ...selection, label: e.target.value })}
              />
            </Field>
            <Field label="Odds">
              <TextInput
                required
                type="number"
                step="0.01"
                min={1.01}
                value={selection.odds}
                onChange={(e) => setSelection({ ...selection, odds: e.target.value })}
              />
            </Field>
            <Field label="Sort order">
              <TextInput
                type="number"
                min={0}
                value={selection.sortOrder}
                onChange={(e) => setSelection({ ...selection, sortOrder: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <Select
                value={selection.status}
                onChange={(e) => setSelection({ ...selection, status: e.target.value as typeof selection.status })}
              >
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="void">void</option>
              </Select>
            </Field>
            <Field label="Outcome spec (JSON)" className="sm:col-span-2">
              <TextArea
                rows={3}
                value={selection.outcomeSpec}
                onChange={(e) => setSelection({ ...selection, outcomeSpec: e.target.value })}
              />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Btn type="submit" disabled={busy}>
                Save selection
              </Btn>
              <Btn
                type="button"
                variant="ghost"
                onClick={() =>
                  setSelection({
                    id: "",
                    marketId: "",
                    label: "",
                    odds: "2.00",
                    sortOrder: "0",
                    status: "active",
                    outcomeSpec: '{"winner":"fighter_a"}',
                  })
                }
              >
                Cancel
              </Btn>
            </div>
          </form>
        </Panel>
      ) : null}

      {!fights.data?.length ? (
        <Panel title="No bouts yet">
          <p className="text-sm text-muted-foreground">Create an event and bout first.</p>
        </Panel>
      ) : null}
    </>
  );
}
