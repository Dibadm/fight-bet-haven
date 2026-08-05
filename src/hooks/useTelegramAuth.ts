import { useEffect, useRef, useState } from "react";
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
  const tried = useRef(false);

  useEffect(() => {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void } } })
      .Telegram?.WebApp;

    if (!tg) {
      setState({ busy: false, error: null, done: true });
      return;
    }

    tg.ready();
    tg.expand();

    if (!tg.initData) {
      if (!tried.current) {
        tried.current = true;
        const interval = setInterval(() => {
          const t = (window as unknown as { Telegram?: { WebApp?: { initData: string } } }).Telegram?.WebApp;
          if (t?.initData) {
            clearInterval(interval);
            doAuth(t.initData);
          }
        }, 200);
        setTimeout(() => clearInterval(interval), 3000);
      }
      return;
    }

    doAuth(tg.initData);

    async function doAuth(initData: string) {
      if (state.done) return;
      setState({ busy: true, error: null, done: false });

      try {
        const { data: session } = await supabase.auth.getSession();
        if (session.session) {
          setState({ busy: false, error: null, done: true });
          return;
        }

        const data = await telegramAuthFn({ data: { initData } });
        if (!data?.email || !data?.password) {
          setState({ busy: false, error: "Telegram auth failed", done: true });
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (signInError) {
          setState({ busy: false, error: signInError.message, done: true });
          return;
        }

        setState({ busy: false, error: null, done: true });
      } catch (err) {
        setState({ busy: false, error: (err as Error).message, done: true });
      }
    }
  }, [telegramAuthFn]);

  return state;
}