// core/deck.js
// Колода, перемешивание, случайные утилиты общего назначения.
//
// НАЙДЕНО ПРИ РАЗБОРЕ И ОБЪЕДИНЕНО ЗДЕСЬ (см. ARCHITECTURE.md, DECISIONS —
// «Найденное дублирование»): полное перемешивание было продублировано трижды
// независимо (тренировка «Ауты», тренировка «Позиции» как posShuffle, воркер
// эквити инлайн-версией). Здесь — одна версия, `shuffle`.
//
// `partialShuffle` — НЕ то же самое, что `shuffle`: это отдельная, осознанная
// оптимизация из воркера эквити (тасует только N нужных карт колоды, а не все
// 52 — важно при тысячах итераций Монте-Карло за один расчёт). Не сводить в одну
// функцию с `shuffle` — они решают разные задачи.

import { RANKS, SUITS } from "./state.js";

export function buildDeck() {
  const deck = [];
  RANKS.forEach(r => SUITS.forEach(s => deck.push({ rank: r, suit: s })));
  return deck;
}

// Полное перемешивание массива (Фишера-Йетса). Мутирует и возвращает тот же массив —
// сохранено поведение оригинала (тренировка «Ауты» полагалась на мутацию на месте).
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Частичное перемешивание: тасует только первые `count` позиций массива —
// этого достаточно, чтобы получить `count` случайных элементов без замены,
// не трогая (и не тратя время на) весь остальной массив. Мутирует и возвращает
// тот же массив, как и `shuffle`. Источник — инлайн-код воркера эквити.
export function partialShuffle(arr, count) {
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

// Случайное целое число в диапазоне [min, max], оба конца включительно.
// Источник — posRandomInt из тренировки «Позиции», общая по смыслу утилита,
// не специфична для позиций.
export function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Случайный элемент массива. Источник — notPickRandom из тренировки «Нотация».
export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
