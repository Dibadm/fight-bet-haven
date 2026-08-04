import 'dotenv/config';
import { TelegramBot } from 'node-telegram-bot-api';

const token = process.env.TELEGRAM_BOT_TOKEN;
const webAppUrl = process.env.WEB_APP_URL || 'https://fight-bet-haven-lzuihsko0-dibadms-projects.vercel.app';

if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Please share your contact to continue.', {
    reply_markup: {
      keyboard: [[{ text: 'Share Contact', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
});

bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;
  if (!msg.contact) return;

  const telegramId = String(msg.from.id);

  await bot.sendMessage(chatId, 'Your contact has been received! Click below to open EFTC.', {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Open EFTC',
        web_app: { url: webAppUrl },
      }]],
    },
  });
});

bot.on('polling_error', (err) => console.error('Polling error:', err.message));
