import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TelegramInitDataSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  allows_write_to_pm: z.boolean().optional(),
  photo_url: z.string().optional(),
});

function parseInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const userStr = params.get("user");
  if (!userStr) throw new Error("Missing user in Telegram initData");
  const user = TelegramInitDataSchema.parse(JSON.parse(userStr));

  const hash = params.get("hash");
  if (!hash) throw new Error("Missing hash in Telegram initData");

  const authDate = params.get("auth_date");
  if (!authDate) throw new Error("Missing auth_date in Telegram initData");

  return { user, hash, authDate, params };
}

async function verifyTelegramHash(params: URLSearchParams, hash: string, botToken: string): Promise<boolean> {
  const entries: string[] = [];
  params.forEach((value, key) => {
    if (key === "hash") return;
    entries.push(`${key}=${value}`);
  });
  entries.sort();
  const dataCheckString = entries.join("\n");

  const encoder = new TextEncoder();
  const secretKeyBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(botToken));
  
  const secretKey = await crypto.subtle.importKey(
    "raw",
    secretKeyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signatureBytes = hexToBytes(hash);
  return crypto.subtle.verify("HMAC", secretKey, signatureBytes, encoder.encode(dataCheckString));
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

async function createTelegramUser(user: { id: number; first_name: string; last_name?: string; username?: string }) {
  const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const telegramId = String(user.id);
  const email = `tg_${telegramId}@telegram.local`;
  const password = crypto.randomUUID();

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id, telegram_id")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (existing?.id) {
    await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
    return { userId: existing.id, email, password };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { telegram_id: telegramId, first_name: user.first_name, last_name: user.last_name, username: user.username },
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message ?? "Failed to create Telegram user");
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: authData.user.id,
    telegram_id: telegramId,
    full_name: `${user.first_name}${user.last_name ? ` ${user.last_name}` : ""}`,
    nickname: user.username,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    throw new Error(profileError.message);
  }

  return { userId: authData.user.id, email, password };
}

export const telegramAuth = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ initData: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const botToken = process.env["TELEGRAM_BOT_TOKEN"];
    if (!botToken) throw new Error("Telegram bot token not configured");

    const { user, hash, params } = parseInitData(data.initData);

    const valid = await verifyTelegramHash(params, hash, botToken);
    if (!valid) throw new Error("Invalid Telegram initData signature");

    const { userId, email, password } = await createTelegramUser(user);

    return { userId, email, password, telegramUser: user };
  });

export const verifyTelegramInitData = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ initData: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const botToken = process.env["TELEGRAM_BOT_TOKEN"];
    if (!botToken) throw new Error("Telegram bot token not configured");

    const { user, hash, params } = parseInitData(data.initData);
    const valid = await verifyTelegramHash(params, hash, botToken);
    if (!valid) throw new Error("Invalid Telegram initData signature");

    return { valid: true, user };
  });
