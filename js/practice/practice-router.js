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
let anySubviewCallback = null;

// Вызывается из файла тренировки при загрузке модуля: "когда покажется этот
// под-экран — вызови эту функцию". Не заменяет точку входа для Обучариума
// (startTraining/init) — та появится отдельно, при доработке роутера.
export function onSubviewShow(name, callback) {
  subviewHooks[name] = callback;
}

// В оригинале hubUpdateHeaderSlot вызывался при КАЖДОЙ смене под-экрана,
// не только при показе хаба — сохраняю то же поведение отдельным хуком.
export function onAnySubviewShow(callback) {
  anySubviewCallback = callback;
}

export function showSubview(name) {
  document.querySelectorAll('[data-screen="free"] .subview').forEach(v => {
    v.classList.toggle("active", v.dataset.subview === name);
  });
  const backBtn = document.getElementById("back-btn");
  const headerTitle = document.getElementById("header-title");
  backBtn.classList.toggle("show", name !== "hub");
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
  if (subviewHooks[name]) subviewHooks[name]();
  if (anySubviewCallback) anySubviewCallback();
}
