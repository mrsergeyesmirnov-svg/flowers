import { formatPrice, recommend } from "./recommender.js";

const screens = [...document.querySelectorAll(".screen")];
const backButton = document.querySelector("#backButton");
const progressBar = document.querySelector("#progressBar");
const state = { occasion: "", description: "", budget: 8000, recipientName: "", avoid: "", selected: null };
let history = ["introScreen"];

const $ = (selector) => document.querySelector(selector);

function showScreen(id, remember = true) {
  screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
  if (remember && history.at(-1) !== id) history.push(id);
  backButton.classList.toggle("hidden", id === "introScreen" || id === "successScreen");
  const steps = { introScreen: 0, occasionScreen: 25, descriptionScreen: 50, budgetScreen: 75, detailsScreen: 100, resultsScreen: 100, orderScreen: 100, successScreen: 100 };
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
  Object.assign(state, { occasion: "", description: "", budget: 8000, recipientName: "", avoid: "", selected: null });
  $("#description").value = "";
  $("#budget").value = 8000;
  $("#budgetOutput").textContent = formatPrice(8000);
  $("#charCount").textContent = "0";
  $("#recipientName").value = "";
  $("#avoid").value = "";
  document.querySelectorAll(".selected, input[type=checkbox]:checked").forEach((element) => {
    element.classList.remove("selected");
    if (element.matches("input")) element.checked = false;
  });
  $("#occasionScreen .primary").disabled = true;
  $("#descriptionScreen .primary").disabled = true;
  history = ["introScreen"];
  showScreen("introScreen", false);
}

$("#restartButton").addEventListener("click", reset);
$("#againButton").addEventListener("click", reset);

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

$("#budget").addEventListener("input", (event) => {
  state.budget = Number(event.target.value);
  $("#budgetOutput").textContent = formatPrice(state.budget);
});

$("#showResults").addEventListener("click", () => {
  state.recipientName = $("#recipientName").value.trim();
  state.avoid = $("#avoid").value.trim();
  const matches = recommend(state);
  const name = state.recipientName ? `для ${state.recipientName}` : "для неё";
  $("#resultsTitle").textContent = `Три букета ${name}`;
  $("#resultsReason").textContent = `Учли повод, описание и бюджет до ${formatPrice(state.budget)}${state.avoid ? `. Исключим: ${state.avoid}.` : "."}`;
  $("#bouquetList").innerHTML = matches.map((bouquet, index) => `
    <article class="bouquet-card">
      <div class="bouquet-image">
        <img src="${bouquet.image}" alt="Букет «${bouquet.name}»" loading="lazy" />
        <span class="bouquet-badge">${index === 0 ? "Лучшее совпадение" : index === 1 ? "Альтернатива" : "Смелее"}</span>
      </div>
      <div class="bouquet-content">
        <div class="bouquet-heading"><h3>${bouquet.name}</h3><strong>${formatPrice(bouquet.price)}</strong></div>
        <p class="bouquet-flowers">${bouquet.flowers}</p>
        <p class="bouquet-description">${bouquet.description}</p>
        <button class="primary choose-bouquet" data-id="${bouquet.id}">Выбрать этот <span>→</span></button>
      </div>
    </article>`).join("");
  showScreen("resultsScreen");
});

$("#bouquetList").addEventListener("click", (event) => {
  const button = event.target.closest(".choose-bouquet");
  if (!button) return;
  state.selected = recommend(state).find((bouquet) => bouquet.id === button.dataset.id);
  $("#selectedBouquet").innerHTML = `
    <div class="selected-mini">
      <img src="${state.selected.image}" alt="" />
      <div><h3>${state.selected.name}</h3><p>${state.selected.flowers}</p><strong>${formatPrice(state.selected.price)}</strong></div>
    </div>`;
  document.querySelectorAll("#addonList input").forEach((input) => { input.checked = false; });
  updateTotal();
  showScreen("orderScreen");
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
  $("#successSummary").innerHTML = `
    <div><span>Букет</span><strong>${state.selected.name}</strong></div>
    ${addons.length ? `<div><span>Дополнения</span><strong>${addons.map((item) => item.dataset.name).join(", ")}</strong></div>` : ""}
    <div><span>Итого</span><strong>${formatPrice(total)}</strong></div>`;
  showScreen("successScreen");
});

window.Telegram?.WebApp?.ready();
