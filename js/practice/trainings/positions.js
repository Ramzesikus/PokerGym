// js/practice/trainings/positions.js
// Логика и UI тренировки «Позиции за столом».

import { state } from "../../core/state.js";
import { dict } from "../../core/i18n.js";
import { randomInt, shuffle } from "../../core/deck.js";
import { posLabel, posTailSeats } from "../../core/positions.js";
import { showSubview, registerTrainingEntry, registerGearProvider } from "../practice-router.js";
import { loadSection, saveSection } from "../../core/storage.js";

  const POS_SEAT_COORDS = {
    2: [[50,85],[50,15]],
    3: [[50,85],[16.2,32.5],[83.8,32.5]],
    4: [[50,85],[11,50],[50,15],[89,50]],
    5: [[50,85],[12.9,60.8],[27.1,21.7],[72.9,21.7],[87.1,60.8]],
    6: [[50,85],[16.2,67.5],[16.2,32.5],[50,15],[83.8,32.5],[83.8,67.5]],
    7: [[50,85],[19.5,71.8],[12,42.2],[33.1,18.5],[66.9,18.5],[88,42.2],[80.5,71.8]],
    8: [[50,85],[22.4,74.7],[11,50],[22.4,25.3],[50,15],[77.6,25.3],[89,50],[77.6,74.7]],
    9: [[50,85],[24.9,76.8],[11.6,56.1],[16.2,32.5],[36.7,17.1],[63.3,17.1],[83.8,32.5],[88.4,56.1],[75.1,76.8]]
  };

  // Порядок мест по кругу начиная с баттона (BTN -> SB -> BB -> ... -> CO -> обратно к BTN).
  // Старая школа: MP. Новая школа: MP переименован в HJ (6-max) или в LJ (7-9-max),
  // остальные названия (UTG, UTG+1, UTG+2, HJ, CO) идентичны в обеих школах.
  const POS_LADDER_OLD = {
    2: ["BTNSB","BB"],
    3: ["BTN","SB","BB"],
    4: ["BTN","SB","BB","CO"],
    5: ["BTN","SB","BB","MP","CO"],
    6: ["BTN","SB","BB","UTG","MP","CO"],
    7: ["BTN","SB","BB","UTG","MP","HJ","CO"],
    8: ["BTN","SB","BB","UTG","UTG1","MP","HJ","CO"],
    9: ["BTN","SB","BB","UTG","UTG1","UTG2","MP","HJ","CO"]
  };
  const POS_LADDER_NEW = {
    2: ["BTNSB","BB"],
    3: ["BTN","SB","BB"],
    4: ["BTN","SB","BB","CO"],
    5: ["BTN","SB","BB","HJ","CO"],
    6: ["BTN","SB","BB","UTG","HJ","CO"],
    7: ["BTN","SB","BB","UTG","LJ","HJ","CO"],
    8: ["BTN","SB","BB","UTG","UTG1","LJ","HJ","CO"],
    9: ["BTN","SB","BB","UTG","UTG1","UTG2","LJ","HJ","CO"]
  };

  const POS_DANGER_CODES = ["UTG", "UTG1", "UTG2"];

  const posState = {
    minN: 6,
    maxN: 6,
    format: "short",
    school: "old",
    n: 0,
    btnSeatIndex: 0,
    seats: [],       // { code, userCode, filled }
    fillOrder: [],   // seat indices in the order they must be answered
    fillPos: 0,
    done: false
  };

  function dealNewPositionsRound() {
    const n = randomInt(posState.minN, posState.maxN);
    const ladder = (posState.school === "old" ? POS_LADDER_OLD : POS_LADDER_NEW)[n];
    const btnSeatIndex = randomInt(0, n - 1);

    const seats = new Array(n);
    for (let i = 0; i < n; i++) {
      const seatIndex = (btnSeatIndex + i) % n;
      seats[seatIndex] = { code: ladder[i], userCode: null, filled: false };
    }

    const ownSeatIndex = randomInt(0, n - 1);
    const rest = [];
    for (let i = 0; i < n; i++) if (i !== ownSeatIndex) rest.push(i);
    const fillOrder = [ownSeatIndex, ...shuffle(rest)];

    posState.n = n;
    posState.ladder = ladder;
    // Порядок чипсов-кнопок перемешивается отдельно от порядка мест за столом — иначе
    // порядок кнопок сам по себе выдаёт правильную рассадку (мощная подсказка, которой быть не должно).
    // ВАЖНО: shuffle() мутирует переданный массив на месте. ladder — прямая ссылка на общий
    // POS_LADDER_OLD[n]/POS_LADDER_NEW[n], один и тот же для всех раундов. Если передать
    // ladder напрямую, каждый следующий раунд необратимо портит эталонный список позиций
    // (баг существовал в оригинальном монолите — .slice() делает независимую копию для тасовки).
    posState.optionsOrder = shuffle(ladder.slice());
    posState.btnSeatIndex = btnSeatIndex;
    posState.ownSeatIndex = ownSeatIndex;
    posState.seats = seats;
    posState.fillOrder = fillOrder;
    posState.fillPos = 0;
    posState.done = false;

    hidePosHints();
    document.getElementById("pos-hint-tail").disabled = false;
    renderPositionsTable();
    renderPositionsOptions();
    updatePositionsProgress();
    highlightCurrentSeat();
  }

  function updatePositionsProgress() {
    const t = dict[state.lang];
    document.getElementById("pos-session-context").textContent = (t["posSession.playersLabel"] || "") + posState.n;
    document.getElementById("pos-session-progress").textContent =
      Math.min(posState.fillPos, posState.n) + " / " + posState.n;
    document.getElementById("pos-next-deal").style.display = posState.done ? "block" : "none";
  }

  function renderPositionsTable() {
    const wrap = document.getElementById("pos-table-wrap");
    wrap.querySelectorAll(".pos-seat, .pos-btn-chip").forEach(el => el.remove());

    const coords = POS_SEAT_COORDS[posState.n];
    for (let i = 0; i < posState.n; i++) {
      const [x, y] = coords[i];
      const seatEl = document.createElement("div");
      seatEl.className = "pos-seat";
      seatEl.id = "pos-seat-" + i;
      seatEl.style.left = x + "%";
      seatEl.style.top = y + "%";
      wrap.appendChild(seatEl);

      if (i === posState.btnSeatIndex) {
        const dx = x - 50, dy = y - 50;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        // Смещаем фишку К ЦЕНТРУ стола (внутрь), а не наружу — иначе она окажется за пределами овала.
        const chipX = x - (dx / len) * 13;
        const chipY = y - (dy / len) * 13;
        const chip = document.createElement("div");
        chip.className = "pos-btn-chip";
        chip.style.left = chipX + "%";
        chip.style.top = chipY + "%";
        chip.textContent = "D";
        wrap.appendChild(chip);
      }
    }
  }

  function renderPositionsOptions() {
    const grid = document.getElementById("pos-options-grid");
    grid.innerHTML = "";
    posState.optionsOrder.forEach(code => {
      const btn = document.createElement("button");
      btn.className = "pos-option-btn";
      btn.dataset.code = code;
      btn.textContent = posLabel(code, posState.format);
      btn.addEventListener("click", () => handlePositionAnswer(code));
      grid.appendChild(btn);
    });
    refreshPosOptionsUsedState();
  }

  // Уже расставленные позиции остаются кликабельными (можно переназначить), но становятся
  // тусклее — так виднее, что ещё не расставлено.
  function refreshPosOptionsUsedState() {
    const usedCodes = new Set(posState.seats.filter(s => s.filled).map(s => s.userCode));
    document.querySelectorAll("#pos-options-grid .pos-option-btn").forEach(btn => {
      btn.classList.toggle("pos-option-used", usedCodes.has(btn.dataset.code));
    });
  }

  function highlightCurrentSeat() {
    document.querySelectorAll(".pos-seat").forEach(el => el.classList.remove("pos-seat-highlight"));
    if (posState.fillPos < posState.n) {
      const seatIndex = posState.fillOrder[posState.fillPos];
      const el = document.getElementById("pos-seat-" + seatIndex);
      if (el) el.classList.add("pos-seat-highlight");
    }
  }

  function handlePositionAnswer(code) {
    if (posState.done || posState.fillPos >= posState.n) return;
    const seatIndex = posState.fillOrder[posState.fillPos];
    const seat = posState.seats[seatIndex];
    seat.userCode = code;
    seat.filled = true;

    const el = document.getElementById("pos-seat-" + seatIndex);
    el.innerHTML = '<span>' + posLabel(code, posState.format) + "</span>";
    el.classList.remove("pos-seat-highlight");

    posState.fillPos++;
    updatePositionsProgress();
    refreshPosOptionsUsedState();

    if (posState.fillPos >= posState.n) {
      finishPositionsRound();
    } else {
      highlightCurrentSeat();
    }
  }

  function finishPositionsRound() {
    posState.done = true;
    posState.seats.forEach((seat, seatIndex) => {
      const el = document.getElementById("pos-seat-" + seatIndex);
      const correct = seat.userCode === seat.code;
      el.classList.add(correct ? "pos-seat-correct" : "pos-seat-incorrect");
      if (!correct) {
        el.innerHTML =
          '<span class="pos-seat-wrong-note">' + posLabel(seat.userCode, posState.format) + "</span>" +
          '<span class="pos-seat-correct-note">' + posLabel(seat.code, posState.format) + "</span>";
      }
    });
    document.getElementById("pos-options-grid").querySelectorAll("button").forEach(b => b.disabled = true);
    // «Хвост» ссылается на «текущее» кресло, а после завершения раздачи оно ничем не
    // выделяется среди прочих — подсказка теряет ориентир, поэтому блокируем её.
    document.getElementById("pos-hint-tail").disabled = true;
    updatePositionsProgress();
  }

  /* Подсказки: удерживание показывает эффект, отпускание — убирает. */

  function hidePosHints() {
    document.querySelectorAll(".pos-seat-danger, .pos-seat-tail").forEach(el => {
      el.classList.remove("pos-seat-danger", "pos-seat-tail");
    });
    const svg = document.getElementById("pos-vector-svg");
    svg.classList.remove("show");
    document.querySelectorAll(".pos-hint-btn").forEach(b => b.classList.remove("active"));
  }

  function showDangerHint() {
    posState.seats.forEach((seat, i) => {
      if (POS_DANGER_CODES.indexOf(seat.code) !== -1) {
        document.getElementById("pos-seat-" + i).classList.add("pos-seat-danger");
      }
    });
  }

  function showTailHint() {
    const currentIndex = posState.fillPos < posState.n
      ? posState.fillOrder[posState.fillPos]
      : posState.fillOrder[posState.n - 1];
    posTailSeats(currentIndex, posState.btnSeatIndex, posState.n).forEach(i => {
      document.getElementById("pos-seat-" + i).classList.add("pos-seat-tail");
    });
  }

  function showVectorHint() {
    const coords = POS_SEAT_COORDS[posState.n];
    const order = [];
    for (let i = 0; i < posState.n; i++) order.push((posState.btnSeatIndex + i) % posState.n);

    // Между каждой парой соседних кресел добавляем промежуточную точку (ближе к следующему
    // креслу) — на неё вешается маркер-стрелка, чтобы стрелка не пряталась под самим креслом.
    const pts = [];
    for (let k = 0; k < order.length; k++) {
      const a = coords[order[k]];
      const b = coords[order[(k + 1) % order.length]];
      pts.push(a[0] + "," + a[1]);
      const t = 0.62;
      const ax = a[0] + (b[0] - a[0]) * t;
      const ay = a[1] + (b[1] - a[1]) * t;
      pts.push(ax.toFixed(1) + "," + ay.toFixed(1));
    }
    pts.push(coords[order[0]][0] + "," + coords[order[0]][1]);

    document.getElementById("pos-vector-path").setAttribute("d", "M" + pts.join(" L"));
    document.getElementById("pos-vector-svg").classList.add("show");
  }

  function wirePosHintButton(btnId, activateFn) {
    const btn = document.getElementById(btnId);
    let active = false;
    const start = (e) => {
      e.preventDefault();
      if (active || posState.n === 0 || btn.disabled) return;
      active = true;
      btn.classList.add("active");
      activateFn();
    };
    const end = () => {
      if (!active) return;
      active = false;
      btn.classList.remove("active");
      hidePosHints();
    };
    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointerleave", end);
    btn.addEventListener("pointercancel", end);
  }

  wirePosHintButton("pos-hint-danger", showDangerHint);
  wirePosHintButton("pos-hint-tail", showTailHint);
  wirePosHintButton("pos-hint-vector", showVectorHint);

  /* Настройки */

  function persistPositionsSettings() {
    saveSection("positions", {
      minN: posState.minN,
      maxN: posState.maxN,
      format: posState.format,
      school: posState.school
    });
  }

  function getPositionsSettings() {
    return { minN: posState.minN, maxN: posState.maxN, format: posState.format, school: posState.school };
  }

  const posFormatSwitch = document.getElementById("pos-format-switch");
  posFormatSwitch.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      if (posFormatSwitch.disabled) return;
      posFormatSwitch.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      posState.format = btn.dataset.value;
      checkPositionsSettingsDirty();
    });
  });

  const posSchoolSwitch = document.getElementById("pos-school-switch");
  posSchoolSwitch.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      posSchoolSwitch.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      posState.school = btn.dataset.value;
      checkPositionsSettingsDirty();
    });
  });

  const posNMin = document.getElementById("pos-n-min");
  const posNMax = document.getElementById("pos-n-max");

  function validatePosRange() {
    const min = parseInt(posNMin.value, 10);
    const max = parseInt(posNMax.value, 10);
    const errEl = document.getElementById("pos-range-error");
    if (min > max) {
      errEl.textContent = dict[state.lang]["posSetup.rangeError"];
      return false;
    }
    errEl.textContent = "";
    return true;
  }

  function onPosRangeChange() {
    if (!validatePosRange()) { checkPositionsSettingsDirty(); return; }
    posState.minN = parseInt(posNMin.value, 10);
    posState.maxN = parseInt(posNMax.value, 10);
    checkPositionsSettingsDirty();
  }
  posNMin.addEventListener("change", onPosRangeChange);
  posNMax.addEventListener("change", onPosRangeChange);

  export function runPositionsSession() {
    showSubview("session-positions");
    dealNewPositionsRound();
  }

  // --- Модалка настроек (шестерёнка) ---
  let positionsSettingsSnapshot = null;

  function syncPositionsSettingsUI(s) {
    posNMin.value = s.minN;
    posNMax.value = s.maxN;
    posFormatSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === s.format));
    posSchoolSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === s.school));
  }

  function checkPositionsSettingsDirty() {
    const valid = validatePosRange();
    const changed = positionsSettingsSnapshot && JSON.stringify(getPositionsSettings()) !== JSON.stringify(positionsSettingsSnapshot);
    document.getElementById("positions-settings-ok").disabled = !valid || !changed;
  }

  function openPositionsSettingsModal() {
    positionsSettingsSnapshot = getPositionsSettings();
    document.getElementById("positions-settings-modal").classList.add("show");
    checkPositionsSettingsDirty();
  }
  function closePositionsSettingsModal() {
    document.getElementById("positions-settings-modal").classList.remove("show");
  }
  document.getElementById("positions-settings-ok").addEventListener("click", () => {
    persistPositionsSettings();
    closePositionsSettingsModal();
    runPositionsSession();
  });
  function cancelPositionsSettings() {
    applySettings(positionsSettingsSnapshot);
    syncPositionsSettingsUI(positionsSettingsSnapshot);
    closePositionsSettingsModal();
  }
  document.getElementById("positions-settings-cancel").addEventListener("click", cancelPositionsSettings);
  document.getElementById("positions-settings-cancel-x").addEventListener("click", cancelPositionsSettings);

  registerGearProvider("session-positions", openPositionsSettingsModal);

  document.getElementById("pos-next-deal").addEventListener("click", dealNewPositionsRound);

  /* ===== Модуль: Идентификация комбинации ===== */


  export function refreshPositionsLanguage() {
    if (posState.n) { renderPositionsOptions(); updatePositionsProgress(); }
  }

  // Точка входа для программного запуска (Обучариум) — см. DECISIONS.md.
  // settings: { minN, maxN, format, school }
  export function applySettings(settings) {
    if (settings.minN !== undefined) posState.minN = settings.minN;
    if (settings.maxN !== undefined) posState.maxN = settings.maxN;
    if (settings.format !== undefined) posState.format = settings.format;
    if (settings.school !== undefined) posState.school = settings.school;
  }

  registerTrainingEntry("positions", (settings) => {
    if (settings) applySettings(settings);
    runPositionsSession();
  });

  const savedPositionsSettings = loadSection("positions");
  if (savedPositionsSettings) {
    applySettings(savedPositionsSettings);
    syncPositionsSettingsUI(getPositionsSettings());
  }
