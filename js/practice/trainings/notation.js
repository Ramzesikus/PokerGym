// js/practice/trainings/notation.js
// Логика и UI тренировки «Нотация» — три режима (одиночная заявка,
// множественный выбор, генерация заданий-«токенов»).

import { state, RANKS, SUITS, RANK_VALUE } from "../../core/state.js";
import { dict } from "../../core/i18n.js";
import { pickRandom, shuffle } from "../../core/deck.js";
import { showSubview, registerTrainingEntry } from "../practice-router.js";
import { cardEl } from "../../ui/card.js";


  /* ===== Модуль: Нотация ===== */

  const NOT_RANKS_FACES = ["J","Q","K","A"];
  const NOT_GRID_RANKS = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];

  const notState = {
    mode: "single",
    rankPool: "all",
    pairs: "on",
    tokenType: "pair",
    single: null,
    multi: null
  };

  function notOtherSuit(suit) {
    const rest = SUITS.filter(s => s !== suit);
    return pickRandom(rest);
  }

  function notGetRankPool(rankPool) {
    return rankPool === "faces" ? NOT_RANKS_FACES : RANKS;
  }

  function notLabel(rankA, rankB, isPair, claimSuited) {
    if (isPair) return rankA + rankB;
    return rankA + rankB + (claimSuited ? "s" : "o");
  }

  /* --- Режим «Одна карта» --- */

  function dealNotationSingleRound() {
    const pool = notGetRankPool(notState.rankPool);
    const pairsOn = notState.pairs === "on";
    const isPair = pairsOn && Math.random() < 0.2;

    let rankA, rankB, claimSuited = null, correctFits = true, actualSuited = null;

    if (isPair) {
      rankA = rankB = pickRandom(pool);
    } else {
      do {
        rankA = pickRandom(pool);
        rankB = pickRandom(pool);
      } while (rankA === rankB);
      if (RANK_VALUE[rankA] < RANK_VALUE[rankB]) { const tmp = rankA; rankA = rankB; rankB = tmp; }
      claimSuited = Math.random() < 0.5;
      correctFits = Math.random() < 0.5;
      actualSuited = correctFits ? claimSuited : !claimSuited;
    }

    // Для пары (actualSuited === null, что "ложно") и для явного несовпадения suited-заявки
    // масти всегда РАЗНЫЕ — специально не исключая одноцветные пары (♠+♣, ♥+♦), иначе
    // тренажёр незаметно научит проверять цвет вместо масти.
    const suitA = pickRandom(SUITS);
    const suitB = (isPair || !actualSuited) ? notOtherSuit(suitA) : suitA;

    // Порядок карт на экране — случайный (не всегда старшая слева), чтобы распознавание
    // подходит/не подходит проверялось честно, а не по позиции карты в ряду.
    const swapDisplay = Math.random() < 0.5;

    notState.single = {
      rankA, rankB, isPair, claimSuited,
      correctFits: isPair ? true : correctFits,
      cardA: { rank: rankA, suit: suitA },
      cardB: { rank: rankB, suit: suitB },
      swapDisplay,
      answered: false
    };

    renderNotationSingle();
  }

  function renderNotationSingle() {
    const s = notState.single;
    document.getElementById("not-single-notation").textContent = notLabel(s.rankA, s.rankB, s.isPair, s.claimSuited);

    const cardsWrap = document.getElementById("not-single-cards");
    cardsWrap.innerHTML = "";
    const displayOrder = s.swapDisplay ? [s.cardB, s.cardA] : [s.cardA, s.cardB];
    cardsWrap.appendChild(cardEl(displayOrder[0], true, state.faceStyle, state.cardBack));
    cardsWrap.appendChild(cardEl(displayOrder[1], true, state.faceStyle, state.cardBack));

    document.getElementById("not-single-explain").textContent = "";
    document.getElementById("not-single-next").style.display = "none";

    ["not-answer-fit", "not-answer-nofit"].forEach(id => {
      const b = document.getElementById(id);
      b.disabled = false;
      b.classList.remove("answer-correct", "answer-incorrect");
    });
  }

  function handleNotationSingleAnswer(userSaysFits) {
    const s = notState.single;
    if (!s || s.answered) return;
    s.answered = true;

    const fitBtn = document.getElementById("not-answer-fit");
    const noFitBtn = document.getElementById("not-answer-nofit");
    fitBtn.disabled = true;
    noFitBtn.disabled = true;

    const correct = userSaysFits === s.correctFits;
    const chosenBtn = userSaysFits ? fitBtn : noFitBtn;
    chosenBtn.classList.add(correct ? "answer-correct" : "answer-incorrect");
    if (!correct) {
      const rightBtn = s.correctFits ? fitBtn : noFitBtn;
      rightBtn.classList.add("answer-correct");
    }

    const t = dict[state.lang];
    let explainKey;
    if (s.isPair) explainKey = "notSession.explainPair";
    else if (s.claimSuited) explainKey = s.correctFits ? "notSession.explainSuitedYes" : "notSession.explainSuitedNo";
    else explainKey = s.correctFits ? "notSession.explainOffsuitYes" : "notSession.explainOffsuitNo";
    document.getElementById("not-single-explain").textContent = t[explainKey];

    document.getElementById("not-single-next").style.display = "block";
  }

  document.getElementById("not-answer-fit").addEventListener("click", () => handleNotationSingleAnswer(true));
  document.getElementById("not-answer-nofit").addEventListener("click", () => handleNotationSingleAnswer(false));
  document.getElementById("not-single-next").addEventListener("click", dealNotationSingleRound);

  /* --- Режим «Несколько карт» --- */

  function notAllHandCodes() {
    const codes = [];
    for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) codes.push(notCellInfo(r, c).hand);
    return codes;
  }

  function notHandCodeToCards(code) {
    if (code.length === 2 && code[0] === code[1]) {
      const suitA = pickRandom(SUITS);
      const suitB = notOtherSuit(suitA);
      return [{ rank: code[0], suit: suitA }, { rank: code[1], suit: suitB }];
    }
    const rankA = code[0], rankB = code[1], suffix = code[2];
    const suitA = pickRandom(SUITS);
    const suitB = suffix === "s" ? suitA : notOtherSuit(suitA);
    return [{ rank: rankA, suit: suitA }, { rank: rankB, suit: suitB }];
  }

  function dealNotationMultiRound() {
    const token = notGenRangeToken(notState.rankPool, notState.pairs === "on", notState.tokenType);
    const targetArr = Array.from(token.targetSet);
    const maxCorrect = Math.min(3, targetArr.length);
    const correctCount = 1 + Math.floor(Math.random() * maxCorrect);
    const correctCodes = shuffle(targetArr).slice(0, correctCount);

    const wrongPool = shuffle(notAllHandCodes().filter(c => !token.targetSet.has(c)));
    const wrongCodes = wrongPool.slice(0, 3 - correctCount);

    const candidates = shuffle([...correctCodes, ...wrongCodes]).map(code => ({
      code,
      cards: notHandCodeToCards(code),
      inRange: token.targetSet.has(code),
      displaySwap: Math.random() < 0.5,
      selected: false
    }));

    notState.multi = { label: token.label, candidates, checked: false };
    renderNotationMulti();
  }

  function renderNotationMulti() {
    const m = notState.multi;
    document.getElementById("not-multi-notation").textContent = m.label;

    const wrap = document.getElementById("not-multi-candidates");
    wrap.innerHTML = "";
    m.candidates.forEach(cand => {
      const el = document.createElement("div");
      el.className = "not-multi-candidate";
      // Порядок карт на экране случайный (не всегда старшая слева) — правильность считается по
      // коду руки, а не по позиции карты, так что порядок отображения на неё не влияет.
      const order = cand.displaySwap ? [cand.cards[1], cand.cards[0]] : [cand.cards[0], cand.cards[1]];
      el.appendChild(cardEl(order[0], true, state.faceStyle, state.cardBack));
      el.appendChild(cardEl(order[1], true, state.faceStyle, state.cardBack));
      el.addEventListener("click", () => {
        if (m.checked) return;
        cand.selected = !cand.selected;
        el.classList.toggle("selected", cand.selected);
      });
      wrap.appendChild(el);
    });

    document.getElementById("not-multi-check").style.display = "block";
    document.getElementById("not-multi-next").style.display = "none";
  }

  function checkNotationMulti() {
    const m = notState.multi;
    if (!m || m.checked) return;
    m.checked = true;
    const els = document.querySelectorAll("#not-multi-candidates .not-multi-candidate");
    els.forEach((el, idx) => {
      const cand = m.candidates[idx];
      el.classList.remove("selected");
      if (cand.selected && cand.inRange) el.classList.add("cell-correct");
      else if (cand.selected && !cand.inRange) el.classList.add("cell-incorrect");
      else if (!cand.selected && cand.inRange) el.classList.add("cell-missed");
    });
    document.getElementById("not-multi-check").style.display = "none";
    document.getElementById("not-multi-next").style.display = "block";
  }

  document.getElementById("not-multi-check").addEventListener("click", checkNotationMulti);
  document.getElementById("not-multi-next").addEventListener("click", dealNotationMultiRound);

  /* --- Режим «Диапазон» --- */

  export function notCellInfo(r, c) {
    const rankR = NOT_GRID_RANKS[r], rankC = NOT_GRID_RANKS[c];
    if (r === c) return { hand: rankR + rankR };
    if (r < c) return { hand: rankR + rankC + "s" };
    return { hand: rankC + rankR + "o" };
  }

  function notSortedPool(rankPool) {
    return notGetRankPool(rankPool).slice().sort((a, b) => RANK_VALUE[a] - RANK_VALUE[b]);
  }

  function notGenPairToken(rankPool) {
    const sorted = notSortedPool(rankPool);
    const maxRank = sorted[sorted.length - 1];
    const a = pickRandom(sorted);

    // Дефис — если и только если пул позволяет взять вторую, ОТЛИЧНУЮ от границы "+", точку
    // (иначе дефис-диапазон и "+"-диапазон совпадали бы один в один — незачем плодить дубли формы).
    const canDash = sorted.length >= 3;
    const form = canDash ? pickRandom(["exact", "plus", "dash"]) : pickRandom(["exact", "plus"]);

    if (form === "exact") {
      return { label: a + a, targetSet: new Set([a + a]) };
    }
    if (form === "plus") {
      if (a === maxRank) return { label: a + a, targetSet: new Set([a + a]) }; // вырождается — без "+"
      const targetSet = new Set(sorted.filter(r => RANK_VALUE[r] >= RANK_VALUE[a]).map(r => r + r));
      return { label: a + a + "+", targetSet };
    }
    // dash: две разные границы диапазона пар. Стандарт нотации — младшая рука пишется первой,
    // старшая второй (66-99, а не 99-66; подтверждено внешними источниками, не выдумано).
    let b;
    do { b = pickRandom(sorted); } while (b === a);
    const hi = RANK_VALUE[a] > RANK_VALUE[b] ? a : b;
    const lo = hi === a ? b : a;
    if (hi === lo) return { label: hi + hi, targetSet: new Set([hi + hi]) }; // защита, физически не должно случиться
    const between = sorted.filter(r => RANK_VALUE[r] >= RANK_VALUE[lo] && RANK_VALUE[r] <= RANK_VALUE[hi]);
    if (between.length < 2) return { label: hi + hi, targetSet: new Set([hi + hi]) };
    // Если верхняя граница упирается в потолок пула — это уже "+"-диапазон, короче и привычнее,
    // дефис здесь избыточен (99-AA и 99+ — одно и то же, но "+" стандартнее).
    if (hi === maxRank) {
      const targetSet = new Set(between.map(r => r + r));
      return { label: lo + lo + "+", targetSet };
    }
    const targetSet = new Set(between.map(r => r + r));
    return { label: lo + lo + "-" + hi + hi, targetSet };
  }

  function notGenSuitedOrOffsuitToken(rankPool, suited) {
    const sorted = notSortedPool(rankPool);
    const suffix = suited ? "s" : "o";
    // Якорь — любой ранг, у которого в пуле есть хотя бы один ранг ниже (иначе не из чего строить пару рангов).
    const anchor = pickRandom(sorted.slice(1));
    const anchorIdx = sorted.indexOf(anchor);
    const lowerRanks = sorted.slice(0, anchorIdx);

    const canDash = lowerRanks.length >= 3; // нужно минимум 2 разные внутренние точки, отличные от вырождения
    const forms = canDash ? ["exact", "plus", "dash"] : ["exact", "plus"];
    const form = lowerRanks.length === 1 ? "exact" : pickRandom(forms);

    if (form === "exact") {
      const second = pickRandom(lowerRanks);
      const hand = anchor + second + suffix;
      return { label: hand, targetSet: new Set([hand]) };
    }

    if (form === "plus") {
      const thresholdIdx = Math.floor(Math.random() * lowerRanks.length);
      const threshold = lowerRanks[thresholdIdx];
      const included = lowerRanks.slice(thresholdIdx);
      // "+"-диапазон из одной ячейки — вырожденный случай, плюс тут не нужен, пишем как точную руку.
      if (included.length === 1) {
        const hand = anchor + threshold + suffix;
        return { label: hand, targetSet: new Set([hand]) };
      }
      const targetSet = new Set(included.map(r => anchor + r + suffix));
      return { label: anchor + threshold + suffix + "+", targetSet };
    }

    // dash: две разные внутренние границы (обе строго ниже anchor). Младшая карта — первой,
    // старшая — второй (ATs-AQs, а не AQs-ATs), тот же стандарт, что и для пар.
    let i1 = Math.floor(Math.random() * lowerRanks.length);
    let i2;
    do { i2 = Math.floor(Math.random() * lowerRanks.length); } while (i2 === i1);
    const hiIdx = Math.max(i1, i2), loIdx = Math.min(i1, i2);
    const included = lowerRanks.slice(loIdx, hiIdx + 1);
    if (included.length < 2) {
      const hand = anchor + lowerRanks[hiIdx] + suffix;
      return { label: hand, targetSet: new Set([hand]) };
    }
    const targetSet = new Set(included.map(r => anchor + r + suffix));
    // Верхняя граница упирается в потолок (ранг прямо под anchor) — это уже "+"-диапазон,
    // короче и привычнее дефиса (ATs-AKs и ATs+ — одно и то же).
    if (hiIdx === lowerRanks.length - 1) {
      const label = anchor + lowerRanks[loIdx] + suffix + "+";
      return { label, targetSet };
    }
    const label = anchor + lowerRanks[loIdx] + suffix + "-" + anchor + lowerRanks[hiIdx] + suffix;
    return { label, targetSet };
  }

  export function notGenRangeToken(rankPool, pairsOn, tokenType) {
    let tt = tokenType;
    if (tt === "mix") {
      const options = pairsOn ? ["pair", "suited", "offsuit"] : ["suited", "offsuit"];
      tt = pickRandom(options);
    }
    if (tt === "pair") return notGenPairToken(rankPool);
    return notGenSuitedOrOffsuitToken(rankPool, tt === "suited");
  }

  // Составной диапазон — несколько независимо сгенерированных, но ГАРАНТИРОВАННО непересекающихся
  // токенов (2–3), объединённых через запятую, как выглядят реальные диапазоны розыгрыша
  // (например "22+, ATs+, KQo"). Реальные чарты никогда не повторяют уже включённые руки другим
  // токеном — это было бы бессмысленной записью, поэтому непересечение — жёсткое правило, не эвристика.
  export function notGenCompositeToken(rankPool, pairsOn, tokenType) {
    const count = 2 + Math.floor(Math.random() * 2); // 2 или 3
    const labels = [];
    const targetSet = new Set();
    let guard = 0;
    while (labels.length < count && guard < 60) {
      guard++;
      const tok = notGenRangeToken(rankPool, pairsOn, tokenType);
      let overlaps = false;
      for (const h of tok.targetSet) { if (targetSet.has(h)) { overlaps = true; break; } }
      if (overlaps) continue;
      labels.push(tok.label);
      tok.targetSet.forEach(h => targetSet.add(h));
    }
    return { label: labels.join(", "), targetSet };
  }

  // Число реальных карточных комбинаций, которые кодирует одна ячейка: пара — 6 (C(4,2)),
  // suited — 4 (масть общая), offsuit — 12 (4×3 разных мастей).
export function notHandCombos(code) {
    if (code.length === 2 && code[0] === code[1]) return 6;
    return code.endsWith("s") ? 4 : 12;
  }

  export function wireNotSegmented(el, onChange) {
    el.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        el.querySelectorAll("button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        onChange(btn.dataset.value);
      });
    });
  }

  const notModeSwitch = document.getElementById("not-mode-switch");
  const notTokenBlock = document.getElementById("not-token-block");
  const notTokenSwitch = document.getElementById("not-token-switch");
  const notPairsSwitch = document.getElementById("not-pairs-switch");

  function updateNotTokenBlockVisibility() {
    notTokenBlock.style.display = notState.mode === "multi" ? "block" : "none";
  }

  wireNotSegmented(notModeSwitch, v => {
    notState.mode = v;
    updateNotTokenBlockVisibility();
  });
  wireNotSegmented(document.getElementById("not-rankpool-switch"), v => { notState.rankPool = v; });
  wireNotSegmented(notTokenSwitch, v => { notState.tokenType = v; });

  function updateNotTokenPairAvailability() {
    const pairBtn = notTokenSwitch.querySelector('button[data-value="pair"]');
    const disable = notState.pairs === "off";
    pairBtn.disabled = disable;
    pairBtn.style.opacity = disable ? "0.35" : "1";
    if (disable && pairBtn.classList.contains("active")) {
      pairBtn.classList.remove("active");
      const suitedBtn = notTokenSwitch.querySelector('button[data-value="suited"]');
      suitedBtn.classList.add("active");
      notState.tokenType = "suited";
    }
  }

  wireNotSegmented(notPairsSwitch, v => {
    notState.pairs = v;
    updateNotTokenPairAvailability();
  });

  updateNotTokenBlockVisibility();

  export function runNotationSession() {
    if (notState.mode === "single") {
      showSubview("session-notation-single");
      dealNotationSingleRound();
    } else {
      showSubview("session-notation-multi");
      dealNotationMultiRound();
    }
  }

  document.getElementById("start-notation-session").addEventListener("click", runNotationSession);


  // Точка входа для программного запуска (Обучариум) — см. DECISIONS.md.
  // settings: { mode, rankPool, pairs, tokenType }
  export function applySettings(settings) {
    if (settings.mode !== undefined) notState.mode = settings.mode;
    if (settings.rankPool !== undefined) notState.rankPool = settings.rankPool;
    if (settings.pairs !== undefined) notState.pairs = settings.pairs;
    if (settings.tokenType !== undefined) notState.tokenType = settings.tokenType;
  }

  registerTrainingEntry("notation", (settings) => {
    if (settings) applySettings(settings);
    runNotationSession();
  });
