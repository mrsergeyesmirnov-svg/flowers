const labels = { trial:"Пилот", active:"Активна", overdue:"Просрочена", paused:"Приостановлена" };
const telegram = window.Telegram?.WebApp;
const state = { role:"", database:false, shops:[], current:null, catalog:[] };
const $ = (selector) => document.querySelector(selector);
const money = (value) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "X-Telegram-Init-Data": telegram.initData, ...(options.body ? { "Content-Type":"application/json" } : {}) }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Ошибка запроса");
  return result;
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  setTimeout(() => { $("#toast").hidden = true; }, 2200);
}

function formObject(form) {
  const values = Object.fromEntries(new FormData(form));
  values.monthly = Number(values.monthly || 0);
  values.enabled = state.current?.enabled !== false;
  return values;
}

function statusPill(shop) {
  const pill = element("span", `pill ${!shop.enabled ? "off" : shop.subscription === "active" ? "" : "warn"}`);
  pill.textContent = !shop.enabled ? "Отключён" : labels[shop.subscription] || shop.subscription;
  return pill;
}

function updateDashboard(summary) {
  $("#shopsCount").textContent = summary.shops;
  $("#mrr").textContent = money(summary.mrr);
  $("#activeCount").textContent = summary.active;
  $("#ordersCount").textContent = summary.orders;
  $("#summaryLine").textContent = `${summary.online} онлайн · ${summary.attention} требуют внимания`;
}

function renderShops() {
  const list = $("#shopsList");
  list.replaceChildren();
  state.shops.forEach((shop) => {
    const button = element("button", "shop-card");
    button.type = "button";
    const content = element("div");
    content.append(element("h3", "", shop.name), element("p", "", `${shop.bot || "Бот не указан"} · ${shop.plan} · ${money(shop.monthly)}`));
    const pills = element("div", "pills");
    pills.append(statusPill(shop), element("span", "pill", `${shop.orders} заказов`));
    content.append(pills);
    button.append(content, element("span", "arrow", "→"));
    button.addEventListener("click", () => openShop(shop.id));
    list.append(button);
  });
}

function fillShopForm(shop) {
  const form = $("#shopForm");
  for (const [key, value] of Object.entries(shop)) if (form.elements[key]) form.elements[key].value = value ?? "";
}

async function openShop(id) {
  state.current = state.shops.find((shop) => shop.id === id);
  if (!state.current) return;
  $("#overview").hidden = true;
  $("#shopPanel").hidden = false;
  $("#shopTitle").textContent = state.current.name;
  $("#shopBot").textContent = `${state.current.bot || "Бот не указан"} · ${state.current.plan} · ${money(state.current.monthly)}`;
  $("#shopStatus").textContent = state.current.enabled ? labels[state.current.subscription] : "Отключён";
  $("#toggleShopButton").textContent = state.current.enabled ? "Приостановить" : "Подключить";
  fillShopForm(state.current);
  const { catalog } = await api(`/api/admin/shops/${encodeURIComponent(id)}/catalog`);
  state.catalog = catalog;
  renderCatalog();
}

function renderCatalog() {
  const list = $("#catalogList");
  list.replaceChildren();
  $("#catalogSummary").textContent = `${state.catalog.filter((item) => item.available).length} в наличии · ${state.catalog.length} всего`;
  state.catalog.forEach((bouquet) => {
    const card = element("article", "catalog-card");
    const image = bouquet.image ? element("img") : element("div", "image-placeholder");
    if (bouquet.image) { image.src = bouquet.image; image.alt = ""; image.referrerPolicy = "no-referrer"; }
    const content = element("div");
    content.append(element("h3", "", bouquet.name), element("p", "", bouquet.flowers), element("strong", "", money(bouquet.price)));
    const availability = element("span", `pill ${bouquet.available ? "" : "off"}`, bouquet.available ? "В наличии" : "Скрыт");
    content.append(availability);
    const edit = element("button", "", "Изменить");
    edit.type = "button";
    edit.addEventListener("click", () => showBouquetDialog(bouquet));
    card.append(image, content, edit);
    list.append(card);
  });
}

function showBouquetDialog(bouquet = null) {
  const form = $("#bouquetForm");
  form.reset();
  form.elements.id.value = bouquet?.id || "";
  for (const key of ["name","flowers","description","price","image"]) form.elements[key].value = bouquet?.[key] ?? "";
  form.elements.available.checked = bouquet?.available !== false;
  $("#bouquetDialogTitle").textContent = bouquet ? "Изменить букет" : "Новый букет";
  $("#bouquetDialog").showModal();
}

async function load() {
  const data = await api("/api/admin");
  Object.assign(state, data);
  const superAdmin = state.role === "superadmin";
  document.querySelectorAll(".super-only").forEach((node) => { node.hidden = !superAdmin; });
  $("#roleTitle").textContent = superAdmin ? "Super Admin" : "Магазин";
  $("#roleBadge").textContent = superAdmin ? "MEGA ADMIN" : "SHOP ADMIN";
  $("#databaseNotice").hidden = state.database;
  updateDashboard(data.summary);
  renderShops();
  $("#adminApp").hidden = false;
  if (!superAdmin && state.shops[0]) await openShop(state.shops[0].id);
}

telegram?.ready();
telegram?.expand();
if (!telegram?.initData) document.body.textContent = "Недоступно";
else load().catch(() => { document.body.textContent = "Не удалось открыть админку"; });

$("#refreshButton").addEventListener("click", () => location.reload());
$("#backButton").addEventListener("click", () => { $("#shopPanel").hidden = true; $("#overview").hidden = false; });
$("#addShopButton").addEventListener("click", () => $("#shopDialog").showModal());
$("#addBouquetButton").addEventListener("click", () => showBouquetDialog());
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.close}`).close()));

$("#newShopForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = formObject(event.currentTarget);
    payload.enabled = true;
    const { shop } = await api("/api/admin/shops", { method:"POST", body:JSON.stringify(payload) });
    state.shops.push(shop);
    renderShops();
    $("#shopDialog").close();
    toast("Магазин подключён");
  } catch (error) { toast(error.message); }
});

$("#shopForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const { shop } = await api(`/api/admin/shops/${encodeURIComponent(state.current.id)}`, { method:"PATCH", body:JSON.stringify(formObject(event.currentTarget)) });
    state.current = shop;
    state.shops = state.shops.map((item) => item.id === shop.id ? shop : item);
    await openShop(shop.id);
    toast("Магазин сохранён");
  } catch (error) { toast(error.message); }
});

$("#toggleShopButton").addEventListener("click", async () => {
  try {
    const payload = { ...state.current, enabled: !state.current.enabled };
    const { shop } = await api(`/api/admin/shops/${encodeURIComponent(state.current.id)}`, { method:"PATCH", body:JSON.stringify(payload) });
    state.current = shop;
    state.shops = state.shops.map((item) => item.id === shop.id ? shop : item);
    await openShop(shop.id);
    toast(shop.enabled ? "Магазин подключён" : "Магазин приостановлен");
  } catch (error) { toast(error.message); }
});

$("#bouquetForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const form = event.currentTarget;
    const id = form.elements.id.value;
    const payload = Object.fromEntries(new FormData(form));
    payload.price = Number(payload.price);
    payload.available = form.elements.available.checked;
    const path = `/api/admin/shops/${encodeURIComponent(state.current.id)}/catalog${id ? `/${encodeURIComponent(id)}` : ""}`;
    await api(path, { method:id ? "PATCH" : "POST", body:JSON.stringify(payload) });
    $("#bouquetDialog").close();
    await openShop(state.current.id);
    toast("Ассортимент обновлён");
  } catch (error) { toast(error.message); }
});
