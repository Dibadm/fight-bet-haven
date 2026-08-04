import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, assertAdmin, unwrap, rpc } = await import("./db.server");
    await assertAdmin(context.userId);
    const risk = unwrap(await rpc("risk_dashboard", {}));
    const [{ data: deposits }, { data: withdrawals }, { data: txns }] = await Promise.all([
      supabaseAdmin
        .from("deposits")
        .select("id, user_id, amount, sms_text, status, submitted_at, rejection_reason")
        .order("submitted_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("withdrawals")
        .select("id, user_id, amount, payout_method, payout_details, status, requested_at")
        .order("requested_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("wallet_transactions")
        .select("id, user_id, type, amount, balance_after, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(40),
    ]);
    return { risk, deposits: deposits ?? [], withdrawals: withdrawals ?? [], transactions: txns ?? [] };
  });

export const adminFights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, assertAdmin } = await import("./db.server");
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("fights")
      .select(
        `id, starts_at, status, scheduled_rounds, is_main_event, settled_at,
         event:events ( id, name ),
         fighter_a:fighters!fights_fighter_a_id_fkey ( id, full_name ),
         fighter_b:fighters!fights_fighter_b_id_fkey ( id, full_name ),
         markets ( id, name, status, market_type_code, selections ( id, label, odds, status ) ),
         fight_results ( outcome, method, ending_round )`,
      )
      .order("starts_at", { ascending: true });
    return data ?? [];
  });

export const adminAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, assertAdmin } = await import("./db.server");
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    return data ?? [];
  });

export const reviewDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ depositId: uuid, approve: z.boolean(), reason: z.string().trim().max(300).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin, unwrap, rpc } = await import("./db.server");
    await assertAdmin(context.userId);
    return unwrap(
      await rpc("review_deposit", {
        p_actor: context.userId,
        p_deposit: data.depositId,
        p_approve: data.approve,
        p_reason: data.reason ?? null,
      }),
    );
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        withdrawalId: uuid,
        decision: z.enum(["approve", "reject", "paid"]),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin, unwrap, rpc } = await import("./db.server");
    await assertAdmin(context.userId);
    return unwrap(
      await rpc("review_withdrawal", {
        p_actor: context.userId,
        p_withdrawal: data.withdrawalId,
        p_decision: data.decision,
        p_reason: data.reason ?? null,
      }),
    );
  });

export const updateOdds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ selectionId: uuid, odds: z.number().min(1.01).max(1000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin, unwrap, rpc } = await import("./db.server");
    await assertAdmin(context.userId);
    return unwrap(
      await rpc("update_selection_odds", {
        p_actor: context.userId,
        p_selection: data.selectionId,
        p_odds: data.odds,
      }),
    );
  });

export const setMarketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        marketId: uuid,
        status: z.enum(["draft", "open", "suspended", "closed", "void", "settled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin, unwrap, rpc } = await import("./db.server");
    await assertAdmin(context.userId);
    return unwrap(
      await rpc("set_market_status", {
        p_actor: context.userId,
        p_market: data.marketId,
        p_status: data.status,
      }),
    );
  });

export const setFightStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fightId: uuid,
        status: z.enum([
          "draft",
          "upcoming",
          "open",
          "suspended",
          "live",
          "result_pending",
          "cancelled",
          "postponed",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin } = await import("./db.server");
    await assertAdmin(context.userId);
    const { data: before } = await supabaseAdmin
      .from("fights")
      .select("status")
      .eq("id", data.fightId)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("fights")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.fightId);
    if (error) throw new Error(error.message);
    await rpc("log_admin_action", {
      p_actor: context.userId,
      p_action: "fight_status_changed",
      p_entity_type: "fight",
      p_entity_id: data.fightId,
      p_before: before ?? null,
      p_after: { status: data.status },
      p_reason: null,
    });
    return { ok: true };
  });

export const enterFightResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fightId: uuid,
        outcome: z.enum(["fighter_a", "fighter_b", "draw", "no_contest", "cancelled"]),
        method: z.enum(["ko_tko", "submission", "decision", "dq", "draw", "no_contest", "na"]),
        endingRound: z.number().int().min(1).max(12).nullable().optional(),
        endingTime: z.string().trim().max(20).optional(),
        notes: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin, unwrap, rpc } = await import("./db.server");
    await assertAdmin(context.userId);
    return unwrap(
      await rpc("enter_fight_result", {
        p_actor: context.userId,
        p_fight: data.fightId,
        p_outcome: data.outcome,
        p_method: data.method,
        p_round: data.endingRound ?? null,
        p_time: data.endingTime ?? null,
        p_notes: data.notes ?? null,
      }),
    );
  });

export const previewSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ fightId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin, unwrap, rpc } = await import("./db.server");
    await assertAdmin(context.userId);
    return unwrap(await rpc("preview_settlement", { p_fight: data.fightId }));
  });

export const confirmSettlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ fightId: uuid, confirm: z.literal(true) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin, unwrap, rpc } = await import("./db.server");
    await assertAdmin(context.userId);
    return unwrap(
      await rpc("settle_fight", { p_actor: context.userId, p_fight: data.fightId }),
    );
  });

export const adminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: uuid,
        amount: z.number().refine((v) => v !== 0, "Amount cannot be zero"),
        reason: z.string().trim().min(5).max(300),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin, unwrap, rpc } = await import("./db.server");
    await assertAdmin(context.userId, true);
    unwrap(
      await rpc("admin_adjust_balance", {
        p_actor: context.userId,
        p_user: data.userId,
        p_amount: data.amount,
        p_reason: data.reason,
      }),
    );
    return { ok: true };
  });
