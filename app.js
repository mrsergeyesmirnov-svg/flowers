import { availableBouquets, bouquets, formatPrice, recommend } from "./recommender.js";

const screens = [...document.querySelectorAll(".screen")];
const backButton = document.querySelector("#backButton");
const progressBar = document.querySelector("#progressBar");
const state = { mode: "", recipientType: "", occasion: "", personDescription: "", bouquetDescription: "", budget: 8000, recipientName: "", avoid: "", selected: null, privacyConsentAt: null, marketingConsentAt: null };
let history = ["introScreen"];
let catalog = bouquets;
let shopAddons = [];

const $ = (selector) => document.querySelector(selector);
const occasionOptions = {
  "девушка": [["✨", "без повода", "Просто порадовать"], ["🎂", "день рождения", "День рождения"], ["♥", "годовщина", "Годовщина"], ["☕", "первая встреча", "Первое свидание"], ["🕊", "извинение", "Помириться"], ["🌿", "благодарность", "Поблагодарить"]],
  "мама": [["✨", "без повода", "Просто порадовать"], ["🎂", "день рождения", "День рождения"], ["☀", "день матери", "День матери"], ["🌷", "8 марта", "8 Марта"], ["🕊", "извинение", "Помириться"], ["🌿", "благодарность", "Поблагодарить"]],
  "учитель": [["✎", "день учителя", "День учителя"], ["🎂", "день рождения", "День рождения"], ["🔔", "1 сентября", "1 Сентября"], ["🎓", "выпускной", "Выпускной"], ["🌿", "благодарность", "Поблагодарить"], ["🏆", "поздравление", "Поздравить"]],
  "школа": [["🔔", "1 сентября", "1 Сентября"], ["✎", "день учителя", "День учителя"], ["🎓", "выпускной", "Выпускной"], ["🔔", "последний звонок", "Последний звонок"], ["🏫", "школьное событие", "Событие школы"], ["🌿", "благодарность", "Поблагодарить"]],
  "коллега": [["🎂", "день рождения", "День рождения"], ["💼", "профессиональный праздник", "Проф. праздник"], ["🏆", "поздравление", "Поздравить"], ["🌿", "благодарность", "Поблагодарить"], ["🕊", "извинение", "Извиниться"], ["✨", "без повода", "Просто порадовать"]],
  "другой человек": [["✨", "без повода", "Просто порадовать"], ["🎂", "день рождения", "День рождения"], ["🏆", "поздравление", "Поздравить"], ["🌿", "благодарность", "Поблагодарить"], ["🕊", "извинение", "Извиниться"], ["🎉", "праздник", "Другой праздник"]]
};

function renderOccasions(recipientType) {
  $("#occasionChoices").innerHTML = occasionOptions[recipientType]
    .map(([icon, value, label]) => `<button class="choice" data-value="${value}"><span>${icon}</span>${label}</button>`)
    .join("");
  state.occasion = "";
  $("#occasionScreen .primary").disabled = true;
}

async function loadCatalog() {
  try {
    const response = await fetch("/api/catalog", { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      catalog = data.catalog;
      shopAddons = data.addons || [];
    }
  } catch { /* Используем встроенный демо-каталог. */ }
  return catalog;
}

function showScreen(id, remember = true) {
  screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
  if (remember && history.at(-1) !== id) history.push(id);
  backButton.classList.toggle("hidden", id === "introScreen" || id === "successScreen");
  const steps = {
    introScreen: 0,
    methodScreen: 0,
    recipientScreen: 20,
    occasionScreen: 40,
    descriptionScreen: 60,
    bouquetDescriptionScreen: 60,
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
  Object.assign(state, { mode: "", recipientType: "", occasion: "", personDescription: "", bouquetDescription: "", budget: 8000, recipientName: "", avoid: "", selected: null, privacyConsentAt: null, marketingConsentAt: null });
  $("#description").value = "";
  $("#bouquetDescription").value = "";
  $("#secondaryDescription").value = "";
  $("#budget").value = 8000;
  $("#budgetOutput").textContent = formatPrice(8000);
  $("#charCount").textContent = "0";
  $("#bouquetCharCount").textContent = "0";
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
  $("#bouquetDescriptionScreen .primary").disabled = true;
  $("#recipientScreen .primary").disabled = true;
  $("#methodScreen .primary").disabled = true;
  selectedDescriptors.person.clear();
  selectedDescriptors.bouquet.clear();
  descriptorSuggestions.person = personDescriptorPool.slice(0, 6);
  descriptorSuggestions.bouquet = bouquetDescriptorPool.slice(0, 6);
  renderDescriptorChips("person");
  renderDescriptorChips("bouquet");
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
  renderOccasions(state.recipientType);
  $("#recipientScreen .primary").disabled = false;
});

$("#marketingConsent").addEventListener("change", (event) => {
  state.marketingConsentAt = event.target.checked ? new Date().toISOString() : null;
});

$("#methodChoices").addEventListener("click", (event) => {
  const choice = event.target.closest(".choice");
  if (!choice) return;
  if (state.mode && state.mode !== choice.dataset.value) $("#secondaryDescription").value = "";
  document.querySelectorAll("#methodChoices .choice").forEach((item) => item.classList.remove("selected"));
  choice.classList.add("selected");
  state.mode = choice.dataset.value;
  $("#methodScreen .primary").disabled = false;
  const bouquetFirst = state.mode === "bouquet";
  $("#secondaryDescriptionLabel").textContent = bouquetFirst ? "Хотите немного рассказать о получателе? Необязательно" : "Есть пожелания к самому букету? Необязательно";
  $("#secondaryDescription").placeholder = bouquetFirst
    ? "Например: спокойный человек, ценит минимализм и детали..."
    : "Например: светлый, воздушный, побольше зелени...";
});

$("#occasionChoices").addEventListener("click", (event) => {
  const choice = event.target.closest(".choice");
  if (!choice) return;
  document.querySelectorAll("#occasionChoices .choice").forEach((item) => item.classList.remove("selected"));
  choice.classList.add("selected");
  state.occasion = choice.dataset.value;
  $("#occasionScreen .primary").disabled = false;
});

$("#occasionNext").addEventListener("click", () => showScreen(state.mode === "bouquet" ? "bouquetDescriptionScreen" : "descriptionScreen"));

const personDescriptorPool = [
  ["нежный стиль", "нежная"], ["яркий стиль", "яркая"], ["минимализм", "минимализм"],
  ["творческий характер", "творческая"], ["любит классику", "классика"], ["любит необычное", "необычная"],
  ["спокойный характер", "спокойная"], ["много энергии", "много энергии яркая"], ["элегантный стиль", "стильная"],
  ["романтичное настроение", "романтичная"], ["сдержанный стиль", "деловая"], ["с чувством юмора", "весёлая"],
  ["любит пастельные цвета", "пастель"], ["ценит уют", "уют"], ["предпочитает натуральность", "естественная"],
  ["следит за модой", "мода"], ["любит сюрпризы", "любит сюрпризы необычная"], ["практичный человек", "практичный минимализм"]
];
const bouquetDescriptorPool = [
  ["нежный", "нежная"], ["яркий", "яркая"], ["светлый", "светлый"], ["минималистичный", "минимализм"],
  ["пышный", "пышный"], ["необычный", "необычная"], ["монобукет", "монобукет"], ["много зелени", "зелень"],
  ["пастельные оттенки", "пастель"], ["бело-зелёный", "бело-зелёный"], ["натуральный", "естественная"],
  ["романтичный", "романтичная"], ["классический", "классика"], ["современный", "современная"]
];
const selectedDescriptors = { person: new Set(), bouquet: new Set() };
const descriptorSuggestions = { person: personDescriptorPool.slice(0, 6), bouquet: bouquetDescriptorPool.slice(0, 6) };

function descriptorConfig(type) {
  return type === "person"
    ? { pool: personDescriptorPool, chips: "#descriptionChips", textarea: "#description", counter: "#charCount", screen: "#descriptionScreen", stateKey: "personDescription" }
    : { pool: bouquetDescriptorPool, chips: "#bouquetDescriptionChips", textarea: "#bouquetDescription", counter: "#bouquetCharCount", screen: "#bouquetDescriptionScreen", stateKey: "bouquetDescription" };
}

function renderDescriptorChips(type) {
  const { pool, chips } = descriptorConfig(type);
  const selected = selectedDescriptors[type];
  const options = [...pool.filter(([, value]) => selected.has(value)), ...descriptorSuggestions[type].filter(([, value]) => !selected.has(value))];
  $(chips).innerHTML = options.map(([label, value]) => `<button class="${selected.has(value) ? "selected" : ""}" data-value="${value}">${label}</button>`).join("");
}

function syncDescription(type) {
  const { textarea, counter, screen, stateKey } = descriptorConfig(type);
  const written = $(textarea).value.trim();
  state[stateKey] = [written, ...selectedDescriptors[type]].filter(Boolean).join(" · ");
  $(counter).textContent = $(textarea).value.length;
  $(`${screen} .primary`).disabled = written.length < 5 && selectedDescriptors[type].size === 0;
}

function toggleDescriptor(type, event) {
  const chip = event.target.closest("button");
  if (!chip) return;
  const selected = selectedDescriptors[type];
  selected.has(chip.dataset.value) ? selected.delete(chip.dataset.value) : selected.add(chip.dataset.value);
  renderDescriptorChips(type);
  syncDescription(type);
}

function shuffleDescriptors(type) {
  const { pool } = descriptorConfig(type);
  const selected = selectedDescriptors[type];
  const shown = new Set(descriptorSuggestions[type].map(([, value]) => value));
  let fresh = pool.filter(([, value]) => !selected.has(value) && !shown.has(value));
  if (fresh.length < 6) fresh = pool.filter(([, value]) => !selected.has(value));
  descriptorSuggestions[type] = fresh.sort(() => Math.random() - .5).slice(0, 6);
  renderDescriptorChips(type);
}

$("#description").addEventListener("input", () => syncDescription("person"));
$("#bouquetDescription").addEventListener("input", () => syncDescription("bouquet"));
$("#descriptionChips").addEventListener("click", (event) => toggleDescriptor("person", event));
$("#bouquetDescriptionChips").addEventListener("click", (event) => toggleDescriptor("bouquet", event));
$("#shuffleChips").addEventListener("click", () => shuffleDescriptors("person"));
$("#shuffleBouquetChips").addEventListener("click", () => shuffleDescriptors("bouquet"));
renderDescriptorChips("person");
renderDescriptorChips("bouquet");

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
  const secondaryDescription = $("#secondaryDescription").value.trim();
  if (state.mode === "bouquet") state.personDescription = secondaryDescription;
  else state.bouquetDescription = secondaryDescription;
  await loadCatalog();
  const matches = recommend({ ...state, catalog });
  const recipient = state.recipientName ? `для ${state.recipientName}` : `для получателя`;
  $("#resultsTitle").textContent = `Три букета ${recipient}`;
  const basis = state.mode === "bouquet" ? "пожелания к букету" : "характер получателя";
  $("#resultsReason").textContent = `Учли ${basis}, повод и бюджет до ${formatPrice(state.budget)}${state.avoid ? `. Полностью исключили: ${state.avoid}.` : "."}`;
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
  if (shopAddons.length) {
    const list = $("#addonList");
    list.replaceChildren(...shopAddons.map((addon) => {
      const label = document.createElement("label");
      const text = document.createElement("span");
      const name = document.createElement("b"); name.textContent = addon.name;
      const description = document.createElement("small"); description.textContent = addon.flowers;
      const price = document.createElement("em"); price.textContent = `+${formatPrice(addon.price)}`;
      const input = document.createElement("input"); input.type = "checkbox"; input.value = addon.price; input.dataset.name = addon.name;
      text.append(name, description); label.append(text, price, input); return label;
    }));
  }
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
