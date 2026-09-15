// js/practice/practice-router.js
// Переключение setup/session-экранов внутри «Практики».
//
// ПРИМЕЧАНИЕ ПО АРХИТЕКТУРЕ (не было в исходнике, решение принято при переносе):
// в монолите showSubview напрямую звало renderHub/renderCalcOutsResultText/eqRenderAll
// и т.п. — это было можно, потому что всё жило в одной области видимости. С ES-модулями
// так низя: practice-router.js не может импортировать practice.js/calc-outs.js/
// calc-equity.js напрямую — они сами импортируют showSubview отсюда, получился бы
// циклический импорт. Решение — реестр коллбэков: каждый файл тренировки сам
// регистрирует, что делать при показе своего под-экрана, через onSubviewShow(name, fn).
import { dict } from "../core/i18n.js";
import { state } from "../core/state.js";

const subviewHooks = {};
const trainingEntryPoints = {};
const headerSlotUpdaters = [];

// Реестр правого слота шапки — живёт здесь, не в router.js и не в practice.js,
// чтобы не создавать циклический импорт (router.js уже импортирует practice.js,
// а practice.js должен уметь регистрировать сюда свой обработчик). Любое место,
// что-то показывающее в правом слоте (компакт-режим хаба, шестерёнка тренировки),
// регистрирует здесь свою функцию проверки; router.js вызывает их все при каждой
// смене экрана/вкладки, сам не зная, что конкретно у кого показывать.
export function registerHeaderSlotUpdater(fn) {
  headerSlotUpdaters.push(fn);
}
export function updateHeaderRightSlot() {
  headerSlotUpdaters.forEach(fn => fn());
  updateGearSlot();
}

// Шестерёнка — общий элемент на пятерых, а не по одной на тренировку. Чтобы
// пять независимых колбэков не конкурировали за один DOM-элемент (кто последний
// вызвался — та и победила, реальный риск гонки), решение о показе/скрытии и о
// том, чей обработчик клика сейчас актуален, принимается централизованно здесь.
const gearProviders = {}; // subviewName -> функция открытия модалки настроек
export function registerGearProvider(subviewName, openModalFn) {
  gearProviders[subviewName] = openModalFn;
}
let currentGearHandler = null;
function updateGearSlot() {
  const freeScreenActive = document.querySelector('[data-screen="free"]')?.classList.contains("active");
  const activeSub = freeScreenActive ? document.querySelector('[data-screen="free"] .subview.active') : null;
  const name = activeSub ? activeSub.dataset.subview : null;
  const gearBtn = document.getElementById("header-gear-btn");
  const provider = name ? gearProviders[name] : null;
  gearBtn.classList.toggle("show", !!provider);
  if (currentGearHandler) gearBtn.removeEventListener("click", currentGearHandler);
  currentGearHandler = provider || null;
  if (currentGearHandler) gearBtn.addEventListener("click", currentGearHandler);
}

// Централизованное переключение левой/центральной части шапки — раньше каждый
// из трёх роутеров (router.js, этот файл, theory.js) по отдельности дёргал
// backBtn.classList, что и привело к пропущенному месту при переключении вкладок.
// Теперь одна функция управляет сразу четырьмя элементами как двумя парами:
// «назад» + «i» (взаимоисключающие слева), заголовок экрана + логотип
// (взаимоисключающие по центру).
export function setHeaderMainMode(isMainScreen) {
  document.getElementById("back-btn").classList.toggle("show", !isMainScreen);
  document.getElementById("header-info-btn").classList.toggle("show", isMainScreen);
  document.getElementById("header-title").classList.toggle("show", !isMainScreen);
  document.getElementById("header-wordmark").classList.toggle("show", isMainScreen);
}

// Заранее сброшенный флаг: последний запуск тренировки шёл с готовыми настройками
// извне (Обучариум), а не по клику пользователя из хаба. Пригодится, когда будет
// построена реальная шестерёнка-модалка — она должна прятаться именно в этом случае.
export let lastLaunchHadCustomSettings = false;

// Вызывается каждой тренировкой при загрузке модуля: "вот моя функция запуска сессии".
export function registerTrainingEntry(moduleId, runFn) {
  trainingEntryPoints[moduleId] = runFn;
}

// Точка входа для программного запуска тренировки — сразу в сессию, минуя сетап.
// customSettings — объект нужной для конкретной тренировки формы (см. DECISIONS.md),
// null/не передан — тренировка запускается с текущими (по умолчанию/уже выставленными)
// настройками, как если бы пользователь сам открыл её из хаба.
export async function startTraining(moduleId, customSettings = null) {
  const entry = trainingEntryPoints[moduleId];
  if (!entry) {
    console.warn("startTraining: нет зарегистрированной точки входа для", moduleId);
    return;
  }
  lastLaunchHadCustomSettings = !!customSettings;
  await entry(customSettings);
}

// Вызывается из файла тренировки при загрузке модуля: "когда покажется этот
// под-экран — вызови эту функцию".
export function onSubviewShow(name, callback) {
  subviewHooks[name] = callback;
}

// Общий правый слот шапки (компакт-режим хаба, шестерёнка тренировки и т.п.)
// теперь обновляется через registerHeaderSlotUpdater/updateHeaderRightSlot выше —
// заменяет прежний onAnySubviewShow (был нужен только для одного подписчика).

export function showSubview(name) {
  document.querySelectorAll('[data-screen="free"] .subview').forEach(v => {
    v.classList.toggle("active", v.dataset.subview === name);
  });
  const headerTitle = document.getElementById("header-title");
  setHeaderMainMode(name === "hub");
  const t = dict[state.lang];
  if (name === "hub") headerTitle.textContent = t["tab.free"];
  if (name === "soon") headerTitle.textContent = t["stub.soon"];
  if (name === "setup") headerTitle.textContent = t["module.outs.title"];
  if (name === "session") headerTitle.textContent = t["module.outs.title"];
  if (name === "setup-combo" || name === "session-combo") headerTitle.textContent = t["module.identifyCombo.title"];
  if (name === "calc-outs-setup" || name === "calc-outs-result") headerTitle.textContent = t["module.calcOuts.title"];
  if (name === "calc-equity") headerTitle.textContent = t["module.calcEquity.title"];
  if (name === "setup-positions" || name === "session-positions") headerTitle.textContent = t["module.positions.title"];
  if (name === "setup-notation" || name === "session-notation-single" || name === "session-notation-multi") headerTitle.textContent = t["module.notation.title"];
  if (name === "setup-preflop" || name === "session-notation-range") headerTitle.textContent = t["module.preflopTable.title"];
  if (name === "session-mnemonic") headerTitle.textContent = t["module.mnemonic.title"];
  if (subviewHooks[name]) subviewHooks[name]();
  updateHeaderRightSlot();
}
