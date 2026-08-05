import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/lib/user.functions";
import { useServerFn } from "@tanstack/react-start";
import { LayoutDashboard, Swords, Wallet, ScrollText, Settings, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    return { user: data.user };
  },
  loader: async ({ context }) => {
    const fetchMe = useServerFn(getMe);
    const data = await fetchMe();
    if (!data?.isAdmin) throw redirect({ to: "/" });
    return { me: data };
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/_admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/_admin/fights", label: "Fights", icon: Swords },
  { to: "/_admin/financials", label: "Financials", icon: Wallet },
  { to: "/_admin/settlements", label: "Settlements", icon: ScrollText },
  { to: "/_admin/audit", label: "Audit", icon: Settings },
];

function AdminLayout() {
  const { me } = Route.useLoaderData();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="font-display text-xl leading-none tracking-wide">ADMIN</h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {me.roles?.includes("super_admin") ? "Super Admin" : "Admin"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium">{me.profile?.full_name ?? "Admin"}</p>
            <p className="text-[10px] text-muted-foreground">{me.roles?.join(", ")}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl">
        <nav className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-52 flex-col border-r border-border bg-background/95 py-4 md:flex">
          {NAV.map((item) => {
            const active = item.end ? path === item.to : path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "mx-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
