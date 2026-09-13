// ui/card-picker.js
// В отличие от card.js, здесь состояние (state.faceStyle/state.cardBack) читается
// напрямую из core/state.js, не параметрами — компонент достаточно завязан на
// глобальные настройки темы карт (грид на весь экран, много ячеек), параметризация
// каждой ячейки была бы избыточной. Решение сознательное, не забытый случай, как
// раньше было с cardEl.

import { dict } from "../core/i18n.js";
import { state, RANKS, SUITS } from "../core/state.js";
import { cardId } from "../core/hand-eval.js";
import { suitColor, displayRank } from "./card.js";

const suitSymbols = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };

let cardPickerTakenIds = null;
let cardPickerAllowClear = false;
let cardPickerCallback = null;

export function openCardPicker(takenIds, allowClear, onPick) {
  cardPickerTakenIds = takenIds;
  cardPickerAllowClear = allowClear;
  cardPickerCallback = onPick;
  renderCardPickerGrid();
  document.getElementById("card-grid-modal").classList.add("show");
}

export function renderCardPickerGrid() {
  const content = document.getElementById("card-grid-content");
  content.innerHTML = "";

  if (cardPickerAllowClear) {
    const clearCell = document.createElement("div");
    clearCell.className = "card-grid-clear-cell";
    clearCell.textContent = dict[state.lang]["calc.clearSlot"];
    clearCell.addEventListener("click", () => {
      document.getElementById("card-grid-modal").classList.remove("show");
      cardPickerCallback(null);
    });
    content.appendChild(clearCell);
  }

  const grid = document.createElement("div");
  grid.className = "card-grid";
  SUITS.forEach(suit => {
    RANKS.forEach(rank => {
      const cell = document.createElement("div");
      const id = rank + "-" + suit;
      const isTaken = cardPickerTakenIds.has(id);
      cell.className = "card-grid-cell" + (isTaken ? " taken" : "");
      cell.style.color = isTaken ? "" : suitColor(suit, state.faceStyle);
      cell.textContent = displayRank(rank) + suitSymbols[suit];
      if (!isTaken) {
        cell.addEventListener("click", () => {
          document.getElementById("card-grid-modal").classList.remove("show");
          cardPickerCallback({ rank, suit });
        });
      }
      grid.appendChild(cell);
    });
  });
  content.appendChild(grid);
}

document.getElementById("close-card-grid").addEventListener("click", () => {
  document.getElementById("card-grid-modal").classList.remove("show");
});

// Рендерит ряд из maxLen слотов с последовательным заполнением: заполненные — кликабельны
// (сменить карту), следующий пустой — кликабелен (задать), остальные — заблокированы (рубашка).
// Очистить (вернуть в рубашку) можно только САМЫЙ ПОСЛЕДНИЙ заполненный слот — иначе более
// поздние заполненные слоты повисли бы без своего предшественника.
// maxFillable — до какого индекса слот вообще может стать кликабельным (по умолчанию
// совпадает с maxLen). Слоты с индексом >= maxFillable всегда рендерятся как постоянно
// запертые (locked), даже если предыдущие уже заполнены — нужно, например, для 5-й карты
// борда в калькуляторе Аутов: она показывается, но никогда не открывается.
export function renderSeqCardRow(container, cardList, maxLen, getTakenIds, onChange, maxFillable) {
  if (maxFillable === undefined) maxFillable = maxLen;
  container.innerHTML = "";
  let filledCount = 0;
  while (filledCount < maxLen && cardList[filledCount]) filledCount++;

  for (let i = 0; i < maxLen; i++) {
    const card = cardList[i];
    const slot = document.createElement("div");
    if (card) {
      slot.className = "card-slot filled";
      slot.textContent = displayRank(card.rank) + suitSymbols[card.suit];
      slot.style.color = suitColor(card.suit, state.faceStyle);
      const isLast = i === filledCount - 1;
      slot.addEventListener("click", () => {
        const taken = getTakenIds();
        taken.delete(cardId(card));
        openCardPicker(taken, isLast, newCard => {
          cardList[i] = newCard;
          onChange();
        });
      });
    } else if (i === filledCount && i < maxFillable) {
      slot.className = "card-slot next-fillable back-" + state.cardBack;
      slot.textContent = "+";
      slot.addEventListener("click", () => {
        openCardPicker(getTakenIds(), false, newCard => {
          cardList[i] = newCard;
          onChange();
        });
      });
    } else {
      slot.className = "card-slot locked back-" + state.cardBack;
    }
    container.appendChild(slot);
  }
}
