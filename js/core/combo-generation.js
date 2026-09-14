// core/combo-generation.js
// Генератор раздачи «под целевую категорию руки» + вероятностные таблицы —
// чистая логика без DOM. Изначально жили в outs.js исторически (там же лежали
// TRAINING_WEIGHTS/REAL_PROBS), но «Ауты» это всё не использует вообще —
// единственный настоящий потребитель был/остаётся «Комбинации». См. обсуждение
// в чате: вынесено сюда, а не оставлено в файле чужой тренировки, чтобы не
// повторить ту же путаницу, когда доступ понадобится ещё и «Теории».

import { RANKS, SUITS } from "./state.js";
import { buildDeck, shuffle } from "./deck.js";
import { evaluateBest, displayCategoryIndex } from "./hand-eval.js";

export const TRAINING_WEIGHTS = [15.23, 19.18, 16.41, 11.05, 10.93, 9.84, 9.47, 4.79, 2.20, 0.90];
export const REAL_PROBS = [17.41, 43.82, 23.50, 4.83, 4.62, 3.03, 2.60, 0.17, 0.028, 0.0032321];
// Точные (не Монте-Карло) вероятности для 5 и 6 карт — см. чат: 5 карт полным
// перебором C(52,5)=2 598 960, 6 карт полным перебором C(52,6)=20 358 520,
// оба результата сверены с независимыми источниками. REAL_PROBS выше — те же
// точные данные для 7 карт (сверено с durangobill.com). Порядок категорий тот
// же, что и везде: CATEGORY_NAMES/displayCategoryIndex (0=старшая карта..9=рояль).
export const REAL_PROBS_5 = [50.12, 42.26, 4.75, 2.11, 0.39, 0.20, 0.14, 0.024, 0.0014, 0.0001539];
export const REAL_PROBS_6 = [32.48, 47.80, 12.44, 3.60, 1.78, 1.011, 0.82, 0.072, 0.0081, 0.0009234];

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
