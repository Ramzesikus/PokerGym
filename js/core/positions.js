// core/positions.js
// Чистая логика позиций за столом — без DOM. Не специфична для тренировки
// «Позиции»: пригодится Обучариуму для сценариев вида «ты на BTN».
//
// НАЙДЕНО ПРИ РАЗБОРЕ (не отражено в исходной таблице ARCHITECTURE.md — уточнить
// при следующей актуализации): posLabel зависит от POS_SHORT_LABEL/POS_FULL_KEY,
// которые физически объявлены прямо перед ним в диапазоне «Позиций» (строки
// ~5637–5672) — они переехали сюда же вместе с posLabel, а не остались в
// positions-logic.js, иначе core/positions.js был бы неполным сам по себе.
// POS_LADDER_OLD/POS_LADDER_NEW (используются только dealNewPositionsRound —
// генерацией раунда, не отображением) в core НЕ переносятся, остаются в
// positions-logic.js.

import { dict } from "./i18n.js";
import { state } from "./state.js";

const POS_SHORT_LABEL = {
  BTNSB: "BTN/SB", BTN: "BTN", SB: "SB", BB: "BB",
  UTG: "UTG", UTG1: "UTG+1", UTG2: "UTG+2",
  MP: "MP", LJ: "LJ", HJ: "HJ", CO: "CO"
};

// Полные названия берём из уже существующего глоссария (term.*.ru), чтобы не дублировать текст.
const POS_FULL_KEY = {
  BTN: "term.btn.ru", SB: "term.sb.ru", BB: "term.bb.ru",
  UTG: "term.utg.ru", UTG1: "term.utg1.ru", UTG2: "term.utg2.ru",
  MP: "term.mp.ru", LJ: "term.lj.ru", HJ: "term.hj.ru", CO: "term.co.ru"
};

export function posLabel(code, format) {
  if (format === "full") {
    if (code === "BTNSB") {
      const t = dict[state.lang];
      return t["term.btn.ru"] + "/" + t["term.sb.ru"];
    }
    return dict[state.lang][POS_FULL_KEY[code]];
  }
  return POS_SHORT_LABEL[code];
}

export function posTailSeats(fromIndex, btnIndex, n) {
  const result = [];
  let i = (fromIndex + 1) % n;
  while (i !== btnIndex) {
    result.push(i);
    i = (i + 1) % n;
  }
  return result;
}
