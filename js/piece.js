// ============================================================
// PUYOTRIS - piece.js
// The falling piece: a tetromino shape whose 4 cells each carry
// an independently-random puyo color.
// ============================================================
import { SHAPES, PIECE_NAMES, COLS } from './constants.js';
import { randomColor } from './board.js';

const KICKS = [[0,0], [-1,0], [1,0], [-2,0], [2,0], [0,-1]];

export class Piece {
  constructor(type, colors) {
    this.type = type;
    this.rot = 0;
    this.x = Math.floor(COLS / 2) - 2;
    this.y = 0;
    this.colors = colors || Array.from({ length: 4 }, randomColor);
  }

  static random() {
    const type = PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
    return new Piece(type);
  }

  clone() {
    const p = new Piece(this.type, this.colors.slice());
    p.rot = this.rot;
    p.x = this.x;
    p.y = this.y;
    return p;
  }

  cells(rot = this.rot, ox = this.x, oy = this.y) {
    const shape = SHAPES[this.type][((rot % 4) + 4) % 4];
    return shape.map(([dx, dy], i) => ({ x: ox + dx, y: oy + dy, color: this.colors[i] }));
  }

  fits(board, rot, ox, oy) {
    for (const c of this.cells(rot, ox, oy)) {
      if (!board.isInside(c.x, c.y)) return false;
      if (board.grid[c.y][c.x] !== null) return false;
    }
    return true;
  }

  tryMove(board, dx, dy) {
    if (this.fits(board, this.rot, this.x + dx, this.y + dy)) {
      this.x += dx;
      this.y += dy;
      return true;
    }
    return false;
  }

  tryRotate(board, dir) {
    const newRot = this.rot + dir;
    for (const [kx, ky] of KICKS) {
      if (this.fits(board, newRot, this.x + kx, this.y + ky)) {
        this.rot = ((newRot % 4) + 4) % 4;
        this.x += kx;
        this.y += ky;
        return true;
      }
    }
    return false;
  }

  ghostY(board) {
    let gy = this.y;
    while (this.fits(board, this.rot, this.x, gy + 1)) gy++;
    return gy;
  }
}
