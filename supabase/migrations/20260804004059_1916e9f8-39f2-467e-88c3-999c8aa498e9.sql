
-- ============ AUDIT HELPER ============
CREATE OR REPLACE FUNCTION public.log_admin_action(p_actor UUID, p_action TEXT, p_entity_type TEXT, p_entity_id UUID, p_before JSONB, p_after JSONB, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_audit_logs (actor_id, action, entity_type, entity_id, before, after, reason)
  VALUES (p_actor, p_action, p_entity_type, p_entity_id, p_before, p_after, p_reason);
END; $$;

-- ============ WALLET ENGINE ============
CREATE OR REPLACE FUNCTION public.wallet_apply(
  p_user UUID, p_type public.txn_type, p_avail_delta NUMERIC, p_held_delta NUMERIC,
  p_ref_type TEXT DEFAULT NULL, p_ref_id UUID DEFAULT NULL, p_idem TEXT DEFAULT NULL,
  p_actor UUID DEFAULT NULL, p_notes TEXT DEFAULT NULL,
  p_deposit_delta NUMERIC DEFAULT 0, p_withdraw_delta NUMERIC DEFAULT 0
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.wallets; v_id UUID;
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (p_user) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO w FROM public.wallets WHERE user_id = p_user FOR UPDATE;

  IF w.available_balance + p_avail_delta < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
  END IF;
  IF w.held_balance + p_held_delta < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_HELD_FUNDS';
  END IF;

  UPDATE public.wallets SET
    available_balance = available_balance + p_avail_delta,
    held_balance = held_balance + p_held_delta,
    total_deposited = total_deposited + COALESCE(p_deposit_delta,0),
    total_withdrawn = total_withdrawn + COALESCE(p_withdraw_delta,0),
    updated_at = now()
  WHERE user_id = p_user
  RETURNING * INTO w;

  INSERT INTO public.wallet_transactions (user_id, type, amount, balance_after, held_after, ref_type, ref_id, idempotency_key, created_by, notes)
  VALUES (p_user, p_type, p_avail_delta, w.available_balance, w.held_balance, p_ref_type, p_ref_id, p_idem, p_actor, p_notes)
  RETURNING id INTO v_id;

  RETURN v_id;
END; $$;

-- ============ PLACE BET ============
CREATE OR REPLACE FUNCTION public.place_bet(p_user UUID, p_selection UUID, p_stake NUMERIC, p_idem TEXT)
RETURNS public.bets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.selections; m public.markets; f public.fights; cfg public.platform_settings;
        v_bet public.bets; v_payout NUMERIC; v_existing public.bets;
BEGIN
  IF p_idem IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.bets WHERE user_id = p_user AND idempotency_key = p_idem;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;

  SELECT * INTO cfg FROM public.platform_settings WHERE id;
  SELECT * INTO s FROM public.selections WHERE id = p_selection FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELECTION_NOT_FOUND'; END IF;
  SELECT * INTO m FROM public.markets WHERE id = s.market_id;
  SELECT * INTO f FROM public.fights WHERE id = m.fight_id;

  IF s.status <> 'active' THEN RAISE EXCEPTION 'SELECTION_UNAVAILABLE'; END IF;
  IF m.status <> 'open' THEN RAISE EXCEPTION 'MARKET_NOT_OPEN'; END IF;
  IF f.status <> 'open' THEN RAISE EXCEPTION 'FIGHT_NOT_OPEN_FOR_BETTING'; END IF;
  IF f.starts_at <= now() THEN RAISE EXCEPTION 'FIGHT_ALREADY_STARTED'; END IF;
  IF m.closes_at IS NOT NULL AND m.closes_at <= now() THEN RAISE EXCEPTION 'MARKET_CLOSED'; END IF;
  IF p_stake IS NULL OR p_stake <= 0 THEN RAISE EXCEPTION 'INVALID_STAKE'; END IF;
  IF p_stake < cfg.min_stake THEN RAISE EXCEPTION 'STAKE_BELOW_MIN'; END IF;
  IF p_stake > cfg.max_stake THEN RAISE EXCEPTION 'STAKE_ABOVE_MAX'; END IF;

  v_payout := ROUND(p_stake * s.odds, 2);
  IF v_payout > cfg.max_payout_per_bet THEN RAISE EXCEPTION 'PAYOUT_ABOVE_MAX'; END IF;

  INSERT INTO public.bets (user_id, fight_id, market_id, selection_id, stake, odds_snapshot, potential_payout, idempotency_key)
  VALUES (p_user, f.id, m.id, s.id, p_stake, s.odds, v_payout, p_idem)
  RETURNING * INTO v_bet;

  PERFORM public.wallet_apply(p_user, 'bet_stake_held', -p_stake, p_stake, 'bet', v_bet.id,
    CASE WHEN p_idem IS NULL THEN NULL ELSE 'bet:'||p_idem END, p_user, 'Stake held for bet');

  RETURN v_bet;
END; $$;

-- ============ DEPOSITS ============
CREATE OR REPLACE FUNCTION public.submit_deposit(p_user UUID, p_amount NUMERIC, p_sms TEXT)
RETURNS public.deposits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deposits; v_hash TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF length(coalesce(trim(p_sms),'')) < 15 THEN RAISE EXCEPTION 'SMS_TEXT_TOO_SHORT'; END IF;
  v_hash := encode(digest(lower(regexp_replace(p_sms,'\s+',' ','g')), 'sha256'), 'hex');
  IF EXISTS (SELECT 1 FROM public.deposits WHERE sms_hash = v_hash) THEN RAISE EXCEPTION 'DUPLICATE_SMS'; END IF;

  INSERT INTO public.deposits (user_id, amount, sms_text, sms_hash)
  VALUES (p_user, p_amount, trim(p_sms), v_hash) RETURNING * INTO d;

  PERFORM public.wallet_apply(p_user, 'deposit_pending', 0, 0, 'deposit', d.id, 'dep_pending:'||d.id::text, p_user, 'Deposit submitted for review');
  RETURN d;
END; $$;

CREATE OR REPLACE FUNCTION public.review_deposit(p_actor UUID, p_deposit UUID, p_approve BOOLEAN, p_reason TEXT)
RETURNS public.deposits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deposits;
BEGIN
  SELECT * INTO d FROM public.deposits WHERE id = p_deposit FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEPOSIT_NOT_FOUND'; END IF;
  IF d.status <> 'pending' THEN RAISE EXCEPTION 'DEPOSIT_ALREADY_REVIEWED'; END IF;

  IF p_approve THEN
    UPDATE public.deposits SET status='approved', reviewed_by=p_actor, reviewed_at=now() WHERE id=d.id RETURNING * INTO d;
    PERFORM public.wallet_apply(d.user_id, 'deposit_approved', d.amount, 0, 'deposit', d.id, 'dep_approved:'||d.id::text, p_actor, 'Deposit approved', d.amount, 0);
  ELSE
    UPDATE public.deposits SET status='rejected', reviewed_by=p_actor, reviewed_at=now(), rejection_reason=p_reason WHERE id=d.id RETURNING * INTO d;
    PERFORM public.wallet_apply(d.user_id, 'deposit_rejected', 0, 0, 'deposit', d.id, 'dep_rejected:'||d.id::text, p_actor, COALESCE(p_reason,'Deposit rejected'));
  END IF;

  PERFORM public.log_admin_action(p_actor, CASE WHEN p_approve THEN 'deposit_approved' ELSE 'deposit_rejected' END, 'deposit', d.id, NULL, to_jsonb(d), p_reason);
  RETURN d;
END; $$;

-- ============ WITHDRAWALS ============
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_user UUID, p_amount NUMERIC, p_method TEXT, p_details JSONB)
RETURNS public.withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.withdrawals; cfg public.platform_settings;
BEGIN
  SELECT * INTO cfg FROM public.platform_settings WHERE id;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF p_amount < cfg.min_withdrawal THEN RAISE EXCEPTION 'BELOW_MIN_WITHDRAWAL'; END IF;
  IF p_amount > cfg.max_withdrawal THEN RAISE EXCEPTION 'ABOVE_MAX_WITHDRAWAL'; END IF;

  INSERT INTO public.withdrawals (user_id, amount, payout_method, payout_details)
  VALUES (p_user, p_amount, COALESCE(p_method,'telebirr'), COALESCE(p_details,'{}'::jsonb)) RETURNING * INTO w;

  -- funds leave available immediately and are held against the request
  PERFORM public.wallet_apply(p_user, 'withdrawal_requested', -p_amount, p_amount, 'withdrawal', w.id, 'wd_req:'||w.id::text, p_user, 'Withdrawal requested');
  RETURN w;
END; $$;

CREATE OR REPLACE FUNCTION public.review_withdrawal(p_actor UUID, p_withdrawal UUID, p_decision TEXT, p_reason TEXT)
RETURNS public.withdrawals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.withdrawals;
BEGIN
  SELECT * INTO w FROM public.withdrawals WHERE id = p_withdrawal FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WITHDRAWAL_NOT_FOUND'; END IF;

  IF p_decision = 'approve' THEN
    IF w.status <> 'pending' THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
    UPDATE public.withdrawals SET status='approved', reviewed_by=p_actor, reviewed_at=now() WHERE id=w.id RETURNING * INTO w;
    PERFORM public.wallet_apply(w.user_id, 'withdrawal_approved', 0, 0, 'withdrawal', w.id, 'wd_appr:'||w.id::text, p_actor, 'Withdrawal approved');
  ELSIF p_decision = 'reject' THEN
    IF w.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'INVALID_STATE'; END IF;
    UPDATE public.withdrawals SET status='rejected', reviewed_by=p_actor, reviewed_at=now(), rejection_reason=p_reason WHERE id=w.id RETURNING * INTO w;
    PERFORM public.wallet_apply(w.user_id, 'withdrawal_rejected', w.amount, -w.amount, 'withdrawal', w.id, 'wd_rej:'||w.id::text, p_actor, COALESCE(p_reason,'Withdrawal rejected'));
  ELSIF p_decision = 'paid' THEN
    IF w.status <> 'approved' THEN RAISE EXCEPTION 'MUST_APPROVE_FIRST'; END IF;
    UPDATE public.withdrawals SET status='paid', paid_at=now() WHERE id=w.id RETURNING * INTO w;
    PERFORM public.wallet_apply(w.user_id, 'withdrawal_paid', 0, -w.amount, 'withdrawal', w.id, 'wd_paid:'||w.id::text, p_actor, 'Withdrawal paid out', 0, w.amount);
  ELSE
    RAISE EXCEPTION 'INVALID_DECISION';
  END IF;

  PERFORM public.log_admin_action(p_actor, 'withdrawal_'||p_decision, 'withdrawal', w.id, NULL, to_jsonb(w), p_reason);
  RETURN w;
END; $$;

-- ============ ADMIN ADJUSTMENT ============
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(p_actor UUID, p_user UUID, p_amount NUMERIC, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_amount = 0 OR p_amount IS NULL THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  IF length(coalesce(trim(p_reason),'')) < 5 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  PERFORM public.wallet_apply(p_user, 'admin_adjustment', p_amount, 0, 'adjustment', NULL, NULL, p_actor, p_reason);
  PERFORM public.log_admin_action(p_actor, 'admin_adjustment', 'wallet', p_user, NULL, jsonb_build_object('amount', p_amount), p_reason);
END; $$;

-- ============ ODDS / MARKET CONTROL ============
CREATE OR REPLACE FUNCTION public.update_selection_odds(p_actor UUID, p_selection UUID, p_odds NUMERIC)
RETURNS public.selections LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.selections; m public.markets; v_old NUMERIC;
BEGIN
  SELECT * INTO s FROM public.selections WHERE id = p_selection FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SELECTION_NOT_FOUND'; END IF;
  SELECT * INTO m FROM public.markets WHERE id = s.market_id;
  IF m.status IN ('closed','void','settled') THEN RAISE EXCEPTION 'MARKET_LOCKED'; END IF;
  IF p_odds < 1.01 THEN RAISE EXCEPTION 'INVALID_ODDS'; END IF;

  v_old := s.odds;
  UPDATE public.selections SET odds = p_odds, updated_at = now() WHERE id = s.id RETURNING * INTO s;
  INSERT INTO public.odds_history (selection_id, old_odds, new_odds, changed_by) VALUES (s.id, v_old, p_odds, p_actor);
  PERFORM public.log_admin_action(p_actor, 'odds_changed', 'selection', s.id, jsonb_build_object('odds', v_old), jsonb_build_object('odds', p_odds), NULL);
  RETURN s;
END; $$;

CREATE OR REPLACE FUNCTION public.set_market_status(p_actor UUID, p_market UUID, p_status public.market_status)
RETURNS public.markets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.markets; v_old public.market_status;
BEGIN
  SELECT * INTO m FROM public.markets WHERE id = p_market FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MARKET_NOT_FOUND'; END IF;
  v_old := m.status;
  UPDATE public.markets SET status = p_status, updated_at = now() WHERE id = m.id RETURNING * INTO m;

  IF p_status = 'void' THEN
    UPDATE public.selections SET status='void' WHERE market_id = m.id;
    PERFORM public.void_bets_for_market(p_actor, m.id, 'Market voided');
  END IF;

  PERFORM public.log_admin_action(p_actor, 'market_status_changed', 'market', m.id, jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), NULL);
  RETURN m;
END; $$;

CREATE OR REPLACE FUNCTION public.void_bets_for_market(p_actor UUID, p_market UUID, p_reason TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bets; n INT := 0;
BEGIN
  FOR b IN SELECT * FROM public.bets WHERE market_id = p_market AND status = 'open' FOR UPDATE LOOP
    UPDATE public.bets SET status='void', settled_at=now(), payout_amount=b.stake WHERE id=b.id;
    PERFORM public.wallet_apply(b.user_id, 'bet_stake_returned', b.stake, -b.stake, 'bet', b.id, 'void:'||b.id::text, p_actor, p_reason);
    n := n + 1;
  END LOOP;
  RETURN n;
END; $$;

-- ============ RESULTS ============
CREATE OR REPLACE FUNCTION public.enter_fight_result(
  p_actor UUID, p_fight UUID, p_outcome public.fight_outcome, p_method public.victory_method,
  p_round INT, p_time TEXT, p_notes TEXT
) RETURNS public.fight_results LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.fights; r public.fight_results; v_before JSONB;
BEGIN
  SELECT * INTO f FROM public.fights WHERE id = p_fight FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FIGHT_NOT_FOUND'; END IF;
  IF f.status = 'settled' THEN RAISE EXCEPTION 'FIGHT_ALREADY_SETTLED'; END IF;
  IF p_round IS NOT NULL AND p_round > f.scheduled_rounds THEN RAISE EXCEPTION 'ROUND_EXCEEDS_SCHEDULED'; END IF;

  SELECT to_jsonb(x) INTO v_before FROM public.fight_results x WHERE x.fight_id = p_fight;

  INSERT INTO public.fight_results (fight_id, outcome, method, ending_round, ending_time, notes, entered_by)
  VALUES (p_fight, p_outcome, COALESCE(p_method,'na'), p_round, p_time, p_notes, p_actor)
  ON CONFLICT (fight_id) DO UPDATE SET outcome=EXCLUDED.outcome, method=EXCLUDED.method,
    ending_round=EXCLUDED.ending_round, ending_time=EXCLUDED.ending_time, notes=EXCLUDED.notes,
    entered_by=EXCLUDED.entered_by, confirmed_at=now()
  RETURNING * INTO r;

  UPDATE public.fights SET status='result_pending', updated_at=now() WHERE id=p_fight;
  UPDATE public.markets SET status='closed', updated_at=now() WHERE fight_id=p_fight AND status IN ('open','suspended');

  PERFORM public.log_admin_action(p_actor, 'fight_result_entered', 'fight', p_fight, v_before, to_jsonb(r), p_notes);
  RETURN r;
END; $$;

-- selection matcher
CREATE OR REPLACE FUNCTION public.selection_matches_result(p_spec JSONB, p_outcome public.fight_outcome, p_method public.victory_method, p_round INT, p_scheduled INT)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE ok BOOLEAN := true; v_distance BOOLEAN;
BEGIN
  IF p_spec IS NULL OR p_spec = '{}'::jsonb THEN RETURN false; END IF;
  v_distance := (p_method IN ('decision','draw')) OR (p_round IS NOT NULL AND p_round >= p_scheduled AND p_method = 'decision');

  IF p_spec ? 'winner' THEN ok := ok AND (p_spec->>'winner' = p_outcome::text); END IF;
  IF p_spec ? 'method' THEN ok := ok AND (p_spec->>'method' = p_method::text); END IF;
  IF p_spec ? 'ends_in_round' THEN
    ok := ok AND (p_method IN ('ko_tko','submission','dq') AND p_round IS NOT NULL AND p_round = (p_spec->>'ends_in_round')::int);
  END IF;
  IF p_spec ? 'goes_distance' THEN ok := ok AND ((p_spec->>'goes_distance')::boolean = v_distance); END IF;
  RETURN ok;
END; $$;

-- ============ SETTLEMENT ============
CREATE OR REPLACE FUNCTION public.preview_settlement(p_fight UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.fights; r public.fight_results; b RECORD;
  n_won INT:=0; n_lost INT:=0; n_void INT:=0; total_payout NUMERIC:=0; total_stakes NUMERIC:=0; v_void_all BOOLEAN;
BEGIN
  SELECT * INTO f FROM public.fights WHERE id = p_fight;
  IF NOT FOUND THEN RAISE EXCEPTION 'FIGHT_NOT_FOUND'; END IF;
  SELECT * INTO r FROM public.fight_results WHERE fight_id = p_fight;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_RESULT_ENTERED'; END IF;
  v_void_all := r.outcome IN ('no_contest','cancelled');

  FOR b IN SELECT bt.*, s.outcome_spec, s.status AS sel_status, mk.status AS mk_status
           FROM public.bets bt JOIN public.selections s ON s.id = bt.selection_id
           JOIN public.markets mk ON mk.id = bt.market_id
           WHERE bt.fight_id = p_fight AND bt.status = 'open' LOOP
    total_stakes := total_stakes + b.stake;
    IF v_void_all OR b.sel_status = 'void' OR b.mk_status = 'void' THEN
      n_void := n_void + 1; total_payout := total_payout + b.stake;
    ELSIF public.selection_matches_result(b.outcome_spec, r.outcome, r.method, r.ending_round, f.scheduled_rounds) THEN
      n_won := n_won + 1; total_payout := total_payout + b.potential_payout;
    ELSE
      n_lost := n_lost + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'fight_id', p_fight, 'already_settled', EXISTS (SELECT 1 FROM public.settlements WHERE fight_id = p_fight),
    'won', n_won, 'lost', n_lost, 'void', n_void,
    'total_stakes', total_stakes, 'total_payout', total_payout,
    'platform_pl', total_stakes - total_payout
  );
END; $$;

CREATE OR REPLACE FUNCTION public.settle_fight(p_actor UUID, p_fight UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.fights; r public.fight_results; b RECORD; st public.settlements;
  n_won INT:=0; n_lost INT:=0; n_void INT:=0; total_payout NUMERIC:=0; total_stakes NUMERIC:=0;
  v_void_all BOOLEAN; v_totals JSONB; v_win BOOLEAN;
BEGIN
  SELECT * INTO f FROM public.fights WHERE id = p_fight FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FIGHT_NOT_FOUND'; END IF;

  SELECT * INTO st FROM public.settlements WHERE fight_id = p_fight;
  IF FOUND THEN RETURN st.totals || jsonb_build_object('idempotent', true); END IF;

  SELECT * INTO r FROM public.fight_results WHERE fight_id = p_fight;
  IF NOT FOUND THEN RAISE EXCEPTION 'NO_RESULT_ENTERED'; END IF;

  INSERT INTO public.settlements (fight_id, performed_by, totals) VALUES (p_fight, p_actor, '{}'::jsonb) RETURNING * INTO st;
  v_void_all := r.outcome IN ('no_contest','cancelled');

  FOR b IN SELECT bt.*, s.outcome_spec, s.status AS sel_status, mk.status AS mk_status
           FROM public.bets bt JOIN public.selections s ON s.id = bt.selection_id
           JOIN public.markets mk ON mk.id = bt.market_id
           WHERE bt.fight_id = p_fight AND bt.status = 'open' FOR UPDATE OF bt LOOP
    total_stakes := total_stakes + b.stake;

    IF v_void_all OR b.sel_status = 'void' OR b.mk_status = 'void' THEN
      UPDATE public.bets SET status='void', settled_at=now(), settlement_id=st.id, payout_amount=b.stake WHERE id=b.id;
      PERFORM public.wallet_apply(b.user_id, 'bet_stake_returned', b.stake, -b.stake, 'bet', b.id, 'settle_void:'||b.id::text, p_actor, 'Bet voided - stake refunded');
      n_void := n_void + 1; total_payout := total_payout + b.stake;
    ELSE
      v_win := public.selection_matches_result(b.outcome_spec, r.outcome, r.method, r.ending_round, f.scheduled_rounds);
      IF v_win THEN
        UPDATE public.bets SET status='won', settled_at=now(), settlement_id=st.id, payout_amount=b.potential_payout WHERE id=b.id;
        PERFORM public.wallet_apply(b.user_id, 'bet_winnings_paid', b.potential_payout, -b.stake, 'bet', b.id, 'settle_win:'||b.id::text, p_actor, 'Bet won - payout credited');
        n_won := n_won + 1; total_payout := total_payout + b.potential_payout;
      ELSE
        UPDATE public.bets SET status='lost', settled_at=now(), settlement_id=st.id, payout_amount=0 WHERE id=b.id;
        PERFORM public.wallet_apply(b.user_id, 'bet_stake_held', 0, -b.stake, 'bet', b.id, 'settle_lost:'||b.id::text, p_actor, 'Bet lost - stake forfeited');
        n_lost := n_lost + 1;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.selections s SET status = CASE
      WHEN v_void_all THEN 'void'::public.selection_status
      WHEN public.selection_matches_result(s.outcome_spec, r.outcome, r.method, r.ending_round, f.scheduled_rounds) THEN 'won'::public.selection_status
      ELSE 'lost'::public.selection_status END
  WHERE s.market_id IN (SELECT id FROM public.markets WHERE fight_id = p_fight);

  UPDATE public.markets SET status = CASE WHEN v_void_all THEN 'void'::public.market_status ELSE 'settled'::public.market_status END, updated_at=now()
  WHERE fight_id = p_fight;

  UPDATE public.fights SET status='settled', settled_at=now(), updated_at=now() WHERE id=p_fight;

  v_totals := jsonb_build_object('fight_id', p_fight, 'won', n_won, 'lost', n_lost, 'void', n_void,
    'total_stakes', total_stakes, 'total_payout', total_payout, 'platform_pl', total_stakes - total_payout);
  UPDATE public.settlements SET totals = v_totals WHERE id = st.id;

  PERFORM public.log_admin_action(p_actor, 'fight_settled', 'fight', p_fight, NULL, v_totals, NULL);
  RETURN v_totals;
END; $$;

-- ============ RISK / REVENUE ============
CREATE OR REPLACE FUNCTION public.risk_dashboard()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res JSONB;
BEGIN
  SELECT jsonb_build_object(
    'totals', (SELECT jsonb_build_object(
        'open_bets', COUNT(*) FILTER (WHERE status='open'),
        'total_wagered', COALESCE(SUM(stake),0),
        'open_stakes', COALESCE(SUM(stake) FILTER (WHERE status='open'),0),
        'open_liability', COALESCE(SUM(potential_payout) FILTER (WHERE status='open'),0),
        'total_paid_out', COALESCE(SUM(payout_amount) FILTER (WHERE status IN ('won','void','refunded')),0)
      ) FROM public.bets),
    'money', (SELECT jsonb_build_object(
        'total_deposits', COALESCE(SUM(total_deposited),0),
        'total_withdrawals', COALESCE(SUM(total_withdrawn),0),
        'user_available', COALESCE(SUM(available_balance),0),
        'user_held', COALESCE(SUM(held_balance),0)
      ) FROM public.wallets),
    'pending', jsonb_build_object(
        'deposits', (SELECT COUNT(*) FROM public.deposits WHERE status='pending'),
        'withdrawals', (SELECT COUNT(*) FROM public.withdrawals WHERE status='pending')),
    'by_fight', COALESCE((SELECT jsonb_agg(x) FROM (
        SELECT f.id AS fight_id, e.name AS event_name,
               fa.full_name AS fighter_a, fb.full_name AS fighter_b, f.status,
               COALESCE(SUM(b.stake),0) AS stakes,
               COALESCE(SUM(b.potential_payout),0) AS liability,
               COUNT(b.id) AS bet_count
        FROM public.fights f
        JOIN public.events e ON e.id=f.event_id
        JOIN public.fighters fa ON fa.id=f.fighter_a_id
        JOIN public.fighters fb ON fb.id=f.fighter_b_id
        LEFT JOIN public.bets b ON b.fight_id=f.id AND b.status='open'
        GROUP BY f.id, e.name, fa.full_name, fb.full_name, f.status
        ORDER BY 8 DESC NULLS LAST) x), '[]'::jsonb),
    'by_selection', COALESCE((SELECT jsonb_agg(y) FROM (
        SELECT s.id AS selection_id, s.label, mk.name AS market_name, mk.market_type_code, f.id AS fight_id,
               COALESCE(SUM(b.stake),0) AS stakes, COALESCE(SUM(b.potential_payout),0) AS liability,
               COUNT(b.id) AS bet_count
        FROM public.selections s
        JOIN public.markets mk ON mk.id=s.market_id
        JOIN public.fights f ON f.id=mk.fight_id
        LEFT JOIN public.bets b ON b.selection_id=s.id AND b.status='open'
        GROUP BY s.id, s.label, mk.name, mk.market_type_code, f.id
        HAVING COUNT(b.id) > 0
        ORDER BY 7 DESC) y), '[]'::jsonb)
  ) INTO res;
  RETURN res;
END; $$;

-- lock down execution: server-side (service_role) only
REVOKE ALL ON FUNCTION public.log_admin_action(UUID,TEXT,TEXT,UUID,JSONB,JSONB,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wallet_apply(UUID,public.txn_type,NUMERIC,NUMERIC,TEXT,UUID,TEXT,UUID,TEXT,NUMERIC,NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.place_bet(UUID,UUID,NUMERIC,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_deposit(UUID,NUMERIC,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_deposit(UUID,UUID,BOOLEAN,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_withdrawal(UUID,NUMERIC,TEXT,JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_withdrawal(UUID,UUID,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_adjust_balance(UUID,UUID,NUMERIC,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_selection_odds(UUID,UUID,NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_market_status(UUID,UUID,public.market_status) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.void_bets_for_market(UUID,UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enter_fight_result(UUID,UUID,public.fight_outcome,public.victory_method,INT,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.selection_matches_result(JSONB,public.fight_outcome,public.victory_method,INT,INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_settlement(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_fight(UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.risk_dashboard() FROM PUBLIC;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
