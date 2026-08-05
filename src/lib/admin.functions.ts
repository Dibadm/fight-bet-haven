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
         fighter_a:fighters!fights_fighter_a_id_fkey ( id, full_name ),
         fighter_b:fighters!fights_fighter_b_id_fkey ( id, full_name ),
         event_id, fighter_a_id, fighter_b_id, weight_class_id, bout_order,
         event:events ( id, name ),
         markets ( id, name, status, market_type_code, closes_at,
           selections ( id, label, odds, status, sort_order, outcome_spec ) ),
         fight_results ( outcome, method, ending_round, ending_time, notes )`,
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
    const { supabaseAdmin, assertAdmin, rpc } = await import("./db.server");
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

/* ---------------- Phase 3: catalog management ---------------- */

export const adminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getRoles } = await import("./db.server");
    const roles = await getRoles(context.userId);
    return {
      isAdmin: roles.some((r) => r === "admin" || r === "super_admin"),
      isSuperAdmin: roles.includes("super_admin"),
      roles,
    };
  });

export const adminCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, assertAdmin } = await import("./db.server");
    await assertAdmin(context.userId);
    const [{ data: events }, { data: fighters }, { data: weightClasses }, { data: marketTypes }] =
      await Promise.all([
        supabaseAdmin
          .from("events")
          .select("id, name, promotion, venue, country, starts_at, status")
          .order("starts_at", { ascending: false }),
        supabaseAdmin.from("fighters").select("id, full_name, nickname, nationality, record_w, record_l, record_d").order("full_name"),
        supabaseAdmin.from("weight_classes").select("id, name, limit_kg").order("name"),
        supabaseAdmin.from("market_types").select("code, name, description").order("code"),
      ]);
    return {
      events: events ?? [],
      fighters: fighters ?? [],
      weightClasses: weightClasses ?? [],
      marketTypes: marketTypes ?? [],
    };
  });

export const upsertEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: uuid.optional(),
        name: z.string().trim().min(2).max(120),
        promotion: z.string().trim().max(80).optional(),
        venue: z.string().trim().max(120).optional(),
        country: z.string().trim().max(80).optional(),
        startsAt: z.string().min(4),
        status: z.enum(["draft", "published", "cancelled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin, rpc } = await import("./db.server");
    await assertAdmin(context.userId);
    const row = {
      name: data.name,
      promotion: data.promotion ?? null,
      venue: data.venue ?? null,
      country: data.country ?? null,
      starts_at: new Date(data.startsAt).toISOString(),
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = data.id
      ? await supabaseAdmin.from("events").update(row).eq("id", data.id).select().single()
      : await supabaseAdmin.from("events").insert(row).select().single();
    if (error) throw new Error(error.message);
    await rpc("log_admin_action", {
      p_actor: context.userId,
      p_action: data.id ? "event_updated" : "event_created",
      p_entity_type: "event",
      p_entity_id: saved.id,
      p_before: null,
      p_after: row,
      p_reason: null,
    });
    return saved;
  });

export const upsertFighter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: uuid.optional(),
        fullName: z.string().trim().min(2).max(120),
        nickname: z.string().trim().max(80).optional(),
        nationality: z.string().trim().max(80).optional(),
        recordW: z.number().int().min(0).max(500),
        recordL: z.number().int().min(0).max(500),
        recordD: z.number().int().min(0).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin, rpc } = await import("./db.server");
    await assertAdmin(context.userId);
    const row = {
      full_name: data.fullName,
      nickname: data.nickname ?? null,
      nationality: data.nationality ?? null,
      record_w: data.recordW,
      record_l: data.recordL,
      record_d: data.recordD,
    };
    const { data: saved, error } = data.id
      ? await supabaseAdmin.from("fighters").update(row).eq("id", data.id).select().single()
      : await supabaseAdmin.from("fighters").insert(row).select().single();
    if (error) throw new Error(error.message);
    await rpc("log_admin_action", {
      p_actor: context.userId,
      p_action: data.id ? "fighter_updated" : "fighter_created",
      p_entity_type: "fighter",
      p_entity_id: saved.id,
      p_before: null,
      p_after: row,
      p_reason: null,
    });
    return saved;
  });

export const upsertFight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: uuid.optional(),
        eventId: uuid,
        fighterAId: uuid,
        fighterBId: uuid,
        weightClassId: uuid.optional(),
        scheduledRounds: z.number().int().min(1).max(12),
        startsAt: z.string().min(4),
        isMainEvent: z.boolean(),
        boutOrder: z.number().int().min(1).max(50),
        status: z.enum(["draft", "upcoming", "open", "suspended", "live", "postponed", "cancelled"]),
      })
      .refine((v) => v.fighterAId !== v.fighterBId, "Pick two different fighters")
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin, rpc } = await import("./db.server");
    await assertAdmin(context.userId);
    const row = {
      event_id: data.eventId,
      fighter_a_id: data.fighterAId,
      fighter_b_id: data.fighterBId,
      weight_class_id: data.weightClassId ?? null,
      scheduled_rounds: data.scheduledRounds,
      starts_at: new Date(data.startsAt).toISOString(),
      is_main_event: data.isMainEvent,
      bout_order: data.boutOrder,
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = data.id
      ? await supabaseAdmin.from("fights").update(row).eq("id", data.id).select().single()
      : await supabaseAdmin.from("fights").insert(row).select().single();
    if (error) throw new Error(error.message);
    await rpc("log_admin_action", {
      p_actor: context.userId,
      p_action: data.id ? "fight_updated" : "fight_created",
      p_entity_type: "fight",
      p_entity_id: saved.id,
      p_before: null,
      p_after: row,
      p_reason: null,
    });
    return saved;
  });

export const upsertMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: uuid.optional(),
        fightId: uuid,
        marketTypeCode: z.string().trim().min(2).max(60),
        name: z.string().trim().min(2).max(120),
        status: z.enum(["draft", "open", "suspended", "closed", "void", "settled"]),
        closesAt: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin, rpc } = await import("./db.server");
    await assertAdmin(context.userId);
    const row = {
      fight_id: data.fightId,
      market_type_code: data.marketTypeCode,
      name: data.name,
      status: data.status,
      closes_at: data.closesAt ? new Date(data.closesAt).toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = data.id
      ? await supabaseAdmin.from("markets").update(row).eq("id", data.id).select().single()
      : await supabaseAdmin.from("markets").insert(row).select().single();
    if (error) throw new Error(error.message);
    await rpc("log_admin_action", {
      p_actor: context.userId,
      p_action: data.id ? "market_updated" : "market_created",
      p_entity_type: "market",
      p_entity_id: saved.id,
      p_before: null,
      p_after: row,
      p_reason: null,
    });
    return saved;
  });

export const upsertSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: uuid.optional(),
        marketId: uuid,
        label: z.string().trim().min(1).max(120),
        odds: z.number().min(1.01).max(1000),
        sortOrder: z.number().int().min(0).max(100),
        status: z.enum(["active", "suspended", "void"]),
        outcomeSpec: z.string().trim().min(2).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, assertAdmin, rpc } = await import("./db.server");
    await assertAdmin(context.userId);
    let spec: unknown;
    try {
      spec = JSON.parse(data.outcomeSpec);
    } catch {
      throw new Error("Outcome spec must be valid JSON, e.g. {\"winner\":\"fighter_a\"}");
    }
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
      throw new Error("Outcome spec must be a JSON object");
    }
    const row = {
      market_id: data.marketId,
      label: data.label,
      odds: data.odds,
      sort_order: data.sortOrder,
      status: data.status,
      outcome_spec: spec as never,
      updated_at: new Date().toISOString(),
    };
    const { data: saved, error } = data.id
      ? await supabaseAdmin.from("selections").update(row).eq("id", data.id).select().single()
      : await supabaseAdmin.from("selections").insert(row).select().single();
    if (error) throw new Error(error.message);
    await rpc("log_admin_action", {
      p_actor: context.userId,
      p_action: data.id ? "selection_updated" : "selection_created",
      p_entity_type: "selection",
      p_entity_id: saved.id,
      p_before: null,
      p_after: { label: data.label, odds: data.odds, status: data.status },
      p_reason: null,
    });
    return saved;
  });
