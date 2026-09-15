// js/practice/trainings/mnemonics.js
// Тренировка «Мнемоника»: показать 2 карты на время → отвлечь серией
// арифметики (N верных подряд, ошибка/просрочка — серия заново) → вспомнить,
// какие карты были (через общий openCardPicker/renderSeqCardRow).
//
// Показ карт здесь — БЕЗ опции «не скрывать»: рубашка после времени показа
// наступает всегда, настраивается только само время (см. чат/DECISIONS.md —
// сознательно урезанный вариант общего контракта «Показ карт», не полный).
// Поэтому mnemoState хранит только showTime, без hideCards.

import { state } from "../../core/state.js";
import { dict } from "../../core/i18n.js";
import { buildDeck, shuffle, randomInt } from "../../core/deck.js";
import { cardId } from "../../core/hand-eval.js";
import { cardEl, displayRank, suitSymbols } from "../../ui/card.js";
import { renderSeqCardRow } from "../../ui/card-picker.js";
import { showSubview, registerTrainingEntry, registerGearProvider } from "../practice-router.js";
import { loadSection, saveSection } from "../../core/storage.js";

  // Своя настройка этой тренировки (см. DECISIONS.md — контракт «Показ карт»,
  // тот же снимок+Ок/Отмена, что у «Аутов»/«Комбинаций»), плюс собственные поля
  // отвлечения. dealNum/correctCount/answeredCount — транзитное состояние сессии,
  // не персистится (как и у остальных тренировок).
  let mnemoState = {
    showTime: "3",
    digitLength: "2",     // "2" | "3" — разрядность чисел в примерах
    exampleCount: 3,      // сколько верных ответов подряд нужно набрать
    exampleTime: "8",     // сек на один пример
    dealNum: 1,
    correctCount: 0,
    answeredCount: 0
  };

  let mnemoDeal = null;              // { cards: [card, card] }
  let mnemoRecall = [null, null];    // заполняется через renderSeqCardRow
  let mnemoStreak = 0;
  let mnemoCurrentExample = null;    // { text, answer }

  let mnemoTimerHandle = null;   // таймер показа карт
  let mnemoExTimerHandle = null; // таймер одного примера арифметики

  export function stopMnemoTimer() {
    if (mnemoTimerHandle) { clearTimeout(mnemoTimerHandle); mnemoTimerHandle = null; }
  }
  export function stopMnemoExTimer() {
    if (mnemoExTimerHandle) { clearTimeout(mnemoExTimerHandle); mnemoExTimerHandle = null; }
  }

  /* ===== Настройки (шестерёнка) — контракт снимок+Ок/Отмена, как у остальных ===== */

  export function persistMnemonicSettings() {
    saveSection("mnemonic", {
      showTime: mnemoState.showTime,
      digitLength: mnemoState.digitLength,
      exampleCount: mnemoState.exampleCount,
      exampleTime: mnemoState.exampleTime
    });
  }

  export function getMnemonicSettings() {
    return {
      showTime: mnemoState.showTime,
      digitLength: mnemoState.digitLength,
      exampleCount: mnemoState.exampleCount,
      exampleTime: mnemoState.exampleTime
    };
  }

  export function syncMnemonicSettingsUI(s) {
    mnemoTimeOptions.querySelectorAll(".time-chip").forEach(c => c.classList.toggle("active", c.dataset.value === s.showTime));
    mnemoDigitSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === s.digitLength));
    mnemoCountSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === String(s.exampleCount)));
    mnemoExTimeOptions.querySelectorAll(".time-chip").forEach(c => c.classList.toggle("active", c.dataset.value === s.exampleTime));
  }

  // Точка входа для программного запуска (Обучариум) — та же форма, что
  // возвращает getMnemonicSettings().
  export function applySettings(settings) {
    if (settings.showTime !== undefined) mnemoState.showTime = settings.showTime;
    if (settings.digitLength !== undefined) mnemoState.digitLength = settings.digitLength;
    if (settings.exampleCount !== undefined) mnemoState.exampleCount = settings.exampleCount;
    if (settings.exampleTime !== undefined) mnemoState.exampleTime = settings.exampleTime;
  }

  const mnemoTimeOptions = document.getElementById("mnemo-time-options");
  mnemoTimeOptions.querySelectorAll(".time-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      mnemoTimeOptions.querySelectorAll(".time-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      mnemoState.showTime = chip.dataset.value;
      checkMnemonicSettingsDirty();
    });
  });

  const mnemoDigitSwitch = document.getElementById("mnemo-digit-switch");
  mnemoDigitSwitch.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      mnemoDigitSwitch.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      mnemoState.digitLength = btn.dataset.value;
      checkMnemonicSettingsDirty();
    });
  });

  const mnemoCountSwitch = document.getElementById("mnemo-count-switch");
  mnemoCountSwitch.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      mnemoCountSwitch.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      mnemoState.exampleCount = parseInt(btn.dataset.value, 10);
      checkMnemonicSettingsDirty();
    });
  });

  const mnemoExTimeOptions = document.getElementById("mnemo-ex-time-options");
  mnemoExTimeOptions.querySelectorAll(".time-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      mnemoExTimeOptions.querySelectorAll(".time-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      mnemoState.exampleTime = chip.dataset.value;
      checkMnemonicSettingsDirty();
    });
  });

  let mnemonicSettingsSnapshot = null;

  function checkMnemonicSettingsDirty() {
    const changed = mnemonicSettingsSnapshot && JSON.stringify(getMnemonicSettings()) !== JSON.stringify(mnemonicSettingsSnapshot);
    document.getElementById("mnemonic-settings-ok").disabled = !changed;
  }

  function openMnemonicSettingsModal() {
    mnemonicSettingsSnapshot = getMnemonicSettings();
    document.getElementById("mnemonic-settings-modal").classList.add("show");
    checkMnemonicSettingsDirty();
  }
  function closeMnemonicSettingsModal() {
    document.getElementById("mnemonic-settings-modal").classList.remove("show");
  }

  document.getElementById("mnemonic-settings-ok").addEventListener("click", () => {
    persistMnemonicSettings();
    closeMnemonicSettingsModal();
    startMnemoSession();
  });
  function cancelMnemonicSettings() {
    applySettings(mnemonicSettingsSnapshot);
    syncMnemonicSettingsUI(mnemonicSettingsSnapshot);
    closeMnemonicSettingsModal();
  }
  document.getElementById("mnemonic-settings-cancel").addEventListener("click", cancelMnemonicSettings);
  document.getElementById("mnemonic-settings-cancel-x").addEventListener("click", cancelMnemonicSettings);
  registerGearProvider("session-mnemonic", openMnemonicSettingsModal);

  /* ===== Фаза 1: показ карт ===== */

  function showMnemoPhase(name) {
    document.getElementById("mnemo-phase-show").style.display = name === "show" ? "block" : "none";
    document.getElementById("mnemo-phase-distract").style.display = name === "distract" ? "block" : "none";
    document.getElementById("mnemo-phase-recall").style.display = name === "recall" ? "block" : "none";
    document.getElementById("mnemo-phase-label").textContent = dict[state.lang]["session.mnemoPhase" + name.charAt(0).toUpperCase() + name.slice(1)];
  }

  function dealNewMnemoPair() {
    const deck = shuffle(buildDeck());
    mnemoDeal = { cards: [deck.pop(), deck.pop()] };
  }

  function renderMnemoHand() {
    const row = document.getElementById("mnemo-hand-row");
    row.innerHTML = "";
    mnemoDeal.cards.forEach(c => {
      const el = cardEl(c, true, state.faceStyle, state.cardBack);
      el.classList.add("card-hand");
      row.appendChild(el);
    });
  }

  function startMnemoReveal() {
    stopMnemoTimer();
    showMnemoPhase("show");
    renderMnemoHand();

    const track = document.getElementById("mnemo-timer-track");
    const fill = document.getElementById("mnemo-timer-fill");
    const seconds = parseFloat(mnemoState.showTime);
    track.style.display = "block";
    fill.style.transition = "none";
    fill.style.width = "100%";
    void fill.offsetWidth;

    requestAnimationFrame(() => {
      fill.style.transition = "width " + seconds + "s linear";
      fill.style.width = "0%";
    });

    mnemoTimerHandle = setTimeout(() => {
      startMnemoDistraction();
    }, seconds * 1000);
  }

  /* ===== Фаза 2: отвлечение — серия арифметики ===== */

  function updateMnemoStreakLabel() {
    document.getElementById("mnemo-streak-label").textContent = mnemoStreak + " / " + mnemoState.exampleCount;
  }

  function generateMnemoExample() {
    const isThree = mnemoState.digitLength === "3";
    const min = isThree ? 100 : 10;
    const max = isThree ? 999 : 99;
    const a = randomInt(min, max);
    const b = randomInt(min, max);
    const isAdd = Math.random() < 0.5;
    if (isAdd) return { text: a + " + " + b, answer: a + b };
    const hi = Math.max(a, b), lo = Math.min(a, b);
    return { text: hi + " − " + lo, answer: hi - lo };
  }

  function nextMnemoExample() {
    mnemoCurrentExample = generateMnemoExample();
    document.getElementById("mnemo-example-text").textContent = mnemoCurrentExample.text + " = ?";
    const input = document.getElementById("mnemo-example-answer");
    input.value = "";
    startMnemoExTimer();
  }

  function startMnemoDistraction() {
    showMnemoPhase("distract");
    mnemoStreak = 0;
    updateMnemoStreakLabel();
    document.getElementById("mnemo-distract-error").textContent = "";
    nextMnemoExample();
  }

  function startMnemoExTimer() {
    stopMnemoExTimer();
    const track = document.getElementById("mnemo-ex-timer-track");
    const fill = document.getElementById("mnemo-ex-timer-fill");
    const seconds = parseFloat(mnemoState.exampleTime);
    fill.style.transition = "none";
    fill.style.width = "100%";
    void fill.offsetWidth;

    requestAnimationFrame(() => {
      fill.style.transition = "width " + seconds + "s linear";
      fill.style.width = "0%";
    });

    mnemoExTimerHandle = setTimeout(() => {
      mnemoStreak = 0;
      updateMnemoStreakLabel();
      document.getElementById("mnemo-distract-error").textContent = dict[state.lang]["session.mnemoTimeout"];
      nextMnemoExample();
    }, seconds * 1000);
  }

  document.getElementById("mnemo-check-example").addEventListener("click", () => {
    const input = document.getElementById("mnemo-example-answer");
    const val = parseInt(input.value, 10);
    stopMnemoExTimer();

    if (val === mnemoCurrentExample.answer) {
      mnemoStreak += 1;
      updateMnemoStreakLabel();
      document.getElementById("mnemo-distract-error").textContent = "";
      if (mnemoStreak >= mnemoState.exampleCount) { startMnemoRecall(); return; }
      nextMnemoExample();
    } else {
      mnemoStreak = 0;
      updateMnemoStreakLabel();
      document.getElementById("mnemo-distract-error").textContent = dict[state.lang]["session.mnemoWrong"];
      nextMnemoExample();
    }
  });

  /* ===== Фаза 3: вспомнить карты ===== */

  function mnemoRecallTakenIds() {
    const ids = new Set();
    mnemoRecall.forEach(c => { if (c) ids.add(cardId(c)); });
    return ids;
  }

  // onChange = сама эта функция — тот же паттерн, что renderCalcSlots в
  // calc-outs.js: клик по слоту меняет mnemoRecall на месте, коллбэк
  // перерисовывает ряд целиком и пересчитывает доступность кнопки проверки.
  function renderMnemoRecallSlots() {
    renderSeqCardRow(document.getElementById("mnemo-recall-slots"), mnemoRecall, 2, mnemoRecallTakenIds, renderMnemoRecallSlots);
    document.getElementById("mnemo-check-recall").disabled = !mnemoRecall.every(c => c);
  }

  function startMnemoRecall() {
    stopMnemoExTimer();
    showMnemoPhase("recall");
    mnemoRecall = [null, null];
    document.getElementById("mnemo-recall-error").textContent = "";
    document.getElementById("mnemo-check-recall").style.display = "block";
    document.getElementById("mnemo-check-recall").disabled = true;
    document.getElementById("mnemo-next-round").style.display = "none";
    renderMnemoRecallSlots();
  }

  document.getElementById("mnemo-check-recall").addEventListener("click", () => {
    const dealIds = new Set(mnemoDeal.cards.map(cardId));
    const recallIds = mnemoRecall.filter(Boolean).map(cardId);
    const isCorrect = recallIds.length === 2 && recallIds.every(id => dealIds.has(id));

    const err = document.getElementById("mnemo-recall-error");
    if (isCorrect) {
      err.textContent = "";
      mnemoState.correctCount += 1;
    } else {
      err.textContent = dict[state.lang]["session.mnemoIncorrectShow"] + " " +
        mnemoDeal.cards.map(c => displayRank(c.rank) + suitSymbols[c.suit]).join(" ");
    }
    mnemoState.answeredCount += 1;

    document.getElementById("mnemo-check-recall").style.display = "none";
    document.getElementById("mnemo-next-round").style.display = "block";
  });

  document.getElementById("mnemo-next-round").addEventListener("click", () => {
    mnemoState.dealNum += 1;
    startMnemoRound();
  });

  /* ===== Запуск сессии ===== */

  function updateMnemoSessionContext() {
    document.getElementById("mnemo-session-progress").textContent = mnemoState.dealNum + " / 10";
  }

  function startMnemoRound() {
    dealNewMnemoPair();
    updateMnemoSessionContext();
    startMnemoReveal();
  }

  export function startMnemoSession() {
    mnemoState.dealNum = 1;
    mnemoState.correctCount = 0;
    mnemoState.answeredCount = 0;
    showSubview("session-mnemonic");
    startMnemoRound();
  }

  registerTrainingEntry("mnemonic", (settings) => {
    if (settings) applySettings(settings);
    startMnemoSession();
  });

  // Восстановление сохранённых настроек — тот же контракт, что у остальных
  // тренировок (см. outs.js/combinations.js).
  const savedMnemoSettings = loadSection("mnemonic");
  if (savedMnemoSettings) {
    applySettings(savedMnemoSettings);
    syncMnemonicSettingsUI(getMnemonicSettings());
  }
