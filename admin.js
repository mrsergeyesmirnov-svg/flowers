const labels = { trial:"Пилот", active:"Активна", overdue:"Просрочена", paused:"Приостановлена" };
const orderLabels = { new:"Новый", confirmed:"Подтверждён", working:"В работе", ready:"Готов", completed:"Завершён" };
const roleLabels = { owner:"Владелец", manager:"Менеджер", florist:"Флорист" };
const telegram = window.Telegram?.WebApp;
const state = { role:"", database:false, shops:[], current:null, catalog:[], staff:[], orders:[], orderFilter:"" };
const $ = (selector) => document.querySelector(selector);
const money = (value) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { "X-Telegram-Init-Data": telegram.initData, ...(options.body ? { "Content-Type":"application/json" } : {}) } });
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
    content.append(element("h3", "", shop.name), element("p", "", `${shop.bot || "Бот не указан"} · ${shop.plan} · ${money(shop.monthly)}`), element("code", "shop-card-id", `SHOP_ID=${shop.id}`));
    const pills = element("div", "pills");
    pills.append(statusPill(shop), element("span", "pill", `${shop.orders} заказов`));
    content.append(pills);
    button.append(content, element("span", "arrow", "→"));
    button.addEventListener("click", () => openShop(shop.id));
    list.append(button);
  });
}

function fillForm(form, data) {
  for (const [key, value] of Object.entries(data)) if (form.elements[key]) form.elements[key].value = value ?? "";
}

async function openShop(id) {
  state.current = state.shops.find((shop) => shop.id === id);
  if (!state.current) return;
  $("#overview").hidden = true;
  $("#shopPanel").hidden = false;
  $("#shopTitle").textContent = state.current.name;
  $("#shopBot").textContent = state.role === "superadmin" ? `${state.current.bot || "Бот не указан"} · ${state.current.plan} · ${money(state.current.monthly)}` : state.current.bot || "Бот магазина";
  $("#shopId").textContent = `SHOP_ID=${state.current.id}`;
  $("#shopStatus").textContent = state.current.enabled ? labels[state.current.subscription] : "Отключён";
  $("#toggleShopButton").textContent = state.current.enabled ? "Приостановить" : "Подключить";
  $("#mailingSender").value = state.current.name;
  fillForm($("#shopForm"), state.current);
  fillForm($("#profileForm"), state.current);
  const base = `/api/admin/shops/${encodeURIComponent(id)}`;
  const [{ catalog }, { staff }, { orders }] = await Promise.all([api(`${base}/catalog`), api(`${base}/staff`), api(`${base}/orders`)]);
  state.catalog = catalog;
  state.staff = staff;
  state.orders = orders;
  renderCatalog("bouquet");
  renderCatalog("addon");
  renderStaff();
  renderOrders();
  showTab(state.role === "superadmin" ? "catalog" : "orders");
}

function renderCatalog(kind) {
  const items = state.catalog.filter((item) => (item.kind || "bouquet") === kind);
  const list = $(kind === "addon" ? "#addonsList" : "#catalogList");
  const summary = $(kind === "addon" ? "#addonsSummary" : "#catalogSummary");
  list.replaceChildren();
  summary.textContent = `${items.filter((item) => item.available).length} в наличии · ${items.length} всего`;
  if (!items.length) list.append(element("div", "empty-state", kind === "addon" ? "Добавьте открытки, сладости, вазы или другие дополнения." : "Добавьте первый букет в ассортимент."));
  items.forEach((item) => {
    const card = element("article", "catalog-card");
    const image = item.image ? element("img") : element("div", "image-placeholder");
    if (item.image) { image.src = item.image; image.alt = ""; image.referrerPolicy = "no-referrer"; }
    const content = element("div");
    content.append(element("h3", "", item.name), element("p", "", item.flowers), element("strong", "", money(item.price)), element("span", `pill ${item.available ? "" : "off"}`, item.available ? "В наличии" : "Скрыт"));
    const edit = element("button", "", "Изменить");
    edit.type = "button";
    edit.addEventListener("click", () => showBouquetDialog(item, kind));
    card.append(image, content, edit);
    list.append(card);
  });
}

function renderStaff() {
  const list = $("#staffList");
  list.replaceChildren();
  if (!state.staff.length) list.append(element("div", "empty-state", "Добавьте владельца, менеджера или флориста по номеру телефона."));
  state.staff.forEach((person) => {
    const card = element("article", "team-card");
    const info = element("div");
    info.append(element("h3", "", person.name), element("p", "", `${roleLabels[person.role]} · ${person.phone}`), element("small", "", `${person.connected ? "Telegram подтверждён" : "Ожидает подтверждения"} · ${person.completedOrders} заказов`));
    const toggle = element("button", person.active ? "" : "danger", person.active ? "Отключить" : "Включить");
    toggle.type = "button";
    toggle.addEventListener("click", () => toggleStaff(person));
    card.append(info, toggle);
    list.append(card);
  });
}

function renderOrders() {
  const list = $("#ordersList");
  const orders = state.orders.filter((order) => !state.orderFilter || order.status === state.orderFilter);
  list.replaceChildren();
  $("#ordersSummary").textContent = `${state.orders.filter((order) => order.status === "new").length} новых · ${state.orders.length} всего`;
  if (!orders.length) list.append(element("div", "empty-state", state.orders.length ? "В этом статусе заказов нет." : "Новых заказов пока нет. Они появятся здесь после оформления клиентом."));
  orders.forEach((order) => {
    const card = element("article", "order-card");
    const info = element("div");
    info.append(element("h3", "", `Заказ ${order.id.slice(0, 8)}`), element("p", "", `${order.customerName || "Клиент"} · ${money(order.total)}`));
    const controls = element("div", "order-controls");
    const status = element("select");
    for (const [value, label] of Object.entries(orderLabels)) { const option = element("option", "", label); option.value = value; option.selected = value === order.status; status.append(option); }
    const florist = element("select");
    florist.append(Object.assign(element("option", "", "Флорист не назначен"), { value:"" }));
    state.staff.filter((person) => person.active && person.role === "florist").forEach((person) => florist.append(Object.assign(element("option", "", person.name), { value:person.id, selected:person.id === order.floristId })));
    const save = element("button", "", "Сохранить"); save.type = "button"; save.addEventListener("click", () => saveOrder(order.id, status.value, florist.value));
    controls.append(status, florist, save); card.append(info, controls); list.append(card);
  });
}

function showTab(name) {
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === name));
  document.querySelectorAll("[data-section]").forEach((section) => section.classList.toggle("active", section.dataset.section === name));
}

function showBouquetDialog(item = null, kind = "bouquet") {
  const form = $("#bouquetForm");
  form.reset();
  form.elements.id.value = item?.id || "";
  form.elements.kind.value = kind;
  for (const key of ["name","flowers","description","price","image"]) form.elements[key].value = item?.[key] ?? "";
  form.elements.tags.value = (item?.tags || []).join(", ");
  form.elements.available.checked = item?.available !== false;
  const addon = kind === "addon";
  $("#bouquetDialogTitle").textContent = item ? `Изменить ${addon ? "позицию" : "букет"}` : `Новый ${addon ? "товар" : "букет"}`;
  $("#bouquetCompositionLabel").textContent = addon ? "Описание позиции" : "Состав";
  $("#bouquetTagsLabel").hidden = addon;
  $("#bouquetDialog").showModal();
}

async function load() {
  const data = await api("/api/admin");
  Object.assign(state, data);
  const superAdmin = state.role === "superadmin";
  document.querySelectorAll(".super-only").forEach((node) => { node.hidden = !superAdmin; });
  $("#roleTitle").textContent = superAdmin ? "Super Admin" : "Магазин";
  $("#roleBadge").textContent = superAdmin ? "MEGA ADMIN" : "КАБИНЕТ МАГАЗИНА";
  $("#databaseNotice").hidden = state.database;
  $("#adminApp").hidden = false;
  if (superAdmin) { updateDashboard(data.summary); renderShops(); return; }
  $("#overview").hidden = true;
  if (state.shops[0]) await openShop(state.shops[0].id);
  else { $("#shopBindingNotice").textContent = data.shopBindingError || "Магазин не привязан"; $("#shopBindingNotice").hidden = false; }
}

async function toggleStaff(person) {
  await api(`/api/admin/shops/${encodeURIComponent(state.current.id)}/staff/${encodeURIComponent(person.id)}`, { method:"PATCH", body:JSON.stringify({ active:!person.active }) });
  person.active = !person.active; renderStaff(); toast("Команда обновлена");
}

async function saveOrder(id, status, floristId) {
  await api(`/api/admin/shops/${encodeURIComponent(state.current.id)}/orders/${encodeURIComponent(id)}`, { method:"PATCH", body:JSON.stringify({ status, floristId }) });
  const order = state.orders.find((item) => item.id === id); order.status = status; order.floristId = floristId; renderOrders(); toast("Заказ обновлён");
}

telegram?.ready();
telegram?.expand();
if (!telegram?.initData) document.body.textContent = "Недоступно";
else load().catch((error) => { document.body.textContent = error.message || "Не удалось открыть админку"; });

$("#refreshButton").addEventListener("click", () => location.reload());
$("#backButton").addEventListener("click", () => { $("#shopPanel").hidden = true; $("#overview").hidden = false; });
$("#copyShopIdButton").addEventListener("click", async () => { await navigator.clipboard.writeText(state.current.id); toast("SHOP_ID скопирован"); });
$("#addShopButton").addEventListener("click", () => $("#shopDialog").showModal());
$("#addBouquetButton").addEventListener("click", () => showBouquetDialog(null, "bouquet"));
$("#addAddonButton").addEventListener("click", () => showBouquetDialog(null, "addon"));
$("#addStaffButton").addEventListener("click", () => { $("#staffForm").reset(); $("#staffDialog").showModal(); });
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.close}`).close()));
document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => showTab(button.dataset.tab)));
$("#orderFilters").addEventListener("click", (event) => { const button = event.target.closest("button"); if (!button) return; state.orderFilter = button.dataset.status; $("#orderFilters .active")?.classList.remove("active"); button.classList.add("active"); renderOrders(); });

$("#newShopForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { const payload = formObject(event.currentTarget); payload.enabled = true; const { shop } = await api("/api/admin/shops", { method:"POST", body:JSON.stringify(payload) }); state.shops.push(shop); renderShops(); $("#shopDialog").close(); toast("Магазин подключён"); } catch (error) { toast(error.message); }
});

$("#shopForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { const { shop } = await api(`/api/admin/shops/${encodeURIComponent(state.current.id)}`, { method:"PATCH", body:JSON.stringify(formObject(event.currentTarget)) }); state.current = shop; state.shops = state.shops.map((item) => item.id === shop.id ? shop : item); await openShop(shop.id); toast("Магазин сохранён"); } catch (error) { toast(error.message); }
});

$("#profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { const payload = Object.fromEntries(new FormData(event.currentTarget)); const { shop } = await api(`/api/admin/shops/${encodeURIComponent(state.current.id)}/profile`, { method:"PATCH", body:JSON.stringify(payload) }); state.current = shop; state.shops = state.shops.map((item) => item.id === shop.id ? shop : item); toast("Контакты сохранены"); } catch (error) { toast(error.message); }
});

$("#toggleShopButton").addEventListener("click", async () => {
  try { const payload = { ...state.current, enabled:!state.current.enabled }; const { shop } = await api(`/api/admin/shops/${encodeURIComponent(state.current.id)}`, { method:"PATCH", body:JSON.stringify(payload) }); state.current = shop; state.shops = state.shops.map((item) => item.id === shop.id ? shop : item); await openShop(shop.id); toast(shop.enabled ? "Магазин подключён" : "Магазин приостановлен"); } catch (error) { toast(error.message); }
});

$("#bouquetForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { const form = event.currentTarget; const id = form.elements.id.value; const payload = Object.fromEntries(new FormData(form)); payload.price = Number(payload.price); payload.available = form.elements.available.checked; const path = `/api/admin/shops/${encodeURIComponent(state.current.id)}/catalog${id ? `/${encodeURIComponent(id)}` : ""}`; await api(path, { method:id ? "PATCH" : "POST", body:JSON.stringify(payload) }); $("#bouquetDialog").close(); const { catalog } = await api(`/api/admin/shops/${encodeURIComponent(state.current.id)}/catalog`); state.catalog = catalog; renderCatalog("bouquet"); renderCatalog("addon"); toast("Ассортимент обновлён"); } catch (error) { toast(error.message); }
});

$("#staffForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try { const payload = Object.fromEntries(new FormData(event.currentTarget)); const { staff } = await api(`/api/admin/shops/${encodeURIComponent(state.current.id)}/staff`, { method:"POST", body:JSON.stringify(payload) }); state.staff.push(staff); renderStaff(); $("#staffDialog").close(); toast("Сотрудник добавлен"); } catch (error) { toast(error.message); }
});

$("#mailingForm textarea").addEventListener("input", (event) => { $("#mailingPreview").textContent = event.target.value || "Предпросмотр сообщения"; });
$("#mailingForm").addEventListener("submit", (event) => { event.preventDefault(); toast("Нет получателей с рекламным согласием"); });
