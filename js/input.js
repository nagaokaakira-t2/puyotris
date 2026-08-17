// ============================================================
// PUYOTRIS - input.js
// Key-config storage (localStorage) + a per-player input poller
// with DAS/ARR-style repeat for left/right movement.
// ============================================================
import { DEFAULT_KEYS_P1, DEFAULT_KEYS_P2 } from './constants.js';

const STORAGE_KEY = 'puyotris.keybinds.v1';

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getKeymap(playerId) {
  const all = loadAll();
  const fallback = playerId === 'p2' ? DEFAULT_KEYS_P2 : DEFAULT_KEYS_P1;
  if (!all || !all[playerId]) return { ...fallback };
  return { ...fallback, ...all[playerId] };
}

export function setKey(playerId, action, code) {
  const all = loadAll() || {};
  all[playerId] = { ...getKeymap(playerId), [action]: code };
  saveAll(all);
  return all[playerId];
}

export function resetKeymap(playerId) {
  const all = loadAll() || {};
  all[playerId] = playerId === 'p2' ? { ...DEFAULT_KEYS_P2 } : { ...DEFAULT_KEYS_P1 };
  saveAll(all);
  return all[playerId];
}

export function findKeyConflicts() {
  const p1 = getKeymap('p1');
  const p2 = getKeymap('p2');
  const conflicts = [];
  for (const [a1, code1] of Object.entries(p1)) {
    for (const [a2, code2] of Object.entries(p2)) {
      if (code1 === code2) conflicts.push({ code: code1, p1Action: a1, p2Action: a2 });
    }
  }
  return conflicts;
}

const DAS_MS = 150;
const ARR_MS = 40;

export class InputManager {
  constructor(keymap) {
    this.keymap = keymap;
    this.down = new Set();
    this._prevDown = new Set();
    this.dasTimer = { left: 0, right: 0 };
    this.dasActive = { left: false, right: false };
    this._onKeyDown = (e) => {
      if (this._codes().includes(e.code)) e.preventDefault();
      this.down.add(e.code);
    };
    this._onKeyUp = (e) => {
      this.down.delete(e.code);
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _codes() {
    return Object.values(this.keymap);
  }

  updateKeymap(keymap) {
    this.keymap = keymap;
  }

  isDown(action) {
    return this.down.has(this.keymap[action]);
  }

  wasPressed(action) {
    const code = this.keymap[action];
    return this.down.has(code) && !this._prevDown.has(code);
  }

  poll(dt) {
    const fired = [];
    if (this.wasPressed('left')) { fired.push('left'); this.dasTimer.left = 0; this.dasActive.left = false; }
    if (this.wasPressed('right')) { fired.push('right'); this.dasTimer.right = 0; this.dasActive.right = false; }
    if (this.wasPressed('rotateCW')) fired.push('rotateCW');
    if (this.wasPressed('rotateCCW')) fired.push('rotateCCW');
    if (this.wasPressed('hardDrop')) fired.push('hardDrop');
    if (this.wasPressed('hold')) fired.push('hold');
    if (this.isDown('softDrop')) fired.push('softDrop');

    for (const dir of ['left', 'right']) {
      if (this.isDown(dir)) {
        if (!this.wasPressed(dir)) {
          this.dasTimer[dir] += dt;
          const threshold = this.dasActive[dir] ? ARR_MS : DAS_MS;
          if (this.dasTimer[dir] >= threshold) {
            fired.push(dir);
            this.dasTimer[dir] = 0;
            this.dasActive[dir] = true;
          }
        }
      } else {
        this.dasTimer[dir] = 0;
        this.dasActive[dir] = false;
      }
    }

    this._prevDown = new Set(this.down);
    return fired;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
