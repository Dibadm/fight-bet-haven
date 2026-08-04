import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { telegramAuth } from "@/lib/telegram.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const telegramAuthFn = useServerFn(telegramAuth);
  const isTelegram = typeof window !== "undefined" && !!(window as unknown as { Telegram?: unknown }).Telegram;

  useEffect(() => {
    if (!isTelegram) return;
    setBusy(true);
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData: string } } }).Telegram?.WebApp;
    if (!tg?.initData) {
      setBusy(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          if (!cancelled) window.location.href = "/";
          return;
        }

        const { data, error } = await telegramAuthFn({ initData: tg.initData });
        if (cancelled) return;
        if (error || !data?.email || !data?.password) {
          throw new Error(error?.message ?? "Telegram auth failed");
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

        if (signInError) throw signInError;
        if (!cancelled) window.location.href = "/";
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isTelegram, telegramAuthFn]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-3xl leading-none">TELEGRAM ONLY</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {isTelegram
            ? busy
              ? "Signing you in…"
              : error
                ? `Auth failed: ${error}`
                : "Open this app from Telegram."
            : "Open this app inside Telegram to continue."}
        </p>
      </div>
    </div>
  );
}
