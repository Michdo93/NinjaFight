/**
 * Sprite-Manifest — beschreibt, wo auf den Sprite-Sheets welcher Frame
 * liegt. Alle Frames wurden mit einem SWF-Decompiler (JPEXS FFDec) aus der
 * Original-SWF exportiert (echte gerenderte Bilder, keine Nachzeichnung)
 * und dann zu Sprite-Sheets zusammengefasst. Die exakten Frame-Bereiche
 * pro Animationszustand (Idle/Walk/Jump/Hit/Kick/Throw/Die/SwordHit)
 * stammen aus den Frame-Labels in der Original-FLA
 * (LIBRARY/Character/Hero/Hero.xml, identisch für alle vier Gegnertypen).
 *
 * Jede Figur (Hero/Blue/Green/Red/White) hat ihr eigenes Sheet mit
 * identischem Raster (8 Spalten × 8 Zeilen, eine Zeile pro Zustand,
 * 8 abgetastete Frames pro Zustand). Die Original-FLA hatte zusätzlich
 * gespiegelte "2"-Varianten (Idle2/Walk2/...) für die andere Blickrichtung
 * — hier bewusst durch einen einfachen horizontalen Flip ersetzt (spart
 * die Hälfte der Bilddaten und ist konsistent mit SwordHit, das im
 * Original ohnehin nur in einer Richtung existierte).
 */

const CHARACTER_SHEET = {
  cellW: 160, cellH: 150,
  anchorX: 30, anchorY: 145, // "Fußpunkt" innerhalb jeder Zelle
  cols: 8,
  states: {
    Idle: { row: 0, count: 8 },
    Walk: { row: 1, count: 8 },
    Jump: { row: 2, count: 8 },
    Hit: { row: 3, count: 8 },
    Kick: { row: 4, count: 8 },
    Throw: { row: 5, count: 8 },
    Die: { row: 6, count: 8 },
    SwordHit: { row: 7, count: 8 },
  },
};

const TILE_SHEET = {
  cellW: 42, cellH: 66,
  tiles: {
    Floor: { row: 0, count: 1, w: 41, h: 21 },
    WaterGround: { row: 1, count: 1, w: 40, h: 18 },
    Bridge: { row: 2, count: 1, w: 36, h: 13 },
    Ladder: { row: 3, count: 1, w: 25, h: 24 },
    Knives: { row: 4, count: 1, w: 18, h: 16 },
    Small: { row: 5, count: 1, w: 41, h: 24 },
    Sword: { row: 6, count: 1, w: 17, h: 65 },
    Shuriken: { row: 7, count: 1, w: 21, h: 21 },
    Heart: { row: 8, count: 1, w: 35, h: 30 },
    Flame: { row: 9, count: 8, w: 16, h: 26 },
  },
};

if (typeof module !== "undefined") module.exports = { CHARACTER_SHEET, TILE_SHEET };
