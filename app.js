import { availableBouquets, bouquets, formatPrice, recommend } from "./recommender.js";

const screens = [...document.querySelectorAll(".screen")];
const backButton = document.querySelector("#backButton");
const progressBar = document.querySelector("#progressBar");
const state = { recipientType: "", occasion: "", description: "", budget: 8000, recipientName: "", avoid: "", selected: null, privacyConsentAt: null, marketingConsentAt: null };
let history = ["introScreen"];
let catalog = bouquets;

const $ = (selector) => document.querySelector(selector);

async function loadCatalog() {
  try {
    const response = await fetch("/api/catalog", { cache: "no-store" });
    if (response.ok) catalog = (await response.json()).catalog;
  } catch { /* Используем встроенный демо-каталог. */ }
  return catalog;
}

function showScreen(id, remember = true) {
  screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
  if (remember && history.at(-1) !== id) history.push(id);
  backButton.classList.toggle("hidden", id === "introScreen" || id === "successScreen");
  const steps = {
    introScreen: 0,
    recipientScreen: 20,
    occasionScreen: 40,
    descriptionScreen: 60,
    budgetScreen: 80,
    detailsScreen: 100,
    resultsScreen: 100,
    catalogScreen: 100,
    customScreen: 100,
    orderScreen: 100,
    successScreen: 100
  };
  progressBar.style.width = `${steps[id]}%`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const next = event.target.closest("[data-next]");
  if (next && !next.disabled) showScreen(next.dataset.next);
});

backButton.addEventListener("click", () => {
  if (history.length < 2) return;
  history.pop();
  showScreen(history.at(-1), false);
});

function reset() {
  Object.assign(state, { recipientType: "", occasion: "", description: "", budget: 8000, recipientName: "", avoid: "", selected: null, privacyConsentAt: null, marketingConsentAt: null });
  $("#description").value = "";
  $("#budget").value = 8000;
  $("#budgetOutput").textContent = formatPrice(8000);
  $("#charCount").textContent = "0";
  $("#recipientName").value = "";
  $("#avoid").value = "";
  $("#customRequest").value = "";
  $("#floristConsent").checked = false;
  $("#customSubmit").disabled = true;
  $("#privacyConsent").checked = false;
  $("#marketingConsent").checked = false;
  $("#showResults").disabled = true;
  document.querySelectorAll(".selected, input[type=checkbox]:checked").forEach((element) => {
    element.classList.remove("selected");
    if (element.matches("input")) element.checked = false;
  });
  $("#occasionScreen .primary").disabled = true;
  $("#descriptionScreen .primary").disabled = true;
  $("#recipientScreen .primary").disabled = true;
  history = ["introScreen"];
  showScreen("introScreen", false);
}

$("#restartButton").addEventListener("click", reset);
$("#againButton").addEventListener("click", reset);

$("#privacyConsent").addEventListener("change", (event) => {
  $("#showResults").disabled = !event.target.checked;
  state.privacyConsentAt = event.target.checked ? new Date().toISOString() : null;
});

$("#recipientChoices").addEventListener("click", (event) => {
  const choice = event.target.closest(".choice");
  if (!choice) return;
  document.querySelectorAll("#recipientChoices .choice").forEach((item) => item.classList.remove("selected"));
  choice.classList.add("selected");
  state.recipientType = choice.dataset.value;
  $("#recipientScreen .primary").disabled = false;
});

$("#marketingConsent").addEventListener("change", (event) => {
  state.marketingConsentAt = event.target.checked ? new Date().toISOString() : null;
});

$("#occasionChoices").addEventListener("click", (event) => {
  const choice = event.target.closest(".choice");
  if (!choice) return;
  document.querySelectorAll("#occasionChoices .choice").forEach((item) => item.classList.remove("selected"));
  choice.classList.add("selected");
  state.occasion = choice.dataset.value;
  $("#occasionScreen .primary").disabled = false;
});

function syncDescription() {
  state.description = $("#description").value.trim();
  $("#charCount").textContent = $("#description").value.length;
  $("#descriptionScreen .primary").disabled = state.description.length < 5;
}

$("#description").addEventListener("input", syncDescription);
$("#descriptionChips").addEventListener("click", (event) => {
  const chip = event.target.closest("button");
  if (!chip) return;
  chip.classList.toggle("selected");
  const chosen = [...document.querySelectorAll("#descriptionChips .selected")].map((item) => item.dataset.value);
  const original = $("#description").value.split(" · ")[0].trim();
  $("#description").value = [original, ...chosen].filter(Boolean).join(" · ");
  syncDescription();
});

const descriptorPool = [
  "нежный стиль", "яркий стиль", "минимализм", "творческий характер", "любит классику", "любит необычное",
  "спокойный характер", "много энергии", "элегантный стиль", "романтичное настроение", "сдержанный стиль", "с чувством юмора",
  "любит пастельные цвета", "ценит уют", "предпочитает натуральность", "следит за модой", "любит сюрпризы", "практичный"
];

function shuffleDescriptors() {
  const shown = new Set([...$("#descriptionChips").children].map((item) => item.dataset.value));
  const fresh = descriptorPool.filter((item) => !shown.has(item)).sort(() => Math.random() - .5).slice(0, 6);
  const values = fresh.length === 6 ? fresh : [...descriptorPool].sort(() => Math.random() - .5).slice(0, 6);
  $("#descriptionChips").innerHTML = values.map((value) => `<button data-value="${value}">${value}</button>`).join("");
}

$("#shuffleChips").addEventListener("click", shuffleDescriptors);

$("#budget").addEventListener("input", (event) => {
  state.budget = Number(event.target.value);
  $("#budgetOutput").textContent = formatPrice(state.budget);
});

function bouquetCard(bouquet, badge = "В наличии") {
  return `
    <article class="bouquet-card">
      <div class="bouquet-image">
        <img src="${bouquet.image}" alt="Букет «${bouquet.name}»: ${bouquet.flowers}" loading="lazy" />
        <span class="bouquet-badge">${badge}</span>
      </div>
      <div class="bouquet-content">
        <div class="bouquet-heading"><h3>${bouquet.name}</h3><strong>${formatPrice(bouquet.price)}</strong></div>
        <p class="bouquet-flowers">${bouquet.flowers}</p>
        <p class="bouquet-description">${bouquet.description}</p>
        <button class="primary choose-bouquet" data-id="${bouquet.id}">Выбрать этот <span>→</span></button>
      </div>
    </article>`;
}

$("#showResults").addEventListener("click", async () => {
  state.recipientName = $("#recipientName").value.trim();
  state.avoid = $("#avoid").value.trim();
  await loadCatalog();
  const matches = recommend({ ...state, catalog });
  const recipient = state.recipientName ? `для ${state.recipientName}` : `для получателя`;
  $("#resultsTitle").textContent = `Три букета ${recipient}`;
  $("#resultsReason").textContent = `Учли повод, описание и бюджет до ${formatPrice(state.budget)}${state.avoid ? `. Полностью исключили: ${state.avoid}.` : "."}`;
  const badges = ["Лучшее совпадение", "Альтернатива", "Смелее"];
  $("#bouquetList").innerHTML = matches.map((bouquet, index) => bouquetCard(bouquet, badges[index])).join("");
  showScreen("resultsScreen");
});

$("#showCatalog").addEventListener("click", () => {
  const available = availableBouquets({ ...state, catalog });
  $("#catalogReason").textContent = state.avoid
    ? `Показываем ${available.length} вариантов. В составах нет: ${state.avoid}.`
    : `Сейчас в наличии ${available.length} вариантов.`;
  $("#catalogList").innerHTML = available.map((bouquet) => bouquetCard(bouquet)).join("");
  showScreen("catalogScreen");
});

function selectBouquet(id) {
  state.selected = availableBouquets({ ...state, catalog }).find((bouquet) => bouquet.id === id);
  if (!state.selected) return;
  $("#selectedBouquet").innerHTML = `
    <div class="selected-mini">
      <img src="${state.selected.image}" alt="" />
      <div><h3>${state.selected.name}</h3><p>${state.selected.flowers}</p><strong>${formatPrice(state.selected.price)}</strong></div>
    </div>`;
  document.querySelectorAll("#addonList input").forEach((input) => { input.checked = false; });
  updateTotal();
  showScreen("orderScreen");
}

document.addEventListener("click", (event) => {
  const button = event.target.closest(".choose-bouquet");
  if (button) selectBouquet(button.dataset.id);
});

function syncCustomRequest() {
  $("#customSubmit").disabled = $("#customRequest").value.trim().length < 5 || !$("#floristConsent").checked;
}

$("#customRequest").addEventListener("input", syncCustomRequest);
$("#floristConsent").addEventListener("change", syncCustomRequest);
$("#customSubmit").addEventListener("click", () => {
  $("#successSummary").innerHTML = `
    <div><span>Запрос</span><strong>Личный подбор</strong></div>
    <p>${$("#customRequest").value.trim()}</p>`;
  $("#successScreen h2").textContent = "Запрос готов для флориста";
  $("#successScreen .lead").textContent = "В рабочей версии флорист сразу получит пожелания и сможет ответить клиенту в Telegram.";
  showScreen("successScreen");
});

function updateTotal() {
  const addons = [...document.querySelectorAll("#addonList input:checked")];
  const total = (state.selected?.price || 0) + addons.reduce((sum, input) => sum + Number(input.value), 0);
  $("#totalPrice").textContent = formatPrice(total);
  return { addons, total };
}

$("#addonList").addEventListener("change", updateTotal);
$("#orderButton").addEventListener("click", () => {
  const { addons, total } = updateTotal();
  $("#successScreen h2").textContent = "Флорист всё проверит";
  $("#successScreen .lead").textContent = "В рабочей версии здесь клиент оставит телефон, выберет доставку и оплатит заказ.";
  $("#successSummary").innerHTML = `
    <div><span>Букет</span><strong>${state.selected.name}</strong></div>
    ${addons.length ? `<div><span>Дополнения</span><strong>${addons.map((item) => item.dataset.name).join(", ")}</strong></div>` : ""}
    <div><span>Итого</span><strong>${formatPrice(total)}</strong></div>`;
  showScreen("successScreen");
});

window.Telegram?.WebApp?.ready();
