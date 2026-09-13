// js/practice/trainings/calc-outs.js
// Калькулятор аутов — ручной ввод произвольной руки/борда.
// ПРИМЕЧАНИЕ: в монолите этот калькулятор физически делил переменные
// currentDeal/currentClassification с тренировкой «Ауты» (общая область
// видимости). В ES-модулях так нельзя (импортированную переменную нельзя
// переприсваивать) — здесь у калькулятора свои: calcCurrentDeal/
// calcCurrentClassification. Поведение калькулятора не меняется.

import { state } from "../../core/state.js";
import { dict } from "../../core/i18n.js";
import { cardId, classifyCategories, evaluateBest, displayCategoryIndex, CATEGORY_NAMES } from "../../core/hand-eval.js";
import { openCardPicker, renderSeqCardRow } from "../../ui/card-picker.js";
import { updatePercategoryAvailability, renderBreakdown } from "./outs.js";
import { showSubview, onSubviewShow } from "../practice-router.js";

  let calcCurrentDeal = null;
  let calcCurrentClassification = null;

  /* ===== Калькулятор: Ауты (борд сверху, последовательные слоты, без кнопок улиц) ===== */

  const calcState = { board: [null, null, null, null, null], hand: [null, null] };

  function calcBoardFilledCount() {
    let n = 0;
    while (n < 5 && calcState.board[n]) n++;
    return n;
  }

  function calcAllTakenIds() {
    const ids = new Set();
    calcState.hand.forEach(c => { if (c) ids.add(cardId(c)); });
    calcState.board.forEach(c => { if (c) ids.add(cardId(c)); });
    return ids;
  }

  function renderCalcSlots() {
    // maxFillable=4: 5-я карта борда (ривер) для подсчёта аутов бессмысленна — рука уже
    // определена. Слот показывается (видно, что дальше борд не идёт), но заперт навсегда.
    renderSeqCardRow(document.getElementById("calc-board-slots"), calcState.board, 5, calcAllTakenIds, () => {
      renderCalcSlots();
    }, 4);

    const handWrap = document.getElementById("calc-hand-slots");
    handWrap.innerHTML = "";
    calcState.hand.forEach((card, idx) => {
      const slot = document.createElement("div");
      slot.className = "card-slot" + (card ? " filled" : " next-fillable back-" + state.cardBack);
      if (card) {
        slot.textContent = displayRank(card.rank) + suitSymbols[card.suit];
        slot.style.color = suitColor(card.suit, state.faceStyle);
      } else {
        slot.textContent = "+";
      }
      slot.addEventListener("click", () => {
        const taken = calcAllTakenIds();
        if (card) taken.delete(cardId(card));
        openCardPicker(taken, false, newCard => {
          calcState.hand[idx] = newCard;
          renderCalcSlots();
        });
      });
      handWrap.appendChild(slot);
    });

    updateCalcRunButton();
  }

  function updateCalcRunButton() {
    const filledHand = calcState.hand.every(c => c);
    const boardCount = calcBoardFilledCount();
    const validBoard = boardCount === 3 || boardCount === 4;
    document.getElementById("calc-outs-run").disabled = !(filledHand && validBoard);
  }

  document.getElementById("calc-outs-run").addEventListener("click", () => {
    const hand = calcState.hand;
    const boardCount = calcBoardFilledCount();
    const board = calcState.board.slice(0, boardCount);
    calcCurrentDeal = { hand, board };
    calcCurrentClassification = classifyCategories(hand, board);

    const boardRow = document.getElementById("calc-result-board-row");
    const handRow = document.getElementById("calc-result-hand-row");
    boardRow.innerHTML = "";
    handRow.innerHTML = "";
    board.forEach(c => boardRow.appendChild(cardEl(c, true)));
    // Довешиваем декоративные заперты слоты до 5, чтобы ширина ряда борда совпадала с
    // экраном настройки (там всегда видно 5 слотов) — иначе карты визуально "сжимаются".
    for (let i = board.length; i < 5; i++) {
      const lockedSlot = document.createElement("div");
      lockedSlot.className = "card-slot locked back-" + state.cardBack;
      boardRow.appendChild(lockedSlot);
    }
    hand.forEach(c => { const el = cardEl(c, true); el.classList.add("card-hand"); handRow.appendChild(el); });

    renderCalcOutsResultText();
    showSubview("calc-outs-result");
  });

  // Отдельная функция (а не только внутри обработчика клика) — чтобы применить language
  // switch, если пользователь переключил язык уже находясь на экране результата: без
  // этого текст оставался на старом языке до следующего пересчёта.
  function renderCalcOutsResultText() {
    if (!calcCurrentDeal || !calcCurrentClassification) return;
    const t = dict[state.lang];
    const boardCount = calcCurrentDeal.board.length;
    const denom = boardCount === 3 ? 47 : 46;
    const realCount = calcCurrentClassification.totalCount;
    const realProb = Math.round((realCount / denom) * 1000) / 10;
    const currentBest = evaluateBest(calcCurrentDeal.hand.concat(calcCurrentDeal.board)).best;

    const resultContent = document.getElementById("calc-result-content");
    resultContent.innerHTML = "";
    const summary = document.createElement("div");
    summary.className = "breakdown-group-title";
    summary.style.margin = "14px 0";
    summary.innerHTML = t["session.currentBestHand"] + " " + CATEGORY_NAMES[state.lang][displayCategoryIndex(currentBest)] +
      "<br>" + t["session.outsQuestion"] + " " + realCount + " (" + realProb + "%)";
    resultContent.appendChild(summary);

    const breakdownBtn = document.createElement("button");
    breakdownBtn.className = "secondary-btn";
    breakdownBtn.textContent = t["session.showBreakdown"];
    breakdownBtn.addEventListener("click", () => {
      renderBreakdown();
      document.getElementById("breakdown-modal").classList.add("show");
    });
    resultContent.appendChild(breakdownBtn);
  }

  document.getElementById("calc-back-to-setup").addEventListener("click", () => {
    showSubview("calc-outs-setup");
  });

  renderCalcSlots();
  updatePercategoryAvailability();


  onSubviewShow("calc-outs-result", renderCalcOutsResultText);
