// ============================================================
// PUYOTRIS - render.js
// Canvas drawing for one player's play-field, side panel, and
// the "chain marquee" flash banner.
// ============================================================
import { COLORS, GARBAGE_COLOR } from './constants.js';

export class Renderer {
  constructor(canvas, { cell = 26 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cell = cell;
  }

  resize(cols, rows, sidePanelCells = 4) {
    const dpr = window.devicePixelRatio || 1;
    const w = (cols + sidePanelCells) * this.cell;
    const h = rows * this.cell;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;
    this.boardPxW = cols * this.cell;
  }

  _cellColor(v) {
    if (v === 'G') return GARBAGE_COLOR;
    if (typeof v === 'number') return COLORS[v];
    return null;
  }

  drawBlock(x, y, color, { ghost = false, glow = true } = {}) {
    const s = this.cell;
    const px = x * s, py = y * s;
    const ctx = this.ctx;
    if (ghost) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, s - 4, s - 4);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.fillStyle = color;
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
    }
    const r = 5;
    ctx.beginPath();
    ctx.roundRect(px + 1.5, py + 1.5, s - 3, s - 3, r);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.roundRect(px + 4, py + 4, s - 8, (s - 8) * 0.4, 3);
    ctx.fill();
  }

  drawBoard(game, { flash = false } = {}) {
    const ctx = this.ctx;
    const { board } = game;
    ctx.clearRect(0, 0, this.w, this.h);

    ctx.fillStyle = 'rgba(10,13,26,0.9)';
    ctx.fillRect(0, 0, this.boardPxW, this.h);

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= board.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * this.cell, 0);
      ctx.lineTo(x * this.cell, board.rows * this.cell);
      ctx.stroke();
    }
    for (let y = 0; y <= board.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * this.cell);
      ctx.lineTo(board.cols * this.cell, y * this.cell);
      ctx.stroke();
    }

    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        const v = board.grid[y][x];
        if (v !== null) this.drawBlock(x, y, this._cellColor(v));
      }
    }

    if (!game.gameOver) {
      for (const c of game.ghostCells()) {
        this.drawBlock(c.x, c.y, this._cellColor(c.color), { ghost: true });
      }
      for (const c of game.current.cells()) {
        this.drawBlock(c.x, c.y, this._cellColor(c.color));
      }
    }

    if (flash) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(0, 0, this.boardPxW, this.h);
    }

    if (game.gameOver) {
      ctx.fillStyle = 'rgba(5,6,14,0.75)';
      ctx.fillRect(0, 0, this.boardPxW, this.h);
      ctx.fillStyle = '#ff4b6e';
      ctx.font = 'bold 20px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', this.boardPxW / 2, this.h / 2);
      ctx.textAlign = 'left';
    }

    this._drawSidePanel(game);
  }

  _drawMiniPiece(piece, originX, originY, scale = 0.7) {
    const ctx = this.ctx;
    if (!piece) return;
    const cells = piece.cells(0, 0, 0);
    const s = this.cell * scale;
    for (const c of cells) {
      ctx.fillStyle = this._cellColor(c.color);
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(originX + c.x * s, originY + c.y * s, s - 3, s - 3, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  _drawSidePanel(game) {
    const ctx = this.ctx;
    const panelX = this.boardPxW;
    const panelW = this.w - this.boardPxW;
    ctx.fillStyle = 'rgba(15,18,34,0.95)';
    ctx.fillRect(panelX, 0, panelW, this.h);

    ctx.fillStyle = '#8b93b8';
    ctx.font = '11px "Space Grotesk", sans-serif';
    ctx.fillText('HOLD', panelX + 10, 16);
    ctx.fillText('NEXT', panelX + 10, 96);
    this._drawMiniPiece(game.hold, panelX + 14, 26);
    this._drawMiniPiece(game.nextPiece, panelX + 14, 106);

    ctx.fillStyle = '#e8eaf6';
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.fillText('SCORE', panelX + 10, 200);
    ctx.font = '13px "Space Grotesk", sans-serif';
    ctx.fillText(String(game.score), panelX + 10, 218);

    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
    ctx.fillText('LV ' + game.level, panelX + 10, 250);

    if (game.pendingGarbage.length) {
      const total = game.pendingGarbage.reduce((a, g) => a + g.amount, 0);
      ctx.fillStyle = '#ff4b6e';
      ctx.font = 'bold 13px "Space Grotesk", sans-serif';
      ctx.fillText('⚠ +' + total, panelX + 10, 280);
    }
  }

  drawChainBanner(chain) {
    const ctx = this.ctx;
    const cy = this.h * 0.42;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(5,6,14,0.55)';
    ctx.fillRect(0, cy - 26, this.boardPxW, 52);
    ctx.fillStyle = '#ffd23f';
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 14;
    ctx.font = 'bold 26px "Space Grotesk", sans-serif';
    ctx.fillText(chain + ' CHAIN!', this.boardPxW / 2, cy + 9);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}
