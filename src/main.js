import './style.css'

// Audio Context
let audioCtx = null;

async function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  return audioCtx;
}

async function playGlugSound() {
  const ctx = await initAudio();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  // "Pop" or "Bubble" sound
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150 + Math.random() * 100, now);
  osc.frequency.exponentialRampToValueAtTime(300 + Math.random() * 100, now + 0.1);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(400, now);
  filter.Q.setValueAtTime(10, now);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

let pouringBuffer = null;

async function loadPouringSound() {
  if (pouringBuffer) return pouringBuffer;
  const ctx = await initAudio();
  try {
    const response = await fetch('sounds/pouring.mp3');
    const arrayBuffer = await response.arrayBuffer();
    pouringBuffer = await ctx.decodeAudioData(arrayBuffer);
    return pouringBuffer;
  } catch (e) {
    console.error('Failed to load pouring sound:', e);
    return null;
  }
}

async function playPouringSound(duration) {
  const ctx = await initAudio();
  if (!ctx || ctx.state !== 'running') return;

  const buffer = await loadPouringSound();
  if (!buffer) return;

  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
  gain.gain.setValueAtTime(0.4, now + duration - 0.1);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  source.connect(gain);
  gain.connect(ctx.destination);

  source.start(now);
  source.stop(now + duration);
}

async function playWinSound() {
  const ctx = await initAudio();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + i * 0.1);

    gain.gain.setValueAtTime(0.1, now + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + i * 0.1);
    osc.stop(now + i * 0.1 + 0.5);
  });
}

function spawnWinParticles() {
  const colors = COLORS;
  for (let i = 0; i < 50; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = Math.random() * 100 + 'vw';
    p.style.top = '100vh';
    p.style.setProperty('--tx', (Math.random() - 0.5) * 200 + 'px');
    p.style.setProperty('--ty', -(Math.random() * 500 + 500) + 'px');
    p.style.setProperty('--rot', Math.random() * 360 + 'deg');
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2000);
  }
}

// Game Constants
const JAR_CAPACITY = 4;
const COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Yellow
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

// Game State
let state = {
  level: 1,
  jars: [], // Array of arrays: [[color, color], [color]]
  selectedJarIndex: null,
  history: [],
  isAnimating: false
};

// DOM Elements
const gameContainer = document.getElementById('game-container');
const levelNumEl = document.getElementById('level-num');
const undoBtn = document.getElementById('undo-btn');
const restartBtn = document.getElementById('restart-btn');
const addJarBtn = document.getElementById('add-jar-btn');
const nextLevelBtn = document.getElementById('next-level-btn');
const winOverlay = document.getElementById('win-overlay');
const adOverlay = document.getElementById('ad-overlay');
const watchAdBtn = document.getElementById('watch-ad-btn');
const cancelAdBtn = document.getElementById('cancel-ad-btn');
const adPrompt = document.getElementById('ad-prompt');
const adContent = document.getElementById('ad-content');
const adTimer = document.getElementById('ad-timer');
const progressFill = document.getElementById('progress-fill');

// Initialize Game
function init() {
  const savedLevel = localStorage.getItem('chroma_pour_level');
  const savedJars = localStorage.getItem('chroma_pour_jars');

  if (savedLevel) {
    state.level = parseInt(savedLevel);
    if (savedJars) {
      state.jars = JSON.parse(savedJars);
      levelNumEl.textContent = state.level;
      render();

      // If they left on a win screen, show it again
      if (checkWin()) {
        winOverlay.classList.remove('hidden');
      }
    } else {
      setupLevel(state.level);
    }
  } else {
    setupLevel(state.level);
  }

  undoBtn.addEventListener('click', undo);
  restartBtn.addEventListener('click', () => setupLevel(state.level));
  addJarBtn.addEventListener('click', () => {
    if (state.isAnimating) return;
    adOverlay.classList.remove('hidden');
    adPrompt.classList.remove('hidden');
    adContent.classList.add('hidden');
  });
  nextLevelBtn.addEventListener('click', nextLevel);

  watchAdBtn.addEventListener('click', startAdFlow);
  cancelAdBtn.addEventListener('click', () => adOverlay.classList.add('hidden'));
}

function setupLevel(level) {
  state.level = level;
  levelNumEl.textContent = level;
  state.jars = generateLevel(level);
  state.history = [];
  state.selectedJarIndex = null;
  state.isAnimating = false;
  winOverlay.classList.add('hidden');

  // Save progress
  localStorage.setItem('chroma_pour_level', state.level);
  localStorage.setItem('chroma_pour_jars', JSON.stringify(state.jars));

  render();
}

function generateLevel(level) {
  const colorCount = Math.min(3 + Math.floor(level / 2), COLORS.length);
  const activeColors = COLORS.slice(0, colorCount);

  // Start with solved state
  const jars = activeColors.map(color => Array(JAR_CAPACITY).fill(color));

  // Add 2 empty jars
  jars.push([]);
  jars.push([]);

  // Shuffle by performing reverse moves
  const shuffleMoves = 30 + (level * 5);
  for (let i = 0; i < shuffleMoves; i++) {
    const fromIdx = Math.floor(Math.random() * jars.length);
    if (jars[fromIdx].length === 0) continue;

    const toIdx = Math.floor(Math.random() * jars.length);
    if (fromIdx === toIdx || jars[toIdx].length === JAR_CAPACITY) continue;

    const color = jars[fromIdx].pop();
    jars[toIdx].push(color);
  }

  return jars;
}

function render() {
  gameContainer.innerHTML = '';
  state.jars.forEach((colors, index) => {
    const jarEl = document.createElement('div');
    jarEl.className = `jar ${state.selectedJarIndex === index ? 'selected' : ''}`;
    jarEl.dataset.index = index;

    // Create liquid layers
    colors.forEach(color => {
      const liquidEl = document.createElement('div');
      liquidEl.className = 'liquid';
      liquidEl.style.backgroundColor = color;
      liquidEl.style.height = `${100 / JAR_CAPACITY}%`;
      jarEl.appendChild(liquidEl);
    });

    jarEl.addEventListener('click', () => handleJarClick(index));
    gameContainer.appendChild(jarEl);
  });
}

async function handleJarClick(index) {
  await initAudio();
  if (state.isAnimating) return;

  const currentJar = state.jars[index];

  // If no jar is selected
  if (state.selectedJarIndex === null) {
    if (currentJar.length === 0) return; // Can't select empty jar
    state.selectedJarIndex = index;
    render();
  }
  // If a jar is already selected
  else {
    const fromIndex = state.selectedJarIndex;
    const toIndex = index;

    if (fromIndex === toIndex) {
      state.selectedJarIndex = null;
      render();
      return;
    }

    if (canPour(fromIndex, toIndex)) {
      await performPour(fromIndex, toIndex);
    } else {
      // Invalid move, shake animation? or just deselect
      state.selectedJarIndex = index;
      if (state.jars[index].length === 0) state.selectedJarIndex = null;
      render();
    }
  }
}

function canPour(fromIndex, toIndex) {
  const fromJar = state.jars[fromIndex];
  const toJar = state.jars[toIndex];

  if (fromJar.length === 0) return false;
  if (toJar.length === JAR_CAPACITY) return false;

  const colorToPour = fromJar[fromJar.length - 1];
  const targetTopColor = toJar[toJar.length - 1];

  // Target must be empty OR top color must match
  return toJar.length === 0 || targetTopColor === colorToPour;
}

async function performPour(fromIndex, toIndex) {
  state.isAnimating = true;
  saveHistory();

  const fromJar = state.jars[fromIndex];
  const toJar = state.jars[toIndex];
  const colorToPour = fromJar[fromJar.length - 1];

  // How many layers of the same color can we pour?
  let layersToMove = 0;
  for (let i = fromJar.length - 1; i >= 0; i--) {
    if (fromJar[i] === colorToPour && toJar.length + layersToMove < JAR_CAPACITY) {
      layersToMove++;
    } else {
      break;
    }
  }

  const fromEl = document.querySelector(`.jar[data-index="${fromIndex}"]`);
  const toEl = document.querySelector(`.jar[data-index="${toIndex}"]`);

  // Calculate relative position for animation
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();

  const isPouringRight = toRect.left > fromRect.left;
  const rotation = isPouringRight ? 80 : -80;

  // Alignment logic: 
  // If pouring right, we want the top-right of the source to align with its new pos
  // If pouring left, we want the top-left of the source to align
  let deltaX, deltaY;
  const jarWidth = fromRect.width;

  if (isPouringRight) {
    fromEl.style.transformOrigin = 'top right';
    deltaX = (toRect.left + toRect.width / 2) - fromRect.right;
  } else {
    fromEl.style.transformOrigin = 'top left';
    deltaX = (toRect.left + toRect.width / 2) - fromRect.left;
  }
  deltaY = toRect.top - fromRect.top - 60;

  // 1. Move and Tilt
  fromEl.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
  fromEl.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotation}deg)`;
  fromEl.style.zIndex = '100';

  await new Promise(r => setTimeout(r, 600));

  // 2. Add Stream
  const stream = document.createElement('div');
  stream.className = 'stream';
  stream.style.color = colorToPour;
  stream.style.setProperty('--stream-height', '60');
  if (isPouringRight) {
    stream.style.right = '0';
  } else {
    stream.style.left = '0';
  }
  fromEl.appendChild(stream);

  // Play continuous pouring sound for the duration of the transfer
  const pouringDuration = layersToMove * 0.3 + 0.2;
  playPouringSound(pouringDuration);

  // 3. Pour layers
  for (let i = 0; i < layersToMove; i++) {
    const color = fromJar.pop();
    toJar.push(color);
    render();

    // Maintain the transform after render
    const newFromEl = document.querySelector(`.jar[data-index="${fromIndex}"]`);
    newFromEl.style.transformOrigin = isPouringRight ? 'top right' : 'top left';
    newFromEl.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${rotation}deg)`;
    newFromEl.style.zIndex = '100';
    newFromEl.appendChild(stream);

    playGlugSound();
    await new Promise(r => setTimeout(r, 300));
  }

  // 4. Cleanup
  stream.remove();
  const finalFromEl = document.querySelector(`.jar[data-index="${fromIndex}"]`);
  finalFromEl.style.transform = '';
  await new Promise(r => setTimeout(r, 500));

  state.selectedJarIndex = null;
  state.isAnimating = false;

  // Save progress after each pour
  localStorage.setItem('chroma_pour_jars', JSON.stringify(state.jars));

  render();

  if (checkWin()) {
    spawnWinParticles();
    playWinSound();
    setTimeout(() => {
      winOverlay.classList.remove('hidden');
    }, 500);
  }
}

function checkWin() {
  return state.jars.every(jar => {
    if (jar.length === 0) return true;
    if (jar.length !== JAR_CAPACITY) return false;
    const firstColor = jar[0];
    return jar.every(c => c === firstColor);
  });
}

function saveHistory() {
  state.history.push(JSON.stringify(state.jars));
  if (state.history.length > 20) state.history.shift();
}

function undo() {
  if (state.history.length === 0 || state.isAnimating) return;
  const lastState = state.history.pop();
  state.jars = JSON.parse(lastState);
  state.selectedJarIndex = null;
  localStorage.setItem('chroma_pour_jars', JSON.stringify(state.jars));
  render();
}

async function startAdFlow() {
  adPrompt.classList.add('hidden');
  adContent.classList.remove('hidden');

  let secondsLeft = 5;
  adTimer.textContent = secondsLeft;
  progressFill.style.width = '0%';

  const startTime = Date.now();
  const duration = 5000;

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      progressFill.style.width = `${progress}%`;

      const newSeconds = Math.ceil((duration - elapsed) / 1000);
      if (newSeconds !== secondsLeft && newSeconds >= 0) {
        secondsLeft = newSeconds;
        adTimer.textContent = secondsLeft;
      }

      if (elapsed >= duration) {
        clearInterval(interval);
        adOverlay.classList.add('hidden');
        confirmAddJar();
        resolve();
      }
    }, 50);
  });
}

function confirmAddJar() {
  // Ensure we don't exceed help limits
  const baseJarCount = Math.min(3 + Math.floor(state.level / 2), COLORS.length) + 2;
  if (state.jars.length >= baseJarCount + 2) {
    alert("You already have maximum extra help!");
    return;
  }

  saveHistory();
  state.jars.push([]);
  localStorage.setItem('chroma_pour_jars', JSON.stringify(state.jars));
  render();
}

async function nextLevel() {
  const nextLevelNum = state.level + 1;

  // Show interstitial ad every 2 levels (2, 4, 6, etc.)
  if (state.level % 2 === 0) {
    adOverlay.classList.remove('hidden');
    adPrompt.classList.add('hidden');
    adContent.classList.remove('hidden');

    // Update text for interstitial
    const statusText = adContent.querySelector('.ad-status');
    const originalStatus = statusText.textContent;
    statusText.textContent = "Loading next challenge...";

    await startAdFlow(false); // false means don't add a jar

    statusText.textContent = originalStatus; // Reset for jar ads
  }

  setupLevel(nextLevelNum);
}

// Start
init();
