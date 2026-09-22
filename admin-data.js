const allowedSubscriptions = new Set(["trial", "active", "overdue", "paused"]);
const allowedBotStatuses = new Set(["online", "setup", "error"]);

export function readShops(value, fallback = {}) {
  if (!value) return [{
    id: fallback.id || "flowers-pilot",
    name: fallback.name || "Цветы — пилот",
    bot: fallback.bot || "Не указан",
    plan: "Пилот",
    subscription: "trial",
    monthly: 2900,
    paidUntil: "",
    botStatus: fallback.botOnline ? "online" : "setup",
    orders: 0
  }];

  const shops = JSON.parse(value);
  if (!Array.isArray(shops)) throw new Error("ADMIN_SHOPS_JSON must be an array");
  return shops.map((shop, index) => ({
    id: String(shop.id || `shop-${index + 1}`),
    name: String(shop.name || "Без названия"),
    bot: String(shop.bot || "Не указан"),
    plan: String(shop.plan || "Start"),
    subscription: allowedSubscriptions.has(shop.subscription) ? shop.subscription : "trial",
    monthly: Math.max(0, Number(shop.monthly) || 0),
    paidUntil: String(shop.paidUntil || ""),
    botStatus: allowedBotStatuses.has(shop.botStatus) ? shop.botStatus : "setup",
    orders: Math.max(0, Number(shop.orders) || 0)
  }));
}

export function adminSummary(shops) {
  return {
    shops: shops.length,
    online: shops.filter((shop) => shop.botStatus === "online").length,
    active: shops.filter((shop) => shop.subscription === "active").length,
    attention: shops.filter((shop) => shop.subscription === "overdue" || shop.botStatus === "error").length,
    mrr: shops.filter((shop) => shop.subscription === "active").reduce((sum, shop) => sum + shop.monthly, 0),
    orders: shops.reduce((sum, shop) => sum + shop.orders, 0)
  };
}
