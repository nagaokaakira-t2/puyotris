// ============================================================
// PUYOTRIS - constants.js
// Shared constants: board geometry, colors, piece shapes, keys.
// ============================================================

export const COLS = 8;
export const ROWS = 16;

export const COLORS = [
  null,
  '#ff4b6e', // red
  '#ffd23f', // yellow
  '#3ddc84', // green
  '#4b9eff', // blue
  '#c060ff', // purple
];
export const NUM_COLORS = COLORS.length - 1;
export const GARBAGE_COLOR = '#7a8290';

export const SHAPES = {
  I: [
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]],
  ],
  O: [
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
  ],
  T: [
    [[1,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]],
    [[1,0],[0,1],[1,1],[1,2]],
  ],
  S: [
    [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[1,1],[2,1],[0,2],[1,2]],
    [[0,0],[0,1],[1,1],[1,2]],
  ],
  Z: [
    [[0,0],[1,0],[1,1],[2,1]],
    [[2,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,0],[0,1],[1,1],[0,2]],
  ],
  J: [
    [[0,0],[0,1],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[0,2],[1,2]],
  ],
  L: [
    [[2,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]],
    [[0,0],[1,0],[1,1],[1,2]],
  ],
};
export const PIECE_NAMES = Object.keys(SHAPES);

export const DEFAULT_KEYS_P1 = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  softDrop: 'ArrowDown',
  hardDrop: 'ArrowUp',
  rotateCW: 'KeyX',
  rotateCCW: 'KeyZ',
  hold: 'KeyC',
};

export const DEFAULT_KEYS_P2 = {
  left: 'KeyA',
  right: 'KeyD',
  softDrop: 'KeyS',
  hardDrop: 'KeyW',
  rotateCW: 'KeyE',
  rotateCCW: 'KeyQ',
  hold: 'KeyF',
};

export const ACTION_LABELS = {
  left: '左に移動',
  right: '右に移動',
  softDrop: 'ソフトドロップ',
  hardDrop: 'ハードドロップ',
  rotateCW: '右回転',
  rotateCCW: '左回転',
  hold: 'ホールド',
};

export function gravityMs(level) {
  return Math.max(80, 800 - level * 45);
}

export const LOCK_DELAY_MS = 500;
export const GARBAGE_DELAY_MS = 900;

export function chainPower(chain) {
  if (chain <= 1) return 0;
  const table = [0, 0, 1, 4, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320];
  if (chain < table.length) return table[chain];
  return 320 + (chain - (table.length - 1)) * 32;
}

export function lineAttack(lines) {
  const table = { 0: 0, 1: 0, 2: 1, 3: 2, 4: 4 };
  return table[lines] ?? 4 + (lines - 4) * 2;
}
