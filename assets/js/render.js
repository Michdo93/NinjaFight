/**
 * Ninja Fight — Grundlagen: Konstanten, Level-Aufbau, Kollisions-Helfer,
 * Sound, und das Zeichnen von Figuren/Kacheln über echte Sprite-Sheets.
 * Entspricht in Summe mehreren kleinen AS3-Klassen (Floor/Bridge/Ladder/
 * WaterGround/Flame/Knives fuer den Level-Aufbau, SoundController.as fuer
 * den Sound) plus der Zeichenlogik, die im Original ueber Bibliotheks-
 * symbole lief.
 */

/* ==================================================================== */
/* Konstanten                                                            */
/* ==================================================================== */
const STAGE_W = 1024, STAGE_H = 576;
const GRAVITY = 1400;          // px/s^2
const JUMP_SPEED = 620;        // px/s (Anfangsgeschwindigkeit nach oben)
const WALK_SPEED = 160;        // px/s
const ENEMY_SPEED = 90;        // px/s
const CLIMB_SPEED = 110;       // px/s
const TILE_W = 40, TILE_H = 20;
const LADDER_W = 25;
const HAZARD_SIZE = 18;
const GROUND_LEVEL_Y = 414;    // ungefaehre Bodenhoehe, aus den Level-Daten

const PLATFORM_TYPES = new Set(["Floor", "Bridge", "Small", "WaterGround"]);
const SKIP_TYPES = new Set(["Bottom", "WaterTop"]); // rein dekorativ, keine eigene Kollision

/* ==================================================================== */
/* Level aufbauen — entspricht Floor/Bridge/Ladder/.../registerLevelElement() */
/* Die x/y-Koordinaten stammen 1:1 aus den Original-FLA-Leveldaten        */
/* (siehe assets/js/levels.js), Breite/Hoehe pro Kacheltyp entsprechen     */
/* jetzt den tatsaechlichen Sprite-Massen (siehe spritedata.js).          */
/* ==================================================================== */
function buildLevel(levelNum) {
  const raw = LEVELS[levelNum] || [];
  const platforms = [];
  const ladders = [];
  const flames = [];
  const knives = [];
  const decorative = [];

  raw.forEach(el => {
    if (SKIP_TYPES.has(el.type)) { decorative.push(el); return; }

    if (PLATFORM_TYPES.has(el.type)) {
      const size = tileSize(el.type) || { w: TILE_W, h: TILE_H };
      platforms.push({ type: el.type, x: el.x, y: el.y, w: size.w || TILE_W, h: size.h || TILE_H });
    } else if (el.type === "Ladder") {
      ladders.push({ x: el.x, y: el.y, w: LADDER_W, h: TILE_H + 8 });
    } else if (el.type === "Flame") {
      // Original-Leveldaten zeigen: Flame.y entspricht der Bodenhöhe (der
      // Basis der Flamme), nicht ihrer Oberkante — die Flamme steigt vom
      // Boden nach OBEN, nicht umgekehrt (siehe Bugfix-Notiz in der README)
      flames.push({ x: el.x, y: el.y, w: HAZARD_SIZE + 4, h: HAZARD_SIZE + 14 });
    } else if (el.type === "Knives") {
      knives.push({ x: el.x, y: el.y, w: HAZARD_SIZE, h: HAZARD_SIZE });
    }
  });

  const ladderZones = mergeLadderColumns(ladders);

  return { platforms, ladders: ladderZones, flames, knives, decorative };
}

function mergeLadderColumns(tiles) {
  const groups = [];
  tiles.forEach(t => {
    let g = groups.find(g => Math.abs(g.x - t.x) < 8);
    if (!g) { g = { x: t.x, minY: t.y, maxY: t.y + t.h }; groups.push(g); }
    else { g.minY = Math.min(g.minY, t.y); g.maxY = Math.max(g.maxY, t.y + t.h); }
  });
  return groups.map(g => ({ left: g.x, right: g.x + LADDER_W, top: g.minY, bottom: g.maxY + TILE_H }));
}

/* ==================================================================== */
/* Kollisions-Hilfsfunktionen (AABB)                                     */
/* ==================================================================== */
function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
function rectOf(x, y, w, h) { return { left: x, right: x + w, top: y, bottom: y + h }; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* ==================================================================== */
/* SoundController — entspricht SoundController.as                       */
/* ==================================================================== */
class SoundController {
  constructor() {
    this.menuMusic = new Audio("assets/sounds/Game-Menu.mp3");
    this.gameMusic = new Audio("assets/sounds/Lost-Jungle.mp3");
    this.swordSfx = new Audio("assets/sounds/sword.mp3");
    this.collectSfx = new Audio("assets/sounds/Coins.mp3");
    this.menuMusic.loop = true;
    this.gameMusic.loop = true;
    this.volume = 0.6;
    this.applyVolume();
  }
  applyVolume() {
    this.menuMusic.volume = this.volume;
    this.gameMusic.volume = this.volume;
    this.swordSfx.volume = this.volume;
    this.collectSfx.volume = this.volume;
  }
  changeVolume(v) { this.volume = clamp(v, 0, 1); this.applyVolume(); }
  playMenuMusic() { this.gameMusic.pause(); this.menuMusic.currentTime = 0; this.menuMusic.play().catch(() => {}); }
  playGameMusic() { this.menuMusic.pause(); this.gameMusic.currentTime = 0; this.gameMusic.play().catch(() => {}); }
  stopAll() { this.menuMusic.pause(); this.gameMusic.pause(); }
  playSword() { this.swordSfx.currentTime = 0; this.swordSfx.play().catch(() => {}); }
  playCollect() { this.collectSfx.currentTime = 0; this.collectSfx.play().catch(() => {}); }
}

/* ==================================================================== */
/* Sprite-basiertes Zeichnen — echte, aus der Original-SWF exportierte   */
/* Frames (siehe spritedata.js) statt einer prozedural gezeichneten      */
/* Strichfigur.                                                          */
/* ==================================================================== */
const SPRITE_SCALE = 0.45; // Anzeige-Skalierung ggue. der nativen SWF-Aufloesung

const characterImages = {};
["hero", "blue", "green", "red", "white"].forEach(name => {
  const img = new Image();
  img.src = `assets/img/sprites/${name}.png`;
  characterImages[name] = img;
});

const tileSheet = new Image();
tileSheet.src = "assets/img/sprites/tiles.png";

function imageForType(type) {
  return characterImages[(type || "Hero").toLowerCase()] || characterImages.hero;
}

// entspricht doAction()/gotoAndPlay(label) im Original: waehlt anhand des
// Animationszustands und der verstrichenen Zeit den passenden Frame aus
// der jeweiligen Zeile des Sprite-Sheets.
// "Climb" existiert im Original NICHT als eigene Animation (das Klettern
// war laut KnownBugs nie fertig implementiert) — hier ersatzweise die
// Jump-Frames in Dauerschleife, das liegt optisch am naechsten an einer
// Kletterbewegung (siehe README).
function drawNinja(ctx, x, y, facing, type, state, t) {
  const img = imageForType(type);
  if (!img.complete || img.naturalWidth === 0) return;

  const spriteState = state === "Climb" ? "Jump" : state;
  const def = CHARACTER_SHEET.states[spriteState] || CHARACTER_SHEET.states.Idle;
  const fps = state === "Idle" ? 6 : state === "Walk" ? 12 : state === "Climb" ? 7 : 14;
  const loopStates = new Set(["Idle", "Walk", "Climb"]);
  let frame = Math.floor(t * fps);
  frame = loopStates.has(state) ? frame % def.count : Math.min(frame, def.count - 1);

  const sx = frame * CHARACTER_SHEET.cellW;
  const sy = def.row * CHARACTER_SHEET.cellH;
  const dw = CHARACTER_SHEET.cellW * SPRITE_SCALE;
  const dh = CHARACTER_SHEET.cellH * SPRITE_SCALE;
  const anchorX = CHARACTER_SHEET.anchorX * SPRITE_SCALE;
  const anchorY = CHARACTER_SHEET.anchorY * SPRITE_SCALE;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.drawImage(
    img, sx, sy, CHARACTER_SHEET.cellW, CHARACTER_SHEET.cellH,
    -anchorX, -anchorY, dw, dh
  );
  ctx.restore();
}

// Level-Elemente/Items aus dem gemeinsamen tiles.png-Sheet zeichnen
function drawTile(ctx, name, x, y, opts = {}) {
  const def = TILE_SHEET.tiles[name];
  if (!def || !tileSheet.complete || tileSheet.naturalWidth === 0) return;
  const frame = opts.frame || 0;
  const sx = (frame % 8) * TILE_SHEET.cellW + (TILE_SHEET.cellW - def.w) / 2;
  const sy = def.row * TILE_SHEET.cellH + (TILE_SHEET.cellH - def.h) / 2;
  const scale = opts.scale || 1;
  ctx.save();
  if (opts.flip) { ctx.translate(x + def.w * scale, y); ctx.scale(-1, 1); ctx.translate(-x, -y); }
  ctx.drawImage(tileSheet, sx, sy, def.w, def.h, x, y, def.w * scale, def.h * scale);
  ctx.restore();
}
function tileSize(name) {
  const def = TILE_SHEET.tiles[name];
  return def ? { w: def.w, h: def.h } : null;
}
