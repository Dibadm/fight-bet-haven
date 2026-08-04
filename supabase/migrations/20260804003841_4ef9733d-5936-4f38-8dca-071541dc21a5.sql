
-- Replace helper-based policies with inline role checks
DROP POLICY "own profile read" ON public.profiles;
DROP POLICY "roles read own" ON public.user_roles;
DROP POLICY "public read events" ON public.events;
DROP POLICY "public read fights" ON public.fights;
DROP POLICY "public read markets" ON public.markets;
DROP POLICY "admin read odds history" ON public.odds_history;
DROP POLICY "own wallet read" ON public.wallets;
DROP POLICY "own txn read" ON public.wallet_transactions;
DROP POLICY "own deposits read" ON public.deposits;
DROP POLICY "own withdrawals read" ON public.withdrawals;
DROP POLICY "own bets read" ON public.bets;
DROP POLICY "admin settlements read" ON public.settlements;
DROP POLICY "admin audit read" ON public.admin_audit_logs;

CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

CREATE POLICY "public read events" ON public.events FOR SELECT TO anon, authenticated
USING (status = 'published' OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

CREATE POLICY "public read fights" ON public.fights FOR SELECT TO anon, authenticated
USING (status <> 'draft' OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

CREATE POLICY "public read markets" ON public.markets FOR SELECT TO anon, authenticated
USING (status <> 'draft' OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

CREATE POLICY "admin read odds history" ON public.odds_history FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

CREATE POLICY "own wallet read" ON public.wallets FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

CREATE POLICY "own txn read" ON public.wallet_transactions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

CREATE POLICY "own deposits read" ON public.deposits FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

CREATE POLICY "own withdrawals read" ON public.withdrawals FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

CREATE POLICY "own bets read" ON public.bets FOR SELECT TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

CREATE POLICY "admin settlements read" ON public.settlements FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

CREATE POLICY "admin audit read" ON public.admin_audit_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
