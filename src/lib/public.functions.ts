import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().from("platform_settings").select("*").maybeSingle();
  return data;
});

export const debugMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, getRoles, assertAdmin } = await import("./db.server");
    const [{ data: profile }] = await Promise.all([
      supabaseAdmin.from("profiles").select("telegram_id, full_name").eq("id", context.userId).maybeSingle(),
    ]);
    let adminOk = false;
    let roles: string[] = [];
    try {
      roles = await getRoles(context.userId);
      await assertAdmin(context.userId);
      adminOk = true;
    } catch {
      adminOk = false;
    }
    const envAdminIds = (process.env.ADMIN_TELEGRAM_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    return {
      userId: context.userId,
      telegramId: profile?.telegram_id ?? null,
      fullName: profile?.full_name ?? null,
      roles,
      adminOk,
      envAdminIds,
    };
  });

export const getEvents = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      `id, name, promotion, venue, country, starts_at, status,
       fights ( id, starts_at, status, scheduled_rounds, is_main_event, bout_order,
         fighter_a:fighters!fights_fighter_a_id_fkey ( id, full_name, nickname, nationality, record_w, record_l, record_d ),
         fighter_b:fighters!fights_fighter_b_id_fkey ( id, full_name, nickname, nationality, record_w, record_l, record_d ),
         weight_class:weight_classes ( id, name ) )`,
    )
    .eq("status", "published")
    .order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({
    ...e,
    fights: [...(e.fights ?? [])]
      .filter((f) => f.status !== "draft")
      .sort((a, b) => a.bout_order - b.bout_order),
  }));
});

export const getFightDetail = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ fightId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: fight, error } = await supabase
      .from("fights")
      .select(
        `id, starts_at, status, scheduled_rounds, is_main_event, result_notes,
         event:events ( id, name, promotion, venue, country, starts_at ),
         fighter_a:fighters!fights_fighter_a_id_fkey ( id, full_name, nickname, nationality, record_w, record_l, record_d ),
         fighter_b:fighters!fights_fighter_b_id_fkey ( id, full_name, nickname, nationality, record_w, record_l, record_d ),
         weight_class:weight_classes ( id, name ),
         markets ( id, name, status, market_type_code, closes_at,
           selections ( id, label, odds, status, sort_order ) ),
         fight_results ( outcome, method, ending_round, ending_time )`,
      )
      .eq("id", data.fightId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!fight) return null;
    return {
      ...fight,
      markets: (fight.markets ?? [])
        .filter((m) => m.status !== "draft")
        .map((m) => ({
          ...m,
          selections: [...(m.selections ?? [])].sort((a, b) => a.sort_order - b.sort_order),
        })),
    };
  });
