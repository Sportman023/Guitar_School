// Players and their progress, kept in the browser (localStorage).
//
// Several children can share one device: each player has a name, an avatar
// and their own stars, results, settings and guitar. Nothing leaves the
// device — there is no server.
//
// Who is playing right now lives in sessionStorage, so every fresh launch of
// the app starts with the "who is playing?" screen, while a page reload
// keeps the current player.

import { DEFAULT_GUITAR, sanitizeGuitar, unlockedBetween } from '../data/guitar.js';
import { IS_BETA } from './env.js';

// the beta keeps its own players, so trying it never touches the children's stars
const SUFFIX = IS_BETA ? '-beta' : '';
const KEY = `gitar-school-v2${SUFFIX}`;
const SESSION_KEY = `gitar-school-player${SUFFIX}`;
// beta players start rich, so the whole workshop can be tried right away
const START_STARS = IS_BETA ? 9000 : 0;

const emptyProgress = () => ({
  stars: START_STARS,
  modules: {},
  notes: {},
  settings: {},
  guitar: { ...DEFAULT_GUITAR },
  // stars the player had when they last opened the guitar workshop:
  // anything unlocked above that is shown as "new"
  workshopSeen: 0,
});

const emptyRoot = () => ({ profiles: [], progress: {} });

let root = loadRoot();
let currentId = loadSession();
const listeners = new Set();
const unlockListeners = new Set();

if (currentId && !root.profiles.some((p) => p.id === currentId)) currentId = null;

function loadRoot() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || !Array.isArray(raw.profiles)) return emptyRoot();
    return { profiles: raw.profiles, progress: raw.progress || {} };
  } catch {
    return emptyRoot();
  }
}

function saveRoot() {
  try {
    localStorage.setItem(KEY, JSON.stringify(root));
  } catch {
    /* private mode or storage is full — keep working in memory */
  }
}

function loadSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function saveSession() {
  try {
    if (currentId) sessionStorage.setItem(SESSION_KEY, currentId);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* not critical: the player will just be asked again */
  }
}

/** Progress of a player, filled with defaults for anything missing. */
function progressOf(id) {
  const saved = root.progress[id] || {};
  const base = emptyProgress();
  return {
    ...base,
    ...saved,
    modules: { ...saved.modules },
    notes: { ...saved.notes },
    settings: { ...saved.settings },
    guitar: sanitizeGuitar(saved.guitar, saved.stars || 0),
  };
}

// The object handed out as store.state; replaced on every change.
let state = currentId ? progressOf(currentId) : emptyProgress();

function emit() {
  for (const fn of listeners) fn(state);
}

function commit() {
  if (!currentId) return;
  root.progress[currentId] = state;
  saveRoot();
  emit();
}

function newId() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const store = {
  /** Progress of the current player (an empty one when nobody is selected). */
  get state() {
    return state;
  },

  subscribe(fn) {
    listeners.add(fn);
    fn(state);
    return () => listeners.delete(fn);
  },

  /** Called with the list of newly unlocked guitar items after a round. */
  onUnlock(fn) {
    unlockListeners.add(fn);
    return () => unlockListeners.delete(fn);
  },

  // ---------- Players ----------

  /** All players with their stars and guitar, for the "who is playing?" screen. */
  get players() {
    return root.profiles.map((profile) => {
      const progress = progressOf(profile.id);
      return { ...profile, stars: progress.stars, guitar: progress.guitar };
    });
  },

  get player() {
    return root.profiles.find((p) => p.id === currentId) || null;
  },

  addPlayer({ name, avatar }) {
    const profile = { id: newId(), name, avatar, createdAt: Date.now() };
    root.profiles.push(profile);
    root.progress[profile.id] = emptyProgress();
    saveRoot();
    this.selectPlayer(profile.id);
    return profile;
  },

  updatePlayer(id, { name, avatar }) {
    const profile = root.profiles.find((p) => p.id === id);
    if (!profile) return;
    Object.assign(profile, { name, avatar });
    saveRoot();
    emit();
  },

  removePlayer(id) {
    root.profiles = root.profiles.filter((p) => p.id !== id);
    delete root.progress[id];
    saveRoot();
    if (currentId === id) this.signOut();
    else emit();
  },

  selectPlayer(id) {
    currentId = root.profiles.some((p) => p.id === id) ? id : null;
    state = currentId ? progressOf(currentId) : emptyProgress();
    saveSession();
    emit();
  },

  signOut() {
    this.selectPlayer(null);
  },

  // ---------- Settings ----------

  /** Settings like "coloured note heads". */
  setting(key, fallback) {
    return state.settings?.[key] ?? fallback;
  },

  setSetting(key, value) {
    state = { ...state, settings: { ...state.settings, [key]: value } };
    commit();
  },

  // ---------- Results ----------

  /** End of a game round: keep the best score and add the stars. */
  finishRound(moduleId, { score, total }) {
    const prev = state.modules[moduleId] || { best: 0, rounds: 0, lastScore: 0 };
    const before = state.stars || 0;
    const after = before + score;
    state = {
      ...state,
      stars: after,
      modules: {
        ...state.modules,
        [moduleId]: {
          best: Math.max(prev.best || 0, score),
          rounds: (prev.rounds || 0) + 1,
          lastScore: score,
          total,
        },
      },
    };
    commit();

    const unlocked = unlockedBetween(before, after);
    if (unlocked.length) for (const fn of unlockListeners) fn(unlocked);
  },

  /** Per-note statistics — to see which notes are already learned. */
  recordAnswer(noteId, isCorrect) {
    const prev = state.notes[noteId] || { right: 0, wrong: 0 };
    const next = isCorrect ? { ...prev, right: prev.right + 1 } : { ...prev, wrong: prev.wrong + 1 };
    state = { ...state, notes: { ...state.notes, [noteId]: next } };
    commit();
  },

  moduleBest(moduleId) {
    return state.modules[moduleId] || null;
  },

  // ---------- Guitar ----------

  setGuitar(patch) {
    state = { ...state, guitar: sanitizeGuitar({ ...state.guitar, ...patch }, state.stars) };
    commit();
  },

  markWorkshopSeen() {
    if (state.workshopSeen === state.stars) return;
    state = { ...state, workshopSeen: state.stars };
    commit();
  },

  /** Clears the current player's stars, results and guitar; the player stays. */
  reset() {
    state = emptyProgress();
    commit();
  },

  /** The same for any player — from the "edit player" form, where parents are. */
  resetPlayer(id) {
    if (id === currentId) return this.reset();
    if (!root.profiles.some((profile) => profile.id === id)) return;
    root.progress[id] = emptyProgress();
    saveRoot();
    emit();
  },
};
