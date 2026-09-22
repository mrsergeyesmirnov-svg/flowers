import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { adminSummary, readShops } from "./admin-data.js";
import { validateTelegramInitData } from "./telegram-auth.js";

const root = resolve(import.meta.dirname);
const port = Number(process.env.PORT || 4173);
const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const webAppUrl = process.env.WEBAPP_URL || process.env.PUBLIC_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
const contacts = process.env.FLOWER_CONTACTS || "Связаться с флористом: @flowers_manager\nТелефон: +7 (999) 000-00-00";
const addresses = process.env.FLOWER_ADDRESSES || "Наш адрес: Санкт-Петербург, адрес цветочного будет добавлен перед запуском.";
const about = process.env.FLOWER_ABOUT || "Мы собираем букеты под конкретного человека, а не просто продаём готовые композиции. Опиши её — флорист предложит три подходящих варианта.";
const privacyTemplate = readFileSync(join(root, "privacy.html"), "utf8");
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function setSecurityHeaders(response, admin = false) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.setHeader("Content-Security-Policy", admin
    ? "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors https://web.telegram.org https://*.telegram.org; form-action 'self'"
    : "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://images.unsplash.com https://unsplash.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://web.telegram.org https://*.telegram.org; form-action 'self'");
}

createServer((request, response) => {
  const path = request.url.split("?")[0];
  const isAdmin = path === "/admin" || path === "/admin.html" || path === "/api/admin";
  setSecurityHeaders(response, isAdmin);
  if (isAdmin) response.setHeader("Cache-Control", "no-store");

  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }

  if (path === "/api/admin") {
    try {
      const auth = validateTelegramInitData(request.headers["x-telegram-init-data"], botToken);
      if (!auth) {
        response.writeHead(401, { "Content-Type": "application/json; charset=utf-8" }).end(JSON.stringify({ error: "Open admin from Telegram" }));
        return;
      }
      const superAdminId = String(process.env.SUPERADMIN_TELEGRAM_ID || "").trim();
      const shopAdminIds = new Set(String(process.env.SHOP_ADMIN_TELEGRAM_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
      const role = auth.userId === superAdminId ? "superadmin" : shopAdminIds.has(auth.userId) ? "shop_admin" : "";
      if (!role) {
        response.writeHead(403, { "Content-Type": "application/json; charset=utf-8" }).end(JSON.stringify({ error: "Access denied" }));
        return;
      }
      let shops = readShops(process.env.ADMIN_SHOPS_JSON, {
        id: process.env.SHOP_ID,
        name: process.env.SHOP_NAME,
        bot: process.env.BOT_USERNAME,
        botOnline: Boolean(botToken)
      });
      if (role === "shop_admin") {
        const shop = shops.find((item) => item.id === process.env.SHOP_ID) || shops[0];
        shops = shop ? [shop] : [];
      }
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ role, summary: adminSummary(shops), shops }));
    } catch (error) {
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (path === "/privacy" || path === "/privacy.html") {
    const policy = privacyTemplate
      .replaceAll("{{POLICY_VERSION}}", "2026-09-21")
      .replaceAll("{{PRIVACY_OPERATOR}}", escapeHtml(process.env.PRIVACY_OPERATOR || "Владелец цветочного магазина, указанный в разделе «Контакты»"))
      .replaceAll("{{PRIVACY_EMAIL}}", escapeHtml(process.env.PRIVACY_EMAIL || "privacy@example.invalid"));
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(request.method === "HEAD" ? "" : policy);
    return;
  }

  const requested = path === "/" ? "/index.html" : path === "/admin" ? "/admin.html" : path;
  const file = resolve(root, `.${requested}`);

  if (!file.startsWith(`${root}/`) || !existsSync(file)) {
    response.writeHead(404).end("Not found");
    return;
  }

  response.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
  if (request.method === "HEAD") response.end();
  else createReadStream(file).pipe(response);
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
      const updates = await telegram("getUpdates", { offset, timeout: 25, allowed_updates: ["message", "callback_query"] });
      for (const update of updates) {
        offset = update.update_id + 1;
        const message = update.message;
        if (message?.text === "/myid") {
          await telegram("sendMessage", { chat_id: message.chat.id, text: `Ваш Telegram ID: ${message.from.id}\nОн нужен только для настройки доступа в Railway Variables.` });
          continue;
        }
        if (message?.text?.startsWith("/start")) {
          const pickButton = webAppUrl
            ? { text: "🌷 Подобрать букет", web_app: { url: webAppUrl } }
            : { text: "🌷 Подобрать букет", callback_data: "no_webapp" };
          const privacyButton = webAppUrl
            ? { text: "🔒 Конфиденциальность", url: `${webAppUrl.replace(/\/$/, "")}/privacy` }
            : { text: "🔒 Конфиденциальность", callback_data: "privacy" };
          const senderId = String(message.from?.id || "");
          const superAdmin = senderId && senderId === String(process.env.SUPERADMIN_TELEGRAM_ID || "").trim();
          const shopAdmin = senderId && new Set(String(process.env.SHOP_ADMIN_TELEGRAM_IDS || "").split(",").map((id) => id.trim()).filter(Boolean)).has(senderId);
          const adminRow = webAppUrl && (superAdmin || shopAdmin)
            ? [[{ text: superAdmin ? "⚙️ Super Admin" : "⚙️ Админ магазина", web_app: { url: `${webAppUrl.replace(/\/$/, "")}/admin` } }]]
            : [];
          await telegram("sendMessage", {
            chat_id: message.chat.id,
            text: "Привет! Я помогу выбрать букет, который подойдёт именно ей.\n\nОтветь на несколько вопросов — и получишь три персональных варианта под повод, характер и бюджет.",
            reply_markup: {
              inline_keyboard: [
                [pickButton],
                [
                  { text: "☎️ Контакты", callback_data: "contacts" },
                  { text: "📍 Адреса", callback_data: "addresses" }
                ],
                [{ text: "🌿 О нас", callback_data: "about" }],
                [privacyButton],
                ...adminRow
              ]
            }
          });
          continue;
        }

        if (message?.text === "/privacy" && webAppUrl) {
          await telegram("sendMessage", { chat_id: message.chat.id, text: `Политика конфиденциальности: ${webAppUrl.replace(/\/$/, "")}/privacy` });
          continue;
        }

        const callback = update.callback_query;
        if (!callback) continue;
        const replies = {
          contacts,
          addresses,
          about,
          privacy: "Политика появится здесь после настройки публичного адреса приложения.",
          no_webapp: "Подбор почти готов. Публичный адрес приложения ещё не настроен."
        };
        const text = replies[callback.data];
        await telegram("answerCallbackQuery", { callback_query_id: callback.id });
        if (text) await telegram("sendMessage", { chat_id: callback.message.chat.id, text });
      }
    } catch (error) {
      console.error("Telegram polling error:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

startBot();
