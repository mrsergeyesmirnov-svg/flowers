import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname);
const port = Number(process.env.PORT || 4173);
const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const webAppUrl = process.env.WEBAPP_URL || process.env.PUBLIC_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

createServer((request, response) => {
  const requested = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const file = join(root, requested);

  if (!file.startsWith(root) || !existsSync(file)) {
    response.writeHead(404).end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(port, () => console.log(`Flowers is running at http://localhost:${port}`));

async function telegram(method, body = {}) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!result.ok) throw new Error(result.description || `Telegram ${method} failed`);
  return result.result;
}

async function startBot() {
  if (!botToken) {
    console.log("TELEGRAM_BOT_TOKEN is not set; web app only");
    return;
  }

  await telegram("deleteWebhook", { drop_pending_updates: true });
  let offset = 0;
  console.log("Telegram bot is polling");

  while (true) {
    try {
      const updates = await telegram("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });
      for (const update of updates) {
        offset = update.update_id + 1;
        const message = update.message;
        if (!message?.text?.startsWith("/start")) continue;

        const replyMarkup = webAppUrl ? {
          inline_keyboard: [[{ text: "Подобрать букет", web_app: { url: webAppUrl } }]]
        } : undefined;
        await telegram("sendMessage", {
          chat_id: message.chat.id,
          text: webAppUrl
            ? "Опиши её — и мы подберём три букета под характер, повод и бюджет."
            : "Бот запущен, но публичный адрес приложения пока не настроен.",
          reply_markup: replyMarkup
        });
      }
    } catch (error) {
      console.error("Telegram polling error:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

startBot();
