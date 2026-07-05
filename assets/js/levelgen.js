/**
 * Ninja Fight — zusätzliche Level 5–10
 *
 * Die Original-FLA hatte nur vier Level (eines pro Gegnertyp). Auf Wunsch
 * wurden sechs weitere Level ergänzt, die dieselbe Kachel-Sprache benutzen
 * (Floor/Small/Bridge/WaterGround/Ladder/Flame/Knives — alles echte
 * Original-Sprites, siehe render.js). Jedes Level ist deterministisch
 * (fester Seed pro Levelnummer), damit es bei jedem Durchlauf gleich
 * aussieht, aber mit wachsender Komplexität: mehr Plattformen, mehr
 * Gefahren, größere Wasserflächen je höher die Levelnummer.
 *
 * Fairness-Prinzip: Der Bodenpfad (y=414) ist IMMER vollständig begehbar
 * (Floor oder WaterGround, niemals eine echte Lücke ohne Boden darunter),
 * Gefahren stehen nie zwei Kacheln nebeneinander auf dem Bodenpfad. Leitern
 * und erhöhte Plattformen sind optionale Nebenwege, kein Level erfordert
 * sie zwingend.
 */

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function next() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateLevel(levelNum) {
  const rand = seededRandom(levelNum * 7919 + 101);
  const tiles = [];
  const groundY = 414;
  const tileW = 40;
  const cols = 24; // 0..920

  // --- Bodenpfad: durchgehend, ein bis zwei Wasserflächen (begehbar) ---
  const extra = levelNum - 5; // 0..5, wächst mit jedem neuen Level
  const numWaterPools = 1 + Math.floor(extra / 3);
  const waterRanges = [];
  for (let i = 0; i < numWaterPools; i++) {
    let start, tries = 0;
    do { start = 4 + Math.floor(rand() * (cols - 10)); tries++; }
    while (waterRanges.some(([a, b]) => start < b + 2 && start + 4 > a - 2) && tries < 30);
    waterRanges.push([start, start + 3]);
  }
  for (let i = 0; i < cols; i++) {
    const inWater = waterRanges.some(([a, b]) => i >= a && i < b);
    tiles.push({ type: inWater ? "WaterGround" : "Floor", x: i * tileW, y: groundY });
  }

  // Über einer der Wasserflächen liegt ab Level 7 eine Brücke als Alternative
  if (levelNum >= 7 && waterRanges.length > 0) {
    const [a, b] = waterRanges[0];
    for (let i = a; i < b; i++) tiles.push({ type: "Bridge", x: i * tileW, y: groundY - 116 });
  }

  // --- Erhöhte Plattformen (Small), Anzahl wächst mit dem Level ---
  const numPlatforms = 2 + Math.floor(extra / 2);
  const platformBands = [groundY - 100, groundY - 160];
  const usedCols = new Set();
  const platforms = [];
  for (let p = 0; p < numPlatforms; p++) {
    let startCol, tries = 0;
    do { startCol = 2 + Math.floor(rand() * (cols - 7)); tries++; }
    while (Array.from({ length: 4 }, (_, k) => startCol + k).some(c => usedCols.has(c)) && tries < 30);
    const length = 3 + Math.floor(rand() * 2);
    const py = platformBands[p % platformBands.length];
    for (let j = 0; j < length; j++) { tiles.push({ type: "Small", x: (startCol + j) * tileW, y: py }); usedCols.add(startCol + j); }
    platforms.push({ startCol, length, y: py });
  }

  // --- Leitern: verbinden den Boden mit einer erhöhten Plattform ---
  const numLadders = 1 + Math.floor(extra / 3);
  for (let l = 0; l < Math.min(numLadders, platforms.length); l++) {
    const plat = platforms[l];
    const ladderCol = plat.startCol + Math.floor(plat.length / 2);
    for (let y = groundY - 24; y > plat.y; y -= 24) tiles.push({ type: "Ladder", x: ladderCol * tileW, y });
  }

  // --- Gefahren: Flame (Schaden) häufiger, Knives (sofort tödlich) sparsam.
  //     Nie zwei Gefahren auf direkt benachbarten Bodenkacheln. ---
  const numFlames = 2 + Math.floor(extra * 0.8);
  const numKnives = 1 + Math.floor(extra * 0.6);
  const hazardCols = new Set();

  function placeHazard(type) {
    let col, tries = 0;
    do {
      col = 2 + Math.floor(rand() * (cols - 4));
      tries++;
    } while ((hazardCols.has(col) || hazardCols.has(col - 1) || hazardCols.has(col + 1) || waterRanges.some(([a, b]) => col >= a - 1 && col < b + 1)) && tries < 40);
    hazardCols.add(col);
    tiles.push({ type, x: col * tileW, y: groundY });
  }
  for (let i = 0; i < numFlames; i++) placeHazard("Flame");
  for (let i = 0; i < numKnives; i++) placeHazard("Knives");

  // gelegentlich auch eine Gefahr auf einer erhöhten Plattform (ab Level 8)
  if (levelNum >= 8 && platforms.length > 0) {
    const plat = platforms[platforms.length - 1];
    const col = plat.startCol + Math.floor(rand() * plat.length);
    tiles.push({ type: "Knives", x: col * tileW, y: plat.y });
  }

  return tiles;
}

if (typeof module !== "undefined") module.exports = { generateLevel };
