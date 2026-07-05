/**
 * Ninja Fight — GameManager
 * Entspricht GameManager.as + Main.as + GUIController.as, zusammengefasst
 * für die Web-Portierung. Siehe README für die vollständige Liste der
 * dabei behobenen Fehler aus "Ninja Fight_KnownBugs.pdf".
 */

// entspricht der "GUI/GUIComponent/Background"-Instanz, die laut den
// Original-Leveldaten (Level1..4.xml) als allererstes Element in JEDEM
// Level auf der Bühne liegt, zentriert auf die 1024×576-Bühne
const levelBackground = new Image();
levelBackground.src = "assets/img/background.png";

/* ==================================================================== */
/* Level-Kacheln zeichnen                                                */
/* ==================================================================== */
function drawLevel(ctx, level) {
  // Original-Hintergrundbild statt einer dunklen Nacht-Optik — das Spiel
  // spielt tagsüber vor derselben Wald-/Berg-Kulisse wie das Hauptmenü
  if (levelBackground.complete && levelBackground.naturalWidth > 0) {
    ctx.drawImage(levelBackground, 0, 0, STAGE_W, STAGE_H);
  } else {
    ctx.fillStyle = "#bfe8ea"; ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  }

  // Original-Kachelgrafiken, per Sprite-Sheet aus der decompilierten SWF
  // (siehe spritedata.js / render.js für die Herkunft)
  level.platforms.forEach(p => {
    drawTile(ctx, p.type, p.x, p.y);
  });

  level.ladders.forEach(l => {
    for (let y = l.top; y < l.bottom; y += 24) drawTile(ctx, "Ladder", l.left, y);
  });

  level.flames.forEach(f => {
    const frame = Math.floor(performance.now() / 90 + f.x) % 8;
    const scale = 1.3;
    const size = tileSize("Flame");
    const dh = size.h * scale;
    drawTile(ctx, "Flame", f.x - (size.w * scale - f.w) / 2, f.y - dh, { frame, scale });
  });

  level.knives.forEach(k => {
    drawTile(ctx, "Knives", k.x, k.y);
  });
}

/* ==================================================================== */
/* GameManager                                                           */
/* ==================================================================== */
class GameManager {
  constructor(sound) {
    this.sound = sound;
    this.level = null;
    this.levelNum = 0;
    this.maxLevels = 4;
    this.points = 0;
    this.lifeEnergy = 0;
    this.hero = null;
    this.enemies = [];
    this.powerUps = [];
    this.projectiles = [];
    this.keys = { left: false, right: false, up: false, down: false, jump: false };
    this.paused = false;
    this.running = false;
    this.isHeroDead = false;
    this.timeLeft = 0;
    this._raf = null;
    this._lastTime = 0;
    this._powerUpQueue = [];
  }

  /* ---------------- Ablaufsteuerung ---------------- */
  startGame() {
    this.levelNum = 0;
    this.points = 0;
    this.paused = false;
    this.isHeroDead = false;
    this.nextLevel();
    ui.showScreen("game");
    this.sound.playGameMusic();
    this._lastTime = 0;
    this.running = true;
    if (!this._raf) this._raf = requestAnimationFrame(t => this.loop(t));
  }

  nextLevel() {
    this.cleanUpLevel();

    if (this.levelNum >= this.maxLevels) { this.endGame(); return; }
    this.levelNum++;
    this.isHeroDead = false;

    this.level = buildLevel(this.levelNum);
    this.lifeEnergy = 10 * this.levelNum;
    this.timeLeft = 120 * this.levelNum;

    this.hero = new Hero(this, 90, GROUND_LEVEL_Y);
    this.enemies = [];
    const enemyType = ["Blue", "Green", "Red", "White"][this.levelNum - 1];
    const slotWidth = (STAGE_W - 500) / 4;
    for (let i = 0; i < 4; i++) {
      const x = 380 + i * slotWidth + Math.random() * slotWidth * 0.6;
      this.enemies.push(new Enemy(this, enemyType, x, GROUND_LEVEL_Y));
    }
    this.powerUps = [];
    this.projectiles = [];
    this.setupPowerUpSchedule();

    ui.setStatus(`Level ${this.levelNum}`);
    ui.updateHud(this);
  }

  setupPowerUpSchedule() {
    const count = 3 + Math.floor(Math.random() * 8); // 3..10, wie im Original
    this._powerUpQueue = [];
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      const type = r < 0.7 ? "Heart" : r < 0.9 ? "Shuriken" : "Sword";
      this._powerUpQueue.push(type);
    }
    this._powerUpTimeStep = this.timeLeft / (count + 1);
    this._powerUpCountdown = 0;
  }

  pauseGame() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.running = false;
    ui.showScreen("pause");
  }

  resumeGame() {
    if (!this.paused) return;
    this.paused = false;
    this.running = true;
    this._lastTime = 0;
    ui.showScreen("game");
    if (!this._raf) this._raf = requestAnimationFrame(t => this.loop(t));
  }

  endGame() {
    this.running = false;
    this.cleanUpLevel();
    this.sound.stopAll();
    this.sound.playMenuMusic();
    ui.showGameOver(this.levelNum, this.points);
  }

  onHeroDeath(cause) {
    if (this.isHeroDead) return;
    this.isHeroDead = true;
    if (this.hero) this.hero.setState("Die");
    // Fix für KnownBugs #14: Aufräumen wird auf den nächsten Frame verschoben,
    // statt mitten in der Kollisionsschleife des Helden selbst zu passieren
    // (im Original Ursache für den Absturz bei Tod durch Feuer/Messer)
    setTimeout(() => this.endGame(), 700);
  }

  onEnemyKilled(enemy) {
    this.changePoints(1 * this.levelNum);
    if (this.enemies.every(e => e.dead)) {
      ui.setStatus("Level geschafft!");
      setTimeout(() => this.nextLevel(), 900);
    }
  }

  changeLifeEnergy(amount, reduce) {
    this.lifeEnergy += reduce ? -amount : amount;
    this.lifeEnergy = Math.max(0, this.lifeEnergy);
    ui.updateHud(this);
    if (this.lifeEnergy <= 0 && !this.isHeroDead) this.onHeroDeath("energy");
  }

  changePoints(p) { this.points += p; ui.updateHud(this); }

  spawnProjectile(x, y, dir, owner) { this.projectiles.push(new Projectile(x, y, dir, owner)); }

  cleanUpLevel() {
    this.hero = null;
    this.enemies = [];
    this.powerUps = [];
    this.projectiles = [];
    this.level = null;
  }

  /* ---------------- Game-Loop ---------------- */
  loop(now) {
    this._raf = requestAnimationFrame(t => this.loop(t));
    if (!this.running || this.paused) return;
    if (this._lastTime === 0) this._lastTime = now;
    const dt = Math.min((now - this._lastTime) / 1000, 0.05);
    this._lastTime = now;

    this.update(dt);
    this.render();
  }

  update(dt) {
    if (!this.isHeroDead) {
      this.timeLeft -= dt;
      this._powerUpCountdown = (this._powerUpCountdown || 0) + dt;
      if (this._powerUpQueue.length > 0 && this._powerUpCountdown >= this._powerUpTimeStep) {
        this._powerUpCountdown = 0;
        const type = this._powerUpQueue.shift();
        const x = 120 + Math.random() * (STAGE_W - 240);
        this.powerUps.push(new PowerUp(type, x, -20));
      }
      if (this.timeLeft <= 0) { this.timeLeft = 0; ui.setStatus("Zeit abgelaufen"); setTimeout(() => this.nextLevel(), 600); this.isHeroDead = true; }
    }

    if (this.hero && !this.isHeroDead) this.hero.update(dt);
    this.enemies.forEach(e => e.update(dt));
    this.projectiles.forEach(p => p.update(dt, this));
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.powerUps.forEach(p => p.update(dt, this));
    this.powerUps = this.powerUps.filter(p => !p.collected);

    ui.updateHudTime(this.timeLeft);
    ui.updateHud(this);
  }

  render() {
    const ctx = window.ctx;
    if (!this.level) return;
    drawLevel(ctx, this.level);
    this.powerUps.forEach(p => p.draw(ctx));
    this.enemies.forEach(e => e.draw(ctx));
    if (this.hero) this.hero.draw(ctx);
    this.projectiles.forEach(p => p.draw(ctx));
  }

  /* ---------------- Eingabe ---------------- */
  keyDown(e) {
    if (!this.running) return;
    const k = this.keys;
    switch (e.code) {
      case "ArrowUp": case "KeyW": k.up = true; break;
      case "ArrowLeft": case "KeyA": k.left = true; break;
      case "ArrowDown": case "KeyS": k.down = true; break;
      case "ArrowRight": case "KeyD": k.right = true; break;
      case "Space": k.jump = true; e.preventDefault(); break;
      case "KeyR": if (this.hero) this.hero.hit(); break;
      case "KeyF": if (this.hero) this.hero.kick(); break;
      case "KeyE": if (this.hero) this.hero.useSword(); break;
      case "KeyQ": if (this.hero) this.hero.useShuriken(); break;
      case "Escape": this.pauseGame(); break;
      default: return;
    }
  }
  keyUp(e) {
    const k = this.keys;
    switch (e.code) {
      case "ArrowUp": case "KeyW": k.up = false; break;
      case "ArrowLeft": case "KeyA": k.left = false; break;
      case "ArrowDown": case "KeyS": k.down = false; break;
      case "ArrowRight": case "KeyD": k.right = false; break;
      case "Space": k.jump = false; break;
      default: return;
    }
  }
}
