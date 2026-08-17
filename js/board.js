// ============================================================
// PUYOTRIS - board.js
// Pure game-logic board: no DOM/canvas dependency, so it can be
// reused by the browser UI, the AI, and the Node.js AI trainer.
// ============================================================
import { COLS, ROWS, NUM_COLORS, GARBAGE_COLOR } from './constants.js';

export class Board {
  constructor(cols = COLS, rows = ROWS) {
    this.cols = cols;
    this.rows = rows;
    this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  }

  clone() {
    const b = new Board(this.cols, this.rows);
    b.grid = this.grid.map(row => row.slice());
    return b;
  }

  isInside(x, y) {
    return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
  }

  isEmpty(x, y) {
    if (!this.isInside(x, y)) return false;
    return this.grid[y][x] === null;
  }

  cellAt(x, y) {
    if (!this.isInside(x, y)) return undefined;
    return this.grid[y][x];
  }

  set(x, y, val) {
    if (this.isInside(x, y)) this.grid[y][x] = val;
  }

  stampPiece(cells) {
    for (const c of cells) this.set(c.x, c.y, c.color);
  }

  applyGravity() {
    let moved = false;
    for (let x = 0; x < this.cols; x++) {
      const stack = [];
      for (let y = 0; y < this.rows; y++) {
        if (this.grid[y][x] !== null) stack.push(this.grid[y][x]);
      }
      const newCol = Array(this.rows - stack.length).fill(null).concat(stack);
      for (let y = 0; y < this.rows; y++) {
        if (this.grid[y][x] !== newCol[y]) moved = true;
        this.grid[y][x] = newCol[y];
      }
    }
    return moved;
  }

  findFullRows() {
    const rows = [];
    for (let y = 0; y < this.rows; y++) {
      if (this.grid[y].every(c => c !== null)) rows.push(y);
    }
    return rows;
  }

  clearRows(rowIndices) {
    for (const y of rowIndices) {
      for (let x = 0; x < this.cols; x++) this.grid[y][x] = null;
    }
  }

  findColorGroups(minSize = 4) {
    const seen = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    const groups = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const color = this.grid[y][x];
        if (color === null || color === 'G' || seen[y][x]) continue;
        const stack = [[x, y]];
        const cells = [];
        seen[y][x] = true;
        while (stack.length) {
          const [cx, cy] = stack.pop();
          cells.push([cx, cy]);
          const neighbors = [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
          for (const [nx, ny] of neighbors) {
            if (!this.isInside(nx, ny) || seen[ny][nx]) continue;
            if (this.grid[ny][nx] === color) {
              seen[ny][nx] = true;
              stack.push([nx, ny]);
            }
          }
        }
        if (cells.length >= minSize) groups.push({ color, cells });
      }
    }
    return groups;
  }

  clearColorGroups(groups) {
    const toClear = new Set();
    for (const g of groups) for (const [x, y] of g.cells) toClear.add(`${x},${y}`);
    for (const key of Array.from(toClear)) {
      const [x, y] = key.split(',').map(Number);
      for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
        if (this.isInside(nx, ny) && this.grid[ny][nx] === 'G') {
          toClear.add(`${nx},${ny}`);
        }
      }
    }
    for (const key of toClear) {
      const [x, y] = key.split(',').map(Number);
      this.grid[y][x] = null;
    }
    return toClear;
  }

  // cellsCleared is de-duplicated so a cell that is both part of a full
  // row AND a matched color group in the same pass is only counted once.
  resolveClears() {
    let chain = 0;
    let linesCleared = 0;
    let cellsCleared = 0;
    for (;;) {
      const fullRows = this.findFullRows();
      const groups = this.findColorGroups(4);
      if (fullRows.length === 0 && groups.length === 0) break;
      chain++;
      const clearedThisPass = new Set();
      if (fullRows.length) {
        linesCleared += fullRows.length;
        for (const y of fullRows) for (let x = 0; x < this.cols; x++) clearedThisPass.add(`${x},${y}`);
        this.clearRows(fullRows);
      }
      if (groups.length) {
        for (const key of this.clearColorGroups(groups)) clearedThisPass.add(key);
      }
      cellsCleared += clearedThisPass.size;
      this.applyGravity();
    }
    return { chain, linesCleared, cellsCleared };
  }

  addGarbageRows(count) {
    if (count <= 0) return;
    for (let i = 0; i < count; i++) {
      this.grid.shift();
      const gapX = Math.floor(Math.random() * this.cols);
      const row = Array(this.cols).fill('G');
      row[gapX] = null;
      this.grid.push(row);
    }
  }

  heights() {
    const h = Array(this.cols).fill(0);
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        if (this.grid[y][x] !== null) { h[x] = this.rows - y; break; }
      }
    }
    return h;
  }

  isToppedOut(spawnRowsFromTop = 2) {
    for (let y = 0; y < spawnRowsFromTop; y++) {
      if (this.grid[y].some(c => c !== null)) return true;
    }
    return false;
  }
}

export function randomColor() {
  return 1 + Math.floor(Math.random() * NUM_COLORS);
}

export { GARBAGE_COLOR };
