// Games that open one by one.
//
// In a topic with `inOrder: true` (js/modules/index.js) only the first game
// is open at the start. Every next one opens once the game before it has been
// passed: a round with at least 80% of the answers right. Once passed, a game
// stays passed, so a worse round later never closes anything again.
//
// The order is that of the topic's games in MODULES; app.js hands it over on
// start, so the round result (js/core/quiz.js) can tell which game it opens.

import { store } from './store.js';

// game id → the game before it / after it in its topic
const previous = new Map();
const following = new Map();

/** Remembers the order of the games of every topic that opens them one by one. */
export function setOrder(topics) {
  for (const topic of topics) {
    if (!topic.inOrder) continue;
    const games = topic.items.filter((module) => module.kind !== 'learn');
    games.slice(1).forEach((game, i) => {
      previous.set(game.id, games[i]);
      following.set(games[i].id, game);
    });
  }
}

/**
 * Right answers a round of `total` needs to pass: 80%, rounded down in the
 * child's favour (6 of 8, 7 of 9). Whole numbers only, so no float error.
 */
export const passMark = (total) => Math.floor((total * 4) / 5);

export const isPassed = (id) => Boolean(store.moduleBest(id)?.passed);

/** The game that has to be passed before this one opens, or null when it is open. */
export function lockedBy(id) {
  const gate = previous.get(id);
  return gate && !isPassed(gate.id) ? gate : null;
}

/**
 * The games to pass, one after another, before this one opens: the first of
 * them is open now. Empty when this game is open itself.
 */
export function gamesBefore(id) {
  const path = [];
  for (let gate = lockedBy(id); gate; gate = lockedBy(gate.id)) path.unshift(gate);
  return path;
}

/** The game this one opens, or null when there is none. */
export const opensNext = (id) => following.get(id) || null;
