const labels = { trial:"Пилот", active:"Активна", overdue:"Просрочена", paused:"Приостановлена", online:"Онлайн", setup:"Настройка", error:"Ошибка" };
const money = (value) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
const cell = (row, value, className = "") => { const td=document.createElement("td"); td.className=className; td.textContent=value; row.append(td); return td; };

try {
  const telegram = window.Telegram?.WebApp;
  telegram?.ready();
  telegram?.expand();
  if (!telegram?.initData) throw new Error("Откройте админку кнопкой в Telegram-боте");
  const response = await fetch("/api/admin", { headers: { "X-Telegram-Init-Data": telegram.initData } });
  if (!response.ok) throw new Error("Не удалось загрузить данные");
  const { role, summary, shops } = await response.json();
  document.querySelector("#adminApp").hidden = false;
  const isSuperAdmin = role === "superadmin";
  document.querySelector("#roleTitle").textContent = isSuperAdmin ? "Super Admin" : "Админ магазина";
  document.querySelector("#roleBadge").textContent = isSuperAdmin ? "MEGA ADMIN" : "SHOP ADMIN";
  if (!isSuperAdmin) {
    document.querySelector("#shopsLabel").textContent = "Магазин";
    document.querySelector("#mrrLabel").textContent = "Тариф в месяц";
    document.querySelector("#activeLabel").textContent = "Подписка";
  }
  document.querySelector("#shopsCount").textContent = summary.shops;
  document.querySelector("#mrr").textContent = isSuperAdmin ? money(summary.mrr) : money(shops[0]?.monthly || 0);
  document.querySelector("#activeCount").textContent = isSuperAdmin ? summary.active : labels[shops[0]?.subscription] || "—";
  document.querySelector("#ordersCount").textContent = summary.orders;
  document.querySelector("#summaryLine").textContent = `${summary.online} онлайн · ${summary.attention} требуют внимания`;
  document.querySelector("#empty").hidden = shops.length > 0;
  const table = document.querySelector("#shopsTable");
  shops.forEach((shop) => {
    const row=document.createElement("tr");
    const shopCell=cell(row, "", "shop");
    const name=document.createElement("b"); name.textContent=shop.name;
    const id=document.createElement("small"); id.textContent=shop.id;
    shopCell.append(name,id);
    cell(row, shop.bot);
    cell(row, `${shop.plan} · ${money(shop.monthly)}`);
    const subscription=cell(row, ""); subscription.append(Object.assign(document.createElement("span"), { className:`status ${shop.subscription}`, textContent:labels[shop.subscription] }));
    cell(row, shop.paidUntil || "—");
    const bot=cell(row, ""); bot.append(Object.assign(document.createElement("span"), { className:`status ${shop.botStatus}`, textContent:labels[shop.botStatus] }));
    cell(row, shop.orders);
    table.append(row);
  });
} catch {
  document.body.textContent = "Недоступно";
}
