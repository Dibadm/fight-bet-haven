# Combat-Sports Prediction Platform — Phase 1 Backend Design

Test/demo mode only: real-money rails stay disabled. Telebirr deposits are manual, admin-approved. A global `platform_settings` flag (`demo_mode = true`) gates deposit approval limits and shows a demo banner in the app.

## 1. Database schema

### Identity and roles
- `profiles` — `id` (FK `auth.users`, cascade), `telegram_id` (unique, nullable), `telegram_username`, `display_name`, `created_at`.
- `app_role` enum: `user`, `admin`, `super_admin`.
- `user_roles` — `id`, `user_id`, `role`, unique(user_id, role). Roles NEVER live on `profiles`.
- `has_role(_user_id, _role)` security-definer function used by every admin policy.

### Events and fights
- `events` — `id`, `name`, `promotion`, `venue`, `country`, `starts_at`, `status` (`draft|published|cancelled`), `poster_url`.
- `fighters` — `id`, `full_name`, `nickname`, `nationality`, `record_w/l/d`, `photo_url`.
- `weight_classes` — `id`, `name`, `limit_kg`.
- `fights` — `id`, `event_id`, `fighter_a_id`, `fighter_b_id`, `weight_class_id`, `scheduled_rounds`, `starts_at`, `is_main_event`, `status` enum (`draft|upcoming|open|suspended|live|result_pending|settled|cancelled|postponed`), `bout_order`, `result_notes`, `settled_at`.
- `fight_results` — one row per fight: `outcome` (`fighter_a|fighter_b|draw|no_contest|cancelled`), `method` (`ko_tko|submission|decision|dq|draw|no_contest|na`), `ending_round`, `ending_time`, `entered_by`, `confirmed_at`.
- Constraint: `fighter_a_id <> fighter_b_id`; `ending_round <= scheduled_rounds`.

### Markets (extensible by design)
- `market_types` — `code` (`moneyline`, `method_of_victory`, `round_group`), `name`, `settlement_key`. New market types are rows, not code rewrites.
- `markets` — `id`, `fight_id`, `market_type_code`, `name`, `status` enum (`draft|open|suspended|closed|void|settled`), `closes_at`.
- `selections` — `id`, `market_id`, `label`, `odds` numeric(8,3) `CHECK odds >= 1.01`, `status` (`active|suspended|void|won|lost`), plus a structured `outcome_spec jsonb` (e.g. `{"winner":"fighter_a","method":"ko_tko"}` or `{"ends_in_round":2}` / `{"goes_distance":true}`) — this is what the settlement engine matches against `fight_results`.
- `odds_history` — append-only: `selection_id`, `old_odds`, `new_odds`, `changed_by`, `changed_at`.

### Wallet and ledger
- `wallets` — `user_id` PK, `available_balance`, `held_balance`, `total_deposited`, `total_withdrawn`, all `numeric(14,2) CHECK >= 0`, `currency` default `ETB`, `version`.
- `wallet_transactions` — immutable append-only ledger: `id`, `user_id`, `type` enum (`deposit_pending|deposit_approved|deposit_rejected|bet_stake_held|bet_stake_returned|bet_winnings_paid|withdrawal_requested|withdrawal_approved|withdrawal_rejected|withdrawal_paid|admin_adjustment`), `amount` (signed), `balance_after`, `held_after`, `ref_type`, `ref_id`, `idempotency_key` (unique, nullable), `created_by`, `notes`, `created_at`. No UPDATE/DELETE policy for anyone; a trigger blocks updates.
- Balances only ever change inside the same DB function that writes the ledger row.

### Deposits and withdrawals
- `deposits` — `id`, `user_id`, `amount`, `sms_text`, `sms_hash` (unique — blocks duplicate SMS), `status` (`pending|approved|rejected`), `submitted_at`, `reviewed_by`, `reviewed_at`, `rejection_reason`.
- `withdrawals` — `id`, `user_id`, `amount`, `payout_method`, `payout_details jsonb`, `status` (`pending|approved|rejected|paid`), `requested_at`, `reviewed_by`, `reviewed_at`, `paid_at`, `rejection_reason`.
- `platform_settings` — singleton: `min_withdrawal`, `max_withdrawal`, `min_stake`, `max_stake`, `max_payout_per_bet`, `commission_rate` (default 0 — no house cut unless configured), `demo_mode`, `telebirr_instructions`.

### Bets
- `bets` — `id`, `user_id`, `fight_id`, `market_id`, `selection_id`, `stake`, `odds_snapshot`, `potential_payout`, `status` (`open|won|lost|void|cancelled|refunded`), `placed_at`, `settled_at`, `settlement_id`, `idempotency_key` unique per user.
- `odds_snapshot` and `potential_payout` are written server-side; later odds changes never touch existing rows.
- `settlements` — `id`, `fight_id` (unique — idempotency anchor), `performed_by`, `totals jsonb` (won/lost/void counts, total payout, P/L), `created_at`.

## 2. Wallet ledger design

Double-entry-ish, single-currency: every balance mutation is a function that (a) locks the wallet row `FOR UPDATE`, (b) validates non-negative result, (c) writes the ledger row with `balance_after`/`held_after`. Stake flow: `available -= stake`, `held += stake` on placement; on settlement `held -= stake` and, if won, `available += stake × odds`. Voids return stake to available. Withdrawable = `available_balance` only, so bet-locked funds can never be withdrawn.

## 3. Bet lifecycle

`open` → (`won` | `lost` | `void`/`refunded` | `cancelled`). Placement validates: market `open`, selection `active`, fight status in (`open`), `now() < min(fight.starts_at, market.closes_at)`, stake within limits, sufficient available balance, idempotency key unused. All in one transaction.

## 4. Settlement flow

Admin enters result → preview (read-only aggregate: winners, losers, voids, total payout, platform P/L) → confirm. Confirm calls one SQL function that inserts into `settlements` (unique on `fight_id`, so a second click is a no-op returning the existing summary), then iterates open bets on the fight, matches each selection's `outcome_spec` against `fight_results`, sets bet status, releases held funds, credits winnings, writes one ledger row per movement, closes markets, sets fight `settled`.

Cancelled / no-contest fights void all bets and refund every stake.

## 5. Security model

- Supabase Auth (email/password for admins) plus Telegram Mini App `initData` HMAC verification server-side; verified Telegram identity is mapped to a Supabase user and `profiles.telegram_id`.
- RLS on every table. Users read/write only their own wallet, bets, deposits, withdrawals — and only via server functions for anything money-touching (no direct client INSERT on `bets`, `wallets`, `wallet_transactions`, or status columns).
- Admin/super-admin access through `has_role()`. Super-admin only: role grants, admin adjustments, settings.
- `admin_audit_logs` — `actor_id`, `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `reason`, `created_at`; written for odds changes, market status changes, deposit/withdrawal decisions, result entry/changes, settlements, adjustments.
- Zod validation at every server-function boundary; idempotency keys on placement, deposit submission, settlement. No secrets in client code.

## 6. Server-side functions (TanStack `createServerFn`, auth middleware)

Public/user: `getEvents`, `getFightDetail`, `getFightMarkets`, `getWallet`, `getLedger`, `getMyBets`, `placeBet`, `submitDeposit`, `requestWithdrawal`, `verifyTelegramInitData`.
Admin: `upsertEvent`, `upsertFighter`, `upsertFight`, `setFightStatus`, `upsertMarket`, `upsertSelection`, `updateOdds`, `setMarketStatus`, `listPendingDeposits`, `reviewDeposit`, `listWithdrawals`, `reviewWithdrawal`, `markWithdrawalPaid`, `enterFightResult`, `previewSettlement`, `confirmSettlement`, `adminAdjustBalance`, `getRiskDashboard`, `getAuditLogs`.
Money-moving logic lives in Postgres functions (`place_bet`, `settle_fight`, `approve_deposit`, `credit_wallet`, …) so atomicity is enforced by the database, with server functions as the authorization/validation layer.

## 7. Risks and gaps to confirm
- Manual Telebirr verification is trust-based and doesn't prove payment; SMS text can be forged. Real integration needed before live money.
- Legal/licensing, responsible-gaming limits (self-exclusion, deposit caps), and KYC are out of scope here — demo mode stays on.
- Draw odds on moneyline: MMA/boxing draws are rare; draw selection optional per market.
- Telegram bot notifications need a bot token and a webhook; I'll wire the Telegram connector when we reach Phase 2.

## 8. Phase 1 execution
Enable Lovable Cloud, ship the migration (schema + enums + grants + RLS + SQL functions + audit triggers), seed a demo event with fights, markets and selections, then verify the flows end-to-end: place bet → held funds → enter result → preview → settle → payouts and ledger correctness. Phases 2 and 3 (Mini App UI, admin dashboard) follow after Phase 1 passes.
