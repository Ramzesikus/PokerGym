// js/router.js
// Переключение вкладок (нижняя навигация) + кнопка «назад» — общее для всего
// приложения. Не путать с practice-router.js (тот — только под-экраны Практики).

import { state } from "./core/state.js";
import { dict } from "./core/i18n.js";
import { showSubview } from "./practice/practice-router.js";
import { showTheorySubview } from "./theory/theory.js";
import { stopTimer } from "./practice/trainings/outs.js";
import { hubExitEdit } from "./practice/practice.js";

  const navButtons = document.querySelectorAll("nav button");
  const screens = document.querySelectorAll(".screen");
  const headerTitle = document.getElementById("header-title");
  const backBtn = document.getElementById("back-btn");

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      stopTimer();
      if (typeof hubExitEdit === "function") hubExitEdit();
      const tab = btn.dataset.tab;
      navButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      screens.forEach(s => s.classList.toggle("active", s.dataset.screen === tab));
      if (typeof hubUpdateHeaderSlot === "function") hubUpdateHeaderSlot();
      headerTitle.setAttribute("data-i18n", btn.dataset.i18nTitle);
      headerTitle.textContent = dict[state.lang][btn.dataset.i18nTitle];
      if (tab === "free") showSubview("hub");
      else if (tab === "theory") showTheorySubview("theory-hub");
      else backBtn.classList.remove("show");
    });
  });


  backBtn.addEventListener("click", () => {
    stopTimer();
    const activeScreen = document.querySelector(".screen.active");
    const screenName = activeScreen ? activeScreen.dataset.screen : null;

    if (screenName === "theory") {
      showTheorySubview("theory-hub");
      return;
    }

    const activeSub = document.querySelector('[data-screen="free"] .subview.active');
    const name = activeSub ? activeSub.dataset.subview : "hub";
    if (name === "session") showSubview("setup");
    else if (name === "session-combo") showSubview("setup-combo");
    else if (name === "calc-outs-result") showSubview("calc-outs-setup");
    else if (name === "session-positions") showSubview("setup-positions");
    else if (name === "session-notation-single" || name === "session-notation-multi") showSubview("setup-notation");
    else if (name === "session-notation-range") showSubview("setup-preflop");
    else showSubview("hub");
  });
