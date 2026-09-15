// js/practice/practice.js
// Хаб «Практика»: список тренировок, рендер карточек, закрепление, drag.
// Персистентности пока нет нигде в приложении (сознательно отложено) — весь порядок
// карточек и режим отображения живут только в памяти, сбрасываются при перезагрузке.

import Sortable from "../lib/sortable.js";
import { dict } from "../core/i18n.js";
import { state } from "../core/state.js";
import { showSubview, onSubviewShow, registerHeaderSlotUpdater, startTraining } from "./practice-router.js";
import { loadSection, saveSection } from "../core/storage.js";

  /* ===== Хаб «Практика»: данные, рендер, режим редактирования, драг, закрепление =====
     Персистентности пока нет нигде в приложении (сознательно отложено) — весь порядок
     карточек, закреплённые в «Своей программе» и режим отображения живут только в памяти
     и сбрасываются при перезагрузке страницы. */

  const HUB_MODULES = [
    { id: "identify-combo", group: "base", titleKey: "module.identifyCombo.title", subKey: "module.identifyCombo.sub", icon: '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />' },
    { id: "positions", group: "base", titleKey: "module.positions.title", subKey: "module.positions.sub", icon: '<path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /><path d="M21 21v-2a4 4 0 0 0 -3 -3.85" />' },
    { id: "notation", group: "base", titleKey: "module.notation.title", subKey: "module.notation.sub", icon: '<path d="M3 16v-6a2 2 0 1 1 4 0v6" /><path d="M3 13h4" /><path d="M10 8v6a2 2 0 1 0 4 0v-1a2 2 0 1 0 -4 0v1" /><path d="M20.732 12a2 2 0 0 0 -3.732 1v1a2 2 0 0 0 3.726 1.01" />' },
    { id: "preflop-table", group: "base", titleKey: "module.preflopTable.title", subKey: "module.preflopTable.sub", icon: '<path d="M4 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M4 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />' },
    { id: "mnemonic", group: "base", titleKey: "module.mnemonic.title", subKey: "module.mnemonic.sub", icon: '<path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8" /><path d="M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8" /><path d="M17.5 16a3.5 3.5 0 0 0 0 -7h-.5" /><path d="M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0" /><path d="M6.5 16a3.5 3.5 0 0 1 0 -7h.5" /><path d="M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10" />' },
    { id: "preflop", group: "preflop", isStub: true, titleKey: "module.preflop.title", subKey: "module.preflop.sub", icon: '<path d="M3.604 7.197l7.138 -3.109a.96 .96 0 0 1 1.27 .527l4.924 11.902a1 1 0 0 1 -.514 1.304l-7.137 3.109a.96 .96 0 0 1 -1.271 -.527l-4.924 -11.903a1 1 0 0 1 .514 -1.304l0 .001" /><path d="M15 4h1a1 1 0 0 1 1 1v3.5" /><path d="M20 6c.264 .112 .52 .217 .768 .315a1 1 0 0 1 .53 1.311l-2.298 5.374" />' },
    { id: "outs", group: "flopturn", titleKey: "module.outs.title", subKey: "module.outs.sub", icon: '<path d="M4 5a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -14" /><path d="M8 8a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1l0 -1" /><path d="M8 14l0 .01" /><path d="M12 14l0 .01" /><path d="M16 14l0 .01" /><path d="M8 17l0 .01" /><path d="M12 17l0 .01" /><path d="M16 17l0 .01" />' },
    { id: "tworiver", group: "flopturn", isStub: true, titleKey: "module.tworiver.title", subKey: "module.tworiver.sub", icon: '<path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -6" /><path d="M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -10" /><path d="M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -14" /><path d="M4 20h14" />' },
    { id: "opphand", group: "river", isStub: true, titleKey: "module.opphand.title", subKey: "module.opphand.sub", icon: '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h1.5" /><path d="M15 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M20.2 20.2l1.8 1.8" />' },
    { id: "calc-outs", group: "calculator", titleKey: "module.calcOuts.title", subKey: "module.calcOuts.sub", icon: '<path d="M11 6h9" /><path d="M11 12h9" /><path d="M12 18h8" /><path d="M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4" /><path d="M6 10v-6l-2 2" />' },
    { id: "calc-equity", group: "calculator", titleKey: "module.calcEquity.title", subKey: "module.calcEquity.sub", icon: '<path d="M16 17a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M6 7a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M6 18l12 -12" />' }
  ];
  const HUB_MODULE_BY_ID = {};
  HUB_MODULES.forEach(m => { HUB_MODULE_BY_ID[m.id] = m; });

  const HUB_GROUP_ORDER = ["own", "base", "preflop", "flopturn", "river", "calculator"];
  const HUB_GROUP_LABEL_KEY = { own: "hub.groupOwn", base: "hub.groupBase", preflop: "hub.groupPreflop", flopturn: "hub.groupFlopTurn", river: "hub.groupRiver", calculator: "hub.groupCalculator" };

  export const hubState = {
    compact: false,
    editing: false,
    groupOrder: {},   // group -> [moduleId, ...] — начальный порядок как в HUB_MODULES, дальше меняется драгом
    groupOpen: {}      // group -> bool, по умолчанию всё свёрнуто
  };
  HUB_GROUP_ORDER.forEach(g => { hubState.groupOrder[g] = []; hubState.groupOpen[g] = false; });
  HUB_MODULES.forEach(m => { hubState.groupOrder[m.group].push(m.id); });

  // Восстановление сохранённого порядка/закрепления/компакт-режима — до первого
  // renderHub() ниже. Валидируем на случай, если список тренировок с тех пор
  // изменился: убираем id, которых больше нет, дописываем новые в конец, а не
  // падаем и не молча теряем их из хаба.
  const savedHubSettings = loadSection("hub");
  if (savedHubSettings) {
    if (savedHubSettings.compact !== undefined) hubState.compact = savedHubSettings.compact;
    if (savedHubSettings.groupOrder) {
      const allCurrentIds = new Set(HUB_MODULES.map(m => m.id));
      HUB_GROUP_ORDER.forEach(g => {
        const saved = savedHubSettings.groupOrder[g];
        if (!Array.isArray(saved)) return;
        const stillValid = saved.filter(id => g === "own" ? allCurrentIds.has(id) : hubState.groupOrder[g].includes(id));
        const missing = hubState.groupOrder[g].filter(id => !stillValid.includes(id));
        hubState.groupOrder[g] = g === "own" ? stillValid : stillValid.concat(missing);
      });
    }
  }

  function hubOpenModule(moduleId) {
    if (moduleId === "calc-outs") showSubview("calc-outs-setup");
    else if (moduleId === "calc-equity") showSubview("calc-equity");
    else if (["outs", "identify-combo", "positions", "notation", "preflop-table", "mnemonic"].includes(moduleId)) startTraining(moduleId);
    else showSubview("soon");
  }

  function hubCardHTML(moduleId) {
    const m = HUB_MODULE_BY_ID[moduleId];
    const t = dict[state.lang];
    const pinned = hubState.groupOrder.own.includes(moduleId);
    const pinLabel = pinned ? t["hub.pinRemove"] : t["hub.pinAdd"];
    const pinBadge = hubState.editing
      ? '<button class="hub-pin-badge' + (pinned ? " active" : "") + '" data-pin="' + moduleId + '" aria-label="' + pinLabel + '">' +
        '<svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4.5v5.8l-2.2 3.7v1.5h10.4v-1.5l-2.2 -3.7v-5.8" /><path d="M12 15.5v4.5" /><path d="M7.5 4.5h9" /></svg>' +
        "</button>"
      : "";
    return '<div class="hub-card' + (m.isStub ? " is-stub" : "") + (hubState.editing ? " editing" : "") + (hubState.compact ? " compact" : "") + '" data-module="' + moduleId + '">' +
      '<div class="hub-icon' + (m.isStub ? " is-stub" : "") + '"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + m.icon + "</svg></div>" +
      '<div class="hub-card-text"><p class="hub-title">' + t[m.titleKey] + '</p><p class="hub-sub">' + t[m.subKey] + "</p></div>" +
      pinBadge +
      "</div>";
  }

  function hubGroupHTML(group) {
    const t = dict[state.lang];
    const ids = hubState.groupOrder[group];
    const isOwn = group === "own";
    const isOpen = hubState.groupOpen[group];
    const bodyInner = (isOwn && ids.length === 0)
      ? '<div class="hub-group-empty">' + t["hub.ownEmpty"] + "</div>"
      : ids.map(hubCardHTML).join("");
    return '<button class="hub-group-label' + (isOpen ? " open" : "") + '" data-group="' + group + '">' +
      "<span>" + t[HUB_GROUP_LABEL_KEY[group]] + '</span><i class="hub-group-chevron" aria-hidden="true">▸</i>' +
      "</button>" +
      '<div class="hub-group-body' + (isOpen ? " open" : "") + (isOwn ? " hub-group-body-own" : "") + (hubState.compact ? " compact-body" : "") + '" data-group="' + group + '">' + bodyInner + "</div>";
  }

  function renderHub() {
    document.getElementById("hub-groups").innerHTML = HUB_GROUP_ORDER.map(hubGroupHTML).join("");
    hubInitSortable();
  }

  function persistHubSettings() {
    saveSection("hub", { groupOrder: hubState.groupOrder, compact: hubState.compact });
  }

  function hubTogglePin(moduleId) {
    const idx = hubState.groupOrder.own.indexOf(moduleId);
    if (idx === -1) hubState.groupOrder.own.push(moduleId);
    else hubState.groupOrder.own.splice(idx, 1);
    renderHub();
    persistHubSettings();
  }

  // Единый источник правды для правого слота шапки: тумблер компактности и «Готово»
  // никогда не показываются одновременно и оба видны только на самом экране хаба.
  function updateHubHeaderSlot() {
    const freeScreen = document.querySelector('[data-screen="free"]');
    const hubSub = document.querySelector('[data-subview="hub"]');
    const onHub = !!freeScreen && freeScreen.classList.contains("active") &&
                  !!hubSub && hubSub.classList.contains("active");
    document.getElementById("hub-compact-toggle").classList.toggle("show", onHub && !hubState.editing);
    document.getElementById("hub-done-btn").classList.toggle("show", onHub && hubState.editing);
  }
  registerHeaderSlotUpdater(updateHubHeaderSlot);

  function hubEnterEdit() {
    if (hubState.editing) return;
    hubState.editing = true;
    renderHub();
    updateHubHeaderSlot();
  }

  export function hubExitEdit() {
    if (!hubState.editing) return;
    hubState.editing = false;
    renderHub();
    updateHubHeaderSlot();
  }

  document.getElementById("hub-done-btn").addEventListener("click", hubExitEdit);

  const hubCompactToggleBtn = document.getElementById("hub-compact-toggle");
  // Синхронизация визуального состояния кнопки под уже восстановленный (выше)
  // hubState.compact — сам renderHub() ниже уже покажет карточки верно, но кнопка
  // без этого будет выглядеть выключенной, пока пользователь не кликнет по ней сам.
  hubCompactToggleBtn.classList.toggle("active", hubState.compact);
  hubCompactToggleBtn.setAttribute("aria-label", dict[state.lang][hubState.compact ? "hub.compactOff" : "hub.compactOn"]);
  hubCompactToggleBtn.addEventListener("click", () => {
    hubState.compact = !hubState.compact;
    hubCompactToggleBtn.classList.toggle("active", hubState.compact);
    hubCompactToggleBtn.setAttribute("aria-label", dict[state.lang][hubState.compact ? "hub.compactOff" : "hub.compactOn"]);
    renderHub();
    persistHubSettings();
  });

  const hubSubviewEl = document.querySelector('[data-screen="free"] [data-subview="hub"]');
  const hubGroupsEl = document.getElementById("hub-groups");

  // Тап по группе / карточке / булавке — обычный клик, без задержки. Тап по пустому месту
  // самого экрана во время редактирования — выход из режима (как в iOS).
  hubSubviewEl.addEventListener("click", e => {
    const pinBtn = e.target.closest(".hub-pin-badge");
    if (pinBtn) { hubTogglePin(pinBtn.dataset.pin); return; }

    const groupLabel = e.target.closest(".hub-group-label");
    if (groupLabel) {
      const g = groupLabel.dataset.group;
      hubState.groupOpen[g] = !hubState.groupOpen[g];
      renderHub();
      return;
    }

    const card = e.target.closest(".hub-card");
    if (card) {
      if (!hubState.editing) hubOpenModule(card.dataset.module);
      return;
    }

    if (hubState.editing) hubExitEdit();
  });

  // ===== Долгий тап по карточке — вход в режим редактирования (специфика приложения,
  // библиотека этого не делает). Сам же драг внутри группы, пока режим уже включён, —
  // полностью на SortableJS (см. hubInitSortable ниже), включая анимацию раздвижения
  // соседей — переизобретать это оказалось непросто, а библиотека уже закрывает все
  // краевые случаи (первый элемент списка, распознавание клика vs начала драга и т.д.). =====
  const LONG_PRESS_MS = 500;
  const DRAG_THRESHOLD_PX = 6;
  let pressTimer = null;
  let pressCard = null;

  hubGroupsEl.addEventListener("pointerdown", e => {
    if (hubState.editing) return; // в режиме редактирования жест целиком отдан Sortable
    const badge = e.target.closest(".hub-pin-badge");
    if (badge) return;
    const card = e.target.closest(".hub-card");
    if (!card) return;

    pressCard = card;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      hubEnterEdit();
    }, LONG_PRESS_MS);
  });

  function cancelPressTimer() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    pressCard = null;
  }
  hubGroupsEl.addEventListener("pointerup", cancelPressTimer);
  hubGroupsEl.addEventListener("pointercancel", cancelPressTimer);
  hubGroupsEl.addEventListener("pointermove", e => {
    // Небольшое движение до срабатывания тайминга долгого тапа — отменяем (палец просто
    // скроллит страницу, не собирался ничего зажимать).
    if (pressTimer && pressCard) {
      const rect = pressCard.getBoundingClientRect();
      if (e.clientY < rect.top - DRAG_THRESHOLD_PX || e.clientY > rect.bottom + DRAG_THRESHOLD_PX) cancelPressTimer();
    }
  });

  // Один экземпляр Sortable на каждый контейнер группы (включая «Свою программу») —
  // уникальное имя group='hub-<группа>' у каждого само по себе не даёт перетащить карточку
  // из одной группы в другую, без какого-либо кастомного кода на эту тему. Пересоздаётся
  // после каждого renderHub(), т.к. он полностью перестраивает DOM (innerHTML).
  let hubSortables = [];
  function hubInitSortable() {
    hubSortables.forEach(s => s.destroy());
    hubSortables = [];
    document.querySelectorAll('#hub-groups .hub-group-body').forEach(body => {
      const group = body.dataset.group;
      hubSortables.push(new Sortable(body, {
        group: "hub-" + group,
        draggable: ".hub-card",
        filter: ".hub-pin-badge",
        preventOnFilter: true,
        disabled: !hubState.editing,
        animation: 150,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        delay: 0,
        forceFallback: true, // одинаковое поведение на мыши и тачскрине — без нативного
        // HTML5 drag-and-drop с его собственным полупрозрачным «призраком», который на
        // десктопе выглядел иначе, чем на телефоне
        swapThreshold: 0.65, // ниже дефолтной 1 — с разновысокими карточками (полный режим,
        // не все строки одной высоты из-за длины текста) не нужно пересекать соседа
        // целиком, чтобы своп ощущался отзывчиво, а не «залипал»
        onStart: evt => {
          // Гасим покачивание у ВСЕХ карточек группы, а не только у перетаскиваемой:
          // Sortable должен плавно двигать соседей через transform (это и даёт эффект
          // "раздвижения"), а keyframe-анимация покачивания тоже трогает transform —
          // если она продолжает идти у соседей, оба аниматора спорят за одно и то же
          // свойство, и вместо плавного сдвига получаются дискретные рывки.
          evt.from.querySelectorAll(".hub-card.editing").forEach(c => c.classList.add("drag-paused"));
        },
        onEnd: evt => {
          evt.from.querySelectorAll(".drag-paused").forEach(c => c.classList.remove("drag-paused"));
          hubState.groupOrder[group] = Array.from(body.querySelectorAll(".hub-card")).map(el => el.dataset.module);
          persistHubSettings();
        }
      }));
    });
  }

  renderHub();
  updateHubHeaderSlot();

  /* Navigation: subviews inside "theory" */


  onSubviewShow("hub", renderHub);
