// js/practice/trainings/calc-equity.js
// Калькулятор эквити — интерфейс. Сам расчёт (Монте-Карло) — в core/equity-worker.js.

import { state, RANKS, SUITS } from "../../core/state.js";
import { dict } from "../../core/i18n.js";
import { cardId, CATEGORY_NAMES } from "../../core/hand-eval.js";
import { openCardPicker, renderSeqCardRow } from "../../ui/card-picker.js";
import { onSubviewShow } from "../practice-router.js";

  const eqState = {
    board: [null, null, null, null, null],
    players: [{ hand: [null, null], showBreakdown: false }, { hand: [null, null], showBreakdown: false }],
    iterations: 20000,
    results: null
  };

  function eqAllTakenIds() {
    const ids = new Set();
    eqState.board.forEach(c => { if (c) ids.add(cardId(c)); });
    eqState.players.forEach(p => p.hand.forEach(c => { if (c) ids.add(cardId(c)); }));
    return ids;
  }

  function eqRenderBoard() {
    renderSeqCardRow(document.getElementById("eq-board-slots"), eqState.board, 5, eqAllTakenIds, () => {
      eqState.results = null;
      eqRenderAll();
    });
  }

  function eqRenderPlayers() {
    const wrap = document.getElementById("eq-players");
    wrap.innerHTML = "";
    const t = dict[state.lang];
    const DASH = "\u2014";

    eqState.players.forEach((player, pi) => {
      const row = document.createElement("div");
      row.className = "eq-player-row";

      // Шапка строки: имя игрока + крестик удаления (если можно удалить) — отдельно от
      // карт, чтобы крестик не путался с зоной результата.
      const header = document.createElement("div");
      header.className = "eq-player-header";
      const label = document.createElement("span");
      label.className = "eq-player-label";
      label.textContent = t["eq.player"] + " " + (pi + 1);
      header.appendChild(label);
      if (eqState.players.length > 2) {
        const removeBtn = document.createElement("button");
        removeBtn.className = "eq-player-remove";
        removeBtn.textContent = "\u00d7";
        removeBtn.setAttribute("aria-label", t["eq.player"] + " " + (pi + 1));
        removeBtn.addEventListener("click", () => {
          eqState.players.splice(pi, 1);
          eqState.results = null;
          eqRenderAll();
        });
        header.appendChild(removeBtn);
      }
      row.appendChild(header);

      // Основная зона: слева карты + стрелка разбивки, справа результат (или прочерки,
      // если ещё не считали) — так при первом расчёте ничего не появляется заново и не
      // сдвигает соседние строки, только прочерки меняются на цифры.
      const main = document.createElement("div");
      main.className = "eq-player-main";

      const left = document.createElement("div");
      left.className = "eq-player-left";
      const slotsWrap = document.createElement("div");
      slotsWrap.className = "card-slot-row";
      left.appendChild(slotsWrap);
      renderSeqCardRow(slotsWrap, player.hand, 2, eqAllTakenIds, () => {
        eqState.results = null;
        eqRenderAll();
      });

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "eq-breakdown-toggle";
      toggleBtn.textContent = player.showBreakdown ? "\u25be" : "\u25b8";
      toggleBtn.setAttribute("aria-label", t["eq.showBreakdown"]);
      toggleBtn.addEventListener("click", () => {
        player.showBreakdown = !player.showBreakdown;
        eqRenderPlayers();
      });
      left.appendChild(toggleBtn);
      main.appendChild(left);

      const right = document.createElement("div");
      right.className = "eq-player-right";
      const r = eqState.results ? eqState.results[pi] : null;
      const lineWin = document.createElement("div");
      lineWin.className = "eq-player-result-line";
      lineWin.innerHTML = t["eq.win"] + " <b>" + (r ? r.win.toFixed(1) + "%" : DASH) + "</b>";
      const lineTie = document.createElement("div");
      lineTie.className = "eq-player-result-line";
      lineTie.innerHTML = t["eq.tie"] + " <b>" + (r ? r.tie.toFixed(1) + "%" : DASH) + "</b>";
      const lineEquity = document.createElement("div");
      lineEquity.className = "eq-player-result-line eq-equity-line";
      lineEquity.innerHTML = t["eq.equity"] + " <b>" + (r ? r.equity.toFixed(1) + "%" : DASH) + "</b>";
      right.appendChild(lineWin);
      right.appendChild(lineTie);
      right.appendChild(lineEquity);
      main.appendChild(right);

      row.appendChild(main);

      if (player.showBreakdown) {
        const body = document.createElement("div");
        body.className = "eq-breakdown-body";
        CATEGORY_NAMES[state.lang].forEach((name, ci) => {
          const line = document.createElement("div");
          line.className = "eq-breakdown-line";
          const val = r ? r.categories[ci].toFixed(ci >= 8 ? 3 : 1) + "%" : DASH;
          line.innerHTML = "<span>" + name + "</span><span>" + val + "</span>";
          body.appendChild(line);
        });
        row.appendChild(body);
      }

      wrap.appendChild(row);
    });

    document.getElementById("eq-add-player").disabled = eqState.players.length >= 9;
  }

  function eqRenderAll() {
    eqRenderBoard();
    eqRenderPlayers();
  }

  // ===== Web Worker для Монте-Карло эквити =====
  //
  // Раньше расчёт (тот же цикл, что ниже в воркере) выполнялся синхронно прямо в
  // обработчике клика по «Пересчитать» — при большом числе игроков и итераций интерфейс
  // на несколько секунд полностью переставал реагировать (ни скролла, ни тапов). Теперь
  // весь цикл считается в отдельном потоке — сюда просто отправляются данные и приходит
  // либо промежуточный прогресс, либо готовый результат.

  // Путь к воркеру — от расположения ЭТОГО файла (calc-equity.js), не от воркера
  // самого (см. ARCHITECTURE.md — путь внутри equity-worker.js отдельный, относительный
  // к самому себе через import.meta.url там).
  const eqWorkerUrl = new URL("../../core/equity-worker.js", import.meta.url);
  const eqWorker = new Worker(eqWorkerUrl, { type: "module" });

  function eqSetProgress(pct) {
    document.getElementById("eq-recalc-progress").style.width = pct + "%";
  }

  function eqSetCalculating(on) {
    const btn = document.getElementById("eq-recalc");
    const label = document.getElementById("eq-recalc-label");
    btn.disabled = on;
    document.getElementById("eq-add-player").disabled = on || eqState.players.length >= 9;
    label.textContent = on ? dict[state.lang]["eq.calculating"] : dict[state.lang]["eq.recalc"];
    if (!on) eqSetProgress(0);
  }

  eqWorker.onmessage = e => {
    if (e.data.type === "progress") {
      eqSetProgress(e.data.pct);
    } else if (e.data.type === "done") {
      eqSetProgress(100);
      eqState.results = e.data.results;
      eqSetCalculating(false);
      eqRenderPlayers();
    }
  };

  document.getElementById("eq-add-player").addEventListener("click", () => {
    if (eqState.players.length >= 9) return;
    eqState.players.push({ hand: [null, null], showBreakdown: false });
    eqState.results = null;
    eqRenderAll();
  });

  document.getElementById("eq-iterations-select").addEventListener("change", e => {
    eqState.iterations = parseInt(e.target.value, 10);
  });

  document.getElementById("eq-recalc").addEventListener("click", () => {
    eqSetCalculating(true);
    eqWorker.postMessage({
      board: eqState.board,
      playersHands: eqState.players.map(p => p.hand),
      iterations: eqState.iterations
    });
  });

  onSubviewShow("calc-equity", eqRenderAll);
