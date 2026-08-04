
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('user','admin','super_admin');
CREATE TYPE public.event_status AS ENUM ('draft','published','cancelled');
CREATE TYPE public.fight_status AS ENUM ('draft','upcoming','open','suspended','live','result_pending','settled','cancelled','postponed');
CREATE TYPE public.fight_outcome AS ENUM ('fighter_a','fighter_b','draw','no_contest','cancelled');
CREATE TYPE public.victory_method AS ENUM ('ko_tko','submission','decision','dq','draw','no_contest','na');
CREATE TYPE public.market_status AS ENUM ('draft','open','suspended','closed','void','settled');
CREATE TYPE public.selection_status AS ENUM ('active','suspended','void','won','lost');
CREATE TYPE public.bet_status AS ENUM ('open','won','lost','void','cancelled','refunded');
CREATE TYPE public.txn_type AS ENUM ('deposit_pending','deposit_approved','deposit_rejected','bet_stake_held','bet_stake_returned','bet_winnings_paid','withdrawal_requested','withdrawal_approved','withdrawal_rejected','withdrawal_paid','admin_adjustment');
CREATE TYPE public.deposit_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.withdrawal_status AS ENUM ('pending','approved','rejected','paid');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id BIGINT UNIQUE,
  telegram_username TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'));
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- CATALOG
CREATE TABLE public.weight_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  limit_kg NUMERIC(6,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.fighters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  nickname TEXT,
  nationality TEXT,
  record_w INT NOT NULL DEFAULT 0,
  record_l INT NOT NULL DEFAULT 0,
  record_d INT NOT NULL DEFAULT 0,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  promotion TEXT,
  venue TEXT,
  country TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  status public.event_status NOT NULL DEFAULT 'draft',
  poster_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.fights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  fighter_a_id UUID NOT NULL REFERENCES public.fighters(id),
  fighter_b_id UUID NOT NULL REFERENCES public.fighters(id),
  weight_class_id UUID REFERENCES public.weight_classes(id),
  scheduled_rounds INT NOT NULL DEFAULT 3 CHECK (scheduled_rounds BETWEEN 1 AND 12),
  starts_at TIMESTAMPTZ NOT NULL,
  is_main_event BOOLEAN NOT NULL DEFAULT false,
  bout_order INT NOT NULL DEFAULT 0,
  status public.fight_status NOT NULL DEFAULT 'draft',
  result_notes TEXT,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fighter_a_id <> fighter_b_id)
);
CREATE TABLE public.fight_results (
  fight_id UUID PRIMARY KEY REFERENCES public.fights(id) ON DELETE CASCADE,
  outcome public.fight_outcome NOT NULL,
  method public.victory_method NOT NULL DEFAULT 'na',
  ending_round INT,
  ending_time TEXT,
  notes TEXT,
  entered_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.market_types (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);
CREATE TABLE public.markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fight_id UUID NOT NULL REFERENCES public.fights(id) ON DELETE CASCADE,
  market_type_code TEXT NOT NULL REFERENCES public.market_types(code),
  name TEXT NOT NULL,
  status public.market_status NOT NULL DEFAULT 'draft',
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  odds NUMERIC(8,3) NOT NULL CHECK (odds >= 1.01 AND odds <= 1000),
  status public.selection_status NOT NULL DEFAULT 'active',
  outcome_spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.odds_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id UUID NOT NULL REFERENCES public.selections(id) ON DELETE CASCADE,
  old_odds NUMERIC(8,3),
  new_odds NUMERIC(8,3) NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.weight_classes, public.fighters, public.events, public.fights, public.fight_results, public.market_types, public.markets, public.selections TO anon, authenticated;
GRANT SELECT ON public.odds_history TO authenticated;
GRANT ALL ON public.weight_classes, public.fighters, public.events, public.fights, public.fight_results, public.market_types, public.markets, public.selections, public.odds_history TO service_role;
ALTER TABLE public.weight_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fighters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fight_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odds_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read weight_classes" ON public.weight_classes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read fighters" ON public.fighters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read market_types" ON public.market_types FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read events" ON public.events FOR SELECT TO anon, authenticated USING (status = 'published' OR public.is_admin(auth.uid()));
CREATE POLICY "public read fights" ON public.fights FOR SELECT TO anon, authenticated USING (status <> 'draft' OR public.is_admin(auth.uid()));
CREATE POLICY "public read results" ON public.fight_results FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read markets" ON public.markets FOR SELECT TO anon, authenticated USING (status <> 'draft' OR public.is_admin(auth.uid()));
CREATE POLICY "public read selections" ON public.selections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin read odds history" ON public.odds_history FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- WALLET
CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  held_balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (held_balance >= 0),
  total_deposited NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_deposited >= 0),
  total_withdrawn NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_withdrawn >= 0),
  currency TEXT NOT NULL DEFAULT 'ETB',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.txn_type NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2) NOT NULL,
  held_after NUMERIC(14,2) NOT NULL,
  ref_type TEXT,
  ref_id UUID,
  idempotency_key TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_user ON public.wallet_transactions(user_id, created_at DESC);
GRANT SELECT ON public.wallets, public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallets, public.wallet_transactions TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet read" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "own txn read" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.block_ledger_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'wallet_transactions is append-only';
END;
$$;
CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.block_ledger_mutation();

-- DEPOSITS / WITHDRAWALS / SETTINGS
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  sms_text TEXT NOT NULL,
  sms_hash TEXT NOT NULL UNIQUE,
  status public.deposit_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT
);
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payout_method TEXT NOT NULL DEFAULT 'telebirr',
  payout_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  rejection_reason TEXT
);
CREATE TABLE public.platform_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  min_stake NUMERIC(14,2) NOT NULL DEFAULT 10,
  max_stake NUMERIC(14,2) NOT NULL DEFAULT 5000,
  max_payout_per_bet NUMERIC(14,2) NOT NULL DEFAULT 100000,
  min_withdrawal NUMERIC(14,2) NOT NULL DEFAULT 100,
  max_withdrawal NUMERIC(14,2) NOT NULL DEFAULT 20000,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  demo_mode BOOLEAN NOT NULL DEFAULT true,
  telebirr_instructions TEXT NOT NULL DEFAULT 'Send your deposit to Telebirr account 0900000000 (Demo), then paste the confirmation SMS below.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.platform_settings (id) VALUES (true);
GRANT SELECT ON public.deposits, public.withdrawals TO authenticated;
GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.deposits, public.withdrawals, public.platform_settings TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deposits read" ON public.deposits FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "own withdrawals read" ON public.withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "settings read" ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);

-- BETS / SETTLEMENTS / AUDIT
CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fight_id UUID NOT NULL UNIQUE REFERENCES public.fights(id) ON DELETE CASCADE,
  performed_by UUID REFERENCES auth.users(id),
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fight_id UUID NOT NULL REFERENCES public.fights(id),
  market_id UUID NOT NULL REFERENCES public.markets(id),
  selection_id UUID NOT NULL REFERENCES public.selections(id),
  stake NUMERIC(14,2) NOT NULL CHECK (stake > 0),
  odds_snapshot NUMERIC(8,3) NOT NULL CHECK (odds_snapshot >= 1.01),
  potential_payout NUMERIC(14,2) NOT NULL CHECK (potential_payout > 0),
  status public.bet_status NOT NULL DEFAULT 'open',
  payout_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  settlement_id UUID REFERENCES public.settlements(id),
  idempotency_key TEXT,
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX idx_bets_fight_status ON public.bets(fight_id, status);
CREATE INDEX idx_bets_user ON public.bets(user_id, placed_at DESC);
CREATE TABLE public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before JSONB,
  after JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bets, public.settlements TO authenticated;
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.bets, public.settlements, public.admin_audit_logs TO service_role;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bets read" ON public.bets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "admin settlements read" ON public.settlements FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admin audit read" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Auto profile + wallet on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.market_types (code, name, description) VALUES
  ('moneyline','Moneyline','Which fighter wins the bout'),
  ('method_of_victory','Method of Victory','How the fight ends'),
  ('round_group','Round Markets','Round the fight ends in, or goes the distance');
