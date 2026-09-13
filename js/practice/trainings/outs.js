// js/practice/trainings/outs.js
// Логика и UI тренировки «Ауты и вероятность» в одном файле (разделение на
// -logic.js/-ui.js отложено — приоритет сейчас: рабочее приложение целиком,
// см. ARCHITECTURE.md).

import { state, RANK_VALUE, SUITS, DRAW_TYPES, OTHER_OUT_TYPES } from "../../core/state.js";
import { dict } from "../../core/i18n.js";
import { buildDeck, shuffle } from "../../core/deck.js";
import { classifyCategories, computeOuts, displayCategoryIndex, CATEGORY_NAMES, evaluateBest } from "../../core/hand-eval.js";
import { cardEl } from "../../ui/card.js";
import { showSubview, registerTrainingEntry } from "../practice-router.js";

  let currentDeal = null;
  let timerHandle = null;

  const TRAINING_WEIGHTS = [15.23, 19.18, 16.41, 11.05, 10.93, 9.84, 9.47, 4.79, 2.20, 0.90];
  const REAL_PROBS = [17.41, 43.82, 23.50, 4.83, 4.62, 3.03, 2.60, 0.17, 0.028, 0.003];

  export function pickTargetCategory() {
    const total = TRAINING_WEIGHTS.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < TRAINING_WEIGHTS.length; i++) {
      r -= TRAINING_WEIGHTS[i];
      if (r <= 0) return i;
    }
    return TRAINING_WEIGHTS.length - 1;
  }

  // Прямое построение стрит-флеша: равномерный случайный выбор среди возможных вариантов —
  // честная случайность внутри узкого пространства, а не заранее заготовленный набор.
  // wantRoyal явно фиксирует старший ранг T-A, иначе выбор идёт среди остальных 9 стартов
  // (стрит-флеш категории 8 теперь генерируется гарантированно НЕ роялом).
  // Нужно только для 5-карточного режима, где обычный перебор практически никогда
  // не находит стрит-флеш случайно.
  function constructStraightFlush(wantRoyal) {
    const suit = SUITS[Math.floor(Math.random() * 4)];
    const startIdx = wantRoyal ? 9 : Math.floor(Math.random() * 9);
    let ranks;
    if (startIdx === 0) {
      ranks = ["A", "2", "3", "4", "5"];
    } else {
      ranks = RANKS.slice(startIdx - 1, startIdx + 4);
    }
    return ranks.map(r => ({ rank: r, suit }));
  }

  export function generateCardsForCategory(targetCategory, cardCount) {
    if (cardCount === 5 && (targetCategory === 8 || targetCategory === 9)) {
      return constructStraightFlush(targetCategory === 9);
    }
    for (let attempts = 0; attempts < 300000; attempts++) {
      const deck = shuffle(buildDeck());
      const cards = deck.slice(0, cardCount);
      const result = evaluateBest(cards).best;
      if (displayCategoryIndex(result) === targetCategory) return cards;
    }
    return null;
  }

  function dealNewHand() {
    const deck = shuffle(buildDeck());
    const hand = [deck.pop(), deck.pop()];
    const boardCount = state.street === "flop" ? 3 : 4;
    const board = [];
    for (let i = 0; i < boardCount; i++) board.push(deck.pop());
    currentDeal = { hand, board };
  }

  function renderBoard() {
    const boardRow = document.getElementById("board-row");
    boardRow.innerHTML = "";
    currentDeal.board.forEach(c => boardRow.appendChild(cardEl(c, true, state.faceStyle, state.cardBack)));
  }

  function renderHand(faceUp) {
    const handRow = document.getElementById("hand-row");
    handRow.innerHTML = "";
    currentDeal.hand.forEach(c => {
      const el = cardEl(c, faceUp, state.faceStyle, state.cardBack);
      el.classList.add("card-hand");
      handRow.appendChild(el);
    });
  }

  export function stopTimer() {
    if (timerHandle) { clearTimeout(timerHandle); timerHandle = null; }
  }

  let cardsCurrentlyHiddenByTimer = false;

  function startReveal() {
    stopTimer();
    cardsCurrentlyHiddenByTimer = false;
    renderBoard();
    renderHand(true);
    const track = document.getElementById("timer-track");
    const fill = document.getElementById("timer-fill");

    if (!state.hideCards || state.showTime === "none") {
      track.style.display = "none";
      return;
    }

    const seconds = parseFloat(state.showTime);
    track.style.display = "block";
    fill.style.transition = "none";
    fill.style.width = "100%";
    void fill.offsetWidth;

    requestAnimationFrame(() => {
      fill.style.transition = "width " + seconds + "s linear";
      fill.style.width = "0%";
    });

    timerHandle = setTimeout(() => {
      renderHand(false);
      cardsCurrentlyHiddenByTimer = true;
    }, seconds * 1000);
  }

  function peekHandStart() {
    if (cardsCurrentlyHiddenByTimer) renderHand(true);
  }

  function peekHandEnd() {
    if (cardsCurrentlyHiddenByTimer) renderHand(false);
  }

  const handRowPeekEl = document.getElementById("hand-row");
  handRowPeekEl.addEventListener("pointerdown", peekHandStart);
  handRowPeekEl.addEventListener("pointerup", peekHandEnd);
  handRowPeekEl.addEventListener("pointerleave", peekHandEnd);
  handRowPeekEl.addEventListener("pointercancel", peekHandEnd);

  function createCategoryChip(type) {
    const chip = document.createElement("div");
    chip.className = "dry-chip-2col";
    chip.dataset.type = type;

    const label = document.createElement("span");
    label.className = "chip-label-text";
    label.textContent = dict[state.lang]["dry." + type];
    chip.appendChild(label);

    let input = null;
    if (state.wantPercategory) {
      input = document.createElement("input");
      input.type = "number";
      input.className = "chip-inline-input per-type-answer";
      input.dataset.type = type;
      input.style.visibility = "hidden";
      input.addEventListener("click", e => e.stopPropagation());
      input.addEventListener("mousedown", e => e.stopPropagation());
      chip.appendChild(input);
    }

    chip.addEventListener("click", (e) => {
      if (input && e.target === input) return;
      chip.classList.toggle("active");
      if (input) input.style.visibility = chip.classList.contains("active") ? "visible" : "hidden";
    });

    return chip;
  }

  function renderAnswerArea() {
    const area = document.getElementById("answer-area");
    area.innerHTML = "";
    const t = dict[state.lang];

    if (state.wantCategory) {
      const drawLabel = document.createElement("div");
      drawLabel.className = "chip-group-label";
      drawLabel.textContent = t["categories.groupDraws"];
      area.appendChild(drawLabel);

      const drawGrid = document.createElement("div");
      drawGrid.className = "dry-chips-grid";
      DRAW_TYPES.forEach(type => drawGrid.appendChild(createCategoryChip(type)));
      area.appendChild(drawGrid);

      const otherLabel = document.createElement("div");
      otherLabel.className = "chip-group-label";
      otherLabel.textContent = t["categories.groupOther"];
      area.appendChild(otherLabel);

      const otherGrid = document.createElement("div");
      otherGrid.className = "dry-chips-grid";
      OTHER_OUT_TYPES.forEach(type => otherGrid.appendChild(createCategoryChip(type)));
      area.appendChild(otherGrid);
    }

    if (state.wantNumber) {
      const questionText = state.outputMode === "outs" ? t["session.outsQuestion"] : t["session.probQuestion"];
      const row = document.createElement("div");
      row.className = "total-answer-row";
      if (state.wantCategory) row.style.marginTop = "10px";
      const label = document.createElement("span");
      label.className = "setting-label";
      label.style.margin = "0";
      label.textContent = questionText;
      const input = document.createElement("input");
      input.type = "number";
      input.id = "answer-total";
      input.className = "total-answer-input";
      row.appendChild(label);
      row.appendChild(input);
      area.appendChild(row);
    }
  }

  function updateSessionContext() {
    const t = dict[state.lang];
    const streetLabel = state.street === "flop" ? t["setup.flop"] : t["setup.turn"];
    document.getElementById("session-context").textContent = streetLabel;
    document.getElementById("session-progress").textContent = state.dealNum + " / 10";
  }

  export function startSession() {
    state.dealNum = 1;
    state.correctCount = 0;
    state.answeredCount = 0;
    currentClassification = null;
    document.getElementById("check-answer").style.display = "block";
    document.getElementById("next-deal").style.display = "none";
    document.getElementById("show-breakdown").style.display = "none";
    dealNewHand();
    updateSessionContext();
    renderAnswerArea();
    showSubview("session");
    startReveal();
  }

  function nextDeal() {
    state.dealNum += 1;
    currentClassification = null;
    document.getElementById("check-answer").style.display = "block";
    document.getElementById("next-deal").style.display = "none";
    document.getElementById("show-breakdown").style.display = "none";
    document.getElementById("answer-error").textContent = "";
    dealNewHand();
    updateSessionContext();
    startReveal();
    renderAnswerArea();
  }

  let currentClassification = null;

  function showFieldResult(input, userValue, correctValue, isCorrect) {
    input.disabled = true;
    input.classList.remove("field-correct", "field-incorrect");
    input.classList.add(isCorrect ? "field-correct" : "field-incorrect");
    if (!isCorrect) {
      const span = document.createElement("span");
      span.className = "field-correct-value";
      span.textContent = correctValue;
      input.insertAdjacentElement("afterend", span);
    }
  }

  document.getElementById("check-answer").addEventListener("click", () => {
    const err = document.getElementById("answer-error");
    const total = document.getElementById("answer-total");

    if (state.wantNumber && (!total || total.value === "")) {
      err.textContent = dict[state.lang]["session.errorEmpty"];
      return;
    }
    err.textContent = "";

    const classification = classifyCategories(currentDeal.hand, currentDeal.board);
    currentClassification = classification;
    const realCount = classification.totalCount;
    const denom = state.street === "flop" ? 47 : 46;
    const realProb = Math.round((realCount / denom) * 1000) / 10;

    let totalCorrect = true;

    if (state.wantNumber) {
      const userTotal = parseFloat(total.value);
      if (state.outputMode === "outs") {
        totalCorrect = userTotal === realCount;
        showFieldResult(total, userTotal, realCount, totalCorrect);
      } else {
        totalCorrect = Math.abs(userTotal - realProb) <= 2;
        showFieldResult(total, userTotal, realProb + "%", totalCorrect);
      }
    }

    if (state.wantCategory) {
      const realKeys = classification.presentKeys;
      document.querySelectorAll(".dry-chip-2col").forEach(chip => {
        const type = chip.dataset.type;
        const selected = chip.classList.contains("active");
        const shouldBe = realKeys.includes(type);
        chip.classList.remove("chip-correct", "chip-incorrect", "chip-missed");
        chip.style.pointerEvents = "none";
        if (selected && shouldBe) chip.classList.add("chip-correct");
        else if (selected && !shouldBe) chip.classList.add("chip-incorrect");
        else if (!selected && shouldBe) chip.classList.add("chip-missed");

        if (state.wantPercategory) {
          const input = chip.querySelector(".chip-inline-input");
          if (input) {
            const realTypeCount = classification.buckets[type] ? classification.buckets[type].length : 0;
            input.style.display = "none";
            const resultSpan = document.createElement("span");
            resultSpan.className = "chip-result-text";
            if (selected && shouldBe) {
              const userVal = parseFloat(input.value);
              if (userVal === realTypeCount) {
                resultSpan.innerHTML = '<span class="correct-num">' + realTypeCount + '</span>';
              } else {
                resultSpan.innerHTML = '<s>' + (isNaN(userVal) ? "" : userVal) + '</s> <span class="correct-num">' + realTypeCount + '</span>';
              }
            } else if (selected && !shouldBe) {
              resultSpan.innerHTML = '<s>' + input.value + '</s>';
            } else if (!selected && shouldBe) {
              resultSpan.innerHTML = '<span class="correct-num">' + realTypeCount + '</span>';
            }
            chip.appendChild(resultSpan);
          }
        }
      });
    }

    document.getElementById("check-answer").style.display = "none";
    document.getElementById("next-deal").style.display = "block";
    document.getElementById("show-breakdown").style.display = "block";

    if (totalCorrect) state.correctCount += 1;
    state.answeredCount += 1;
  });

  export function renderBreakdown() {
    const content = document.getElementById("breakdown-content");
    content.innerHTML = "";
    const t = dict[state.lang];

    if (currentDeal) {
      const currentBest = evaluateBest(currentDeal.hand.concat(currentDeal.board)).best;
      const currentHandLine = document.createElement("div");
      currentHandLine.className = "breakdown-group-title";
      currentHandLine.style.marginBottom = "14px";
      currentHandLine.textContent = t["session.currentBestHand"] + " " + CATEGORY_NAMES[state.lang][displayCategoryIndex(currentBest)];
      content.appendChild(currentHandLine);
    }

    if (!currentClassification || currentClassification.totalCount === 0) {
      const p = document.createElement("div");
      p.className = "breakdown-group-title";
      p.textContent = t["session.noOuts"];
      content.appendChild(p);
      return;
    }

    const intersectionIds = new Set(currentClassification.intersections.map(o => cardId(o.card)));

    [{ types: DRAW_TYPES, labelKey: "categories.groupDraws" }, { types: OTHER_OUT_TYPES, labelKey: "categories.groupOther" }].forEach(section => {
      const anyPresent = section.types.some(type => currentClassification.buckets[type] && currentClassification.buckets[type].length > 0);
      if (!anyPresent) return;

      const sectionLabel = document.createElement("div");
      sectionLabel.className = "chip-group-label";
      sectionLabel.textContent = t[section.labelKey];
      content.appendChild(sectionLabel);

      section.types.forEach(type => {
        const cards = currentClassification.buckets[type];
        if (!cards || cards.length === 0) return;
        const group = document.createElement("div");
        group.className = "breakdown-group";
        const title = document.createElement("div");
        title.className = "breakdown-group-title";
        title.textContent = t["dry." + type] + " (" + cards.length + ")";
        const cardsWrap = document.createElement("div");
        cardsWrap.className = "breakdown-cards";
        cards.forEach(card => {
          const el = document.createElement("div");
          el.className = "breakdown-card";
          el.style.color = suitColor(card.suit, state.faceStyle);
          if (intersectionIds.has(cardId(card))) el.style.outline = "2px solid #4fa3ff";
        el.textContent = displayRank(card.rank) + suitSymbols[card.suit];
        cardsWrap.appendChild(el);
      });
      group.appendChild(title);
      group.appendChild(cardsWrap);
      content.appendChild(group);
      });
    });

    if (currentClassification.intersections.length > 0) {
      const group = document.createElement("div");
      group.className = "breakdown-group";
      const title = document.createElement("div");
      title.className = "breakdown-group-title";
      title.textContent = t["session.intersection"] + " (" + currentClassification.intersections.length + ")";
      const cardsWrap = document.createElement("div");
      cardsWrap.className = "breakdown-cards";
      currentClassification.intersections.forEach(o => {
        const el = document.createElement("div");
        el.className = "breakdown-card";
        el.style.color = suitColor(o.card.suit, state.faceStyle);
        el.style.outline = "2px solid #4fa3ff";
        el.textContent = displayRank(o.card.rank) + suitSymbols[o.card.suit];
        cardsWrap.appendChild(el);
      });
      group.appendChild(title);
      group.appendChild(cardsWrap);
      content.appendChild(group);
    }
  }

  document.getElementById("show-breakdown").addEventListener("click", () => {
    renderBreakdown();
    document.getElementById("breakdown-modal").classList.add("show");
  });

  document.getElementById("close-breakdown").addEventListener("click", () => {
    document.getElementById("breakdown-modal").classList.remove("show");
  });

  document.getElementById("next-deal").addEventListener("click", nextDeal);

  /* Navigation: tabs */


  const streetSwitch = document.getElementById("street-switch");
  streetSwitch.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      streetSwitch.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.street = btn.dataset.value;
    });
  });

  function updateStartButtonState() {
    const canStart = state.wantNumber || state.wantCategory;
    const startBtn = document.getElementById("start-session");
    const note = document.getElementById("start-disabled-note");
    startBtn.disabled = !canStart;
    startBtn.style.opacity = canStart ? "1" : "0.5";
    note.style.display = canStart ? "none" : "block";
  }

  const wantNumberToggle = document.getElementById("want-number-toggle");
  const wantCategoryToggle = document.getElementById("want-category-toggle");
  const wantPercategoryToggle = document.getElementById("want-percategory-toggle");

  export function updatePercategoryAvailability() {
    const bothOn = state.wantNumber && state.wantCategory;
    wantPercategoryToggle.disabled = !bothOn;
    document.getElementById("want-percategory-row").classList.toggle("row-disabled", !bothOn);
    if (!bothOn) {
      wantPercategoryToggle.checked = false;
      state.wantPercategory = false;
    }
  }

  wantNumberToggle.addEventListener("change", (e) => {
    state.wantNumber = e.target.checked;
    updatePercategoryAvailability();
    updateStartButtonState();
  });

  wantCategoryToggle.addEventListener("change", (e) => {
    state.wantCategory = e.target.checked;
    updatePercategoryAvailability();
    updateStartButtonState();
  });

  wantPercategoryToggle.addEventListener("change", (e) => {
    state.wantPercategory = e.target.checked;
  });

  document.getElementById("start-session").addEventListener("click", startSession);

  /* Language */


  export function refreshLanguageDisplay() {
    if (currentDeal) { renderAnswerArea(); updateSessionContext(); }
  }

  export function refreshAnswerAreaIfActive() {
    if (currentDeal) renderAnswerArea();
  }

  export function refreshCardFacesIfActive() {
    if (currentDeal) {
      const sub = document.querySelector('[data-screen="free"] .subview.active');
      if (sub && sub.dataset.subview === "session") {
        const handRow = document.getElementById("hand-row");
        const isHandFaceUp = !!(handRow.firstElementChild && handRow.firstElementChild.classList.contains("card-face"));
        renderBoard();
        renderHand(isHandFaceUp);
      }
    }
  }

  // Точка входа для программного запуска (Обучариум) — см. DECISIONS.md.
  // settings: { wantNumber, wantCategory, wantPercategory, street }
  export function applySettings(settings) {
    if (settings.wantNumber !== undefined) state.wantNumber = settings.wantNumber;
    if (settings.wantCategory !== undefined) state.wantCategory = settings.wantCategory;
    if (settings.wantPercategory !== undefined) state.wantPercategory = settings.wantPercategory;
    if (settings.street !== undefined) state.street = settings.street;
  }

  registerTrainingEntry("outs", (settings) => {
    if (settings) applySettings(settings);
    startSession();
  });
