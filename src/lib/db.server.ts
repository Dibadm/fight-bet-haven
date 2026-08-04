// Server-only helpers for the betting engine. Never imported from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export { supabaseAdmin };

export type AppRole = "user" | "admin" | "super_admin";

export async function getRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Authorization check failed");
  return (data ?? []).map((r) => r.role as AppRole);
}

export async function assertAdmin(userId: string, requireSuper = false): Promise<AppRole[]> {
  const roles = await getRoles(userId);
  const ok = requireSuper
    ? roles.includes("super_admin")
    : roles.some((r) => r === "admin" || r === "super_admin");
  if (!ok) throw new Error("Forbidden: admin access required");
  return roles;
}

const FRIENDLY: Record<string, string> = {
  INSUFFICIENT_FUNDS: "Not enough available balance.",
  INSUFFICIENT_HELD_FUNDS: "Wallet state conflict, please retry.",
  SELECTION_NOT_FOUND: "That selection no longer exists.",
  SELECTION_UNAVAILABLE: "That selection is no longer available.",
  MARKET_NOT_OPEN: "This market is not open for betting.",
  MARKET_CLOSED: "This market has closed.",
  MARKET_LOCKED: "Odds can no longer be changed for this market.",
  FIGHT_NOT_OPEN_FOR_BETTING: "Betting is not open on this fight.",
  FIGHT_ALREADY_STARTED: "This fight has already started.",
  FIGHT_ALREADY_SETTLED: "This fight is already settled.",
  INVALID_STAKE: "Enter a valid stake.",
  STAKE_BELOW_MIN: "Stake is below the minimum.",
  STAKE_ABOVE_MAX: "Stake is above the maximum.",
  PAYOUT_ABOVE_MAX: "Potential payout exceeds the platform limit.",
  DUPLICATE_SMS: "This confirmation SMS has already been submitted.",
  SMS_TEXT_TOO_SHORT: "Paste the full Telebirr confirmation SMS.",
  INVALID_AMOUNT: "Enter a valid amount.",
  BELOW_MIN_WITHDRAWAL: "Amount is below the minimum withdrawal.",
  ABOVE_MAX_WITHDRAWAL: "Amount is above the maximum withdrawal.",
  DEPOSIT_NOT_FOUND: "Deposit not found.",
  DEPOSIT_ALREADY_REVIEWED: "This deposit was already reviewed.",
  WITHDRAWAL_NOT_FOUND: "Withdrawal not found.",
  MUST_APPROVE_FIRST: "Approve the withdrawal before marking it paid.",
  INVALID_STATE: "This request is not in a reviewable state.",
  NO_RESULT_ENTERED: "Enter the official result first.",
  ROUND_EXCEEDS_SCHEDULED: "Ending round exceeds the scheduled rounds.",
  REASON_REQUIRED: "A reason of at least 5 characters is required.",
  INVALID_ODDS: "Odds must be at least 1.01.",
};

export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) {
    const code = Object.keys(FRIENDLY).find((k) => res.error!.message.includes(k));
    throw new Error(code ? FRIENDLY[code]! : res.error.message);
  }
  return res.data as T;
}
