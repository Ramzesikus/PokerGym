// js/practice/trainings/preflop-grid.js
// Логика и UI тренировки «Матрица префлопа». Исторически была физически
// перемешана с кодом «Нотации» в одном месте монолита (функции с префиксом
// not..., но относятся к отдельному модулю preflopTable) — см. ARCHITECTURE.md.

import { state } from "../../core/state.js";
import { dict } from "../../core/i18n.js";
import { pickRandom, shuffle } from "../../core/deck.js";
import { notHandCombos, wireNotSegmented, notGenRangeToken, notGenCompositeToken, notCellInfo } from "./notation.js";
import { showSubview, registerTrainingEntry, registerGearProvider } from "../practice-router.js";
import { loadSection, saveSection } from "../../core/storage.js";

  const pfState = {
    rankPool: "all",
    pairs: "on",
    tokenType: "pair",
    rangeComplexity: "single",
    showMode: "table",
    probUnit: "percent",
    probInput: "choice",
    tolerancePct: 2,
    toleranceRatio: 20,
    range: null,
    prob: null
  };

  function notRangeProbability(targetSet) {
    let combos = 0;
    targetSet.forEach(c => { combos += notHandCombos(c); });
    return (combos / 1326) * 100;
  }

  function dealNotationRangeRound() {
    const token = pfState.rangeComplexity === "multi"
      ? notGenCompositeToken(pfState.rankPool, pfState.pairs === "on", pfState.tokenType)
      : notGenRangeToken(pfState.rankPool, pfState.pairs === "on", pfState.tokenType);
    pfState.range = { label: token.label, targetSet: token.targetSet, selected: new Set(), checked: false };
    pfState.prob = null;

    const showMode = pfState.showMode;
    const notationEl = document.getElementById("not-range-notation");
    const checkBtn = document.getElementById("not-range-check");
    document.getElementById("not-prob-block").style.display = "none";
    document.getElementById("not-range-next").style.display = "none";

    if (showMode === "probability") {
      notationEl.textContent = "";
      renderNotationRangeGrid(true);
      checkBtn.style.display = "none";
      showProbabilityQuestion(token.targetSet);
    } else {
      notationEl.textContent = token.label;
      renderNotationRangeGrid(false);
      checkBtn.style.display = "block";
      checkBtn.disabled = false;
    }
  }

  function renderNotationRangeGrid(readOnly) {
    const grid = document.getElementById("not-range-grid");
    grid.innerHTML = "";
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 13; c++) {
        const info = notCellInfo(r, c);
        const cell = document.createElement("div");
        cell.className = "not-range-cell";
        cell.dataset.hand = info.hand;
        cell.textContent = info.hand;
        if (readOnly) {
          if (pfState.range.targetSet.has(info.hand)) cell.classList.add("shape-highlight");
        } else {
          cell.addEventListener("click", () => {
            if (pfState.range.checked) return;
            if (pfState.range.selected.has(info.hand)) {
              pfState.range.selected.delete(info.hand);
              cell.classList.remove("selected");
            } else {
              pfState.range.selected.add(info.hand);
              cell.classList.add("selected");
            }
          });
        }
        grid.appendChild(cell);
      }
    }
  }

  function checkNotationRange() {
    const r = pfState.range;
    if (!r || r.checked) return;
    r.checked = true;
    document.querySelectorAll(".not-range-cell").forEach(cell => {
      const hand = cell.dataset.hand;
      const selected = r.selected.has(hand);
      const shouldBe = r.targetSet.has(hand);
      cell.classList.remove("selected");
      if (selected && shouldBe) cell.classList.add("cell-correct");
      else if (selected && !shouldBe) cell.classList.add("cell-incorrect");
      else if (!selected && shouldBe) cell.classList.add("cell-missed");
    });
    document.getElementById("not-range-check").style.display = "none";
    if (pfState.showMode === "both") {
      showProbabilityQuestion(r.targetSet);
    } else {
      document.getElementById("not-range-next").style.display = "block";
    }
  }

  document.getElementById("not-range-check").addEventListener("click", checkNotationRange);
  document.getElementById("not-range-next").addEventListener("click", dealNotationRangeRound);

  /* --- Вопрос о вероятности диапазона --- */

  // Разбивка "X×12 + Y×6 + Z×4" — та самая калькуляция, по которой видно, откуда взялся ответ,
  // вместо непрозрачного отдельного текста "точный ответ: NN%".
  function notComboBreakdown(targetSet) {
    let nPair = 0, nSuited = 0, nOffsuit = 0;
    targetSet.forEach(h => {
      if (h.length === 2 && h[0] === h[1]) nPair++;
      else if (h.endsWith("s")) nSuited++;
      else nOffsuit++;
    });
    const parts = [];
    if (nOffsuit) parts.push(nOffsuit + "\u00d712");
    if (nPair) parts.push(nPair + "\u00d76");
    if (nSuited) parts.push(nSuited + "\u00d74");
    const total = nOffsuit * 12 + nPair * 6 + nSuited * 4;
    return { expr: parts.join(" + "), total };
  }

  function notBreakdownText(targetSet, unit) {
    const b = notComboBreakdown(targetSet);
    const prob = (b.total / 1326) * 100;
    const ratioOf = dict[state.lang]["notSession.ratioOf"] || "\u0438\u0437";
    if (unit === "ratio") {
      const ratio = 100 / prob;
      return b.expr + " = " + b.total + " \u2192 1326/" + b.total + " \u2248 1 " + ratioOf + " " + ratio.toFixed(1);
    }
    // "expr = total / 1326" была бы ложной цепочкой равенств (total ≠ total/1326) — разрываем
    // стрелкой, как и в ratio-варианте: сначала посчитали total, отдельно — саму вероятность.
    return b.expr + " = " + b.total + " \u2192 " + b.total + "/1326 \u2248 " + prob.toFixed(1) + "%";
  }

  function notGenProbChoices(trueProb, unit) {
    const used = new Set([Math.round(trueProb * 10)]);
    const distractors = [];
    const factors = [0.35, 0.55, 1.6, 2.2, 2.8, 3.5];
    let guard = 0;
    while (distractors.length < 3 && guard < 50) {
      guard++;
      const factor = pickRandom(factors);
      let val = Math.random() < 0.5 ? trueProb * factor : trueProb + (Math.random() < 0.5 ? 1 : -1) * (trueProb * 0.6 + 3);
      val = Math.max(0.1, Math.min(99.5, val));
      const rounded = Math.round(val * 10);
      if (!used.has(rounded)) { used.add(rounded); distractors.push(rounded / 10); }
    }
    const ratioOf = dict[state.lang]["notSession.ratioOf"] || "\u0438\u0437";
    const all = shuffle([Math.round(trueProb * 10) / 10, ...distractors]);
    return all.map(v => ({
      label: unit === "ratio" ? "1 " + ratioOf + " " + (100 / v).toFixed(1) : v.toFixed(1) + "%",
      isCorrect: Math.abs(v - trueProb) < 0.05
    }));
  }

  function showProbabilityQuestion(targetSet) {
    const trueProb = notRangeProbability(targetSet);
    pfState.prob = { trueProb, targetSet, answered: false };

    const probBlock = document.getElementById("not-prob-block");
    probBlock.style.display = "block";
    document.getElementById("not-prob-result").innerHTML = "";

    const choiceWrap = document.getElementById("not-prob-choice");
    const inputWrap = document.getElementById("not-prob-input-wrap");
    const checkBtn = document.getElementById("not-prob-check");
    const input = document.getElementById("not-prob-input");
    choiceWrap.innerHTML = "";
    choiceWrap.style.display = "none";
    inputWrap.style.display = "none";
    input.value = "";
    input.disabled = false;
    input.classList.remove("answer-correct", "answer-incorrect");
    checkBtn.style.display = "block";
    checkBtn.disabled = false;

    const unit = pfState.probUnit;
    if (pfState.probInput === "choice") {
      choiceWrap.style.display = "grid";
      checkBtn.style.display = "none";
      const options = notGenProbChoices(trueProb, unit);
      pfState.prob.options = options;
      options.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.className = "pos-option-btn";
        btn.textContent = opt.label;
        btn.addEventListener("click", () => handleProbChoiceAnswer(idx));
        choiceWrap.appendChild(btn);
      });
    } else {
      inputWrap.style.display = "flex";
      const prefixEl = document.getElementById("not-prob-input-prefix");
      const suffixEl = document.getElementById("not-prob-input-suffix");
      const t = dict[state.lang];
      if (unit === "percent") {
        prefixEl.textContent = "";
        suffixEl.textContent = "%";
        input.placeholder = t["notSession.placeholderPercent"];
      } else {
        prefixEl.textContent = t["notSession.ratioPrefixLabel"];
        suffixEl.textContent = "";
        input.placeholder = t["notSession.placeholderRatio"];
      }
    }
  }

  function finishProbQuestion() {
    document.getElementById("not-range-next").style.display = "block";
  }

  function handleProbChoiceAnswer(idx) {
    const p = pfState.prob;
    if (!p || p.answered) return;
    p.answered = true;
    const opts = p.options;
    document.querySelectorAll("#not-prob-choice button").forEach((btn, i) => {
      btn.disabled = true;
      if (opts[i].isCorrect) btn.classList.add("answer-correct");
      else if (i === idx) btn.classList.add("answer-incorrect");
    });
    document.getElementById("not-prob-result").innerHTML =
      '<div class="prob-breakdown">' + notBreakdownText(p.targetSet, pfState.probUnit) + "</div>";
    finishProbQuestion();
  }

  document.getElementById("not-prob-check").addEventListener("click", () => {
    const p = pfState.prob;
    if (!p || p.answered) return;
    if (pfState.probInput === "choice") return;

    const input = document.getElementById("not-prob-input");
    const userVal = parseFloat(input.value);
    let correct;

    if (pfState.probUnit === "percent") {
      correct = !isNaN(userVal) && Math.abs(userVal - p.trueProb) <= pfState.tolerancePct;
    } else {
      const trueRatio = 100 / p.trueProb;
      correct = !isNaN(userVal) && userVal > 0 && Math.abs(userVal - trueRatio) <= trueRatio * (pfState.toleranceRatio / 100);
    }

    p.answered = true;
    input.disabled = true;
    input.classList.add(correct ? "answer-correct" : "answer-incorrect");
    document.getElementById("not-prob-check").style.display = "none";
    document.getElementById("not-prob-result").innerHTML =
      '<div class="prob-breakdown">' + notBreakdownText(p.targetSet, pfState.probUnit) + "</div>";

    finishProbQuestion();
  });

  /* --- Настройки: «Нотация» --- */

  const pfTokenSwitch = document.getElementById("pf-token-switch");
  const pfPairsSwitch = document.getElementById("pf-pairs-switch");
  const pfSectionProb = document.getElementById("pf-section-prob");
  const pfUnitBlock = document.getElementById("pf-unit-block");
  const pfInputBlock = document.getElementById("pf-input-block");
  const pfTolerancePctBlock = document.getElementById("pf-tolerance-pct-block");
  const pfToleranceRatioBlock = document.getElementById("pf-tolerance-ratio-block");

  function updatePfSetupVisibility() {
    const askProb = pfState.showMode === "probability" || pfState.showMode === "both";
    pfSectionProb.style.display = askProb ? "block" : "none";
    pfUnitBlock.style.display = askProb ? "block" : "none";
    pfInputBlock.style.display = askProb ? "block" : "none";
    const askExact = askProb && pfState.probInput === "exact";
    pfTolerancePctBlock.style.display = (askExact && pfState.probUnit === "percent") ? "block" : "none";
    pfToleranceRatioBlock.style.display = (askExact && pfState.probUnit === "ratio") ? "block" : "none";
  }

  function persistPreflopSettings() {
    saveSection("preflopTable", {
      rankPool: pfState.rankPool,
      pairs: pfState.pairs,
      tokenType: pfState.tokenType,
      rangeComplexity: pfState.rangeComplexity,
      showMode: pfState.showMode,
      probUnit: pfState.probUnit,
      probInput: pfState.probInput,
      tolerancePct: pfState.tolerancePct,
      toleranceRatio: pfState.toleranceRatio
    });
  }

  function getPreflopSettings() {
    return {
      rankPool: pfState.rankPool, pairs: pfState.pairs, tokenType: pfState.tokenType,
      rangeComplexity: pfState.rangeComplexity, showMode: pfState.showMode,
      probUnit: pfState.probUnit, probInput: pfState.probInput,
      tolerancePct: pfState.tolerancePct, toleranceRatio: pfState.toleranceRatio
    };
  }

  const notShowSwitch = document.getElementById("not-show-switch");
  const pfRankpoolSwitch = document.getElementById("pf-rankpool-switch");
  const pfComplexitySwitch = document.getElementById("pf-complexity-switch");
  const pfUnitSwitch = document.getElementById("pf-unit-switch");
  const pfInputSwitch = document.getElementById("pf-input-switch");
  const pfTolerancePctSelect = document.getElementById("pf-tolerance-pct-select");
  const pfToleranceRatioSelect = document.getElementById("pf-tolerance-ratio-select");

  wireNotSegmented(notShowSwitch, v => {
    pfState.showMode = v;
    updatePfSetupVisibility();
    checkPreflopSettingsDirty();
  });
  wireNotSegmented(pfRankpoolSwitch, v => { pfState.rankPool = v; checkPreflopSettingsDirty(); });
  wireNotSegmented(pfTokenSwitch, v => { pfState.tokenType = v; checkPreflopSettingsDirty(); });
  wireNotSegmented(pfComplexitySwitch, v => { pfState.rangeComplexity = v; checkPreflopSettingsDirty(); });
  wireNotSegmented(pfUnitSwitch, v => {
    pfState.probUnit = v;
    updatePfSetupVisibility();
    checkPreflopSettingsDirty();
  });
  wireNotSegmented(pfInputSwitch, v => {
    pfState.probInput = v;
    updatePfSetupVisibility();
    checkPreflopSettingsDirty();
  });

  pfTolerancePctSelect.addEventListener("change", e => {
    pfState.tolerancePct = parseFloat(e.target.value);
    checkPreflopSettingsDirty();
  });
  pfToleranceRatioSelect.addEventListener("change", e => {
    pfState.toleranceRatio = parseFloat(e.target.value);
    checkPreflopSettingsDirty();
  });

  function updatePfTokenPairAvailability() {
    const pairBtn = pfTokenSwitch.querySelector('button[data-value="pair"]');
    const disable = pfState.pairs === "off";
    pairBtn.disabled = disable;
    pairBtn.style.opacity = disable ? "0.35" : "1";
    if (disable && pairBtn.classList.contains("active")) {
      pairBtn.classList.remove("active");
      const suitedBtn = pfTokenSwitch.querySelector('button[data-value="suited"]');
      suitedBtn.classList.add("active");
      pfState.tokenType = "suited";
    }
  }

  wireNotSegmented(pfPairsSwitch, v => {
    pfState.pairs = v;
    updatePfTokenPairAvailability();
    checkPreflopSettingsDirty();
  });

  updatePfSetupVisibility();

  export function runPreflopSession() {
    showSubview("session-notation-range");
    dealNotationRangeRound();
  }

  // --- Модалка настроек (шестерёнка) ---
  let preflopSettingsSnapshot = null;

  function syncPreflopSettingsUI(s) {
    notShowSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === s.showMode));
    pfRankpoolSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === s.rankPool));
    pfTokenSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === s.tokenType));
    pfComplexitySwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === s.rangeComplexity));
    pfUnitSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === s.probUnit));
    pfInputSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === s.probInput));
    pfPairsSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === s.pairs));
    pfTolerancePctSelect.value = s.tolerancePct;
    pfToleranceRatioSelect.value = s.toleranceRatio;
    updatePfSetupVisibility();
    updatePfTokenPairAvailability();
  }

  function checkPreflopSettingsDirty() {
    const changed = preflopSettingsSnapshot && JSON.stringify(getPreflopSettings()) !== JSON.stringify(preflopSettingsSnapshot);
    document.getElementById("preflop-settings-ok").disabled = !changed;
  }

  function openPreflopSettingsModal() {
    preflopSettingsSnapshot = getPreflopSettings();
    document.getElementById("preflop-settings-modal").classList.add("show");
    checkPreflopSettingsDirty();
  }
  function closePreflopSettingsModal() {
    document.getElementById("preflop-settings-modal").classList.remove("show");
  }
  document.getElementById("preflop-settings-ok").addEventListener("click", () => {
    persistPreflopSettings();
    closePreflopSettingsModal();
    runPreflopSession();
  });
  function cancelPreflopSettings() {
    applySettings(preflopSettingsSnapshot);
    syncPreflopSettingsUI(preflopSettingsSnapshot);
    closePreflopSettingsModal();
  }
  document.getElementById("preflop-settings-cancel").addEventListener("click", cancelPreflopSettings);
  document.getElementById("preflop-settings-cancel-x").addEventListener("click", cancelPreflopSettings);
  registerGearProvider("session-notation-range", openPreflopSettingsModal);


  // Точка входа для программного запуска (Обучариум) — см. DECISIONS.md.
  // settings: { rankPool, pairs, tokenType, rangeComplexity, showMode, probUnit, probInput }
  export function applySettings(settings) {
    if (settings.rankPool !== undefined) pfState.rankPool = settings.rankPool;
    if (settings.pairs !== undefined) pfState.pairs = settings.pairs;
    if (settings.tokenType !== undefined) pfState.tokenType = settings.tokenType;
    if (settings.rangeComplexity !== undefined) pfState.rangeComplexity = settings.rangeComplexity;
    if (settings.showMode !== undefined) pfState.showMode = settings.showMode;
    if (settings.probUnit !== undefined) pfState.probUnit = settings.probUnit;
    if (settings.probInput !== undefined) pfState.probInput = settings.probInput;
    if (settings.tolerancePct !== undefined) pfState.tolerancePct = settings.tolerancePct;
    if (settings.toleranceRatio !== undefined) pfState.toleranceRatio = settings.toleranceRatio;
  }

  registerTrainingEntry("preflop-table", (settings) => {
    if (settings) applySettings(settings);
    runPreflopSession();
  });

  const savedPreflopSettings = loadSection("preflopTable");
  if (savedPreflopSettings) {
    applySettings(savedPreflopSettings);
    syncPreflopSettingsUI(getPreflopSettings());
  }
