// js/app.js
// Точка входа. Импортирует все модули ради их побочных эффектов (навешивание
// обработчиков событий при загрузке) — большинство файлов ничего не экспортируют
// в app.js напрямую, но обязаны быть загружены хотя бы откуда-то в графе импортов.

import "./router.js";
import "./practice/practice.js";
import "./practice/trainings/outs.js";
import "./practice/trainings/notation.js";
import "./practice/trainings/preflop-grid.js";
import "./practice/trainings/positions.js";
import "./practice/trainings/combinations.js";
import "./practice/trainings/calc-outs.js";
import "./practice/trainings/calc-equity.js";
import "./practice/trainings/mnemonics.js";
import "./practice/trainings/preflop-strategy.js";
import "./practice/trainings/two-card-probability.js";
import "./practice/trainings/opponent-hand.js";
import "./theory/theory.js";
import "./settings/settings.js";
import "./learnarium/learnarium.js";
import "./stats/stats.js";

  /* ===== Вступительное окно «О чём этот тренажёр» ===== */

  document.getElementById("intro-modal").classList.add("show");

  document.getElementById("close-intro-modal").addEventListener("click", () => {
    document.getElementById("intro-modal").classList.remove("show");
  });

  document.getElementById("header-info-btn").addEventListener("click", () => {
    document.getElementById("intro-modal").classList.add("show");
  });

  document.getElementById("header-login-btn").addEventListener("click", () => {
    document.getElementById("login-soon-modal").classList.add("show");
  });
  document.getElementById("close-login-soon-modal").addEventListener("click", () => {
    document.getElementById("login-soon-modal").classList.remove("show");
  });
