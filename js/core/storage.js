// core/storage.js
// Хранит ТОЛЬКО настройки/предпочтения — не прогресс, не текущую раздачу/сессию
// (см. DECISIONS.md, раздел про localStorage — что сознательно не персистится).
//
// Один ключ в localStorage, один JSON-объект внутри, разбитый на секции по
// файлам-владельцам (outs/positions/notation/... + global + hub). Версия схемы
// хранится в самих данных — при несовпадении не мигрируем, просто откатываемся
// к дефолтным значениям для той секции, что не совпала (см. DECISIONS.md).

const STORAGE_KEY = "pokergym_settings";
const SCHEMA_VERSION = 1;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SCHEMA_VERSION) return null;
    return parsed;
  } catch (err) {
    // Битый JSON, localStorage недоступен (приватный режим и т.п.) — не пытаемся
    // героически восстановить, просто работаем так, как будто сохранённого нет.
    console.warn("core/storage: не удалось прочитать сохранённые настройки —", err.message);
    return null;
  }
}

// Возвращает сохранённые данные секции, или null, если их нет / версия не совпала /
// localStorage недоступен. Вызывающий код в этом случае просто оставляет свои
// дефолтные значения — ничего специально обрабатывать не нужно.
export function loadSection(sectionKey) {
  const data = readAll();
  return data && data[sectionKey] !== undefined ? data[sectionKey] : null;
}

// Записывает секцию немедленно (вызывать сразу при каждом изменении настройки,
// не batch'ить — см. DECISIONS.md). Читает текущее целиком, подменяет одну
// секцию, пишет обратно — так изменение одной тренировки не задевает остальные.
export function saveSection(sectionKey, sectionData) {
  try {
    const current = readAll() || { version: SCHEMA_VERSION };
    current.version = SCHEMA_VERSION;
    current[sectionKey] = sectionData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn("core/storage: не удалось сохранить настройки —", err.message);
  }
}
