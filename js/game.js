// ============================================================
// PUYOTRIS - game.js
// One player's live game session. Framework-agnostic: caller
// drives it with tick(dtMs, actions) from a render loop (browser)
// or a fixed-step loop (Node.js AI trainer / headless sim).
// ============================================================
import { Board } from './board.js';
import { Piece } from './piece.js';
import { gravityMs, LOCK_DELAY_MS, GARBAGE_DELAY_MS, chainPower, lineAttack, PIECE_NAMES } from './constants.js';

function shuffledBag() {
  const bag = [...PIECE_NAMES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export class Game {
  constructor({ onAttack, onGameOver, onLock, onChain } = {}) {
    this.board = new Board();
    this.bag = shuffledBag();
    this.queue = [Piece.random(), Piece.random(), Piece.random()];
    this.current = this._drawPiece();
    this.hold = null;
    this.holdUsed = false;
    this.score = 0;
    this.level = 1;
    this.linesTotal = 0;
    this.gravityAcc = 0;
    this.lockAcc = 0;
    this.isLocking = false;
    this.gameOver = false;
    this.lastChain = 0;
    this.lastChainFlashUntil = 0;
    this.pendingGarbage = [];
    this.softDropHeld = false;

    this.onAttack = onAttack || (() => {});
    this.onGameOver = onGameOver || (() => {});
    this.onLock = onLock || (() => {});
    this.onChain = onChain || (() => {});
    this._clock = 0;
  }

  _drawPiece() {
    if (this.bag.length === 0) this.bag = shuffledBag();
    const next = this.queue.shift();
    this.queue.push(new Piece(this.bag.pop()));
    return next;
  }

  get nextPiece() {
    return this.queue[0];
  }

  applyAction(action) {
    if (this.gameOver) return;
    const p = this.current;
    switch (action) {
      case 'left': p.tryMove(this.board, -1, 0); break;
      case 'right': p.tryMove(this.board, 1, 0); break;
      case 'rotateCW': p.tryRotate(this.board, 1); break;
      case 'rotateCCW': p.tryRotate(this.board, -1); break;
      case 'softDrop':
        if (p.tryMove(this.board, 0, 1)) { this.score += 1; this.gravityAcc = 0; }
        break;
      case 'hardDrop': {
        let dist = 0;
        while (p.tryMove(this.board, 0, 1)) dist++;
        this.score += dist * 2;
        this._lockPiece();
        break;
      }
      case 'hold': this._swapHold(); break;
      default: break;
    }
  }

  _swapHold() {
    if (this.holdUsed) return;
    this.holdUsed = true;
    const cur = this.current;
    cur.rot = 0; cur.x = Math.floor(this.board.cols / 2) - 2; cur.y = 0;
    if (this.hold) {
      const swapped = this.hold;
      swapped.rot = 0; swapped.x = cur.x; swapped.y = 0;
      this.hold = new Piece(cur.type, cur.colors);
      this.current = swapped;
    } else {
      this.hold = new Piece(cur.type, cur.colors);
      this.current = this._drawPiece();
    }
    this.gravityAcc = 0;
    this.lockAcc = 0;
    this.isLocking = false;
  }

  _lockPiece() {
    this.board.stampPiece(this.current.cells());
    this.onLock();
    const result = this.board.resolveClears();
    this.linesTotal += result.linesCleared;
    this.level = 1 + Math.floor(this.linesTotal / 10);

    if (result.chain > 0) {
      const base = lineAttack(result.linesCleared) + chainPower(result.chain);
      this.score += result.cellsCleared * 10 * Math.max(1, result.chain);
      if (base > 0) this.onAttack(base);
      if (result.chain > 1) {
        this.lastChain = result.chain;
        this.lastChainFlashUntil = this._clock + 1400;
        this.onChain(result.chain);
      }
    }

    this.pendingGarbage = this.pendingGarbage.filter(g => {
      if (g.readyAt <= this._clock) {
        this.board.addGarbageRows(g.amount);
        return false;
      }
      return true;
    });

    this.holdUsed = false;
    this.gravityAcc = 0;
    this.lockAcc = 0;
    this.isLocking = false;
    this.current = this._drawPiece();

    if (!this.current.fits(this.board, 0, this.current.x, this.current.y) || this.board.isToppedOut()) {
      this.gameOver = true;
      this.onGameOver();
    }
  }

  receiveGarbage(amount) {
    if (amount <= 0) return;
    this.pendingGarbage.push({ amount, readyAt: this._clock + GARBAGE_DELAY_MS });
  }

  tick(dt, actions = []) {
    if (this.gameOver) return;
    this._clock += dt;
    for (const a of actions) this.applyAction(a);
    if (this.gameOver) return;

    const p = this.current;
    const grav = gravityMs(this.level);
    this.gravityAcc += dt;

    const canFall = p.fits(this.board, p.rot, p.x, p.y + 1);
    if (!canFall) {
      this.isLocking = true;
      this.lockAcc += dt;
      if (this.lockAcc >= LOCK_DELAY_MS) {
        this._lockPiece();
      }
    } else {
      this.isLocking = false;
      this.lockAcc = 0;
      if (this.gravityAcc >= grav) {
        this.gravityAcc = 0;
        p.tryMove(this.board, 0, 1);
      }
    }
  }

  ghostCells() {
    const gy = this.current.ghostY(this.board);
    return this.current.cells(this.current.rot, this.current.x, gy);
  }
}
