import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { adminFights, previewSettlement, confirmSettlement } from "@/lib/admin.functions";
import { AppShell } from "@/components/AppShell";
import { ETB, shortDate, FIGHT_STATUS_LABEL } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/_admin/settlements")({
  head: () => ({ meta: [{ title: "Settlements — Admin" }] }),
  component: AdminSettlements,
});

function AdminSettlements() {
  const fetchFights = useServerFn(adminFights);
  const { data: fights, isLoading } = useQuery({ queryKey: ["admin-fights"], queryFn: () => fetchFights() });
  const qc = useQueryClient();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-fights"] });
    await qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const loadPreview = async (fightId: string) => {
    setPreviewId(fightId);
    setPreviewLoading(true);
    try {
      const fn = useServerFn(previewSettlement);
      const { data, error } = await fn({ data: { fightId } });
      if (error) throw new Error(error.message);
      setPreview(data);
    } catch (err) {
      toast.error((err as Error).message);
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirm = async (fightId: string) => {
    try {
      const fn = useServerFn(confirmSettlement);
      const { error } = await fn({ data: { fightId, confirm: true } });
      if (error) throw new Error(error.message);
      toast.success("Settlement confirmed");
      await refresh();
      setPreview(null);
      setPreviewId(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const settleable = fights?.filter((f: any) => ["result_pending", "live"].includes(f.status)) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl leading-none">SETTLEMENTS</h1>
        <p className="mt-1 text-sm text-muted-foreground">Preview and confirm fight settlements.</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && !settleable.length && (
        <p className="text-sm text-muted-foreground">No fights pending settlement.</p>
      )}

      <div className="space-y-3">
        {settleable.map((fight: any) => (
          <Card key={fight.id} className="surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{fight.event?.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {fight.fighter_a?.full_name} vs {fight.fighter_b?.full_name}
                </p>
                <p className="text-[11px] text-muted-foreground">{shortDate(fight.starts_at)}</p>
              </div>
              <div className="flex gap-2">
                <Dialog open={previewId === fight.id} onOpenChange={(o) => { if (!o) { setPreviewId(null); setPreview(null); } }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" onClick={() => loadPreview(fight.id)}>
                      <ScrollText className="mr-2 size-4" /> Preview
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Settlement Preview</DialogTitle>
                    </DialogHeader>
                    {previewLoading && <p className="text-sm text-muted-foreground">Loading preview…</p>}
                    {!previewLoading && preview && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <Card className="surface p-3">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Winning Bets</p>
                            <p className="text-xl font-bold">{preview.winning_bets ?? 0}</p>
                          </Card>
                          <Card className="surface p-3">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Losing Bets</p>
                            <p className="text-xl font-bold">{preview.losing_bets ?? 0}</p>
                          </Card>
                          <Card className="surface p-3">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Void/Refunded</p>
                            <p className="text-xl font-bold">{preview.void_bets ?? 0}</p>
                          </Card>
                          <Card className="surface p-3">
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Payout</p>
                            <p className="tabular text-xl font-bold">{ETB(preview.total_payout ?? 0)}</p>
                          </Card>
                        </div>
                        <Card className="surface p-3">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Estimated Platform P/L</p>
                          <p className={`tabular text-xl font-bold ${(preview.platform_profit ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                            {ETB(preview.platform_profit ?? 0)}
                          </p>
                        </Card>
                        <div>
                          <p className="text-xs font-semibold">Affected Bets</p>
                          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                            {(preview.bets ?? []).map((bet: any) => (
                              <div key={bet.id} className="flex items-center justify-between border-b border-border/50 pb-1 text-xs">
                                <span className="truncate">{bet.selection?.label}</span>
                                <span className={`font-semibold ${bet.status === "won" ? "text-success" : bet.status === "lost" ? "text-destructive" : "text-warning"}`}>
                                  {bet.status} · {ETB(bet.potential_payout)}
                                </span>
                              </div>
                            ))}
                            {!(preview.bets ?? []).length && <p className="text-xs text-muted-foreground">No bets to settle.</p>}
                          </div>
                        </div>
                        <Button onClick={() => confirm(fight.id)} className="w-full">Confirm Settlement</Button>
                      </div>
                    )}
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
