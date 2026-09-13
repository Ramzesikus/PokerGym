// js/practice/trainings/combinations.js
// Логика и UI тренировки «Комбинации». Переиспользует генератор раздач
// тренировки «Ауты» (pickTargetCategory/generateCardsForCategory).

import { state } from "../../core/state.js";
import { dict } from "../../core/i18n.js";
import { evaluateBest, getCoreCards, displayCategoryIndex, CATEGORY_NAMES, cardId } from "../../core/hand-eval.js";
import { cardEl } from "../../ui/card.js";
import { pickTargetCategory, generateCardsForCategory } from "./outs.js";
import { showSubview, registerTrainingEntry, registerGearProvider } from "../practice-router.js";
import { loadSection, saveSection } from "../../core/storage.js";

  let comboState = { sublevel: "5", dealNum: 1, correctCount: 0, answeredCount: 0 };
  let currentComboDeal = null;
  let selectedComboIndex = null;

  function persistCombinationsSettings() {
    saveSection("identifyCombo", { sublevel: comboState.sublevel });
  }

  const comboSublevelSwitch = document.getElementById("combo-sublevel-switch");
  comboSublevelSwitch.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      comboSublevelSwitch.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      comboState.sublevel = btn.dataset.value;
      checkComboSettingsDirty();
    });
  });

  let comboSettingsSnapshot = null;
  function checkComboSettingsDirty() {
    const changed = comboSettingsSnapshot && comboState.sublevel !== comboSettingsSnapshot.sublevel;
    document.getElementById("combo-settings-ok").disabled = !changed;
  }
  function openComboSettingsModal() {
    comboSettingsSnapshot = { sublevel: comboState.sublevel };
    document.getElementById("combo-settings-modal").classList.add("show");
    checkComboSettingsDirty();
  }
  function closeComboSettingsModal() {
    document.getElementById("combo-settings-modal").classList.remove("show");
  }
  document.getElementById("combo-settings-ok").addEventListener("click", () => {
    persistCombinationsSettings();
    closeComboSettingsModal();
    startComboSession();
  });
  function cancelComboSettings() {
    applySettings(comboSettingsSnapshot);
    comboSublevelSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === comboState.sublevel));
    closeComboSettingsModal();
  }
  document.getElementById("combo-settings-cancel").addEventListener("click", cancelComboSettings);
  document.getElementById("combo-settings-cancel-x").addEventListener("click", cancelComboSettings);
  registerGearProvider("session-combo", openComboSettingsModal);

  function sublevelCardCount(sublevel) {
    if (sublevel === "5") return 5;
    if (sublevel === "flop") return 5;
    if (sublevel === "turn") return 6;
    return 7;
  }

  function dealNewCombo() {
    const cardCount = sublevelCardCount(comboState.sublevel);
    const target = pickTargetCategory();
    const cards = generateCardsForCategory(target, cardCount);
    currentComboDeal = { cards, target };
  }

  let comboCardElements = {};

  function renderComboCards() {
    const area = document.getElementById("combo-cards-area");
    area.innerHTML = "";
    comboCardElements = {};
    const cards = currentComboDeal.cards;

    if (comboState.sublevel === "5") {
      const label = document.createElement("div");
      label.className = "card-row-label";
      label.textContent = dict[state.lang]["session.fiveCards"];
      const row = document.createElement("div");
      row.className = "card-row";
      cards.forEach(c => {
        const el = cardEl(c, true, state.faceStyle, state.cardBack);
        comboCardElements[cardId(c)] = el;
        row.appendChild(el);
      });
      area.appendChild(label);
      area.appendChild(row);
    } else {
      const hand = cards.slice(0, 2);
      const board = cards.slice(2);
      const handLabel = document.createElement("div");
      handLabel.className = "card-row-label";
      handLabel.textContent = dict[state.lang]["session.hand"];
      const handRow = document.createElement("div");
      handRow.className = "card-row";
      hand.forEach(c => {
        const el = cardEl(c, true, state.faceStyle, state.cardBack);
        el.classList.add("card-hand");
        comboCardElements[cardId(c)] = el;
        handRow.appendChild(el);
      });

      const boardLabel = document.createElement("div");
      boardLabel.className = "card-row-label";
      boardLabel.textContent = dict[state.lang]["session.board"];
      const boardRow = document.createElement("div");
      boardRow.className = "card-row";
      board.forEach(c => {
        const el = cardEl(c, true, state.faceStyle, state.cardBack);
        comboCardElements[cardId(c)] = el;
        boardRow.appendChild(el);
      });

      area.appendChild(handLabel);
      area.appendChild(handRow);
      area.appendChild(boardLabel);
      area.appendChild(boardRow);
    }
  }

  function checkComboAnswer(selectedIndex) {
    const wrap = document.getElementById("combo-options");
    wrap.querySelectorAll(".combo-option-btn").forEach(b => {
      b.disabled = true;
      b.style.pointerEvents = "none";
    });

    const realResult = evaluateBest(currentComboDeal.cards);
    const realCategory = displayCategoryIndex(realResult.best);
    const isCorrect = selectedIndex === realCategory;

    const correctBtn = wrap.querySelector('[data-index="' + realCategory + '"]');
    if (correctBtn) correctBtn.classList.add("correct");
    if (!isCorrect) {
      const chosenBtn = wrap.querySelector('[data-index="' + selectedIndex + '"]');
      if (chosenBtn) chosenBtn.classList.add("incorrect");
    }

    const coreCards = getCoreCards(realResult.usedCards);
    const coreIds = new Set(coreCards.map(cardId));
    realResult.usedCards.forEach(c => {
      const el = comboCardElements[cardId(c)];
      if (!el) return;
      el.classList.add("combo-card-highlight");
      if (coreIds.has(cardId(c))) el.classList.add("combo-card-highlight-core");
    });

    if (isCorrect) comboState.correctCount += 1;
    comboState.answeredCount += 1;
  }

  function renderComboOptions() {
    const wrap = document.getElementById("combo-options");
    wrap.innerHTML = "";
    selectedComboIndex = null;
    CATEGORY_NAMES[state.lang].forEach((name, idx) => {
      const btn = document.createElement("button");
      btn.className = "combo-option-btn";
      btn.textContent = name;
      btn.dataset.index = idx;
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        checkComboAnswer(idx);
      });
      wrap.appendChild(btn);
    });
  }

  function updateComboContext() {
    const t = dict[state.lang];
    const labels = { "5": t["setup.sublevel5"], flop: t["setup.sublevelFlop"], turn: t["setup.sublevelTurn"], river: t["setup.sublevelRiver"] };
    document.getElementById("combo-session-context").textContent = labels[comboState.sublevel];
    document.getElementById("combo-session-progress").textContent = comboState.dealNum + " / 10";
  }

  export function startComboSession() {
    comboState.dealNum = 1;
    comboState.correctCount = 0;
    comboState.answeredCount = 0;
    dealNewCombo();
    updateComboContext();
    renderComboCards();
    renderComboOptions();
    showSubview("session-combo");
  }

  function nextComboDeal() {
    comboState.dealNum += 1;
    dealNewCombo();
    updateComboContext();
    renderComboCards();
    renderComboOptions();
  }

  document.getElementById("next-combo-deal").addEventListener("click", nextComboDeal);

  document.getElementById("show-probs-modal").addEventListener("click", () => {
    const t = dict[state.lang];
    const table = document.getElementById("probs-modal-table");
    table.innerHTML = "";
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = "<th>" + t["theory.combos.colName"] + "</th><th>" + t["session.realProbCol"] + "</th><th>" + t["session.trainingProbCol"] + "</th>";
    table.appendChild(headerRow);
    CATEGORY_NAMES[state.lang].forEach((name, idx) => {
      const row = document.createElement("tr");
      row.innerHTML = "<td>" + name + "</td><td>" + REAL_PROBS[idx].toFixed(2) + "%</td><td>" + TRAINING_WEIGHTS[idx].toFixed(2) + "%</td>";
      table.appendChild(row);
    });
    document.getElementById("probs-modal").classList.add("show");
  });

  document.getElementById("close-probs-modal").addEventListener("click", () => {
    document.getElementById("probs-modal").classList.remove("show");
  });

  export function refreshLanguageDisplay() {
    if (currentComboDeal) { renderComboCards(); renderComboOptions(); updateComboContext(); }
  }

  // Точка входа для программного запуска (Обучариум) — см. DECISIONS.md.
  // settings: { sublevel }
  export function applySettings(settings) {
    if (settings.sublevel !== undefined) comboState.sublevel = settings.sublevel;
  }

  registerTrainingEntry("identify-combo", (settings) => {
    if (settings) applySettings(settings);
    startComboSession();
  });

  const savedComboSettings = loadSection("identifyCombo");
  if (savedComboSettings) {
    applySettings(savedComboSettings);
    comboSublevelSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === comboState.sublevel));
  }
