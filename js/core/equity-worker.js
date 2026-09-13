// core/equity-worker.js
// Модульный Web Worker (создаётся с { type: "module" }). Раньше код этого файла
// был встроен строкой EQ_WORKER_SOURCE и дублировал evaluate5/evaluateBest/
// displayCategoryIndex/comboIndices/combinations/cardId из hand-eval.js целиком —
// здесь дублирования нет, всё импортируется.
//
// Путь ниже — относительный от самого этого файла (import.meta.url внутри воркера
// указывает на URL воркера, не на URL того, кто его создал) — работает независимо
// от того, куда задеплоено приложение (корень домена или подпапка).
import { RANK_VALUE } from "./state.js";
import { evaluate5, evaluateBest, compareResult, displayCategoryIndex, cardId } from "./hand-eval.js";
import { partialShuffle } from "./deck.js";

const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
const SUITS = ["hearts","diamonds","clubs","spades"];

self.onmessage = function (e) {
  const { board, playersHands, iterations } = e.data;
  const known = new Set();
  board.forEach(c => { if (c) known.add(cardId(c)); });
  playersHands.forEach(h => h.forEach(c => { if (c) known.add(cardId(c)); }));

  const deckWork = [];
  RANKS.forEach(r => SUITS.forEach(s => {
    const id = r + "-" + s;
    if (!known.has(id)) deckWork.push({ rank: r, suit: s });
  }));

  const boardMissing = [];
  for (let i = 0; i < 5; i++) if (!board[i]) boardMissing.push(i);
  const handMissing = playersHands.map(h => [0, 1].filter(i => !h[i]));
  const totalMissing = boardMissing.length + handMissing.reduce((s, a) => s + a.length, 0);

  const n = playersHands.length;
  const wins = new Array(n).fill(0);
  const tieInvolved = new Array(n).fill(0);
  const equityShare = new Array(n).fill(0);
  const catCounts = playersHands.map(() => new Array(10).fill(0));
  const totalIterations = totalMissing === 0 ? 1 : iterations;

  const boardWork = board.slice();
  const handsWork = playersHands.map(h => h.slice());

  // Прогресс шлём не на каждой итерации (это было бы избыточно — тысячи сообщений в
  // секунду), а пачками примерно по 2% — этого достаточно для плавной заливки кнопки
  // и не создаёт заметной нагрузки на обмен сообщениями между потоками.
  const progressStep = Math.max(200, Math.floor(totalIterations / 50));

  for (let it = 0; it < totalIterations; it++) {
    if (totalMissing > 0) {
      partialShuffle(deckWork, totalMissing);
      let p = 0;
      for (let bi = 0; bi < boardMissing.length; bi++) boardWork[boardMissing[bi]] = deckWork[p++];
      for (let pi = 0; pi < n; pi++) {
        const missing = handMissing[pi];
        for (let mi = 0; mi < missing.length; mi++) handsWork[pi][missing[mi]] = deckWork[p++];
      }
    }

    let bestResult = null;
    const results = new Array(n);
    for (let pi = 0; pi < n; pi++) {
      const r = evaluateBest(handsWork[pi].concat(boardWork)).best;
      results[pi] = r;
      catCounts[pi][displayCategoryIndex(r)] += 1;
      if (!bestResult || compareResult(r, bestResult) > 0) bestResult = r;
    }
    const winners = [];
    for (let pi = 0; pi < n; pi++) if (compareResult(results[pi], bestResult) === 0) winners.push(pi);
    if (winners.length === 1) {
      wins[winners[0]] += 1;
    } else {
      winners.forEach(i => { tieInvolved[i] += 1; equityShare[i] += 1 / winners.length; });
    }

    if (it % progressStep === 0) {
      self.postMessage({ type: "progress", pct: Math.round((it / totalIterations) * 100) });
    }
  }

  const resultsOut = playersHands.map((_, i) => ({
    win: (wins[i] / totalIterations) * 100,
    tie: (tieInvolved[i] / totalIterations) * 100,
    equity: ((wins[i] + equityShare[i]) / totalIterations) * 100,
    categories: catCounts[i].map(c => (c / totalIterations) * 100)
  }));
  self.postMessage({ type: "done", results: resultsOut });
};
