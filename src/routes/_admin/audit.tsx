import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAuditLogs } from "@/lib/admin.functions";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";

export const Route = createFileRoute("/_admin/audit")({
  head: () => ({ meta: [{ title: "Audit Logs — Admin" }] }),
  component: AdminAudit,
});

function AdminAudit() {
  const fetchLogs = useServerFn(adminAuditLogs);
  const { data: logs, isLoading } = useQuery({ queryKey: ["admin-audit"], queryFn: () => fetchLogs() });

  const actionColor = (action: string) => {
    if (action.includes("approve") || action.includes("paid")) return "default";
    if (action.includes("reject")) return "destructive";
    if (action.includes("settlement")) return "outline";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl leading-none">AUDIT</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admin actions and system changes.</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && !logs?.length && <p className="text-sm text-muted-foreground">No audit logs yet.</p>}

      <Card className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs?.map((log: any) => (
                <tr key={log.id} className="border-b border-border/50">
                  <td className="px-4 py-3">
                    <Badge variant={actionColor(log.action) as any}>{log.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {log.entity_type} {log.entity_id ? <span className="text-muted-foreground">#{log.entity_id.slice(0, 8)}</span> : ""}
                  </td>
                  <td className="px-4 py-3 text-xs">{log.actor_id ? log.actor_id.slice(0, 8) : "—"}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs text-muted-foreground">{log.reason ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{new Date(log.created_at).toLocaleString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
