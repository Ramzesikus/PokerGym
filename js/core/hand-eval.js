// core/hand-eval.js
// СВЕРЕНО С POKERSOLVER — НЕ МЕНЯТЬ БЕЗ ВЕСКОЙ ПРИЧИНЫ.
// Чистые функции, без DOM — подтверждено при разборе монолита.
//
// evaluate7 переименована в evaluateBest: функция в реальности универсальна —
// работает с 5, 6, 7 и более картами через combinations(cards, 5), не жёстко
// на 7 (проверено по коду: `cards.length <= 5 ? [cards] : combinations(cards, 5)`).
// Отдельная evaluate6 не нужна.

import { RANK_VALUE } from "./state.js";
import { buildDeck } from "./deck.js";

export function cardId(c) { return c.rank + "-" + c.suit; }

// Индексные шаблоны C(n,k) не зависят от содержимого — вычисляются один раз на пару (n,k)
// и переиспользуются. В этом приложении n всегда 5, 6 или 7 (k=5 карт из руки+борда),
// так что реально считается только 2 раза за всё время работы, а не на каждый вызов.
// Результат combinations() побитово идентичен старой рекурсивной версии — просто быстрее строится.
const COMBO_INDEX_CACHE = {};
function comboIndices(n, k) {
  const key = n + "_" + k;
  if (COMBO_INDEX_CACHE[key]) return COMBO_INDEX_CACHE[key];
  const results = [];
  function go(start, combo) {
    if (combo.length === k) { results.push(combo.slice()); return; }
    for (let i = start; i < n; i++) { combo.push(i); go(i + 1, combo); combo.pop(); }
  }
  go(0, []);
  COMBO_INDEX_CACHE[key] = results;
  return results;
}

export function combinations(arr, k) {
  const idxSets = comboIndices(arr.length, k);
  const out = new Array(idxSets.length);
  for (let s = 0; s < idxSets.length; s++) {
    const idx = idxSets[s];
    const combo = new Array(k);
    for (let j = 0; j < k; j++) combo[j] = arr[idx[j]];
    out[s] = combo;
  }
  return out;
}

export function evaluate5(cards) {
  const values = cards.map(c => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const isFlush = cards.every(c => c.suit === cards[0].suit);

  const counts = {};
  values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  const groups = Object.keys(counts).map(v => ({ value: parseInt(v, 10), count: counts[v] }))
    .sort((a, b) => (b.count - a.count) || (b.value - a.value));

  const uniqueDesc = Array.from(new Set(values)).sort((a, b) => b - a);
  let straightHigh = null;
  if (uniqueDesc.length === 5) {
    if (uniqueDesc[0] - uniqueDesc[4] === 4) straightHigh = uniqueDesc[0];
    else if (JSON.stringify(uniqueDesc) === JSON.stringify([14, 5, 4, 3, 2])) straightHigh = 5;
  }
  const isStraight = straightHigh !== null;

  if (isStraight && isFlush) return { category: 8, tiebreak: [straightHigh] };
  if (groups[0].count === 4) return { category: 7, tiebreak: [groups[0].value, groups[1].value] };
  if (groups[0].count === 3 && groups[1] && groups[1].count === 2) return { category: 6, tiebreak: [groups[0].value, groups[1].value] };
  if (isFlush) return { category: 5, tiebreak: values };
  if (isStraight) return { category: 4, tiebreak: [straightHigh] };
  if (groups[0].count === 3) return { category: 3, tiebreak: [groups[0].value, ...values.filter(v => v !== groups[0].value)] };
  if (groups[0].count === 2 && groups[1] && groups[1].count === 2) {
    const pairVals = [groups[0].value, groups[1].value].sort((a, b) => b - a);
    const kicker = values.find(v => v !== pairVals[0] && v !== pairVals[1]);
    return { category: 2, tiebreak: [pairVals[0], pairVals[1], kicker] };
  }
  if (groups[0].count === 2) return { category: 1, tiebreak: [groups[0].value, ...values.filter(v => v !== groups[0].value)] };
  return { category: 0, tiebreak: values };
}

export function compareResult(a, b) {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < a.tiebreak.length; i++) {
    const diff = (a.tiebreak[i] || 0) - (b.tiebreak[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Было evaluate7 — переименовано, см. примечание в шапке файла.
export function evaluateBest(cards) {
  const subsets = cards.length <= 5 ? [cards] : combinations(cards, 5);
  let best = null;
  let bestCards = null;
  subsets.forEach(subset => {
    const result = evaluate5(subset);
    if (!best || compareResult(result, best) > 0) {
      best = result;
      bestCards = subset;
    }
  });
  return { best, usedCards: bestCards };
}

// Определяет "ядро" комбинации внутри лучших 5 карт — карты, чей повторяющийся ранг
// формирует силу руки (пара/сет/каре/обе пары). Для стрита/флеша/фулл-хауса/старшей
// карты/стрит-флеша ядро = все 5 карт (делить нечего).
export function getCoreCards(fiveCards) {
  const groupsByRank = {};
  fiveCards.forEach(c => {
    const v = RANK_VALUE[c.rank];
    if (!groupsByRank[v]) groupsByRank[v] = [];
    groupsByRank[v].push(c);
  });
  const groups = Object.values(groupsByRank);
  const repeatedGroups = groups.filter(g => g.length >= 2);
  if (repeatedGroups.length === 0) return fiveCards.slice();
  return repeatedGroups.flat();
}

export const CATEGORY_NAMES = {
  ru: ["Старшая карта", "Пара", "Две пары", "Сет", "Стрит", "Флеш", "Фулл-хаус", "Каре", "Стрит-флеш", "Флеш-рояль"],
  en: ["High card", "Pair", "Two pair", "Three of a Kind", "Straight", "Flush", "Full house", "Quads", "Straight flush", "Royal flush"]
};

// Роял-флеш — это стрит-флеш с tiebreak=14 (A-K-Q-J-T), внутри evaluate5/evaluateBest отдельной
// категорией не выделен (и не должен — это не меняет саму механику сравнения рук).
// Здесь — только производная категория для отображения/тренировки: 8=обычный стрит-флеш,
// 9=роял. Сам evaluate5/evaluateBest не трогаем.
export function displayCategoryIndex(best) {
  return (best.category === 8 && best.tiebreak[0] === 14) ? 9 : best.category;
}

export function bestCategoryOnly(cards) {
  if (cards.length < 5) {
    const values = cards.map(c => RANK_VALUE[c.rank]);
    const counts = {};
    values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    const countsArr = Object.values(counts).sort((a, b) => b - a);
    if (countsArr[0] === 4) return 7;
    if (countsArr[0] === 3) return 3;
    if (countsArr[0] === 2 && countsArr[1] === 2) return 2;
    if (countsArr[0] === 2) return 1;
    return 0;
  }
  const subsets = combinations(cards, 5);
  let bestCat = 0;
  subsets.forEach(subset => {
    const r = evaluate5(subset);
    if (r.category > bestCat) bestCat = r.category;
  });
  return bestCat;
}

export function computeOuts(hand, board) {
  const known = hand.concat(board);
  const knownIds = new Set(known.map(cardId));
  const deck = buildDeck().filter(c => !knownIds.has(cardId(c)));

  const oldHandCat = evaluateBest(known).best.category;
  const oldBoardCat = bestCategoryOnly(board);

  const outs = [];
  deck.forEach(card => {
    const newHandResult = evaluateBest(known.concat([card]));
    const newHandCat = newHandResult.best.category;
    const newBoardCat = bestCategoryOnly(board.concat([card]));
    const handDelta = newHandCat - oldHandCat;
    const boardDelta = newBoardCat - oldBoardCat;
    if (handDelta > 0 && handDelta > boardDelta) {
      outs.push({ card, category: newHandCat });
    }
  });

  return outs;
}

export function classifyCategories(hand, board) {
  const known = hand.concat(board);
  const oldHandResult = evaluateBest(known);
  const oldHandCat = oldHandResult.best.category;
  const legit = computeOuts(hand, board);

  const buckets = { gutshot: [], openEnded: [], flushDraw: [], overcardPair: [], pairToSet: [], pairToTwoPair: [], twoPair: [], setToFullHouse: [], setToQuads: [] };

  const straightOuts = legit.filter(o => o.category === 4 || o.category === 8);
  if (straightOuts.length > 0) {
    // Двусторонний дро — когда закрывающие карты идут двумя РАЗНЫМИ рангами (например,
    // 7 или T к 8-9). Раньше это определялось эвристикой «есть ли где-то 4 ранга подряд
    // среди известных карт» — но она ошибается на краю диапазона: J-Q-K-A формально
    // «4 подряд», однако сверху туза карты нет, закрывает только десятка снизу — это
    // гатшот с 4 аутами, а не двусторонний дро. Правильный признак — количество разных
    // рангов среди уже честно посчитанных аутов (учитывает правило "преимущество над
    // столом" автоматически, раз straightOuts уже отфильтрован через legit).
    const distinctOutRanks = new Set(straightOuts.map(o => o.card.rank));
    const key = distinctOutRanks.size >= 2 ? "openEnded" : "gutshot";
    buckets[key] = straightOuts.map(o => o.card);
  }

  const flushOuts = legit.filter(o => o.category === 5 || o.category === 8);
  if (flushOuts.length > 0) buckets.flushDraw = flushOuts.map(o => o.card);

  const boardVals = board.map(c => RANK_VALUE[c.rank]);
  const maxBoardVal = boardVals.length ? Math.max(...boardVals) : 0;

  // Оверкард -> пара: только когда пары нет вообще ни у кого (стартовая категория 0)
  if (oldHandCat === 0) {
    hand.forEach(hc => {
      const hv = RANK_VALUE[hc.rank];
      if (hv > maxBoardVal) {
        const outs = legit.filter(o => RANK_VALUE[o.card.rank] === hv);
        if (outs.length > 0) buckets.overcardPair = buckets.overcardPair.concat(outs.map(o => o.card));
      }
    });
  }

  // Пара -> сет: любая пара (не только карманная), где хотя бы одна своя карта участвует в паре
  // Пара -> две пары: та же стартовая категория, любая другая своя карта даёт вторую пару
  if (oldHandCat === 1) {
    const pairRankValue = oldHandResult.best.tiebreak[0];
    const holeParticipates = hand.some(hc => RANK_VALUE[hc.rank] === pairRankValue);
    if (holeParticipates) {
      const outs = legit.filter(o => RANK_VALUE[o.card.rank] === pairRankValue && o.category === 3);
      if (outs.length > 0) buckets.pairToSet = outs.map(o => o.card);
    }

    hand.forEach(hc => {
      const hv = RANK_VALUE[hc.rank];
      if (hv === pairRankValue) return;
      const outs = legit.filter(o => RANK_VALUE[o.card.rank] === hv && o.category === 2);
      if (outs.length > 0) buckets.pairToTwoPair = buckets.pairToTwoPair.concat(outs.map(o => o.card));
    });
  }

  if (oldHandCat === 2) {
    const outs = legit.filter(o => o.category === 6 || o.category === 7);
    if (outs.length > 0) buckets.twoPair = outs.map(o => o.card);
  }

  // Сет -> фулл-хаус (паринг кикера) и Сет -> каре (добор четвёртой) — раздельно
  if (oldHandCat === 3) {
    const usesHole = oldHandResult.usedCards.some(c => hand.some(h => cardId(h) === cardId(c)));
    if (usesHole) {
      const quadOuts = legit.filter(o => o.category === 7);
      if (quadOuts.length > 0) buckets.setToQuads = quadOuts.map(o => o.card);
      const fullHouseOuts = legit.filter(o => o.category === 6);
      if (fullHouseOuts.length > 0) buckets.setToFullHouse = fullHouseOuts.map(o => o.card);
    }
  }

  const idOwners = {};
  Object.keys(buckets).forEach(key => {
    buckets[key].forEach(card => {
      const id = cardId(card);
      if (!idOwners[id]) idOwners[id] = { card, keys: [] };
      idOwners[id].keys.push(key);
    });
  });

  const totalCount = Object.keys(idOwners).length;
  const presentKeys = Object.keys(buckets).filter(k => buckets[k].length > 0);
  const intersections = Object.values(idOwners).filter(o => o.keys.length > 1);

  return { buckets, totalCount, presentKeys, intersections };
}
