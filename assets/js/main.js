/**
 * Ninja Fight — Boot
 * Entspricht Main.as: legt die zentralen Objekte an und startet die
 * Anwendung im Menü-Zustand.
 */
window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("stage");
  window.ctx = canvas.getContext("2d");

  const sound = new SoundController();
  window.game = new GameManager(sound);

  ui.init();

  // Startbildschirm einmal zeichnen, damit die Bühne nicht leer bleibt,
  // solange kein Level läuft
  window.ctx.fillStyle = "#0b1a24";
  window.ctx.fillRect(0, 0, STAGE_W, STAGE_H);
});
