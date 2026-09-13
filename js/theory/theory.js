// js/theory/theory.js
// Навигация внутри вкладки «Теория» + поиск по глоссарию. Сам текст глоссария
// статичен, лежит в index.html (HTML-SHELL) — здесь только переключение
// разделов и фильтрация по поисковой строке.
//
// НАЙДЕНО ПРИ РАЗБОРЕ: блок поиска физически был расположен в монолите далеко
// от остального кода Теории (между «Комбинациями» и переключателем улицы
// «Аутов»), а не рядом с showTheorySubview — граница в ARCHITECTURE.md была
// неполной, уточнена здесь.

import { dict } from "../core/i18n.js";
import { state } from "../core/state.js";

  export function showTheorySubview(name) {
    const backBtn = document.getElementById("back-btn");
    const headerTitle = document.getElementById("header-title");
    document.querySelectorAll('[data-screen="theory"] [data-theory-subview]').forEach(v => {
      v.classList.toggle("active", v.dataset.theorySubview === name);
    });
    backBtn.classList.toggle("show", name !== "theory-hub");
    const t = dict[state.lang];
    if (name === "theory-hub") headerTitle.textContent = t["tab.theory"];
    if (name === "theory-terms") {
      headerTitle.textContent = t["theory.terms.title"];
      const search = document.getElementById("theory-search");
      if (search) {
        search.value = "";
        document.querySelectorAll(".glossary-term").forEach(el => el.style.display = "");
        document.querySelectorAll(".glossary-group").forEach(el => el.style.display = "");
        document.getElementById("glossary-empty").style.display = "none";
      }
    }
    if (name === "theory-combos") headerTitle.textContent = t["theory.combos.title"];
    if (name === "theory-categories") headerTitle.textContent = t["theory.categories.title"];
    if (name === "theory-notation") headerTitle.textContent = t["theory.notation.title"];
  }

  document.querySelectorAll('[data-screen="theory"] .hub-card').forEach(card => {
    card.addEventListener("click", () => {
      showTheorySubview("theory-" + card.dataset.theory);
    });
  });

  const theorySearch = document.getElementById("theory-search");
  if (theorySearch) {
    theorySearch.addEventListener("input", () => {
      const query = theorySearch.value.trim().toLowerCase();
      let anyVisible = false;

      document.querySelectorAll(".glossary-group").forEach(group => {
        let groupHasVisible = false;
        group.querySelectorAll(".glossary-term").forEach(term => {
          const text = term.textContent.toLowerCase();
          const match = query === "" || text.includes(query);
          term.style.display = match ? "" : "none";
          if (match) groupHasVisible = true;
        });
        group.style.display = groupHasVisible ? "" : "none";
        if (groupHasVisible) anyVisible = true;
      });

      document.getElementById("glossary-empty").style.display = anyVisible ? "none" : "block";
    });
  }
