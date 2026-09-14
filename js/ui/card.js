// ui/card.js
// «Глупый» компонент: не импортирует core/state.js, всё нужное приходит параметрами
// от вызывающего *-ui.js (см. ARCHITECTURE.md — раньше cardEl читал state.faceStyle/
// state.cardBack напрямую, это было найденной проблемой, здесь уже исправлено).

export function suitColor(suit, faceStyle) {
  if (faceStyle === "4color") {
    if (suit === "hearts") return "#d6455a";
    if (suit === "diamonds") return "#e08a1e";
    if (suit === "clubs") return "#2f9e5b";
    return "#1c1e20";
  }
  if (suit === "hearts" || suit === "diamonds") return "#d6455a";
  return "#1c1e20";
}

export const suitSymbols = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };

export function displayRank(rank) {
  // T — общепринятое обозначение десятки в покерной нотации, не переводим в "10".
  return rank;
}

export function cardEl(card, faceUp, faceStyle, cardBack) {
  const div = document.createElement("div");
  div.className = "card-box";
  if (faceUp) {
    div.classList.add("card-face");
    div.style.color = suitColor(card.suit, faceStyle);
    div.textContent = displayRank(card.rank) + suitSymbols[card.suit];
  } else {
    div.classList.add("back-" + cardBack);
  }
  return div;
}
