import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { adminSummary, readShops } from "./admin-data.js";
import { bouquets as demoBouquets } from "./recommender.js";
import { validateTelegramInitData } from "./telegram-auth.js";
import {
  createBouquet, createShop, databaseEnabled, ensureDatabase, getShop,
  listCatalog, listShops, updateBouquet, updateShop
} from "./database.mjs";

const root = resolve(import.meta.dirname);
const port = Number(process.env.PORT || 4173);
const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const webAppUrl = process.env.WEBAPP_URL || process.env.PUBLIC_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "");
const contacts = process.env.FLOWER_CONTACTS || "Связаться с флористом: @flowers_manager\nТелефон: +7 (999) 000-00-00";
const addresses = process.env.FLOWER_ADDRESSES || "Наш адрес: Санкт-Петербург, адрес цветочного будет добавлен перед запуском.";
const about = process.env.FLOWER_ABOUT || "Мы собираем букеты под конкретного человека, а не просто продаём готовые композиции. Опиши получателя — флорист предложит три подходящих варианта.";
const privacyTemplate = readFileSync(join(root, "privacy.html"), "utf8");
const databaseReady = ensureDatabase().catch((error) => {
  console.error("Database initialization failed:", error.message);
  throw error;
});
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
    ? "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors https://web.telegram.org https://*.telegram.org; form-action 'self'"
    : "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://images.unsplash.com https://unsplash.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://web.telegram.org https://*.telegram.org; form-action 'self'");
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 64_000) throw Object.assign(new Error("Слишком большой запрос"), { status: 413 });
  }
  try { return JSON.parse(body || "{}"); }
  catch { throw Object.assign(new Error("Некорректный JSON"), { status: 400 }); }
}

function adminAccess(request) {
  const auth = validateTelegramInitData(request.headers["x-telegram-init-data"], botToken, { maxAgeSeconds: 3600 });
  if (!auth) return null;
  const superAdminId = String(process.env.SUPERADMIN_TELEGRAM_ID || "").trim();
  const shopAdminIds = new Set(String(process.env.SHOP_ADMIN_TELEGRAM_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
  if (auth.userId === superAdminId) return { role: "superadmin" };
  if (shopAdminIds.has(auth.userId)) return { role: "shop_admin", shopId: process.env.SHOP_ID || "" };
  return { role: "denied" };
}

function validateShop(input, id = input.id) {
  const subscriptions = new Set(["trial", "active", "overdue", "paused"]);
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(String(id || ""))) throw Object.assign(new Error("ID: 2–40 латинских символов, цифр или дефисов"), { status: 400 });
  if (!String(input.name || "").trim()) throw Object.assign(new Error("Введите название магазина"), { status: 400 });
  if (!subscriptions.has(input.subscription)) throw Object.assign(new Error("Некорректный статус подписки"), { status: 400 });
  if (input.paidUntil && !/^\d{4}-\d{2}-\d{2}$/.test(String(input.paidUntil))) throw Object.assign(new Error("Некорректная дата оплаты"), { status: 400 });
  return {
    id: String(id), name: String(input.name).trim().slice(0, 120), bot: String(input.bot || "").trim().slice(0, 80),
    plan: String(input.plan || "Start").trim().slice(0, 40), subscription: input.subscription,
    monthly: Math.max(0, Math.round(Number(input.monthly) || 0)), paidUntil: String(input.paidUntil || ""), enabled: input.enabled !== false
  };
}

function validateBouquet(input) {
  if (!String(input.name || "").trim() || !String(input.flowers || "").trim()) throw Object.assign(new Error("Укажите название и состав"), { status: 400 });
  const price = Math.round(Number(input.price));
  if (!Number.isFinite(price) || price < 0) throw Object.assign(new Error("Некорректная цена"), { status: 400 });
  return {
    name: String(input.name).trim().slice(0, 120), flowers: String(input.flowers).trim().slice(0, 300),
    description: String(input.description || "").trim().slice(0, 500), price,
    image: String(input.image || "").trim().slice(0, 1000), available: input.available !== false
  };
}

async function shopsFor(access) {
  if (databaseEnabled) {
    await databaseReady;
    const shops = await listShops();
    return access.role === "shop_admin" ? shops.filter((shop) => shop.id === access.shopId) : shops;
  }
  const shops = readShops(process.env.ADMIN_SHOPS_JSON, {
    id: process.env.SHOP_ID, name: process.env.SHOP_NAME, bot: process.env.BOT_USERNAME, botOnline: Boolean(botToken)
  });
  return access.role === "shop_admin" ? shops.filter((shop) => shop.id === access.shopId) : shops;
}

createServer(async (request, response) => {
  const path = request.url.split("?")[0];
  const isAdmin = path === "/admin" || path === "/admin.html" || path.startsWith("/api/admin");
  setSecurityHeaders(response, isAdmin);
  if (isAdmin) response.setHeader("Cache-Control", "no-store");

  if (path.startsWith("/api/admin")) {
    try {
      const access = adminAccess(request);
      if (!access) return json(response, 401, { error: "Откройте админку из Telegram" });
      if (access.role === "denied") return json(response, 403, { error: "Доступ запрещён" });

      if (path === "/api/admin" && request.method === "GET") {
        const shops = await shopsFor(access);
        return json(response, 200, { role: access.role, database: databaseEnabled, summary: adminSummary(shops), shops });
      }
      if (!databaseEnabled) return json(response, 503, { error: "Подключите Postgres в Railway" });
      await databaseReady;

      if (path === "/api/admin/shops" && request.method === "POST") {
        if (access.role !== "superadmin") return json(response, 403, { error: "Только Super Admin" });
        const shop = await createShop(validateShop(await readJson(request)));
        return json(response, 201, { shop });
      }

      const catalogMatch = path.match(/^\/api\/admin\/shops\/([^/]+)\/catalog(?:\/([^/]+))?$/);
      if (catalogMatch) {
        const shopId = decodeURIComponent(catalogMatch[1]);
        const bouquetId = catalogMatch[2] ? decodeURIComponent(catalogMatch[2]) : "";
        if (access.role !== "superadmin" && access.shopId !== shopId) return json(response, 403, { error: "Чужой магазин" });
        if (request.method === "GET" && !bouquetId) return json(response, 200, { catalog: await listCatalog(shopId) });
        if (request.method === "POST" && !bouquetId) return json(response, 201, { bouquet: await createBouquet(shopId, validateBouquet(await readJson(request))) });
        if (request.method === "PATCH" && bouquetId) {
          const bouquet = await updateBouquet(shopId, bouquetId, validateBouquet(await readJson(request)));
          return bouquet ? json(response, 200, { bouquet }) : json(response, 404, { error: "Букет не найден" });
        }
      }

      const shopMatch = path.match(/^\/api\/admin\/shops\/([^/]+)$/);
      if (shopMatch && request.method === "PATCH") {
        if (access.role !== "superadmin") return json(response, 403, { error: "Только Super Admin" });
        const id = decodeURIComponent(shopMatch[1]);
        const shop = await updateShop(id, validateShop(await readJson(request), id));
        return shop ? json(response, 200, { shop }) : json(response, 404, { error: "Магазин не найден" });
      }
      return json(response, 405, { error: "Недоступная операция" });
    } catch (error) {
      return json(response, error.status || 500, { error: error.status ? error.message : "Ошибка сервера" });
    }
  }

  if (path === "/api/catalog" && request.method === "GET") {
    try {
      const shopId = process.env.SHOP_ID;
      if (!databaseEnabled || !shopId) return json(response, 200, { catalog: demoBouquets });
      await databaseReady;
      const shop = await getShop(shopId);
      if (shop && !shop.enabled) return json(response, 200, { catalog: [] });
      return json(response, 200, { catalog: await listCatalog(shopId, true) });
    } catch {
      return json(response, 200, { catalog: demoBouquets });
    }
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }

  if (path === "/privacy" || path === "/privacy.html") {
    const policy = privacyTemplate
      .replaceAll("{{POLICY_VERSION}}", "22 сентября 2026 года")
      .replaceAll("{{PRIVACY_OPERATOR}}", escapeHtml(process.env.PRIVACY_OPERATOR || "РЕКВИЗИТЫ ОПЕРАТОРА НЕ ЗАПОЛНЕНЫ"))
      .replaceAll("{{PRIVACY_INN}}", escapeHtml(process.env.PRIVACY_INN || "не указан"))
      .replaceAll("{{PRIVACY_OGRN}}", escapeHtml(process.env.PRIVACY_OGRN || "не указан"))
      .replaceAll("{{PRIVACY_ADDRESS}}", escapeHtml(process.env.PRIVACY_ADDRESS || "не указан"))
      .replaceAll("{{PRIVACY_EMAIL}}", escapeHtml(process.env.PRIVACY_EMAIL || "privacy@example.invalid"))
      .replaceAll("{{PRIVACY_PHONE}}", escapeHtml(process.env.PRIVACY_PHONE ? ` · ${process.env.PRIVACY_PHONE}` : ""))
      .replaceAll("{{PRIVACY_RKN_ID}}", escapeHtml(process.env.PRIVACY_RKN_ID || "не указана"))
      .replaceAll("{{SHOP_OPERATOR}}", escapeHtml(process.env.SHOP_OPERATOR || process.env.SHOP_NAME || "РЕКВИЗИТЫ МАГАЗИНА НЕ ЗАПОЛНЕНЫ"))
      .replaceAll("{{HOSTING_LOCATION}}", escapeHtml(process.env.PRIVACY_HOSTING_LOCATION || "РЕГИОН БАЗЫ ДАННЫХ НЕ УКАЗАН"));
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
          if (databaseEnabled && process.env.SHOP_ID) {
            try {
              await databaseReady;
              const shop = await getShop(process.env.SHOP_ID);
              if (shop && !shop.enabled) {
                await telegram("sendMessage", { chat_id: message.chat.id, text: "Магазин временно не принимает заказы." });
                continue;
              }
            } catch {
              await telegram("sendMessage", { chat_id: message.chat.id, text: "Сервис временно недоступен. Попробуйте немного позже." });
              continue;
            }
          }
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
            text: "Привет! Я помогу выбрать букет для важного человека.\n\nОтветь на несколько вопросов — и получишь три персональных варианта под получателя, повод, характер и бюджет.",
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
