// js/router.js
// Переключение вкладок (нижняя навигация) + кнопка «назад» — общее для всего
// приложения. Не путать с practice-router.js (тот — только под-экраны Практики).

import { state } from "./core/state.js";
import { dict } from "./core/i18n.js";
import { showSubview, updateHeaderRightSlot, setHeaderMainMode } from "./practice/practice-router.js";
import { showTheorySubview } from "./theory/theory.js";
import { stopTimer } from "./practice/trainings/outs.js";
import { stopComboTimer } from "./practice/trainings/combinations.js";
import { stopMnemoTimer, stopMnemoExTimer } from "./practice/trainings/mnemonics.js";
import { hubExitEdit } from "./practice/practice.js";
import { refreshCardDisplayStatus } from "./settings/settings.js";

  const navButtons = document.querySelectorAll("nav button");
  const screens = document.querySelectorAll(".screen");
  const headerTitle = document.getElementById("header-title");
  const backBtn = document.getElementById("back-btn");

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      stopTimer();
      stopComboTimer();
      stopMnemoTimer();
      stopMnemoExTimer();
      if (typeof hubExitEdit === "function") hubExitEdit();
      const tab = btn.dataset.tab;
      navButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      screens.forEach(s => s.classList.toggle("active", s.dataset.screen === tab));
      updateHeaderRightSlot();
      headerTitle.setAttribute("data-i18n", btn.dataset.i18nTitle);
      headerTitle.textContent = dict[state.lang][btn.dataset.i18nTitle];
      if (tab === "free") showSubview("hub");
      else if (tab === "theory") showTheorySubview("theory-hub");
      else {
        setHeaderMainMode(true);
        if (tab === "settings") refreshCardDisplayStatus();
      }
    });
  });


  backBtn.addEventListener("click", () => {
    stopTimer();
    stopComboTimer();
    stopMnemoTimer();
    stopMnemoExTimer();
    const activeScreen = document.querySelector(".screen.active");
    const screenName = activeScreen ? activeScreen.dataset.screen : null;

    if (screenName === "theory") {
      showTheorySubview("theory-hub");
      return;
    }

    const activeSub = document.querySelector('[data-screen="free"] .subview.active');
    const name = activeSub ? activeSub.dataset.subview : "hub";
    // Сетап-экраны пяти тренировок больше не часть обычного пути (их место
    // заняла шестерёнка+модалка) — «назад» из сессии теперь всегда ведёт в хаб,
    // не на сетап. Калькулятор аутов — исключение, у него сетап остаётся.
    if (name === "calc-outs-result") showSubview("calc-outs-setup");
    else showSubview("hub");
  });
