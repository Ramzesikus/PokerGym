// js/settings/settings.js
// Общие настройки: язык, тема, карты. applyLanguage — самая связанная функция
// в приложении, трогает почти все модули при смене языка; в оригинале это было
// можно напрямую (общая область видимости), здесь — через прямой импорт функций
// обновления из соответствующих модулей (без циклических импортов: ни один из
// них не импортирует settings.js обратно).

import { state, tableBgs } from "../core/state.js";
import { dict } from "../core/i18n.js";
import { showSubview } from "../practice/practice-router.js";
import { hubState } from "../practice/practice.js";
import { refreshLanguageDisplay as refreshOutsLanguage, refreshCardFacesIfActive, getOutsSettings, syncOutsSettingsUI, persistOutsSettings } from "../practice/trainings/outs.js";
import { refreshLanguageDisplay as refreshComboLanguage, getComboSettings, syncComboSettingsUI, persistCombinationsSettings, applySettings as applyComboSettings } from "../practice/trainings/combinations.js";
import { getMnemonicSettings, syncMnemonicSettingsUI, persistMnemonicSettings, applySettings as applyMnemonicSettings } from "../practice/trainings/mnemonics.js";
import { refreshPositionsLanguage } from "../practice/trainings/positions.js";
import { showTheorySubview } from "../theory/theory.js";
import { suitColor } from "../ui/card.js";
import { loadSection, saveSection } from "../core/storage.js";

  // hideCards/showTime больше не хранятся здесь (см. DECISIONS.md) — переехали
  // в настройки каждой тренировки (outs/identifyCombo). Эта секция теперь
  // хранит только по-настоящему общие поля.
  function persistGlobalSettings() {
    saveSection("global", {
      lang: state.lang,
      cardBack: state.cardBack,
      faceStyle: state.faceStyle,
      tableBg: state.tableBg
    });
  }

  /* Language */

  function applyLanguage() {
    // <html lang> раньше был статичным "ru" и не обновлялся при переключении —
    // некритично само по себе, но важно для hyphens:auto (см. чат): без верного
    // lang браузер переносит английский текст по русским правилам.
    document.documentElement.lang = state.lang;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (dict[state.lang][key]) el.textContent = dict[state.lang][key];
    });
    document.querySelectorAll("[data-i18n-html]").forEach(el => {
      const key = el.getAttribute("data-i18n-html");
      if (dict[state.lang][key]) el.innerHTML = dict[state.lang][key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (dict[state.lang][key]) el.placeholder = dict[state.lang][key];
    });
    const activeScreen = document.querySelector(".screen.active");
    const currentTab = activeScreen ? activeScreen.dataset.screen : null;

    if (currentTab === "free") {
      const activeSub = document.querySelector('[data-screen="free"] .subview.active');
      if (activeSub) showSubview(activeSub.dataset.subview);
    }
    if (currentTab === "theory") {
      const activeTheorySub = document.querySelector('[data-screen="theory"] [data-theory-subview].active');
      if (activeTheorySub) showTheorySubview(activeTheorySub.dataset.theorySubview);
    }
    refreshOutsLanguage();
    refreshComboLanguage();
    formatIterationOptions();
    const compactToggle = document.getElementById("hub-compact-toggle");
    if (compactToggle) compactToggle.setAttribute("aria-label", dict[state.lang][hubState.compact ? "hub.compactOff" : "hub.compactOn"]);
  }

  // Разделитель тысяч зависит от языка: пробел для ru, запятая для en — значения в HTML
  // захардкожены по-русски, переформатируем текст опций при каждой смене языка.
  function formatIterationOptions() {
    const sel = document.getElementById("eq-iterations-select");
    if (!sel) return;
    Array.from(sel.options).forEach(opt => {
      const n = parseInt(opt.value, 10);
      opt.textContent = n.toLocaleString(state.lang === "en" ? "en-US" : "ru-RU");
    });
  }

  const langSwitch = document.getElementById("lang-switch");
  langSwitch.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      langSwitch.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.lang = btn.dataset.value;
      applyLanguage();
      refreshPositionsLanguage();
      persistGlobalSettings();
    });
  });

  /* Показ карт — теперь не своё поле, а «применить всем тренировкам сразу»
     (см. DECISIONS.md). Пишет в обе секции (outs/identifyCombo) напрямую,
     каждой — через её же persist/get/sync, тот же контракт, что у шестерёнок. */

  const hideCardsToggle = document.getElementById("hide-cards-toggle");
  const timeOptions = document.getElementById("time-options");
  const cardDisplayStatusEl = document.getElementById("card-display-status");

  // «Мнемоника» участвует в этом же сравнении, но у неё нет тумблера
  // hideCards — показ там скрывается всегда (см. mnemonics.js/DECISIONS.md).
  // Поэтому «одинаково» требует ещё и того, чтобы «Ауты»/«Комбинации» сами
  // скрывали карты (иначе они принципиально отличаются от «Мнемоники», которая
  // скрывает всегда) — плюс совпадение всех трёх значений времени показа.
  function computeCardDisplayStatus() {
    const o = getOutsSettings();
    const c = getComboSettings();
    const m = getMnemonicSettings();
    return (o.hideCards && c.hideCards && o.showTime === c.showTime && o.showTime === m.showTime) ? "same" : "different";
  }

  // Вызывается при каждом заходе на вкладку «Настройки» (см. router.js) —
  // синхронизирует видимые чекбокс/чипы с текущим значением «Аутов» (как
  // отправная точка для «применить всем») и пересчитывает статус-бар.
  export function refreshCardDisplayStatus() {
    const o = getOutsSettings();
    hideCardsToggle.checked = o.hideCards;
    timeOptions.classList.toggle("disabled", !o.hideCards);
    timeOptions.querySelectorAll(".time-chip").forEach(c => c.classList.toggle("active", c.dataset.value === o.showTime));

    const status = computeCardDisplayStatus();
    cardDisplayStatusEl.textContent = dict[state.lang][status === "same" ? "settings.cardDisplayStatusSame" : "settings.cardDisplayStatusDifferent"];
  }

  function applyCardDisplayToAll() {
    state.hideCards = hideCardsToggle.checked;
    const activeChip = timeOptions.querySelector(".time-chip.active");
    if (activeChip) state.showTime = activeChip.dataset.value;

    persistOutsSettings();
    syncOutsSettingsUI(getOutsSettings());

    applyComboSettings({ hideCards: state.hideCards, showTime: state.showTime });
    persistCombinationsSettings();
    syncComboSettingsUI(getComboSettings());

    // «Мнемонике» из этой пары нужно только время — у неё нет своего hideCards
    // (показ скрывается всегда), передавать его незачем и нечем.
    applyMnemonicSettings({ showTime: state.showTime });
    persistMnemonicSettings();
    syncMnemonicSettingsUI(getMnemonicSettings());

    refreshCardDisplayStatus();
  }

  hideCardsToggle.addEventListener("change", () => {
    timeOptions.classList.toggle("disabled", !hideCardsToggle.checked);
    applyCardDisplayToAll();
  });

  timeOptions.querySelectorAll(".time-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      timeOptions.querySelectorAll(".time-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      applyCardDisplayToAll();
    });
  });

  const cardbackOptions = document.getElementById("cardback-options");
  cardbackOptions.querySelectorAll(".back-swatch").forEach(swatch => {
    swatch.addEventListener("click", () => {
      cardbackOptions.querySelectorAll(".back-swatch").forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
      state.cardBack = swatch.dataset.value;
      persistGlobalSettings();
    });
  });

  const faceSymbolsPreview = { hearts: "A♥", diamonds: "A♦", clubs: "A♣", spades: "A♠" };

  function renderFacePreview() {
    const el = document.getElementById("face-preview");
    el.innerHTML = "";
    ["hearts", "diamonds", "clubs", "spades"].forEach(suit => {
      const card = document.createElement("div");
      card.className = "card-box card-face";
      card.style.color = suitColor(suit, state.faceStyle);
      card.textContent = faceSymbolsPreview[suit];
      el.appendChild(card);
    });
  }

  const faceSwitch = document.getElementById("face-style-switch");
  faceSwitch.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      faceSwitch.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.faceStyle = btn.dataset.value;
      renderFacePreview();
      refreshCardFacesIfActive();
      persistGlobalSettings();
    });
  });

  function applyTableBg() {
    const t = tableBgs[state.tableBg];
    const root = document.documentElement;
    root.style.setProperty("--table-bg", t.bg);
    root.style.setProperty("--table-fg", t.fg);
    root.style.setProperty("--nav-bg", t.nav);
    root.style.setProperty("--well", t.well);
    root.style.setProperty("--divider", t.divider);
    root.style.setProperty("--chip-active", t.chipActive);
    root.style.setProperty("--chip-text", t.chipText);
    root.style.setProperty("--muted", t.muted);
    root.style.setProperty("--card-face-bg", t.cardFace);
    root.style.setProperty("--card-surface", t.cardSurface);
  }

  let tableBgManual = false;

  const tableBgOptions = document.getElementById("table-bg-options");
  tableBgOptions.querySelectorAll(".option-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      tableBgManual = true;
      tableBgOptions.querySelectorAll(".option-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.tableBg = chip.dataset.value;
      applyTableBg();
      persistGlobalSettings();
    });
  });

  function setThemeFromSystem() {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    state.tableBg = prefersDark ? "dark" : "light";
    tableBgOptions.querySelectorAll(".option-chip").forEach(c => {
      c.classList.toggle("active", c.dataset.value === state.tableBg);
    });
  }

  if (window.matchMedia) {
    setThemeFromSystem();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (!tableBgManual) { setThemeFromSystem(); applyTableBg(); }
    });
  }

  renderFacePreview();
  applyTableBg();

  // Восстановление сохранённых настроек — после автоопределения темы по системе,
  // чтобы явно сохранённый ранее выбор пользователя имел приоритет. Если ничего
  // не сохранено — оставляем то, что уже выставлено выше (дефолты + автотема).
  const savedGlobalSettings = loadSection("global");
  if (savedGlobalSettings) {
    if (savedGlobalSettings.lang !== undefined) {
      state.lang = savedGlobalSettings.lang;
      langSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === state.lang));
      applyLanguage();
    }
    if (savedGlobalSettings.cardBack !== undefined) {
      state.cardBack = savedGlobalSettings.cardBack;
      cardbackOptions.querySelectorAll(".back-swatch").forEach(s => s.classList.toggle("active", s.dataset.value === state.cardBack));
    }
    if (savedGlobalSettings.faceStyle !== undefined) {
      state.faceStyle = savedGlobalSettings.faceStyle;
      faceSwitch.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.value === state.faceStyle));
      renderFacePreview();
    }
    if (savedGlobalSettings.tableBg !== undefined) {
      state.tableBg = savedGlobalSettings.tableBg;
      tableBgManual = true; // сохранённый выбор — это и есть ручной выбор, автотема больше не должна его перебивать
      tableBgOptions.querySelectorAll(".option-chip").forEach(c => c.classList.toggle("active", c.dataset.value === state.tableBg));
      applyTableBg();
    }
  }

  /* ===== Общий пикер карты (переиспользуется калькуляторами Ауты и Эквити) ===== */

  let cardPickerCallback = null;
  let cardPickerTakenIds = null;
  let cardPickerAllowClear = false;

