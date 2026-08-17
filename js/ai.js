// ============================================================
// PUYOTRIS - ai.js
// Move search + heuristic evaluation for the AI opponent.
// ============================================================

export const DEFAULT_WEIGHTS = {
  aggregateHeight: -0.51,
  holes: -0.9,
  bumpiness: -0.25,
  maxHeight: -0.3,
  linesCleared: 0.6,
  cellsCleared: 0.35,
  chain: 1.8,
  colorAdjacency: 0.22,
  nearMatch: 0.15,
};

export function extractFeatures(board, clearResult) {
  const heights = board.heights();
  const aggregateHeight = heights.reduce((a, b) => a + b, 0);
  const maxHeight = Math.max(...heights);
  let bumpiness = 0;
  for (let i = 0; i < heights.length - 1; i++) bumpiness += Math.abs(heights[i] - heights[i + 1]);

  let holes = 0;
  for (let x = 0; x < board.cols; x++) {
    let seenBlock = false;
    for (let y = 0; y < board.rows; y++) {
      const c = board.grid[y][x];
      if (c !== null) seenBlock = true;
      else if (seenBlock) holes++;
    }
  }

  let colorAdjacency = 0;
  let nearMatch = 0;
  const groups = board.findColorGroups(2);
  for (const g of groups) {
    if (g.cells.length >= 2) colorAdjacency += g.cells.length;
    if (g.cells.length === 3) nearMatch += 3;
    if (g.cells.length === 2) nearMatch += 1;
  }

  return {
    aggregateHeight,
    holes,
    bumpiness,
    maxHeight,
    linesCleared: clearResult ? clearResult.linesCleared : 0,
    cellsCleared: clearResult ? clearResult.cellsCleared : 0,
    chain: clearResult ? clearResult.chain : 0,
    colorAdjacency,
    nearMatch,
  };
}

export function scoreFeatures(features, weights) {
  let score = 0;
  for (const key in weights) score += (features[key] || 0) * weights[key];
  return score;
}

export function bestMove(board, piece, weights = DEFAULT_WEIGHTS) {
  let best = null;
  for (let rot = 0; rot < 4; rot++) {
    const test = piece.clone();
    test.rot = rot;
    const minShapeX = Math.min(...test.cells(rot, 0, 0).map(c => c.x));
    const maxShapeX = Math.max(...test.cells(rot, 0, 0).map(c => c.x));
    const xMin = -minShapeX;
    const xMax = board.cols - 1 - maxShapeX;

    for (let x = xMin; x <= xMax; x++) {
      if (!test.fits(board, rot, x, 0)) continue;
      let y = 0;
      while (test.fits(board, rot, x, y + 1)) y++;
      if (!test.fits(board, rot, x, y)) continue;

      const sim = board.clone();
      sim.stampPiece(test.cells(rot, x, y));
      if (sim.isToppedOut()) continue;
      const clearResult = sim.resolveClears();
      const features = extractFeatures(sim, clearResult);
      const score = scoreFeatures(features, weights);

      if (!best || score > best.score) {
        best = { rot, x, y, score, features };
      }
    }
  }
  return best;
}

export class AIController {
  constructor(weights = DEFAULT_WEIGHTS) {
    this.weights = weights;
    this.plan = null;
  }

  reset() {
    this.plan = null;
  }

  nextAction(board, piece) {
    if (!this.plan) {
      const move = bestMove(board, piece, this.weights);
      this.plan = move ? { rot: move.rot, x: move.x } : { rot: piece.rot, x: piece.x };
    }
    if (piece.rot !== this.plan.rot) {
      const diff = ((this.plan.rot - piece.rot) + 4) % 4;
      return diff === 3 ? 'rotateCCW' : 'rotateCW';
    }
    if (piece.x < this.plan.x) return 'right';
    if (piece.x > this.plan.x) return 'left';
    this.plan = null;
    return 'hardDrop';
  }
}
