// ==============================
// Toy Store Tussle — app.js
// ==============================

// ====== Toys, Colors, and Sliced Icon Files ======
const TOYS   = ["Robot","Dino","Car","Doll","Puzzle","Ball"];           // rows (top→bottom)
const COLORS = ["Orange","Red","Yellow","Green","Blue","Purple"];       // UI / column order

// Files live at: assets/sliced/_0000_Robot_Orange.png … _0035_Ball_Purple.png
// Folder index order (by color column):
// Orange: 0000..0005, Red: 0006..0011, Yellow: 0012..0017, Green: 0018..0023, Blue: 0024..0029, Purple: 0030..0035
const ICON_DIR = "./assets/sliced";
const ICON_EXT = ".png";

// Base index for each color column in your folder
const COLOR_BASE = {
  Orange: 0,
  Red:    6,
  Yellow: 12,
  Green:  18,
  Blue:   24,
  Purple: 30
};

// Per-color toy order — after your rename, all columns use the same order:
const TOY_ORDER_BY_COLOR = {
  Orange: ["Robot","Dino","Car","Doll","Puzzle","Ball"],
  Red:    ["Robot","Dino","Car","Doll","Puzzle","Ball"],
  Yellow: ["Robot","Dino","Car","Doll","Puzzle","Ball"],
  Green:  ["Robot","Dino","Car","Doll","Puzzle","Ball"],
  Blue:   ["Robot","Dino","Car","Doll","Puzzle","Ball"],
  Purple: ["Robot","Dino","Car","Doll","Puzzle","Ball"]
};

function indexFor(toy, color) {
  const base = COLOR_BASE[color];
  const order = TOY_ORDER_BY_COLOR[color];
  if (base == null || !order) return -1;
  const pos = order.indexOf(toy);
  if (pos < 0) return -1;
  return base + pos; // 0..35
}

function fileForIndex(idx, toy, color) {
  return `${ICON_DIR}/_${String(idx).padStart(4,"0")}_${toy}_${color}${ICON_EXT}`;
}
const keyIcon = (toy, color) => `${toy}|${color}`;

// ====== BGM ========
const bgm = new Audio("./assets/audio/bgm.mp3");
bgm.loop = true;
bgm.volume = 0.15;
let bgmEnabled = true;

function startBgm() {
  if (!bgmEnabled) return;
  bgm.play().catch(() => {});
}

function stopBgm() {
  bgm.pause();
  bgm.currentTime = 0;
}

function restartBgm(){
  bgm.currentTime = 0;
  if (audioUnlocked) {
    bgm.pause();
    startBgm();
  }
}

const endAudio = new Audio(`./assets/audio/end.mp3`);
endAudio.preload = "auto";
endAudio.volume = 0.6;

function playEndMusic() {
  // stop any previous run and play from start
  endAudio.pause();
  endAudio.currentTime = 0;
  endAudio.play().catch(()=>{});
}

function stopEndMusic() {
  endAudio.pause();
  endAudio.currentTime = 0;
}

// ====== SFX (simple audio manager) ======
const SFX_PATH = "assets/sfx";  // put your .mp3/.wav files here

const SFX = {
  select:       `${SFX_PATH}/select.wav`,
  place:        `${SFX_PATH}/place.wav`,
  turn:         `${SFX_PATH}/turn.wav`,
  click:        `${SFX_PATH}/click.wav`
};

// Preload lightweight HTMLAudio elements (low-friction, no Web Audio setup)
const sfxPool = new Map(); // name -> [Audio, Audio, ...] for overlap
function preloadSfx() {
  Object.entries(SFX).forEach(([name, url]) => {
    const a1 = new Audio(url); a1.preload = "auto"; a1.volume = BASE_SFX_VOL * masterVolume;
    const a2 = new Audio(url); a2.preload = "auto"; a2.volume = BASE_SFX_VOL * masterVolume;
    sfxPool.set(name, [a1, a2]); // 2-lane pool prevents cutoffs on quick repeats
  });
}

// Respect browser autoplay policy: unlock audio on first user gesture
let audioUnlocked = false;
function unlockAudioOnce() {
  if (audioUnlocked) return;
  // Try to play muted once to satisfy gesture requirement
  for (const arr of sfxPool.values()) for (const a of arr) { a.muted = true; a.play().catch(()=>{}); a.pause(); a.currentTime=0; a.muted=false; }
  audioUnlocked = true;
  window.removeEventListener("pointerdown", unlockAudioOnce);
  window.removeEventListener("keydown", unlockAudioOnce);
  startBgm();
}
window.addEventListener("pointerdown", unlockAudioOnce, { once: true });
window.addEventListener("keydown", unlockAudioOnce, { once: true });

function playSfx(name) {
  if (masterMuted || masterVolume === 0) return;

  const arr = sfxPool.get(name);
  if (!arr) return;

  const a = arr.find(x => x.paused) || arr[0];
  a.currentTime = 0;
  a.play().catch(()=>{});
}

// ====== Master Audio Controls (Music + SFX together) ======
const BASE_BGM_VOL = 0.15;
const BASE_SFX_VOL = 0.7;
const BASE_END_VOL = 0.6;

let masterMuted = false;
let masterVolume = 0.60; // 0..1 (matches slider default)

function applyAudioSettings(){
  // music volumes
  bgm.volume = BASE_BGM_VOL * masterVolume;
  endAudio.volume = BASE_END_VOL * masterVolume;

  // mute/unmute behavior
  if (masterMuted || masterVolume === 0){
    bgm.pause();
    endAudio.pause();
  } else {
    // only resume bgm if enabled + unlocked
    if (bgmEnabled && audioUnlocked) startBgm();
  }

  // sfx volumes + mute
  for (const arr of sfxPool.values()){
    for (const a of arr){
      a.volume = BASE_SFX_VOL * masterVolume;
      a.muted = masterMuted || masterVolume === 0;
    }
  }

  updateAudioUI();
}

function updateAudioUI(){
  const audioBtn = document.getElementById("audioBtn");
  const slider = document.getElementById("volumeSlider");
  if (audioBtn) audioBtn.textContent = (masterMuted || masterVolume === 0) ? "🔇" : "🔊";
  if (slider) slider.value = String(Math.round(masterVolume * 100));
}


// ====== Game constants ======
const SIZE = 6; // 6x6 board
const SCORE_TABLE = { 2:1, 3:3, 4:6, 5:10, 6:15 };
const ICON_PADDING = 0.12; // space inside tile around icon

// ====== State ======
const state = {
  board: null,              // 6x6 of tiles or null
  supply: [],
  display: [],
  focuses: ["genre","color"],  // 'genre' = toy-type groups; 'color' = color groups
  current: 0,
  phase: "place",           // "slide" | "place"
  selected: null,           // {r,c} tile selected for sliding
  validDests: new Set(),    // "r,c"
  selectedDisplay: null,    // index in display for placing
  hasSlidThisTurn: false    // at most one slide per turn (optional)
};

// ====== Helpers ======
function makeDeck() {
  const d = [];
  // Note: no "slid" flags here; sliding is tracked per-turn only.
  for (const g of TOYS)
    for (const c of COLORS)
      d.push({ genre: g, color: c });
  return d;
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function emptyBoard(){ return Array.from({length:SIZE},()=>Array(SIZE).fill(null)); }
function inBounds(r,c){ return r>=0 && r<SIZE && c>=0 && c<SIZE; }
function key(r,c){ return `${r},${c}`; }

// ====== DOM ======
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const displayEl = document.getElementById("display");
const supplyBadge = document.getElementById("supplyBadge");

// ====== Preload sliced icons ======
const ICONS = new Map(); // Map<"Toy|Color", HTMLImageElement>
let iconsReady = false;

function preloadIcons(){
  const tasks = [];
  for (const toy of TOYS){
    for (const color of COLORS){
      const idx = indexFor(toy,color);           // 0..35 using folder mapping
      const src = fileForIndex(idx, toy, color); // e.g. _0000_Robot_Orange.png
      const img = new Image();
      ICONS.set(keyIcon(toy,color), img);
      tasks.push(new Promise(res => {
        img.onload  = res;
        img.onerror = () => { console.warn("Missing sprite:", src); res(); };
        img.src = src;
      }));
    }
  }
  return Promise.all(tasks).then(() => { iconsReady = true; });
}

// ====== New Game ======
function newGame(withFocusDialog = true){
  // Reset board state
  state.board = emptyBoard();
  state.supply = shuffle(makeDeck());
  state.display = [];
  for (let i = 0; i < 6; i++) drawFromSupplyToDisplay();

  state.current = 0;
  state.phase = "place";
  state.selected = null;
  state.validDests.clear();
  state.selectedDisplay = null;
  state.hasSlidThisTurn = false;

  // UI
  updateSupplyBadge();
  renderDisplay();
  sizeBoardToContainer();
  if (iconsReady) render();

  // Music: restart from beginning each new game
  restartBgm();
  updateMuteIcon();

  // Focus selection vs immediate start
  if (withFocusDialog) showFocusDialog("start");
  else showTurnBanner(state.current);

  // One call is enough (this already calls updateLiveScore)
  setStatus();
}


function drawFromSupplyToDisplay(){
  if(state.supply.length>0 && state.display.length<6){
    state.display.push(state.supply.pop());
  }
}

// ====== Focus selection (mutually exclusive) ======
let focusDialogMode = "start"; // "start" | "newMatch"
let focusDialogInited = false;

function initFocusDialog(){
  if (focusDialogInited) return;
  focusDialogInited = true;

  const startBtn = document.getElementById('startBtn');
  if (!startBtn) return;

  // Enforce mutual exclusion (only attach once)
  const enforceOpposites = (whoChanged) => {
    const p1 = document.querySelector('input[name="p1"]:checked')?.value;
    const p2 = document.querySelector('input[name="p2"]:checked')?.value;
    if (!p1 || !p2) return;
    if (p1 === p2) {
      const target = (p1 === 'genre') ? 'color' : 'genre';
      const sel = whoChanged === "p1"
        ? `input[name="p2"][value="${target}"]`
        : `input[name="p1"][value="${target}"]`;
      const r = document.querySelector(sel);
      if (r) r.checked = true;
    }
  };

  document.querySelectorAll('input[name="p1"]').forEach(r =>
    r.addEventListener('change', () => enforceOpposites('p1'))
  );
  document.querySelectorAll('input[name="p2"]').forEach(r =>
    r.addEventListener('change', () => enforceOpposites('p2'))
  );

  // Start button behavior depends on mode
  startBtn.onclick = () => {
    let p1 = document.querySelector('input[name="p1"]:checked')?.value || 'genre';
    let p2 = document.querySelector('input[name="p2"]:checked')?.value || 'color';
    playSfx("click");

    if (p1 === p2) p2 = (p1 === 'genre') ? 'color' : 'genre';
    state.focuses = [p1, p2];

    const dlg = document.getElementById('focusDialog');
    if (dlg?.close) dlg.close();

    // Update UI once
    setStatus();
    showTurnBanner(state.current);

    // Only when starting a NEW MATCH do we rebuild the board
    if (focusDialogMode === "newMatch") {
      newGame(false);
    }
  };
}

function showFocusDialog(mode = "start"){
  const dlg = document.getElementById('focusDialog');
  if (!dlg) return;

  initFocusDialog();
  focusDialogMode = mode;

  // Avoid throwing if already open
  if (dlg.open) return;
  if (dlg.showModal) dlg.showModal();
  else dlg.setAttribute("open", "");
}

function openFocusForNewGame(){
  showFocusDialog("newMatch");
}


// ====== Sizing ======
function sizeBoardToContainer(){
  const cont = document.getElementById("boardContainer");
  if (!cont) return;

  const isDesktop = window.matchMedia("(min-width: 900px)").matches;
  const MAX_BOARD = isDesktop ? 720 : 640;

  const availableW = Math.floor(cont.clientWidth);
  const header = document.querySelector("header");
  const mainPad = 32;
  const extraBottom = isDesktop ? 220 : 160;
  const availableH = Math.max(
    360,
    window.innerHeight - (header?.offsetHeight || 0) - mainPad - extraBottom
  );

  const target = Math.max(320, Math.floor(Math.min(availableW, availableH, MAX_BOARD)));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.style.width  = target + "px";
  canvas.style.height = target + "px";
  canvas.width  = Math.floor(target * dpr);
  canvas.height = Math.floor(target * dpr);
}
window.addEventListener("resize", () => { sizeBoardToContainer(); render(); });

// ====== Rendering ======
function render(){
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  // background + frame
  ctx.fillStyle = "#0d0f14"; ctx.fillRect(0,0,W,H);
  roundRect(ctx, 8,8, W-16, H-16, 18, "#11141b", "#2a2f3a", 2);

  // grid metrics
  const pad = 40; const size = W - pad*2; const cell = size / SIZE;

  // labels
  ctx.fillStyle = "#c9ccd3"; ctx.font = "14px system-ui"; ctx.textAlign="center"; ctx.textBaseline="middle";
  for(let r=0;r<SIZE;r++){
    ctx.fillText(String(r+1), pad-18, pad + r*cell + cell/2);
    ctx.fillText(String(r+1), pad+size+18, pad + r*cell + cell/2);
  }
  for(let c=0;c<SIZE;c++){
    const ch = String.fromCharCode(65+c);
    ctx.fillText(ch, pad + c*cell + cell/2, pad-18);
    ctx.fillText(ch, pad + c*cell + cell/2, pad+size+18);
  }

  // grid lines
  ctx.strokeStyle = "#2a2f3a"; ctx.lineWidth = 2;
  for(let i=0;i<=SIZE;i++){
    const y = pad + i*cell; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad+size, y); ctx.stroke();
    const x = pad + i*cell; ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad+size); ctx.stroke();
  }

  // valid destinations
  for(const k of state.validDests){
    const [r,c] = k.split(",").map(Number);
    const x = pad + c*cell; const y = pad + r*cell;
    ctx.fillStyle = "rgba(110,168,254,0.18)"; ctx.fillRect(x+2,y+2,cell-4,cell-4);
    ctx.strokeStyle = "#6ea8fe"; ctx.lineWidth = 2; ctx.strokeRect(x+2,y+2,cell-4,cell-4);
  }

  // tiles
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      const t = state.board[r][c]; if(!t) continue;
      const x = pad + c*cell; const y = pad + r*cell;
      drawTile(ctx, x,y, cell, t, state.selected && state.selected.r===r && state.selected.c===c);
    }
  }
}

function roundRect(ctx, x,y,w,h, r, fill, stroke, lw=1){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y, x+w,y+h, r);
  ctx.arcTo(x+w,y+h, x,y+h, r);
  ctx.arcTo(x,y+h, x,y, r);
  ctx.arcTo(x,y, x+w,y, r);
  if(fill){ ctx.fillStyle = fill; ctx.fill(); }
  if(stroke){ ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

// Fit an image into a box (contain, preserve aspect, center)
function drawImageContain(ctx, img, dx, dy, dw, dh) {
  if (!img || !img.complete) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const scale = Math.min(dw / iw, dh / ih);
  const w = Math.floor(iw * scale);
  const h = Math.floor(ih * scale);
  const x = dx + Math.floor((dw - w) / 2);
  const y = dy + Math.floor((dh - h) / 2);
  ctx.drawImage(img, x, y, w, h);
}

function drawTile(ctx, x, y, size, tile, selected=false){
  // card background
  roundRect(ctx, x+6, y+6, size-12, size-12, 14, '#f4f5f6', '#0f1218', 2);

  // icon box — margin inside the card
  const inset = Math.floor(size * ICON_PADDING);
  const boxX = x + inset, boxY = y + inset;
  const boxW = size - inset * 2, boxH = size - inset * 2;

  const img = ICONS.get(keyIcon(tile.genre, tile.color));
  drawImageContain(ctx, img, boxX, boxY, boxW, boxH);

  if (selected) {
    ctx.strokeStyle = '#6ea8fe'; ctx.lineWidth = 3;
    ctx.strokeRect(x+4, y+4, size-8, size-8);
  }
}

// ====== Input ======
canvas.addEventListener("click", (e)=>{
  const rect = canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (canvas.width / rect.width);
  const py = (e.clientY - rect.top) * (canvas.height / rect.height);
  const pad = 40; const size = canvas.width - pad*2; const cell = size / SIZE;
  if(px<pad || py<pad || px>pad+size || py>pad+size) return;
  const c = Math.floor((px - pad)/cell);
  const r = Math.floor((py - pad)/cell);
  onBoardClick(r,c);
});

function onBoardClick(r,c){
  if(state.phase === "slide"){
    // If you've already slid this turn, force place phase
    if (state.hasSlidThisTurn) {
      state.phase = 'place';
      state.selected = null;
      state.validDests.clear();
      setStatus(); render();
      return;
    }

    const t = state.board[r][c];

    // NEW: one-click switch between source tiles while in slide mode
    if (state.selected && t && (state.selected.r !== r || state.selected.c !== c)) {
      state.selected = { r, c };       // switch to the newly clicked tile
      playSfx("select");
      state.validDests.clear();
      computeValidDests(r, c);
      render();
      setStatus();
      return;
    }

    if (t && !state.selected) {
      // start selecting this tile to slide
      state.selectedDisplay = null;            // <<< clear display pick
      renderDisplay();
      state.selected = { r, c };
      playSfx("select");
      computeValidDests(r, c);
    } 
    else if(state.selected && state.validDests.has(key(r,c))) {
      // perform slide to destination
      const { r: sr, c: sc } = state.selected;
      const moved = state.board[sr][sc];
      state.board[r][c] = moved;
      state.board[sr][sc] = null;
      playSfx("place");

      // mark that we've slid this turn
      state.hasSlidThisTurn = true;

      // end slide, switch to place
      state.selected = null;
      state.validDests.clear();
      state.phase = 'place';
      state.selectedDisplay = null;
    } else {
      // click elsewhere cancels selection
      state.selected = null; state.validDests.clear();
    }
  } else if (state.phase === 'place') {
    const t = state.board[r][c];

    // Click a board tile to start sliding — only if you haven't slid this turn
    
    if (t && !state.hasSlidThisTurn) {
      playSfx("select");
      state.selectedDisplay = null;
      renderDisplay();   // auto-unselect any display pick
      state.phase = 'slide';
      state.selected = { r, c };
      computeValidDests(r, c);
      render();
      setStatus();
      return; // don't try to place on this click
    }

    // placing onto an empty cell requires a selected display tile
    if (state.board[r][c] === null && state.selectedDisplay != null) {
      const src = state.display[state.selectedDisplay];
      state.board[r][c] = { ...src };  // placed tiles are always movable later
      playSfx("place");

      state.display.splice(state.selectedDisplay, 1);
      drawFromSupplyToDisplay();
      state.selectedDisplay = null;

      if (boardFull()) {
        stopBgm();
        playEndMusic();
        endAndScore();
      } else {
        // next player — start in PLACE; slide remains optional
        state.current = 1 - state.current;
        state.phase = 'place';
        state.selected = null;
        state.validDests.clear();
        state.hasSlidThisTurn = false;   // reset for next player
        showTurnBanner(state.current);
      }
    }
  }
  renderDisplay(); 
  render(); 
  setStatus();
}

function computeValidDests(r,c){
  state.validDests.clear();
  // scan in 4 directions until blocked; add empty cells along clear path
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for(const [dr,dc] of dirs){
    let nr=r+dr, nc=c+dc;
    while(inBounds(nr,nc) && state.board[nr][nc]===null){
      state.validDests.add(key(nr,nc));
      nr+=dr; nc+=dc;
    }
  }
}
function boardFull(){
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(!state.board[r][c]) return false;
  return true;
}

// ====== Display panel ======
function renderDisplay(){
  if(!displayEl) return;
  displayEl.innerHTML = "";
  state.display.forEach((t,idx)=>{
    const div = document.createElement("div");
    div.className = "slot" + (state.selectedDisplay===idx ? " sel":"" );
    div.title = `${t.genre} — ${t.color}`;

    const canv = document.createElement('canvas');
    const PREV = 104;   // fits neatly in a ~112px square slot with padding
    const PAD  = 10;    // inner margin
    canv.width = PREV;
    canv.height = PREV;
    const c2 = canv.getContext('2d');
    drawTile(c2, 0, 0, PREV, t, false);

    div.appendChild(canv);

    // Toggle: select to place; click again to unselect & allow sliding
    div.onclick = () => {
      if (state.selectedDisplay === idx) {
        // unselect → allow sliding again
        playSfx("place");
        state.selectedDisplay = null;
        state.selected = null;
        state.validDests.clear();
        state.phase = 'place';          // stay in place; can click board to start slide
      } else {
        // select this tile → prepare to place
        playSfx("select");
        state.selectedDisplay = idx;
        state.selected = null;
        state.validDests.clear();
        state.phase = 'place';
      }
      renderDisplay();
      render();
      setStatus();
    };

    displayEl.appendChild(div);
  });
  updateSupplyBadge();
}
function updateSupplyBadge(){ 
  if(!supplyBadge) return;

  const total = TOYS.length * COLORS.length;           // 36
  const remaining = state.supply.length + state.display.length; // still not on board
  const placed = total - remaining;

  supplyBadge.textContent = `Toys: ${remaining} left (${placed}/${total} placed)`;
}

// ====== Live Score ======
function updateLiveScore(){
  const s1 = computeScoreFor(0);
  const s2 = computeScoreFor(1);

  const p1ScoreEl = document.getElementById('p1Score');
  const p2ScoreEl = document.getElementById('p2Score');
  const p1FocusEl = document.getElementById('p1Focus');
  const p2FocusEl = document.getElementById('p2Focus');

  if (p1ScoreEl) p1ScoreEl.textContent = s1.total;
  if (p2ScoreEl) p2ScoreEl.textContent = s2.total;
  if (p1FocusEl) p1FocusEl.textContent = `P1: ${s1.focus === 'genre' ? 'Toys' : 'Colors'}`;
  if (p2FocusEl) p2FocusEl.textContent = `P2: ${s2.focus === 'genre' ? 'Toys' : 'Colors'}`;
}

// ====== Status & Scoring ======
function setStatus(){
  const p = state.current + 1;
  const focus = state.focuses[state.current] === "genre" ? "Toys" : "Colors";
  const phase = state.phase === "slide"
    ? (state.hasSlidThisTurn ? "You already slid — place a tile" : "Optional: slide a tile, or select from display to place")
    : (state.selectedDisplay == null ? "Place: select a display tile" : "Place: click an empty cell");

  // Console-only status (no UI text updates)
  console.log(`Player ${p} · Focus: ${focus} · ${phase}`);

  updateTurnHighlight();   // NEW: drive UI highlighting instead
  updateLiveScore();
}

function updateTurnHighlight(){
  const p1ScoreEl = document.getElementById('p1Score');
  const p2ScoreEl = document.getElementById('p2Score');
  const p1FocusEl = document.getElementById('p1Focus');
  const p2FocusEl = document.getElementById('p2Focus');

  const p1Row = p1ScoreEl?.parentElement; // <div><b>Player 1</b> <span ...></div>
  const p2Row = p2ScoreEl?.parentElement;

  const p1Active = (state.current === 0);

  // highlight the whole row + focus pill
  if (p1Row) p1Row.classList.toggle('turn-active', p1Active);
  if (p2Row) p2Row.classList.toggle('turn-active', !p1Active);

  if (p1FocusEl) p1FocusEl.classList.toggle('turn-active-pill', p1Active);
  if (p2FocusEl) p2FocusEl.classList.toggle('turn-active-pill', !p1Active);
}

function computeScoreFor(playerIdx){
  const focus = state.focuses[playerIdx];
  const seen = Array.from({length:SIZE},()=>Array(SIZE).fill(false));
  let total = 0; const groups = [];
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      const t = state.board[r][c];
      if(!t || seen[r][c]) continue;
      const attr = focus==="genre" ? t.genre : t.color;
      const q=[[r,c]]; seen[r][c]=true; let sz=0;
      while(q.length){
        const [cr,cc]=q.shift(); sz++;
        const nbs=[[1,0],[-1,0],[0,1],[0,-1]];
        for(const [dr,dc] of nbs){
          const nr=cr+dr, nc=cc+dc;
          if(!inBounds(nr,nc) || seen[nr][nc]) continue;
          const t2 = state.board[nr][nc];
          if(t2 && ((focus==='genre' && t2.genre===attr) || (focus==='color' && t2.color===attr))){
            seen[nr][nc]=true; q.push([nr,nc]);
          }
        }
      }
      if(sz>=2){
        const pts = SCORE_TABLE[sz] ?? (sz>6 ? 15 : 0);
        total += pts; groups.push({attr, size:sz, pts});
      }
    }
  }
  return {total, groups, focus};
}

function endAndScore(){
  const s1 = computeScoreFor(0);
  const s2 = computeScoreFor(1);
  const win = s1.total===s2.total ? "Draw!" : (s1.total>s2.total? "Player 1 wins!" : "Player 2 wins!");
  showScoreModal(s1,s2,win);
}

function showScoreModal(s1,s2,headline="Scores"){
  const box = document.getElementById("scoreContent");
  if (!box) return;
  box.innerHTML = `
    <p><b>${headline}</b></p>
    <div class="hr"></div>
    <p><b>Player 1</b> — Focus: ${s1.focus==='genre'?'Toys':'Colors'} — <b>${s1.total}</b> pts</p>
    ${renderGroupList(s1.groups)}
    <div class="hr"></div>
    <p><b>Player 2</b> — Focus: ${s2.focus==='genre'?'Toys':'Colors'} — <b>${s2.total}</b> pts</p>
    ${renderGroupList(s2.groups)}
  `;
  const dlg = document.getElementById("scoreDialog");
  if (dlg && dlg.showModal) {
    dlg.showModal();
  }
}
function renderGroupList(groups){
  if(!groups.length) return '<p class="hint">No scoring groups.</p>';
  return '<ul>' + groups.map(g=>`<li>${g.size} in ${g.attr} → ${g.pts} pts</li>`).join('') + '</ul>';
}

function openFocusForNewGame(){
  const dlg = document.getElementById('focusDialog');
  if (!dlg || !dlg.showModal) { 
    // Fallback: if the dialog isn’t on this page, just start a fresh game
    newGame(true);
    return;
  }

  // Re-show the same focus dialog the app uses on first load
  dlg.showModal();

  // Reuse your mutual-exclusion listeners already attached in showFocusDialog()
  // We just redefine Start to apply choices and then start a fresh board.
  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.onclick = () => {
      let p1 = document.querySelector('input[name="p1"]:checked')?.value || 'genre';
      let p2 = document.querySelector('input[name="p2"]:checked')?.value || 'color';
      playSfx("click");
      if (p1 === p2) p2 = (p1 === 'genre') ? 'color' : 'genre';
      state.focuses = [p1, p2];
      dlg.close();
      newGame(false); // focuses already chosen; don’t show the dialog again
    };
  }
}

function showTurnBanner(playerIndex) {
  const overlay = document.getElementById('turnBanner');
  const strip   = overlay?.querySelector('.banner-strip');
  const label   = document.getElementById('turnBannerText');
  if (!overlay || !strip || !label) return;

  label.textContent = `Player ${playerIndex + 1}'s Turn`;
  overlay.style.display = 'block';
  playSfx("turn");
  // retrigger CSS animation
  strip.classList.remove('run');
  // force reflow
  // eslint-disable-next-line no-unused-expressions
  strip.offsetWidth;
  strip.classList.add('run');

  strip.addEventListener('animationend', () => {
    overlay.style.display = 'none';
    strip.classList.remove('run');
  }, { once: true });
}


// ====== Buttons ======
const newBtn = document.getElementById("newBtn");
const rulesBtn = document.getElementById("rulesBtn");

if (newBtn) newBtn.onclick = ()=>{
  playSfx("click");
  newGame(true);
};

if (rulesBtn) rulesBtn.onclick = ()=>{ 
  const d=document.getElementById("rulesDialog");
  playSfx("click");
  if(d&&d.showModal) d.showModal(); 
};

const closeRules = document.getElementById("closeRules");
if (closeRules) closeRules.onclick = ()=>{
  playSfx("click");
  const d=document.getElementById("rulesDialog"); 
  if(d&&d.close) d.close(); 
};

// Close button in Scores dialog (if not already wired)
const closeScore = document.getElementById("closeScore");
if (closeScore) closeScore.onclick = () => {
  const d = document.getElementById("scoreDialog");
  if (d && d.close) d.close();
  stopEndMusic();
  playSfx("click");
};

const muteBtn = document.getElementById("muteBtn");

function updateMuteIcon(){
  if (!muteBtn) return;
  muteBtn.textContent = bgmEnabled ? "🔊" : "🔇";
}

if (muteBtn){
  muteBtn.onclick = () => {
    playSfx("click");

    bgmEnabled = !bgmEnabled;

    if (bgmEnabled) {
      startBgm();
    } else {
      bgm.pause();
    }

    updateMuteIcon();
  };
}

const audioBtn = document.getElementById("audioBtn");
const volumeSlider = document.getElementById("volumeSlider");

if (audioBtn){
  audioBtn.onclick = () => {
    playSfx("click");
    masterMuted = !masterMuted;
    applyAudioSettings();
  };
}

if (volumeSlider){
  volumeSlider.addEventListener("input", () => {
    masterVolume = Math.max(0, Math.min(1, Number(volumeSlider.value) / 100));
    applyAudioSettings();
  });
}

// New Match: close results, then open focus picker
const newMatchBtn = document.getElementById("newMatchBtn");
if (newMatchBtn) newMatchBtn.onclick = () => {
  stopEndMusic();
  playSfx("click");
  const d = document.getElementById("scoreDialog");
  if (d && d.close) d.close();
  openFocusForNewGame();   // ← show criteria dialog now
};

// ====== Kickoff (preload icons first) ======
preloadSfx();
preloadIcons().then(() => {
  newGame(true);
  applyAudioSettings();
});
