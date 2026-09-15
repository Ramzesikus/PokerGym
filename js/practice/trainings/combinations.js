// js/practice/trainings/combinations.js
// Логика и UI тренировки «Комбинации». Генератор раздачи по целевой категории
// (pickTargetCategory/generateCardsForCategory) — в core/combo-generation.js,
// не здесь и не в «Аутах» (см. DECISIONS.md, историю переноса в чате).

import { state } from "../../core/state.js";
import { dict } from "../../core/i18n.js";
import { evaluateBest, getCoreCards, displayCategoryIndex, CATEGORY_NAMES, cardId } from "../../core/hand-eval.js";
import { cardEl } from "../../ui/card.js";
import { pickTargetCategory, generateCardsForCategory, TRAINING_WEIGHTS, REAL_PROBS, REAL_PROBS_5, REAL_PROBS_6 } from "../../core/combo-generation.js";
import { showSubview, registerTrainingEntry, registerGearProvider } from "../practice-router.js";
import { loadSection, saveSection } from "../../core/storage.js";

  // hideCards/showTime — своя настройка этой тренировки (см. DECISIONS.md), не
  // общая с «Аутами»: та же пара полей, но отдельное хранение в comboState/
  // identifyCombo, чтобы у каждой тренировки могло быть своё значение.
  // Для подуровня «5 карт» (нет деления рука/борд) скрытие не действует —
  // см. updateComboCardDisplayAvailability.
  let comboState = { sublevel: "5", hideCards: false, showTime: "3", dealNum: 1, correctCount: 0, answeredCount: 0 };
  let currentComboDeal = null;
  let selectedComboIndex = null;

  export function persistCombinationsSettings() {
    saveSection("identifyCombo", { sublevel: comboState.sublevel, hideCards: comboState.hideCards, showTime: comboState.showTime });
  }

  export function getComboSettings() {
    return { sublevel: comboState.sublevel, hideCards: comboState.hideCards, showTime: comboState.showTime };
  }

  export function syncComboSettingsUI(s) {
    comboSublevelSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === s.sublevel));
    comboHideCardsToggle.checked = s.hideCards;
    comboTimeOptions.classList.toggle("disabled", !s.hideCards);
    comboTimeOptions.querySelectorAll(".time-chip").forEach(c => c.classList.toggle("active", c.dataset.value === s.showTime));
    updateComboCardDisplayAvailability();
  }

  // Подуровень «5 карт» не делит раздачу на руку/борд — скрывать там нечего
  // (см. обсуждение в чате). Блок скрытия в модалке просто затемняется, само
  // сохранённое значение hideCards/showTime не трогаем — вернётся, если
  // переключить подуровень обратно.
  function updateComboCardDisplayAvailability() {
    const disabled = comboState.sublevel === "5";
    comboHideCardsToggle.disabled = disabled;
    document.getElementById("combo-hide-cards-block").classList.toggle("row-disabled", disabled);
  }

  const comboSublevelSwitch = document.getElementById("combo-sublevel-switch");
  comboSublevelSwitch.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      comboSublevelSwitch.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      comboState.sublevel = btn.dataset.value;
      updateComboCardDisplayAvailability();
      checkComboSettingsDirty();
    });
  });

  const comboHideCardsToggle = document.getElementById("combo-hide-cards-toggle");
  const comboTimeOptions = document.getElementById("combo-time-options");
  comboHideCardsToggle.addEventListener("change", () => {
    comboState.hideCards = comboHideCardsToggle.checked;
    comboTimeOptions.classList.toggle("disabled", !comboState.hideCards);
    checkComboSettingsDirty();
  });
  comboTimeOptions.querySelectorAll(".time-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      comboTimeOptions.querySelectorAll(".time-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      comboState.showTime = chip.dataset.value;
      checkComboSettingsDirty();
    });
  });

  let comboSettingsSnapshot = null;
  function checkComboSettingsDirty() {
    const changed = comboSettingsSnapshot && JSON.stringify(getComboSettings()) !== JSON.stringify(comboSettingsSnapshot);
    document.getElementById("combo-settings-ok").disabled = !changed;
  }
  function openComboSettingsModal() {
    comboSettingsSnapshot = getComboSettings();
    document.getElementById("combo-settings-modal").classList.add("show");
    updateComboCardDisplayAvailability();
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
    syncComboSettingsUI(comboSettingsSnapshot);
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

  // --- Скрытие руки после показа — тот же механизм, что в «Аутах» (см. outs.js:
  // startReveal/peekHandStart/peekHandEnd), но здесь скрывается ТОЛЬКО рука
  // (2 карты), борд виден всегда — по прямому решению Романа в чате. Для
  // подуровня «5 карт» деления на руку/борд нет вообще, эта логика туда не
  // заходит (comboHandRowEl остаётся null).
  let comboTimerHandle = null;
  let comboHandHiddenByTimer = false;
  let comboHandRowEl = null;
  let comboHandCards = null;

  export function stopComboTimer() {
    if (comboTimerHandle) { clearTimeout(comboTimerHandle); comboTimerHandle = null; }
  }

  // Перерисовывает только ряд руки (борд и подписи не трогает) — вызывается и
  // при первом показе, и при скрытии по таймеру, и при «подсмотреть» по
  // зажатию, и при смене языка/оформления карт поверх уже идущей раздачи.
  function renderComboHand(faceUp) {
    if (!comboHandRowEl || !comboHandCards) return;
    comboHandRowEl.innerHTML = "";
    comboHandCards.forEach(c => {
      const el = cardEl(c, faceUp, state.faceStyle, state.cardBack);
      el.classList.add("card-hand");
      if (faceUp) comboCardElements[cardId(c)] = el;
      comboHandRowEl.appendChild(el);
    });
  }

  function comboPeekHandStart() {
    if (comboHandHiddenByTimer) renderComboHand(true);
  }
  function comboPeekHandEnd() {
    if (comboHandHiddenByTimer) renderComboHand(false);
  }

  // Строит статичную часть раздачи: подписи, ряд руки (пустой контейнер —
  // карты в него кладёт renderComboHand) и ряд борда (сразу и всегда лицом
  // вверх — борд не прячется). Сама раздача карт руки — отдельным шагом
  // в startComboReveal, как и в «Аутах» (renderBoard/renderHand разделены).
  function renderComboCards() {
    const area = document.getElementById("combo-cards-area");
    area.innerHTML = "";
    comboCardElements = {};
    comboHandRowEl = null;
    comboHandCards = null;
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

      const handLabel = document.createElement("div");
      handLabel.className = "card-row-label";
      handLabel.textContent = dict[state.lang]["session.hand"];
      const handRow = document.createElement("div");
      handRow.className = "card-row";
      comboHandRowEl = handRow;
      comboHandCards = hand;
      handRow.addEventListener("pointerdown", comboPeekHandStart);
      handRow.addEventListener("pointerup", comboPeekHandEnd);
      handRow.addEventListener("pointerleave", comboPeekHandEnd);
      handRow.addEventListener("pointercancel", comboPeekHandEnd);

      area.appendChild(boardLabel);
      area.appendChild(boardRow);
      area.appendChild(handLabel);
      area.appendChild(handRow);
    }
  }

  // Аналог startReveal() из outs.js: строит раздачу, показывает руку лицом
  // вверх и — если скрытие включено и применимо к этому подуровню — запускает
  // таймер, по истечении которого рука переворачивается рубашкой вверх.
  function startComboReveal() {
    stopComboTimer();
    comboHandHiddenByTimer = false;
    renderComboCards();

    const track = document.getElementById("combo-timer-track");
    const fill = document.getElementById("combo-timer-fill");

    if (comboState.sublevel === "5") {
      track.style.display = "none";
      return;
    }

    renderComboHand(true);

    if (!comboState.hideCards) {
      track.style.display = "none";
      return;
    }

    const seconds = parseFloat(comboState.showTime);
    track.style.display = "block";
    fill.style.transition = "none";
    fill.style.width = "100%";
    void fill.offsetWidth;

    requestAnimationFrame(() => {
      fill.style.transition = "width " + seconds + "s linear";
      fill.style.width = "0%";
    });

    comboTimerHandle = setTimeout(() => {
      renderComboHand(false);
      comboHandHiddenByTimer = true;
    }, seconds * 1000);
  }

  function checkComboAnswer(selectedIndex) {
    // Раскрываем руку перед разбором ответа, если она ещё скрыта таймером —
    // иначе подсветку использованных карт (ниже) было бы не видно, а сама
    // рука так и осталась бы рубашкой вверх до конца раздачи. Останавливаем
    // и сам таймер — иначе он мог бы сработать позже, уже во время разбора.
    stopComboTimer();
    if (comboHandHiddenByTimer) {
      renderComboHand(true);
      comboHandHiddenByTimer = false;
    }

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
    renderComboOptions();
    // showSubview — до startComboReveal: полосе таймера нужен реальный layout
    // (реальная видимость), чтобы трюк с reflow (void fill.offsetWidth) сработал
    // так же, как в outs.js startSession.
    showSubview("session-combo");
    startComboReveal();
  }

  function nextComboDeal() {
    comboState.dealNum += 1;
    dealNewCombo();
    updateComboContext();
    startComboReveal();
    renderComboOptions();
  }

  document.getElementById("next-combo-deal").addEventListener("click", nextComboDeal);

  // До фулл-хауса включительно (idx 0-6) — всегда ровно 2 знака. Каре (idx 7) —
  // ровно 3 знака, Стрит-флеш и Флеш-рояль (idx 8-9) — ровно 4 знака. Раньше
  // здесь была вариативная точность («минимум 2 живые цифры», fmtProb/
  // fmtProbCoarse) — по прямому решению Романа заменена на фиксированное число
  // знаков для наглядности и предсказуемости в столбцах точных вероятностей.
  // fmtProb/fmtProbCoarse ниже никуда не делись — ими по-прежнему считается
  // только тренировочная колонка (см. fmtProbByRow), это решение не трогает.
  function fmtProbExact(pct, idx) {
    if (idx <= 6) return pct.toFixed(2);
    if (idx === 7) return pct.toFixed(3);
    return pct.toFixed(4);
  }

  // Минимум 2 «живые» (не нулевые после ведущих нулей) цифры после запятой —
  // см. чат: обычные 2 знака достаточны для больших процентов, редкие категории
  // получают столько знаков, сколько нужно (0.00015% для рояля на 5 картах и т.п.).
  function fmtProb(pct) {
    for (let dec = 2; dec <= 6; dec++) {
      const s = pct.toFixed(dec);
      const frac = s.split(".")[1];
      const firstNonZero = [...frac].findIndex(ch => ch !== "0");
      if (firstNonZero === -1) continue;
      if (frac.length - firstNonZero >= 2) return s;
    }
    return pct.toFixed(6);
  }

  // Только для строки флеш-рояля (idx 9) — на телефоне 5 знаков после запятой
  // слипаются, по прямому решению Романа на одну значащую цифру меньше, чем
  // обычное правило fmtProb. Считает от точного значения (REAL_PROBS_5/6/[9]
  // хранят полную точность), не переокругляет уже показанное — иначе то самое
  // двойное округление, что уже один раз дало неверный результат в чате.
  function fmtProbCoarse(pct) {
    let fineDec = 6;
    for (let dec = 2; dec <= 6; dec++) {
      const s = pct.toFixed(dec);
      const frac = s.split(".")[1];
      const firstNonZero = [...frac].findIndex(ch => ch !== "0");
      if (firstNonZero === -1) continue;
      if (frac.length - firstNonZero >= 2) { fineDec = dec; break; }
    }
    return pct.toFixed(Math.max(fineDec - 1, 0));
  }

  // Тренировочная колонка (5-я) — единственная, что всё ещё считается этой
  // вариативной точностью («минимум 2 живые цифры», Флеш-рояль на 1 знак
  // грубее). Столбцы точных вероятностей (5/6/7 карт) больше не используют
  // fmtProbByRow — там фиксированная точность по строке, см. fmtProbExact выше.
  function fmtProbByRow(pct, idx) {
    if (idx <= 6) return pct.toFixed(2);
    if (idx === 9) return fmtProbCoarse(pct);
    return fmtProb(pct);
  }

  document.getElementById("show-probs-modal").addEventListener("click", () => {
    const t = dict[state.lang];
    const table = document.getElementById("probs-modal-table");
    table.innerHTML = "";
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = "<th>" + t["theory.combos.colName"] + "</th><th>" + t["session.realProb5Col"] + "</th><th>" + t["session.realProb6Col"] + "</th><th>" + t["session.realProb7Col"] + "</th><th>" + t["session.trainingProbCol"] + "</th>";
    table.appendChild(headerRow);
    CATEGORY_NAMES[state.lang].forEach((name, idx) => {
      const row = document.createElement("tr");
      const fmt5 = fmtProbExact(REAL_PROBS_5[idx], idx);
      const fmt6 = fmtProbExact(REAL_PROBS_6[idx], idx);
      const fmt7 = fmtProbExact(REAL_PROBS[idx], idx);
      const fmtT = fmtProbByRow(TRAINING_WEIGHTS[idx], idx);
      row.innerHTML = "<td>" + name + "</td><td>" + fmt5 + "%</td><td>" + fmt6 + "%</td><td>" + fmt7 + "%</td><td>" + fmtT + "%</td>";
      table.appendChild(row);
    });
    document.getElementById("probs-modal").classList.add("show");
  });

  document.getElementById("close-probs-modal").addEventListener("click", () => {
    document.getElementById("probs-modal").classList.remove("show");
  });

  export function refreshLanguageDisplay() {
    if (currentComboDeal) {
      // renderComboCards() пересобирает и руку (пустой контейнер), и борд —
      // сразу же довосстанавливаем текущее видимое/скрытое состояние руки,
      // не перезапуская сам таймер (смена языка не должна сбрасывать раздачу).
      renderComboCards();
      renderComboHand(!comboHandHiddenByTimer);
      renderComboOptions();
      updateComboContext();
    }
  }

  // Точка входа для программного запуска (Обучариум) — см. DECISIONS.md.
  // settings: { sublevel, hideCards, showTime }
  export function applySettings(settings) {
    if (settings.sublevel !== undefined) comboState.sublevel = settings.sublevel;
    if (settings.hideCards !== undefined) comboState.hideCards = settings.hideCards;
    // "none" — устаревшее значение из убранной опции «Без ограничения», см. outs.js.
    if (settings.showTime !== undefined && settings.showTime !== "none") comboState.showTime = settings.showTime;
  }

  registerTrainingEntry("identify-combo", (settings) => {
    if (settings) applySettings(settings);
    startComboSession();
  });

  const savedComboSettings = loadSection("identifyCombo");
  if (savedComboSettings) {
    applySettings(savedComboSettings);
    syncComboSettingsUI(getComboSettings());
  }
