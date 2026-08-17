#!/usr/bin/env node
// ============================================================
// PUYOTRIS - tools/train-node.js
// Offline AI trainer (headless genetic algorithm).
// Usage: node tools/train-node.js [populationSize] [generations] [maxPieces]
// Writes the best weight vector to ai-weights.json at project root.
// ============================================================
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initialPopulation, runGeneration, nextPopulation } from '../js/genetic.js';
import { DEFAULT_WEIGHTS } from '../js/ai.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const POP_SIZE = Number(process.argv[2]) || 24;
const GENERATIONS = Number(process.argv[3]) || 30;
const MAX_PIECES = Number(process.argv[4]) || 300;

console.log(`PUYOTRIS AI trainer  (population=${POP_SIZE}, generations=${GENERATIONS}, maxPieces=${MAX_PIECES})`);
console.log('-------------------------------------------------------------');

let population = initialPopulation(POP_SIZE, DEFAULT_WEIGHTS);
let best = null;

for (let gen = 1; gen <= GENERATIONS; gen++) {
  const started = Date.now();
  const results = await runGeneration(population, { maxPieces: MAX_PIECES });
  const top = results[0];
  if (!best || top.fitness > best.fitness) best = top;
  const avg = results.reduce((a, r) => a + r.fitness, 0) / results.length;
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `世代 ${String(gen).padStart(3)}/${GENERATIONS}  best=${top.fitness.toFixed(0).padStart(6)}  avg=${avg.toFixed(0).padStart(6)}  pieces=${top.pieces}  lines=${top.lines}  (${secs}s)`
  );
  population = nextPopulation(results, POP_SIZE);
}

const outPath = join(__dirname, '..', 'ai-weights.json');
writeFileSync(outPath, JSON.stringify(best.weights, null, 2) + '\n');

console.log('-------------------------------------------------------------');
console.log(`ベスト fitness=${best.fitness.toFixed(0)} (score=${best.score}, pieces=${best.pieces}, lines=${best.lines})`);
console.log(`保存しました -> ${outPath}`);
console.log(best.weights);
