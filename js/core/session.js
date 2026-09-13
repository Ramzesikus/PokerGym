// core/session.js
// НЕ извлечено из монолита дословно — спроектировано заново по итогам разбора
// (см. ARCHITECTURE.md, DECISIONS «Игровой цикл: прогресс, счёт, обратная связь»).
// Источник паттерна: updateSessionContext/updatePositionsProgress/updateComboContext
// делали одно и то же (счётчик «X / N» в DOM) в трёх местах; comboState.correctCount/
// answeredCount — единственный существующий пример счёта правильных ответов, но
// реализован вручную, локально для одной тренировки.
//
// Контракт: чистое хранилище состояния сессии, БЕЗ обращений к DOM. Какие именно
// текстовые поля на экране обновлять — решает и делает вызывающий *-ui.js, не этот
// файл. Это то же самое правило чистоты, что и для core/hand-eval.js, core/deck.js.

/**
 * Форма объекта результата одного хода (ActionFeedback), которую принимает recordAnswer:
 * {
 *   trainingId: string,      // id тренировки (outs, positions, combinations, ...)
 *   isCorrect: boolean,      // сошёлся ли ответ
 *   userAnswer: any,         // что ввёл/нажал пользователь
 *   correctAnswer: any       // как было на самом деле
 * }
 * timestamp проставляется автоматически внутри recordAnswer.
 */

export function createSession(totalSteps) {
  return {
    currentStep: 0,
    totalSteps: totalSteps,
    correctAnswers: 0,
    answeredCount: 0,
    log: []
  };
}

// Записывает результат хода, возвращает НОВЫЙ объект состояния (не мутирует
// переданный session) — вызывающий код сам решает, сохранять ли ссылку.
export function recordAnswer(session, feedback) {
  const entry = {
    trainingId: feedback.trainingId,
    isCorrect: !!feedback.isCorrect,
    userAnswer: feedback.userAnswer,
    correctAnswer: feedback.correctAnswer,
    timestamp: Date.now()
  };
  return {
    currentStep: session.currentStep + 1,
    totalSteps: session.totalSteps,
    correctAnswers: session.correctAnswers + (entry.isCorrect ? 1 : 0),
    answeredCount: session.answeredCount + 1,
    log: session.log.concat([entry])
  };
}

export function isSessionComplete(session) {
  return session.currentStep >= session.totalSteps;
}
