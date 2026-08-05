import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { adminAccess } from "@/lib/admin.functions";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

export function useAdminAccess() {
  const fetchAccess = useServerFn(adminAccess);
  return useQuery({ queryKey: ["admin-access"], queryFn: () => fetchAccess(), staleTime: 60_000 });
}

const TABS = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/events", label: "Events & fights" },
  { to: "/admin/markets", label: "Markets & odds" },
];

function AdminLayout() {
  const { data: access, isLoading, error } = useAdminAccess();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) {
    return (
      <AppShell>
        <p className="surface p-4 text-sm text-muted-foreground">Checking permissions…</p>
      </AppShell>
    );
  }

  if (error || !access?.isAdmin) {
    return (
      <AppShell>
        <div className="surface flex items-start gap-3 p-4">
          <ShieldAlert className="mt-0.5 size-5 text-destructive" />
          <div>
            <p className="font-semibold">Admin access required</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your account does not have the admin role. Every admin action is authorized on the
              server, so this area stays locked.
            </p>
            <Link to="/" className="mt-3 inline-block text-xs text-primary">
              Back to fights
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl leading-none">CONTROL ROOM</h1>
        {access.isSuperAdmin ? (
          <span className="rounded bg-gold/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold">
            Super admin
          </span>
        ) : null}
      </div>

      <nav className="mt-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-secondary/30 p-1">
        {TABS.map((t) => {
          const active = t.to === "/admin" ? path === "/admin" : path.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 space-y-4">
        <Outlet />
      </div>
    </AppShell>
  );
}
