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
  const authDone = useRef(false);

  useEffect(() => {
    if (authDone.current) return;

    let cancelled = false;

    function doAuth(initData: string) {
      if (cancelled || authDone.current) return;
      authDone.current = true;
      setState({ busy: true, error: null, done: false });

      (async () => {
        try {
          const { data: session } = await supabase.auth.getSession();
          if (session.session) {
            setState({ busy: false, error: null, done: true });
            return;
          }

          const data = await telegramAuthFn({ data: { initData } });
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

          setState({ busy: false, error: null, done: true });
        } catch (err) {
          if (!cancelled) setState({ busy: false, error: (err as Error).message, done: true });
        }
      })();
    }

    const tg = (window as unknown as { Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void; onEvent: (event: string, cb: () => void) => void } } })
      .Telegram?.WebApp;

    if (!tg) {
      const checkInterval = setInterval(() => {
        const t = (window as unknown as { Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void; onEvent: (event: string, cb: () => void) => void } } })
          .Telegram?.WebApp;
        if (t) {
          clearInterval(checkInterval);
          t.ready();
          t.expand();
          if (t.initData) {
            doAuth(t.initData);
          } else {
            t.onEvent("initDataReady", () => {
              if (!cancelled && t.initData) doAuth(t.initData);
            });
            setTimeout(() => {
              if (!authDone.current && !cancelled) {
                setState({ busy: false, error: null, done: true });
              }
            }, 5000);
          }
        }
      }, 300);
      setTimeout(() => clearInterval(checkInterval), 5000);
      return;
    }

    tg.ready();
    tg.expand();

    if (tg.initData) {
      doAuth(tg.initData);
    } else {
      tg.onEvent("initDataReady", () => {
        if (!cancelled && tg.initData) doAuth(tg.initData);
      });
      setTimeout(() => {
        if (!authDone.current && !cancelled) {
          setState({ busy: false, error: null, done: true });
        }
      }, 5000);
    }

    return () => {
      cancelled = true;
    };
  }, [telegramAuthFn]);

  return state;
}