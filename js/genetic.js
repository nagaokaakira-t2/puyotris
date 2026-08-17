// ============================================================
// PUYOTRIS - genetic.js
// The actual "machine learning" part: a genetic algorithm that
// evolves the AI's heuristic weight vector via self-play.
// Pure logic - imported unmodified by both the browser training
// screen (js/main.js) and the Node.js CLI trainer (tools/train-node.js).
// ============================================================
import { Game } from './game.js';
import { AIController, DEFAULT_WEIGHTS } from './ai.js';

const FEATURE_KEYS = Object.keys(DEFAULT_WEIGHTS);
const WEIGHT_RANGE = 2;

export function randomWeights() {
  const w = {};
  for (const k of FEATURE_KEYS) w[k] = (Math.random() * 2 - 1) * WEIGHT_RANGE;
  return w;
}

export function mutate(weights, rate = 0.2, amount = 0.4) {
  const w = { ...weights };
  for (const k of FEATURE_KEYS) {
    if (Math.random() < rate) w[k] += (Math.random() * 2 - 1) * amount;
  }
  return w;
}

export function crossover(a, b) {
  const w = {};
  for (const k of FEATURE_KEYS) w[k] = Math.random() < 0.5 ? a[k] : b[k];
  return w;
}

export function simulateGame(weights, maxPieces = 300) {
  const game = new Game();
  const controller = new AIController(weights);
  let pieces = 0;
  let ticks = 0;
  const maxTicks = maxPieces * 40;
  while (!game.gameOver && pieces < maxPieces && ticks < maxTicks) {
    const action = controller.nextAction(game.board, game.current);
    game.tick(16, [action]);
    ticks++;
    if (action === 'hardDrop') pieces++;
  }
  return {
    fitness: game.score + pieces * 2,
    score: game.score,
    pieces,
    lines: game.linesTotal,
  };
}

export async function runGeneration(population, { maxPieces = 250, onProgress } = {}) {
  const results = [];
  for (let i = 0; i < population.length; i++) {
    const r = simulateGame(population[i], maxPieces);
    results.push({ weights: population[i], ...r });
    if (onProgress) onProgress(i + 1, population.length);
    await new Promise((res) => setTimeout(res, 0));
  }
  results.sort((a, b) => b.fitness - a.fitness);
  return results;
}

export function nextPopulation(results, size) {
  const eliteCount = Math.max(2, Math.floor(size * 0.2));
  const elites = results.slice(0, eliteCount);
  const next = elites.map((e) => e.weights);
  while (next.length < size) {
    const a = elites[Math.floor(Math.random() * elites.length)].weights;
    const b = elites[Math.floor(Math.random() * elites.length)].weights;
    next.push(mutate(crossover(a, b)));
  }
  return next;
}

export function initialPopulation(size, seedWeights = null) {
  const pop = [];
  if (seedWeights) pop.push({ ...seedWeights });
  while (pop.length < size) pop.push(randomWeights());
  return pop;
}
