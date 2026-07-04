/**
 * Ninja Fight — HTML5/JS-Portierung
 * Original: Adobe Animate / ActionScript 3 (Michael Dörflinger, HFU 2018)
 *
 * Diese Datei enthält die komplette Spiellogik. Sie ist bewusst in klar
 * benannte Abschnitte gegliedert, die jeweils einer Original-AS3-Klasse
 * entsprechen (siehe README für die vollständige Zuordnung und die Liste
 * der dabei behobenen Fehler aus "Ninja Fight_KnownBugs.pdf").
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
const TILE_W = 40, TILE_H = 16;
const LADDER_W = 26;
const HAZARD_SIZE = 26;
const GROUND_LEVEL_Y = 414;    // ungefähre Bodenhöhe, aus den Level-Daten

const PLATFORM_TYPES = new Set(["Floor", "Bridge", "Small", "WaterGround"]);
const SKIP_TYPES = new Set(["Bottom", "WaterTop"]); // rein dekorativ, keine eigene Kollision

/* ==================================================================== */
/* Level aufbauen — entspricht Floor/Bridge/Ladder/.../registerLevelElement() */
/* Die x/y-Koordinaten stammen 1:1 aus den Original-FLA-Leveldaten        */
/* (siehe assets/js/levels.js), nur Breite/Höhe pro Kacheltyp wurden      */
/* für die eigene Zeichnung neu festgelegt.                              */
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
      platforms.push({ type: el.type, x: el.x, y: el.y, w: TILE_W, h: TILE_H });
    } else if (el.type === "Ladder") {
      ladders.push({ x: el.x, y: el.y, w: LADDER_W, h: TILE_H + 8 });
    } else if (el.type === "Flame") {
      flames.push({ x: el.x, y: el.y, w: HAZARD_SIZE, h: HAZARD_SIZE });
    } else if (el.type === "Knives") {
      knives.push({ x: el.x, y: el.y, w: HAZARD_SIZE, h: HAZARD_SIZE });
    }
  });

  // benachbarte Leiter-Kacheln zu einer durchgehenden Kletterzone verschmelzen
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
/* Kollisions-Hilfsfunktionen (AABB) — dasselbe Muster wie in den        */
/* beiden vorigen Repos (Buch-Port & Animate-Kurs)                       */
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
/* Zeichnen — ersetzt die vektorbasierten Figuren-Bodyparts (Hero/Enemy/  */
/* BodyPart/*) aus der Original-FLA durch eine prozedural gezeichnete    */
/* Ninja-Figur, parametrisiert über Farbe und Pose (dasselbe Prinzip wie */
/* das Charakter-Rig aus dem Animate-Kurs-Repo)                          */
/* ==================================================================== */
function poseFor(state, t) {
  const pose = { legL: 0, legR: 0, armL: 0, armR: 0, bob: 0, tilt: 0, weapon: null };
  switch (state) {
    case "Walk": {
      const s = Math.sin(t * 10);
      pose.legL = s * 32; pose.legR = -s * 32;
      pose.armL = -s * 26; pose.armR = s * 26;
      pose.bob = Math.abs(Math.cos(t * 10)) * 3;
      break;
    }
    case "Jump":
      pose.legL = 22; pose.legR = -18; pose.armL = -140; pose.armR = 150;
      break;
    case "Hit":
      pose.armR = -70; pose.weapon = "fist";
      break;
    case "Kick":
      pose.legR = -60; pose.armL = 20;
      break;
    case "SwordHit":
      pose.armR = -110; pose.weapon = "sword";
      break;
    case "Throw":
      pose.armR = -90; pose.weapon = "shuriken";
      break;
    case "Die":
      pose.tilt = 80; pose.bob = 10;
      break;
    case "Idle":
    default: {
      const s = Math.sin(t * 2.2);
      pose.armL = 6 + s * 3; pose.armR = -6 - s * 3;
      pose.bob = s * 1.5;
      break;
    }
  }
  return pose;
}

function drawNinja(ctx, x, y, facing, color, state, t) {
  const p = poseFor(state, t);
  ctx.save();
  ctx.translate(x, y - p.bob);
  ctx.rotate((p.tilt * facing * Math.PI) / 180);
  ctx.scale(facing, 1);
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = 5; ctx.lineCap = "round";

  // Beine
  limb(ctx, 0, -2, p.legL, 28);
  limb(ctx, 0, -2, p.legR, 28);
  // Rumpf
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -40); ctx.stroke();
  // Arme
  limb(ctx, 0, -36, p.armL, 24);
  limb(ctx, 0, -36, p.armR, 24, p.weapon);
  // Kopf (mit Ninja-Maske: Augenstreifen)
  ctx.beginPath(); ctx.arc(0, -48, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#0a0e14";
  ctx.fillRect(-11, -51, 22, 5);

  ctx.restore();
}

function limb(ctx, x, y, angleDeg, length, weapon) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, length); ctx.stroke();
  if (weapon === "sword") {
    ctx.strokeStyle = "#cfd6dd"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, length); ctx.lineTo(0, length + 26); ctx.stroke();
  } else if (weapon === "shuriken") {
    ctx.fillStyle = "#cfd6dd";
    drawStar(ctx, 0, length + 4, 6);
  }
  ctx.restore();
}

function drawStar(ctx, x, y, r) {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.4;
    const a = (Math.PI / 4) * i;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
