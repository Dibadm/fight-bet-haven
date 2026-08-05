import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { adminFights } from "@/lib/admin.functions";
import { AppShell } from "@/components/AppShell";
import { shortDate, FIGHT_STATUS_LABEL } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Swords } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_admin/fights")({
  head: () => ({ meta: [{ title: "Manage Fights — Admin" }] }),
  component: AdminFights,
});

type Fight = Database["public"]["Tables"]["fights"]["Row"] & {
  event: { id: string; name: string } | null;
  fighter_a: { id: string; full_name: string } | null;
  fighter_b: { id: string; full_name: string } | null;
  markets: Array<{
    id: string;
    name: string;
    status: string;
    market_type_code: string;
    selections: Array<{ id: string; label: string; odds: number; status: string }>;
  }>;
  fight_results: { outcome: string; method: string; ending_round: number | null } | null;
};

function AdminFights() {
  const fetchFights = useServerFn(adminFights);
  const { data: fights, isLoading } = useQuery({ queryKey: ["admin-fights"], queryFn: () => fetchFights() });
  const qc = useQueryClient();

  const [selectedFight, setSelectedFight] = useState<Fight | null>(null);
  const [status, setStatus] = useState("");
  const [oddsSelectionId, setOddsSelectionId] = useState("");
  const [oddsValue, setOddsValue] = useState("");
  const [marketId, setMarketId] = useState("");
  const [marketStatus, setMarketStatus] = useState("");
  const [resultOpen, setResultOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [method, setMethod] = useState("");
  const [endingRound, setEndingRound] = useState("");

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-fights"] });
    await qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const updateFightStatus = async () => {
    if (!selectedFight || !status) return;
    try {
      const { setFightStatus } = await import("@/lib/admin.functions");
      const fn = useServerFn(setFightStatus);
      await fn({ data: { fightId: selectedFight.id, status: status as any } });
      toast.success("Fight status updated");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const updateMarketStatus = async () => {
    if (!marketId || !marketStatus) return;
    try {
      const { setMarketStatus } = await import("@/lib/admin.functions");
      const fn = useServerFn(setMarketStatus);
      await fn({ data: { marketId, status: marketStatus as any } });
      toast.success("Market status updated");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const updateOdds = async () => {
    if (!oddsSelectionId || !oddsValue) return;
    try {
      const { updateOdds } = await import("@/lib/admin.functions");
      const fn = useServerFn(updateOdds);
      await fn({ data: { selectionId: oddsSelectionId, odds: Number(oddsValue) } });
      toast.success("Odds updated");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const submitResult = async () => {
    if (!selectedFight || !outcome || !method) return;
    try {
      const { enterFightResult } = await import("@/lib/admin.functions");
      const fn = useServerFn(enterFightResult);
      await fn({
        data: {
          fightId: selectedFight.id,
          outcome: outcome as any,
          method: method as any,
          endingRound: endingRound ? Number(endingRound) : null,
        },
      });
      toast.success("Result entered");
      setResultOpen(false);
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const statuses = ["draft", "upcoming", "open", "suspended", "live", "result_pending", "settled", "cancelled", "postponed"] as const;
  const marketStatuses = ["draft", "open", "suspended", "closed", "void", "settled"] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl leading-none">FIGHTS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage fights, markets, odds, and results.</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && !fights?.length && <p className="text-sm text-muted-foreground">No fights found.</p>}

      <div className="space-y-3">
        {fights?.map((fight: Fight) => (
          <Card key={fight.id} className="surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{fight.event?.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{shortDate(fight.starts_at)}</p>
              </div>
              <Badge variant={fight.status === "open" ? "default" : "secondary"}>
                {FIGHT_STATUS_LABEL[fight.status] ?? fight.status}
              </Badge>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm">
                {fight.fighter_a?.full_name} <span className="text-muted-foreground">vs</span> {fight.fighter_b?.full_name}
              </p>
              <div className="flex gap-2">
                <Dialog open={resultOpen && selectedFight?.id === fight.id} onOpenChange={(o) => { if (!o) setResultOpen(false); }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" onClick={() => { setSelectedFight(fight); setResultOpen(true); }}>
                      Result
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Enter Result</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Outcome</Label>
                        <Select value={outcome} onValueChange={setOutcome}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select outcome" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fighter_a">Fighter A wins</SelectItem>
                            <SelectItem value="fighter_b">Fighter B wins</SelectItem>
                            <SelectItem value="draw">Draw</SelectItem>
                            <SelectItem value="no_contest">No contest</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Method</Label>
                        <Select value={method} onValueChange={setMethod}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ko_tko">KO/TKO</SelectItem>
                            <SelectItem value="submission">Submission</SelectItem>
                            <SelectItem value="decision">Decision</SelectItem>
                            <SelectItem value="dq">DQ</SelectItem>
                            <SelectItem value="na">N/A</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Ending Round</Label>
                        <Input type="number" min={1} max={12} value={endingRound} onChange={(e) => setEndingRound(e.target.value)} />
                      </div>
                      <Button onClick={submitResult} className="w-full">Save Result</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={selectedFight?.id === fight.id && !resultOpen} onOpenChange={(o) => { if (!o) setSelectedFight(null); }}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => setSelectedFight(fight)}>Manage</Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Manage Fight</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Fight Status</Label>
                        <div className="flex gap-2">
                          <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              {statuses.map((s) => (
                                <SelectItem key={s} value={s}>{FIGHT_STATUS_LABEL[s] ?? s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" onClick={updateFightStatus}>Update</Button>
                        </div>
                      </div>

                      <div>
                        <Label>Markets</Label>
                        <div className="space-y-2">
                          {fight.markets?.map((m) => (
                            <div key={m.id} className="rounded-lg border border-border p-3">
                              <p className="text-sm font-medium">{m.name}</p>
                              <p className="text-[11px] text-muted-foreground">{m.market_type_code}</p>
                              <div className="mt-2 flex items-center gap-2">
                                <Select value={marketId === m.id ? marketStatus : ""} onValueChange={(v) => { setMarketId(m.id); setMarketStatus(v); }}>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Market status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {marketStatuses.map((s) => (
                                      <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button size="sm" onClick={updateMarketStatus}>Set</Button>
                              </div>
                              <div className="mt-2 space-y-1">
                                {m.selections?.map((sel) => (
                                  <div key={sel.id} className="flex items-center justify-between text-xs">
                                    <span>{sel.label}</span>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        className="h-7 w-20"
                                        defaultValue={sel.odds}
                                        onBlur={(e) => {
                                          const val = e.target.value;
                                          if (val && Number(val) !== sel.odds) {
                                            setOddsSelectionId(sel.id);
                                            setOddsValue(val);
                                            setTimeout(() => {
                                              updateOdds();
                                              setOddsSelectionId("");
                                              setOddsValue("");
                                            }, 0);
                                          }
                                        }}
                                      />
                                      <span className="text-muted-foreground">{sel.status}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
