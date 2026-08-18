// ============================================================
// PUYOTRIS - main.js
// App shell: screen navigation, key-config UI, the live game
// loop (2P local / vs AI), and the AI training lab.
// ============================================================
import { COLS, ROWS, ACTION_LABELS } from './constants.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { InputManager, getKeymap, setKey, resetKeymap, findKeyConflicts } from './input.js';
import { AIController, DEFAULT_WEIGHTS, updateWeightsTowardChoice } from './ai.js';
import { initialPopulation, runGeneration, nextPopulation, randomWeights } from './genetic.js';

// ---------------------------------------------------------------
// Screen navigation
// ---------------------------------------------------------------
const screens = document.querySelectorAll('.screen');
function showScreen(name) {
  const targetId = 'screen-' + name;
  for (const s of screens) s.hidden = s.id !== targetId;
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-goto]');
  if (!btn) return;
  const dest = btn.dataset.goto;
  if (dest === '2p' || dest === 'vsai' || dest === 'mirror') {
    startGame(dest);
    showScreen('game');
  } else {
    stopGameLoop();
    showScreen(dest);
    if (dest === 'keyconfig') renderKeybindList();
  }
});

showScreen('menu');

// ---------------------------------------------------------------
// Key config screen
// ---------------------------------------------------------------
let currentPlayer = 'p1';

const KEY_LABELS = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Space: 'Space',
};
function keyLabel(code) {
  if (!code) return '---';
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

document.querySelectorAll('.tab-btn').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentPlayer = tab.dataset.player;
    renderKeybindList();
  });
});

document.getElementById('reset-keys-btn').addEventListener('click', () => {
  resetKeymap(currentPlayer);
  renderKeybindList();
});

function renderKeybindList() {
  const list = document.getElementById('keybind-list');
  list.innerHTML = '';
  const keymap = getKeymap(currentPlayer);
  for (const action of Object.keys(ACTION_LABELS)) {
    const li = document.createElement('li');
    li.className = 'keybind-row';
    const label = document.createElement('span');
    label.className = 'action-label';
    label.textContent = ACTION_LABELS[action];
    const btn = document.createElement('button');
    btn.className = 'key-btn';
    btn.textContent = keyLabel(keymap[action]);
    btn.addEventListener('click', () => captureKey(action));
    li.appendChild(label);
    li.appendChild(btn);
    list.appendChild(li);
  }
  renderConflictWarning();
}

function renderConflictWarning() {
  const box = document.getElementById('conflict-warning');
  const conflicts = findKeyConflicts();
  if (conflicts.length === 0) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const lines = conflicts.map(
    (c) => `「${keyLabel(c.code)}」が P1:${ACTION_LABELS[c.p1Action]} と P2:${ACTION_LABELS[c.p2Action]} で重複しています`
  );
  box.textContent = '⚠ ' + lines.join(' / ');
}

function captureKey(action) {
  const overlay = document.getElementById('key-capture-overlay');
  overlay.hidden = false;
  const onKey = (e) => {
    e.preventDefault();
    if (e.code === 'Escape') {
      cleanup();
      return;
    }
    setKey(currentPlayer, action, e.code);
    cleanup();
    renderKeybindList();
  };
  function cleanup() {
    overlay.hidden = true;
    window.removeEventListener('keydown', onKey, true);
  }
  document.getElementById('capture-cancel-btn').onclick = cleanup;
  window.addEventListener('keydown', onKey, true);
}

// ---------------------------------------------------------------
// AI weights loading (fetched default + optional user-trained override)
// ---------------------------------------------------------------
const AI_STORAGE_KEY = 'puyotris.aiweights.v1';
let aiWeights = { ...DEFAULT_WEIGHTS };

(async function loadAIWeights() {
  try {
    const res = await fetch('ai-weights.json', { cache: 'no-store' });
    if (res.ok) aiWeights = { ...aiWeights, ...(await res.json()) };
  } catch {
    /* running from file:// or offline - default weights are fine */
  }
  try {
    const saved = localStorage.getItem(AI_STORAGE_KEY);
    if (saved) aiWeights = { ...aiWeights, ...JSON.parse(saved) };
  } catch { /* ignore corrupt storage */ }
})();

// ---------------------------------------------------------------
// "Mirror AI" weights: an AI that learns YOUR placements online,
// live, while you play against it (see updateWeightsTowardChoice
// in ai.js). Persisted separately from the genetic-algorithm AI's
// weights so the two AIs stay distinct opponents.
// ---------------------------------------------------------------
const MIRROR_STORAGE_KEY = 'puyotris.mirrorweights.v1';

function loadMirrorWeights() {
  try {
    const saved = localStorage.getItem(MIRROR_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore corrupt storage */ }
  return { ...DEFAULT_WEIGHTS };
}

function saveMirrorWeights(weights) {
  try {
    localStorage.setItem(MIRROR_STORAGE_KEY, JSON.stringify(weights));
  } catch { /* storage full/unavailable - learning just won't persist */ }
}

function resetMirrorWeights() {
  const fresh = randomWeights();
  saveMirrorWeights(fresh);
  return fresh;
}

let mirrorWeights = null;
let mirrorUpdateCount = 0;

// ---------------------------------------------------------------
// Game loop (2P local or vs AI)
// ---------------------------------------------------------------
const CELL_SIZE = 24;
const AI_ACTION_INTERVAL_MS = 90;

let rafId = null;
let paused = false;
let lastTs = 0;
let inputs = { p1: null, p2: null };
let games = { p1: null, p2: null };
let renderers = { p1: null, p2: null };
let aiController = null;
let aiTimer = 0;
let currentMode = null;

function stopGameLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (inputs.p1) inputs.p1.destroy();
  if (inputs.p2) inputs.p2.destroy();
  inputs = { p1: null, p2: null };
  document.getElementById('game-overlay').hidden = true;
}

const MODE_TITLES = { '2p': '2人対戦', vsai: 'AI対戦', mirror: '模倣AI対戦' };

function startGame(mode) {
  stopGameLoop();
  currentMode = mode;
  paused = false;
  document.getElementById('game-mode-title').textContent = MODE_TITLES[mode] || '対戦';
  document.getElementById('label-p1').textContent = 'PLAYER 1';
  document.getElementById('label-p2').textContent = mode === '2p' ? 'PLAYER 2' : mode === 'mirror' ? 'MIRROR AI' : 'AI';

  const learnBadge = document.getElementById('learn-badge');
  learnBadge.hidden = mode !== 'mirror';
  mirrorUpdateCount = 0;
  if (mode === 'mirror') {
    mirrorWeights = loadMirrorWeights();
    updateLearnBadge();
  }

  const canvasP1 = document.getElementById('canvas-p1');
  const canvasP2 = document.getElementById('canvas-p2');
  renderers.p1 = new Renderer(canvasP1, { cell: CELL_SIZE });
  renderers.p2 = new Renderer(canvasP2, { cell: CELL_SIZE });
  renderers.p1.resize(COLS, ROWS);
  renderers.p2.resize(COLS, ROWS);

  games.p1 = new Game({
    onAttack: (amt) => games.p2 && games.p2.receiveGarbage(amt),
    onGameOver: () => endMatch('p2'),
    onBeforeLock: mode === 'mirror'
      ? (board, piece) => {
          const before = { ...mirrorWeights };
          updateWeightsTowardChoice(mirrorWeights, board, piece, { rot: piece.rot, x: piece.x });
          const changed = Object.keys(mirrorWeights).some((k) => mirrorWeights[k] !== before[k]);
          if (changed) {
            mirrorUpdateCount++;
            saveMirrorWeights(mirrorWeights);
            updateLearnBadge();
          }
        }
      : undefined,
  });
  games.p2 = new Game({
    onAttack: (amt) => games.p1 && games.p1.receiveGarbage(amt),
    onGameOver: () => endMatch('p1'),
  });

  inputs.p1 = new InputManager(getKeymap('p1'));
  if (mode === '2p') {
    inputs.p2 = new InputManager(getKeymap('p2'));
  } else {
    aiController = new AIController(mode === 'mirror' ? mirrorWeights : aiWeights);
    aiTimer = 0;
  }

  document.getElementById('game-overlay').hidden = true;
  lastTs = 0;
  rafId = requestAnimationFrame(loop);
}

function updateLearnBadge() {
  document.getElementById('learn-badge').textContent = `🧠 学習更新: ${mirrorUpdateCount}回`;
}

document.getElementById('mirror-reset-btn').addEventListener('click', () => {
  mirrorWeights = resetMirrorWeights();
  if (aiController) aiController.weights = mirrorWeights;
  mirrorUpdateCount = 0;
  updateLearnBadge();
});

function endMatch(winner) {
  paused = true;
  const overlay = document.getElementById('game-overlay');
  const title = document.getElementById('overlay-title');
  document.getElementById('mirror-reset-btn').hidden = currentMode !== 'mirror';
  if (currentMode === 'vsai') {
    title.textContent = winner === 'p1' ? 'あなたの勝ち！' : 'AIの勝ち！';
  } else if (currentMode === 'mirror') {
    title.textContent = winner === 'p1' ? 'あなたの勝ち！' : 'ミラーAIの勝ち！';
  } else {
    title.textContent = (winner === 'p1' ? 'PLAYER 1' : 'PLAYER 2') + ' の勝ち！';
  }
  overlay.hidden = false;
}

document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('overlay-resume-btn').addEventListener('click', () => {
  if (games.p1.gameOver || games.p2.gameOver) return; // match already over
  togglePause();
});
document.getElementById('overlay-restart-btn').addEventListener('click', () => startGame(currentMode));

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !document.getElementById('screen-game').hidden) {
    togglePause();
  }
});

function togglePause() {
  paused = !paused;
  const overlay = document.getElementById('game-overlay');
  document.getElementById('overlay-title').textContent = '一時停止';
  document.getElementById('mirror-reset-btn').hidden = currentMode !== 'mirror';
  overlay.hidden = !paused;
  if (!paused) {
    lastTs = 0;
    rafId = requestAnimationFrame(loop);
  }
}

function loop(ts) {
  if (paused) return;
  if (!lastTs) lastTs = ts;
  let dt = ts - lastTs;
  lastTs = ts;
  dt = Math.min(dt, 50); // clamp huge frame gaps (tab switch, etc.)

  const g1 = games.p1, g2 = games.p2;

  if (!g1.gameOver) {
    const fired = inputs.p1.poll(dt);
    g1.tick(dt, fired);
  }

  if (currentMode === '2p') {
    if (!g2.gameOver) {
      const fired = inputs.p2.poll(dt);
      g2.tick(dt, fired);
    }
  } else {
    if (!g2.gameOver) {
      aiTimer += dt;
      const aiActions = [];
      while (aiTimer >= AI_ACTION_INTERVAL_MS) {
        aiTimer -= AI_ACTION_INTERVAL_MS;
        aiActions.push(aiController.nextAction(g2.board, g2.current));
      }
      g2.tick(dt, aiActions);
    }
  }

  const now = performance.now();
  renderers.p1.drawBoard(g1);
  if (g1.lastChain > 1 && now < g1.lastChainFlashUntil) renderers.p1.drawChainBanner(g1.lastChain);
  renderers.p2.drawBoard(g2);
  if (g2.lastChain > 1 && now < g2.lastChainFlashUntil) renderers.p2.drawChainBanner(g2.lastChain);

  if (!g1.gameOver && !g2.gameOver) {
    rafId = requestAnimationFrame(loop);
  }
}

// ---------------------------------------------------------------
// AI Training Lab
// ---------------------------------------------------------------
let trainPopulation = null;
let trainHistory = []; // [{gen, best, avg}]
let trainBestWeights = null;
let trainGenNumber = 0;
let trainBusy = false;

const trainStatusEl = document.getElementById('train-status');
const trainLogEl = document.getElementById('train-log');
const trainGraph = document.getElementById('train-graph');
const trainGraphCtx = trainGraph.getContext('2d');

function ensurePopulation() {
  const size = Math.max(4, Math.min(60, Number(document.getElementById('train-pop').value) || 16));
  if (!trainPopulation || trainPopulation.length !== size) {
    trainPopulation = initialPopulation(size, aiWeights);
    trainHistory = [];
    trainGenNumber = 0;
    trainLogEl.innerHTML = '';
  }
  return size;
}

async function runOneGeneration() {
  if (trainBusy) return;
  trainBusy = true;
  const maxPieces = Math.max(30, Math.min(600, Number(document.getElementById('train-maxpieces').value) || 150));
  ensurePopulation();
  trainGenNumber++;

  const results = await runGeneration(trainPopulation, {
    maxPieces,
    onProgress: (done, total) => {
      trainStatusEl.textContent = `世代 ${trainGenNumber}: 個体 ${done}/${total} を評価中…`;
    },
  });

  const best = results[0];
  const avg = results.reduce((a, r) => a + r.fitness, 0) / results.length;
  trainHistory.push({ gen: trainGenNumber, best: best.fitness, avg });
  trainBestWeights = best.weights;
  trainPopulation = nextPopulation(results, trainPopulation.length);

  const li = document.createElement('li');
  li.textContent = `世代${trainGenNumber}  最高=${best.fitness.toFixed(0)}  平均=${avg.toFixed(0)}  手数=${best.pieces}  ライン=${best.lines}`;
  trainLogEl.prepend(li);

  trainStatusEl.textContent = `世代 ${trainGenNumber} 完了　最高fitness=${best.fitness.toFixed(0)}`;
  drawTrainGraph();
  trainBusy = false;
}

function drawTrainGraph() {
  const ctx = trainGraphCtx;
  const w = trainGraph.width, h = trainGraph.height;
  ctx.clearRect(0, 0, w, h);
  if (trainHistory.length === 0) return;
  const maxVal = Math.max(...trainHistory.map((p) => p.best), 1);
  const pad = 24;
  const plotW = w - pad * 2, plotH = h - pad * 2;
  const stepX = trainHistory.length > 1 ? plotW / (trainHistory.length - 1) : 0;

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, h - pad);
  ctx.stroke();

  function plot(key, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    trainHistory.forEach((p, i) => {
      const x = pad + i * stepX;
      const y = h - pad - (p[key] / maxVal) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  plot('avg', 'rgba(0,229,255,0.6)');
  plot('best', '#ffd23f');

  ctx.fillStyle = '#ffd23f';
  ctx.font = '11px sans-serif';
  ctx.fillText('最高', pad, 14);
  ctx.fillStyle = 'rgba(0,229,255,0.8)';
  ctx.fillText('平均', pad + 40, 14);
}

document.getElementById('train-run-btn').addEventListener('click', runOneGeneration);
document.getElementById('train-run5-btn').addEventListener('click', async () => {
  for (let i = 0; i < 5; i++) await runOneGeneration();
});
document.getElementById('train-save-btn').addEventListener('click', () => {
  if (!trainBestWeights) {
    trainStatusEl.textContent = 'まだ訓練結果がありません。先に世代を実行してください。';
    return;
  }
  localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(trainBestWeights));
  aiWeights = { ...aiWeights, ...trainBestWeights };
  trainStatusEl.textContent = '保存しました。次回の「AI対戦」からこのAIが使われます。';
});
document.getElementById('train-export-btn').addEventListener('click', () => {
  if (!trainBestWeights) {
    trainStatusEl.textContent = 'まだ訓練結果がありません。先に世代を実行してください。';
    return;
  }
  const blob = new Blob([JSON.stringify(trainBestWeights, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ai-weights.json';
  a.click();
  URL.revokeObjectURL(url);
});
