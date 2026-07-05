# Ninja Fight — HTML5/JS-Portierung

Ninja Fight ist ursprünglich ein 2D-Plattform-Kampfspiel, das in **Adobe
Animate / ActionScript 3** entwickelt wurde (Konzept & Umsetzung: Michael
Dörflinger, Hochschule Furtwangen, Studiengang MIB, WS 2017/2018). Dieses
Repo portiert das komplette, in der Abgabe unfertig gebliebene Spiel nach
**HTML5 Canvas + Vanilla JavaScript** — lauffähig direkt im Browser, ohne
Flash Player, ohne Build-Schritt, bereit für GitHub Pages.

▶ **[Spielen](./index.html)**

## Ausgangslage

Das Original-Archiv (`Endabgabe/`) enthielt:

- 35 AS3-Klassen (`Source/Classes/`) — viele davon nur Rümpfe ohne
  Verhalten (siehe unten)
- eine `ninja-fight.fla` mit vier fertig gestalteten Levels (Level 1–4)
- Original-Sounddateien, ein Konzept-PDF und ein **"Known Bugs"-PDF**, in
  dem der Entwickler selbst dokumentiert hat, welche Systeme nicht fertig
  wurden
- drei praktisch identische Kopien desselben Projekts (`Build/`, `Source/`,
  `Projekt/`) — nur eine davon wurde als Quelle verwendet

Das Spiel war laut eigener Aussage **nicht fertiggestellt**. Diese
Portierung repariert die im Known-Bugs-Dokument aufgeführten Probleme,
statt sie unverändert zu übernehmen.

## Was aus dem Original übernommen wurde

| Asset | Herkunft | Verwendung |
|-------|----------|------------|
| Level-Layouts (Level 1–4) | aus `LIBRARY/Level/Level1..4.xml` der FLA extrahiert (`DOMSymbolInstance`-Positionen) | 1:1 in `assets/js/levels.js` — exakt dieselbe Platzierung von Boden, Brücken, Leitern, Wasser, Feuer, Messern wie im Original |
| Sprachdaten (Englisch/Deutsch) | `ExternalData/strings.json`, unverändert | `assets/js/strings.js` |
| Sounds | `Sounds/*.mp3`, unverändert | `assets/sounds/` |
| Menü-Hintergrund | eingebettetes PNG aus der FLA-Bibliothek (`GUI/GUIComponent/background.png`) | `assets/img/background.png` |
| **Charakter-Animationen** (Held + 4 Gegnertypen) | **echte gerenderte Frames aus einem SWF-Decompiler (JPEXS FFDec)** | `assets/img/sprites/{hero,blue,green,red,white}.png` |
| **Level-Elemente & Items** (Floor, Bridge, Ladder, Knives, Flame, Sword, Shuriken, Heart) | ebenfalls aus dem Decompiler-Export | `assets/img/sprites/tiles.png` |

### Von der Farbpalette zu echten Sprites

In einer früheren Fassung dieser Portierung gab es keinen Zugriff auf die
eigentlichen Grafikdaten — nur auf die FLA-Quelldatei, in der die Figuren
als verschachtelte Vektor-Bodyparts ohne fertig gerenderte Bilder vorlagen.
Die Lösung damals: die echten Fill-Farben aus den Shape-Definitionen
extrahieren und eine eigene, prozedural gezeichnete Strichfigur einfärben.

Mit einem **Decompiler-Export der SWF** (`decompiled.zip`, per JPEXS FFDec)
änderte sich das grundlegend: FFDec rendert für jede `DefineSprite`
(= jedes MovieClip-Symbol) jeden einzelnen Frame als fertiges PNG. Für den
Helden allein ergab das **465 Einzelbilder** — jede Pose jeder Animation,
pixelgenau wie im Original. Die Frame-Grenzen pro Animationszustand
(Idle/Walk/Jump/Hit/Kick/Throw/Die/SwordHit) wurden aus den Frame-Labels in
`LIBRARY/Character/Hero/Hero.xml` ausgelesen (z. B. `index="57" duration="51"
name="Jump"`) — identisch für alle vier Gegnertypen.

**Verarbeitungspipeline** (siehe Build-Historie, nicht Teil des Repos):

1. Pro Figur (Hero, Blue, Green, Red, White) und pro Zustand 8 Frames
   gleichmäßig aus dem jeweiligen Original-Bereich abgetastet (465 Frames
   pro Figur wären für ein kleines Web-Spiel unnötig groß — 8 pro Zustand
   reichen für eine flüssige Wirkung).
2. Jeder Frame auf ein einheitliches 160×150-Fenster zugeschnitten (deckt
   alle beobachteten Posen sicher ab).
3. Alle Frames einer Figur zu **einem** Sprite-Sheet zusammengefügt
   (8 Spalten × 8 Zeilen, eine Zeile pro Zustand) — ein Bild pro Figur statt
   Hunderter Einzeldateien, deutlich weniger HTTP-Requests.
4. Level-Elemente und Items (die meist nur 1 Frame haben, außer Flame mit
   37 Animationsframes) ebenso in ein gemeinsames `tiles.png` gepackt.

Ergebnis: 5 Charakter-Sheets (je 150–200 KB) + 1 Kachel-Sheet (15 KB) statt
einer selbst gezeichneten Näherung — die Figuren sehen jetzt exakt so aus
wie im Original, inklusive des tatsächlichen Kopfbands, der Maskenfarbe und
der Statur.

Die "2"-Varianten aus dem Original (`Idle2`, `Walk2`, … — vermutlich
gespiegelte Versionen für die andere Blickrichtung) wurden bewusst **nicht**
übernommen: `SwordHit` existierte im Original ohnehin nur in einer Richtung,
daher wird hier durchgängig ein einfacher horizontaler Canvas-Flip
(`ctx.scale(facing, 1)`) für die Blickrichtung verwendet — konsistent für
alle Zustände und mit halb so vielen Bilddaten.

## Architektur

```
/
├── index.html                  alle Bildschirme (Menü, Spiel, Pause, …)
├── assets/
│   ├── css/style.css            gemeinsames Stylesheet
│   ├── js/
│   │   ├── levels.js             extrahierte Original-Leveldaten
│   │   ├── strings.js            Original-Sprachdaten (EN/DE)
│   │   ├── spritedata.js         Sprite-Sheet-Manifest (welcher Frame liegt wo)
│   │   ├── render.js             Konstanten, Level-Aufbau, Sound, Sprite-Zeichnen
│   │   ├── entities.js           Hero, Enemy, PowerUp, Projectile
│   │   ├── gamemanager.js        Spiellogik, Level-Aufbau, Game-Loop
│   │   ├── ui.js                 Menüs, Einstellungen, Highscore
│   │   └── main.js               Boot
│   ├── sounds/*.mp3               Original-Audiodateien
│   └── img/
│       ├── background.png         Original-Hintergrundbild
│       └── sprites/
│           ├── hero.png, blue.png, green.png, red.png, white.png
│           │    (je 64 echte Original-Frames: 8 Zustände × 8 Posen)
│           └── tiles.png          Level-Elemente & Items (inkl. animiertes Feuer)
└── README.md
```

Die Klassenaufteilung folgt bewusst dem Original: `Hero`/`Enemy` entsprechen
`HeroController`/`*Controller.as`, `GameManager` entspricht
`GameManager.as` + `Main.as`, `ui.js` entspricht `GUIController.as` +
den Menü-Klassen.

## Behobene Fehler (aus "Ninja Fight_KnownBugs.pdf")

Das Original-Dokument listet 14 bekannte Probleme. Alle spielrelevanten
wurden für diese Portierung behoben:

| # | Problem im Original | Fix in dieser Portierung |
|---|----------------------|---------------------------|
| 1a | Pause-Menü: `btnResume.addEventListener(CLICK, Main.resumeGame())` ruft die Funktion sofort auf, statt eine Referenz zu übergeben — Resume funktioniert nie | `ui.js`: echte Funktionsreferenz `() => game.resumeGame()` |
| 1b | ESC-Taste zum Pausieren war auskommentiert (`//pauseGame();`) | in `gamemanager.js` aktiv verdrahtet |
| 1c | Shuriken-Wurfanimation lief, aber es wurde nie ein Projektil erzeugt | `Projectile`-Klasse in `entities.js`, die sich durch den Raum bewegt und bei Treffer/Bildschirmrand verschwindet |
| 1d | Leiter-Klettern war nicht implementiert (keine Prüfung, ob der Spieler gerade eine Leiter berührt) | `Hero.update()`: Leiterzone wird geprüft, `W`/`S` bewegen die Figur vertikal |
| 1e | Sprung funktionierte nicht zuverlässig (Bodenkollision widersprach der Sprungbewegung) | vollständig neue, geschwindigkeitsbasierte Sprungphysik (siehe unten) |
| 2 | Keine Schadenskollision zwischen Held und Gegnern (nur Kommentare im Code, nie umgesetzt) | echte Angriffs-Hitboxen für Hit/Kick/Schwert beim Helden, Kontakt-/Fernangriffe bei Gegnern |
| 7 | Highscore-Liste ließ sich nach dem Laden nicht scrollen | entfällt durch natives HTML-Scrolling (`overflow-y: auto`) |
| 12 | Gegner-Verhalten war nie implementiert (`*Controller.as` sind leere Rümpfe) — keine Bewegung, keine Landung auf Plattformen | einfache Patrouillen-KI mit derselben Schwerkraft-/Landungs-Logik wie beim Helden, plus Angriffe je nach Gegnertyp |
| 14 | Spielabsturz beim Tod durch Feuer, weil das Aufräumen mitten in der Kollisionsschleife des Helden selbst passierte | Aufräumen wird per `setTimeout()` auf den nächsten Frame verschoben (siehe `onHeroDeath()`) |

Zusätzlich behoben, weil beim Portieren aufgefallen: In
`AnimationController.as` lautete die Bedingung zum Sperren einer laufenden
Animation `currentAnimation != "Jump" || currentAnimation != "Jump2" || ...`
— eine Kette von `!=`-Vergleichen mit `||` ist immer wahr (ein String kann
nicht gleichzeitig zwei verschiedene Werte NICHT sein), wodurch die Sperre
nie griff. In dieser Portierung sperrt `Hero.setState()` korrekt: eine
laufende Angriffs-/Sprunganimation kann nicht durch Bewegung unterbrochen
werden (mit Tests verifiziert, siehe unten).

## Original-Farbwelt bestätigt

Das Spiel spielt tagsüber vor einer freundlichen Wald-/Berg-Kulisse — nicht
nachts, wie eine frühere Fassung dieser Portierung versehentlich annahm.
Laut den Original-Leveldaten (`Level1..4.xml`) ist die
`GUI/GUIComponent/Background`-Grafik (dasselbe helle Hintergrundbild wie im
Hauptmenü) das **erste Element in jedem einzelnen Level**. Mit den jetzt
verfügbaren Original-Sprites ist das ohnehin hinfällig — Boden, Wasser,
Brücke, Leiter und Gefahren sehen exakt wie im Original aus, nicht nur
farblich angenähert.

## Nachträgliche Korrekturen (nach visuellem Feedback)

| Problem | Ursache | Fix |
|---------|---------|-----|
| Ganzes Spielfeld wirkte abgedunkelt, wie durch ein Overlay | Die Basis-Regel `.screen` setzte einen dunklen Verlauf als Hintergrund für **alle** Bildschirme, auch `#screen-game` — der während des Spiels direkt über dem Canvas liegt | `#screen-game { background: none; }` mit hoher ID-Spezifität, damit es nicht mit der `.with-bg`-Regel der Menüs kollidiert |
| Herz-Pickup wirkte überdimensioniert | PowerUp-Icons wurden in Original-Sprite-Größe (35×30px) statt herunterskaliert gezeichnet | einheitlicher Skalierungsfaktor 0.55 für Heart/Sword/Shuriken-Pickups |
| Flammen saßen zu tief/wirkten zu klein | `Flame.y` in den Original-Leveldaten entspricht der **Bodenhöhe** (Basis der Flamme), nicht ihrer Oberkante — wurde als Top-Left-Position missverstanden | Flamme wird jetzt mit der Unterkante an `y` verankert (wächst nach oben) und um Faktor 1.3 vergrößert |
| Keine erkennbare Kletter-Animation auf der Leiter | Das Original hat **keine eigene Climb-Animation** (laut KnownBugs war das Klettern nie vollständig fertig) | ersatzweise werden die Jump-Frames in Dauerschleife verwendet — optisch die am ehesten passende vorhandene Pose |
| Gegner wirkten wie eingefroren | Patrouillenradius war mit ±70px winzig, Spawn-Positionen konnten sich gegenseitig überlappen | Patrouillenradius auf ±220px erhöht, Spawn-Positionen gleichmäßig über die Levelbreite verteilt, außerdem gelegentliches Klettern und Springen während der Patrouille ergänzt |

## Weitere Ergänzungen (zweite Feedback-Runde)

| Wunsch/Problem | Umsetzung |
|-----------------|-----------|
| Shuriken-Anzahl im HUD sichtbar machen | neues HUD-Feld `#hud-weapons` zeigt Shuriken-Anzahl (✦) und ob ein Schwert getragen wird (🗡) |
| Lebensanzeige über Gegnern | `drawHealthBar()` in `render.js` — schmaler grün/orange/rot abnehmender Balken über jedem Gegnerkopf |
| Leiter: am oberen/unteren Ende nicht normal weiterlaufen können | Kletterlogik komplett neu geschrieben: Klettern greift nur, solange ausschließlich hoch/runter gedrückt wird — sobald links/rechts gedrückt wird, wird die Leiter sofort verlassen und normale Bewegung/Schwerkraft greift wieder |
| Keine Kletter-Sprites | Das Original hat keine eigene Climb-Animation (nie fertiggestellt) — ersatzweise laufen die Jump-Frames in Dauerschleife während des Kletterns |
| Schwert nicht sichtbar, wenn getragen (nur bei Angriff) | Im Original zeigt nur die SwordHit-Animation selbst das Schwert. Für Idle/Walk/Jump wird jetzt ein kleines Schwert-Sprite schräg auf dem Rücken ergänzt (`showSheathed` in `drawNinja()`), solange `hasSword` gesetzt ist und keine Angriffsanimation läuft — gilt für Helden und Gegner gleichermaßen |
| Gegner sollen Items einsammeln können | `PowerUp.update()` prüft jetzt alle Charaktere (Held **und** alle lebenden Gegner) auf Kollision, nicht mehr nur den Helden — wer zuerst da ist, bekommt das Item. Gegner haben dafür eine eigene `collectPowerUp()`-Methode (Heart heilt, Sword/Shuriken schalten die jeweilige Fähigkeit frei) |

## Notwendige Anpassungen für GitHub Pages

- **Server-Highscore → `localStorage`.** Das Original schickte Highscores
  per `URLLoader` an einen PHP-Server auf dem Hochschul-Webspace
  (`saveScore.php`/`highscore.php`). GitHub Pages kann kein PHP ausführen —
  die Highscore-Liste wird deshalb lokal im Browser gespeichert
  (`localStorage`). Das Prinzip (Name, Punkte, Level speichern und sortiert
  anzeigen) bleibt identisch, nur ist die Liste jetzt pro Gerät statt global.
- **Sprung-/Bewegungsphysik neu geschrieben.** Statt die fehlerhafte
  Original-Physik (`deltaY += 0.125`, kollidierende Prüfschleifen) zu
  reparieren, wurde eine saubere, geschwindigkeitsbasierte Physik verwendet
  (konstante Erdanziehung, Sprunggeschwindigkeit, Landungserkennung über
  Plattform-Kacheln) — dasselbe Muster wie in den beiden vorigen Repos
  dieser Reihe.

## Testen

Da dieses Spiel mit echten Fehlerbehebungen wirbt, wurden die kritischen
Systeme mit einem headless Node-Test verifiziert (Sprung, Leiter,
Schuriken-Treffer, Nahkampf-Treffer, Pause/Resume-Einfrieren,
Level-Fortschritt über alle 4 Level, Tod ohne Absturz, Highscore-Speicherung).
Alle Tests laufen grün. Der Testcode ist nicht Teil des Repos (reines
Entwicklungswerkzeug), aber die Ergebnisse sind in den Commit-Notizen
nachvollziehbar.

## Steuerung

| Taste | Aktion |
|-------|--------|
| `W`/`↑`, `S`/`↓` | Leiter hoch/runter |
| `A`/`←`, `D`/`→` | Laufen |
| `Leertaste` | Springen |
| `R` | Schlagen |
| `F` | Treten |
| `E` | Schwert (wenn eingesammelt) |
| `Q` | Shuriken (wenn eingesammelt) |
| `ESC` | Pause |

## Lokal ansehen

```bash
python3 -m http.server 8000
# dann: http://localhost:8000
```

(Ein lokaler Server ist nicht strikt nötig, da diese Version ohne
`fetch()`-Aufrufe auskommt — funktioniert auch direkt per `file://`.)

## Deployment über GitHub Pages

1. Repo auf GitHub anlegen (z. B. `NinjaFight`) und diesen gesamten Ordner
   hineinpushen — `index.html` muss im Root-Verzeichnis liegen.
2. Im Repo zu **Settings → Pages** gehen.
3. Unter **"Build and deployment" → Source** **"GitHub Actions"**
   auswählen.
4. GitHub schlägt daraufhin die Workflow-Vorlage **"Static HTML"** vor —
   diese auswählen und committen (erzeugt automatisch
   `.github/workflows/static.yml`).
5. Warten, bis der Workflow unter **Actions** grün durchläuft (Build +
   Deploy).
6. Die Seite ist danach unter `https://<dein-username>.github.io/<repo-name>/`
   erreichbar.

Falls der Deploy-Schritt mit *"Deployment failed, try again later"*
fehlschlägt, obwohl der Build erfolgreich war: einmal **Re-run all jobs**
im fehlgeschlagenen Workflow-Run ausführen — das behebt laut den
GitHub-eigenen Diskussionen dazu die meisten Fälle, da es sich meist um ein
kurzzeitiges Problem auf GitHubs Seite handelt, nicht um einen Fehler in
eurem Repo.

## Quelle

Original-Konzept und ActionScript-3-Umsetzung: Michael Dörflinger,
Hochschule Furtwangen (Studiengang MIB), Vorlesung "Spieleentwicklung 2D",
WS 2017/2018. Diese Portierung ersetzt Animate/Flash vollständig durch
HTML5 Canvas + Vanilla JS und behebt die im Original dokumentierten Fehler.
