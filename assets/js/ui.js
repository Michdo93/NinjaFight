/**
 * Ninja Fight — UI-Steuerung
 * Entspricht GUIController.as + Main.as (Bildschirmwechsel) sowie
 * StartMenu/PauseMenu/Settings/Highscore/HowTo/Credits/GameOver.as.
 *
 * Wichtigste Anpassung: Der Original-Highscore lief über einen PHP-Server
 * auf dem Hochschul-Webspace (Highscore.as/GameOver.as → saveScore.php/
 * highscore.php). GitHub Pages kann kein PHP ausführen — die Highscore-
 * Liste wird deshalb über localStorage im Browser gespeichert. Siehe
 * README für Details.
 */

const HIGHSCORE_KEY = "ninjafight_highscores";
const SETTINGS_KEY = "ninjafight_settings";

const ui = {
  lang: "English",
  volume: 60,

  init() {
    this.loadSettings();
    this.wireMenus();
    this.applyStrings();
    window.addEventListener("keydown", e => game.keyDown(e));
    window.addEventListener("keyup", e => game.keyUp(e));
    setTimeout(() => this.showScreen("menu"), 500);
  },

  loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (saved.lang) this.lang = saved.lang;
      if (typeof saved.volume === "number") this.volume = saved.volume;
    } catch (e) { /* ignore */ }
    game.sound.changeVolume(this.volume / 100);
  },
  saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ lang: this.lang, volume: this.volume }));
  },

  showScreen(name) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const el = document.getElementById("screen-" + name);
    if (el) el.classList.add("active");
    if (name === "menu" || name === "pause") game.sound.playMenuMusic();
    if (name === "highscore") this.renderHighscore();
  },

  applyStrings() {
    const dict = STRINGS[this.lang] || STRINGS.English;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (dict[key] != null) el.textContent = dict[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (dict[key] != null) el.placeholder = dict[key];
    });
    document.getElementById("set-language").value = this.lang;
    document.getElementById("set-volume").value = this.volume;
  },

  setStatus(msg) {
    const el = document.getElementById("status-msg");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => el.classList.remove("show"), 1400);
  },

  updateHud(g) {
    document.getElementById("hud-level").textContent = `${(STRINGS[this.lang] || STRINGS.English).level}: ${g.levelNum}`;
    document.getElementById("hud-life").textContent = `❤ ${g.lifeEnergy}`;
    document.getElementById("hud-points").textContent = `${(STRINGS[this.lang] || STRINGS.English).points}: ${g.points}`;
    const hero = g.hero;
    const weaponsEl = document.getElementById("hud-weapons");
    if (hero) {
      const parts = [];
      if (hero.hasShuriken) parts.push(`✦ ${hero.shurikenCount}`);
      if (hero.hasSword) parts.push(`🗡`);
      weaponsEl.textContent = parts.join("   ");
    } else {
      weaponsEl.textContent = "";
    }
  },
  updateHudTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60), r = s % 60;
    document.getElementById("hud-time").textContent = `${m}:${String(r).padStart(2, "0")}`;
  },

  showGameOver(level, points) {
    document.getElementById("go-level").textContent = level;
    document.getElementById("go-points").textContent = points;
    document.getElementById("go-name").value = "";
    document.getElementById("go-name").disabled = false;
    const btn = document.getElementById("btn-send-score");
    btn.disabled = false;
    btn.textContent = (STRINGS[this.lang] || STRINGS.English).sendScore;
    this._pendingScore = { level, points };
    this.showScreen("gameover");
  },

  /* -------- Highscore: localStorage statt PHP-Server -------- */
  loadHighscoreList() {
    try { return JSON.parse(localStorage.getItem(HIGHSCORE_KEY) || "[]"); }
    catch (e) { return []; }
  },
  saveHighscoreEntry(name, points, level) {
    const list = this.loadHighscoreList();
    list.push({ name: name || "Anonymous", points, level });
    list.sort((a, b) => b.points - a.points);
    localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(list.slice(0, 20)));
  },
  renderHighscore() {
    const list = this.loadHighscoreList();
    const el = document.getElementById("highscore-list");
    if (list.length === 0) { el.textContent = "Noch keine Einträge — spiel eine Runde!"; return; }
    el.textContent = "Name, Points, Level\n\n" + list.map(e => `${e.name}, ${e.points}, ${e.level}`).join("\n");
  },

  /* -------- Menü-Verdrahtung -------- */
  wireMenus() {
    document.getElementById("btn-play").addEventListener("click", () => game.startGame());
    document.getElementById("btn-highscore").addEventListener("click", () => this.showScreen("highscore"));
    document.getElementById("btn-settings").addEventListener("click", () => this.showScreen("settings"));
    document.getElementById("btn-howto").addEventListener("click", () => this.showScreen("howto"));
    document.getElementById("btn-credits").addEventListener("click", () => this.showScreen("credits"));

    document.getElementById("btn-settings-back").addEventListener("click", () => this.showScreen(this._settingsReturnTo || "menu"));
    document.getElementById("btn-howto-back").addEventListener("click", () => this.showScreen(this._howtoReturnTo || "menu"));
    document.getElementById("btn-credits-back").addEventListener("click", () => this.showScreen("menu"));
    document.getElementById("btn-highscore-back").addEventListener("click", () => this.showScreen(this._highscoreReturnTo || "menu"));

    document.getElementById("set-volume").addEventListener("input", (e) => {
      this.volume = Number(e.target.value);
      game.sound.changeVolume(this.volume / 100);
      this.saveSettings();
    });
    document.getElementById("set-language").addEventListener("change", (e) => {
      this.lang = e.target.value;
      this.applyStrings();
      this.saveSettings();
    });

    // Pause-Menü — Fix für KnownBugs #1 ("Resume-Button ruft resumeGame()
    // sofort auf statt eine Funktionsreferenz zu übergeben")
    document.getElementById("btn-resume").addEventListener("click", () => game.resumeGame());
    document.getElementById("btn-pause-highscore").addEventListener("click", () => { this._highscoreReturnTo = "pause"; this.showScreen("highscore"); });
    document.getElementById("btn-pause-settings").addEventListener("click", () => { this._settingsReturnTo = "pause"; this.showScreen("settings"); });
    document.getElementById("btn-pause-howto").addEventListener("click", () => { this._howtoReturnTo = "pause"; this.showScreen("howto"); });
    document.getElementById("btn-pause-menu").addEventListener("click", () => { game.running = false; game.paused = false; game.cleanUpLevel(); this.showScreen("menu"); });

    // Game Over
    document.getElementById("btn-send-score").addEventListener("click", () => {
      const name = document.getElementById("go-name").value.trim();
      this.saveHighscoreEntry(name, this._pendingScore.points, this._pendingScore.level);
      document.getElementById("go-name").disabled = true;
      const btn = document.getElementById("btn-send-score");
      btn.disabled = true;
      btn.textContent = "✓";
    });
    document.getElementById("btn-play-again").addEventListener("click", () => game.startGame());
    document.getElementById("btn-back-to-menu").addEventListener("click", () => this.showScreen("menu"));

    // ESC im Spiel pausiert (Fix für KnownBugs #1 — im Original auskommentiert)
    document.getElementById("btn-pause-icon")?.addEventListener("click", () => game.pauseGame());
  },
};
