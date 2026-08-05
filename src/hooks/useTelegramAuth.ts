import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { telegramAuth } from "@/lib/telegram.functions";
import { supabase } from "@/integrations/supabase/client";

type TelegramAuthState = {
  busy: boolean;
  error: string | null;
  done: boolean;
};

export function useTelegramAuth() {
  const [state, setState] = useState<TelegramAuthState>({ busy: false, error: null, done: false });
  const telegramAuthFn = useServerFn(telegramAuth);

  useEffect(() => {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void } } })
      .Telegram?.WebApp;

    if (!tg?.initData) {
      setState((s) => ({ ...s, done: true }));
      return;
    }

    let cancelled = false;
    setState({ busy: true, error: null, done: false });

    tg.ready();
    tg.expand();

    async function auth() {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session.session) {
          if (!cancelled) setState({ busy: false, error: null, done: true });
          return;
        }

        const data = await telegramAuthFn({ data: { initData: tg!.initData } });
        if (cancelled) return;
        if (!data?.email || !data?.password) {
          setState({ busy: false, error: "Telegram auth failed", done: true });
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (cancelled) return;
        if (signInError) {
          setState({ busy: false, error: signInError.message, done: true });
          return;
        }

        if (!cancelled) setState({ busy: false, error: null, done: true });
      } catch (err) {
        if (!cancelled) setState({ busy: false, error: (err as Error).message, done: true });
      }
    }

    auth();

    return () => {
      cancelled = true;
    };
  }, [telegramAuthFn]);

  return state;
}
