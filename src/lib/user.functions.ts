import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, getRoles } = await import("./db.server");
    const roles = await getRoles(context.userId);
    const [{ data: profile }, { data: wallet }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      supabaseAdmin.from("wallets").select("*").eq("user_id", context.userId).maybeSingle(),
    ]);
    if (!wallet) {
      await supabaseAdmin.from("wallets").insert({ user_id: context.userId });
    }
    return {
      userId: context.userId,
      roles,
      isAdmin: roles.some((r) => r === "admin" || r === "super_admin"),
      profile,
      wallet: wallet ?? {
        user_id: context.userId,
        available_balance: 0,
        held_balance: 0,
        total_deposited: 0,
        total_withdrawn: 0,
        currency: "ETB",
      },
    };
  });

export const getLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("./db.server");
    const { data } = await supabaseAdmin
      .from("wallet_transactions")
      .select("id, type, amount, balance_after, held_after, notes, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(60);
    return data ?? [];
  });

export const getMyBets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("./db.server");
    const { data } = await supabaseAdmin
      .from("bets")
      .select(
        `id, stake, odds_snapshot, potential_payout, status, payout_amount, placed_at, settled_at,
         selection:selections ( id, label ),
         market:markets ( id, name ),
         fight:fights ( id, starts_at, status,
           fighter_a:fighters!fights_fighter_a_id_fkey ( full_name ),
           fighter_b:fighters!fights_fighter_b_id_fkey ( full_name ) )`,
      )
      .eq("user_id", context.userId)
      .order("placed_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const getMyDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("./db.server");
    const [{ data: deposits }, { data: withdrawals }] = await Promise.all([
      supabaseAdmin
        .from("deposits")
        .select("id, amount, status, submitted_at, reviewed_at, rejection_reason")
        .eq("user_id", context.userId)
        .order("submitted_at", { ascending: false })
        .limit(30),
      supabaseAdmin
        .from("withdrawals")
        .select("id, amount, status, payout_method, requested_at, paid_at, rejection_reason")
        .eq("user_id", context.userId)
        .order("requested_at", { ascending: false })
        .limit(30),
    ]);
    return { deposits: deposits ?? [], withdrawals: withdrawals ?? [] };
  });

export const placeBet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        selectionId: z.string().uuid(),
        stake: z.number().positive().max(1_000_000),
        idempotencyKey: z.string().min(8).max(64),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, unwrap } = await import("./db.server");
    const bet = unwrap(
      await supabaseAdmin.rpc("place_bet", {
        p_user: context.userId,
        p_selection: data.selectionId,
        p_stake: Math.round(data.stake * 100) / 100,
        p_idem: data.idempotencyKey,
      }),
    );
    return bet;
  });

export const submitDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        amount: z.number().positive().max(1_000_000),
        smsText: z.string().trim().min(15).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, unwrap } = await import("./db.server");
    return unwrap(
      await supabaseAdmin.rpc("submit_deposit", {
        p_user: context.userId,
        p_amount: Math.round(data.amount * 100) / 100,
        p_sms: data.smsText,
      }),
    );
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        amount: z.number().positive().max(1_000_000),
        accountName: z.string().trim().min(2).max(80),
        accountNumber: z.string().trim().min(6).max(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, unwrap } = await import("./db.server");
    return unwrap(
      await supabaseAdmin.rpc("request_withdrawal", {
        p_user: context.userId,
        p_amount: Math.round(data.amount * 100) / 100,
        p_method: "telebirr",
        p_details: { account_name: data.accountName, account_number: data.accountNumber },
      }),
    );
  });
