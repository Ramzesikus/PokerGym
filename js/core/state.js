// core/state.js
// Чистое хранилище данных. НЕ импортирует ничего из ui/practice/theory/settings —
// иначе риск циклических зависимостей (см. ARCHITECTURE.md, DECISIONS).
// Другие модули читают и меняют поля этого объекта напрямую и сами реагируют на
// изменения — этот файл не содержит логики реакции на собственные изменения.

export const tableBgs = {
  dark:  { bg: "#14171a", fg: "#e8e8e8", nav: "#191c1f", well: "#1f2327", divider: "#2a2e33", chipActive: "#2f353b", chipText: "#c7cad0", muted: "#6b7076", cardFace: "#ffffff", cardSurface: "#191c1f" },
  light: { bg: "#f4f4f2", fg: "#1c1e20", nav: "#ffffff", well: "#e9e9e6", divider: "#dcdcd8", chipActive: "#ffffff", chipText: "#3a3d40", muted: "#7a7d80", cardFace: "#ffffff", cardSurface: "#ffffff" },
  felt:  { bg: "#0f3d2e", fg: "#eaf3ee", nav: "#0c3227", well: "#134a38", divider: "#1c5643", chipActive: "#1c5643", chipText: "#d8ece4", muted: "#7fae9c", cardFace: "#ffffff", cardSurface: "#0c3227" },
  navy:  { bg: "#101828", fg: "#e6ebf2", nav: "#0c1420", well: "#182236", divider: "#233150", chipActive: "#233150", chipText: "#c3cee0", muted: "#6d7994", cardFace: "#ffffff", cardSurface: "#0c1420" }
};

// ПРИМЕЧАНИЕ (найдено при разборе, не исправлено здесь — см. ARCHITECTURE.md):
// correctCount/answeredCount ниже по факту используются только тренировкой «Ауты»
// (state.correctCount += 1 и т.п.) — это не общеприкладное состояние, а транзитный
// счётчик одной конкретной тренировки, случайно оказавшийся в глобальном объекте.
// При переносе PR-TR-OUTS на core/session.js эти два поля должны уйти отсюда
// и замениться на session.js — оставлено как есть сейчас, чтобы не трогать чужой
// шаг раньше времени.
export const state = {
  lang: "ru",
  outputMode: "outs",
  hideCards: false,
  showTime: "3",
  cardBack: "red-classic",
  faceStyle: "2color",
  tableBg: "light",
  street: "flop",
  wantNumber: true,
  wantCategory: false,
  wantPercategory: false,
  dealNum: 1,
  correctCount: 0,
  answeredCount: 0
};

export const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
export const SUITS = ["hearts","diamonds","clubs","spades"];
export const DRAW_TYPES = ["gutshot", "openEnded", "flushDraw"];
export const OTHER_OUT_TYPES = ["overcardPair", "pairToSet", "pairToTwoPair", "twoPair", "setToFullHouse", "setToQuads"];
export const dryTypes = DRAW_TYPES.concat(OTHER_OUT_TYPES);
export const RANK_VALUE = { "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"T":10,"J":11,"Q":12,"K":13,"A":14 };

// currentDeal / timerHandle в оригинале были module-scope let-переменными общего
// назначения (использовались тренировкой «Ауты» для хранения текущей раздачи и
// хэндла таймера). Не переносятся сюда как есть — это тоже транзитное состояние
// одной тренировки, не общее хранилище. Останутся локальными переменными внутри
// outs-logic.js, когда до него дойдёт очередь.
