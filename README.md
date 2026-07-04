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

**Nicht 1:1 übernommen werden konnten** die eigentlichen Charakter- und
Umgebungsgrafiken selbst — sie liegen als verschachtelte Vektor-Bodyparts
(Kopf/Rumpf/Arme/Beine als separate Animate-Symbole, jeweils mit vielen
Tween-Zwischenschritten pro Animation) vor, keine einfachen Bilddateien.
Eine vollständige Rekonstruktion hätte einen eigenen XFL-Vektor-Renderer
erfordert. Stattdessen wurden die **echten Fill-Farben** aus
`BodyPart/{Head,Torso,Sword}.xml` für jede Figur extrahiert
(`<SolidColor color="#...">`-Werte) und für eine originalgetreue Farbgebung
verwendet:

| Figur | Anzugfarbe (Torso) | Besatz/Sash | aus |
|-------|---------------------|-------------|-----|
| Held | `#333333` (Dunkelgrau) | `#C00E0E` (Rot) | `Hero/BodyPart/Torso.xml` |
| Enemy Blue | `#003399` (Blau) | `#FFFFFF` (Weiß) | `Enemy/Blue/BodyPart/Torso.xml` |
| Enemy Green | `#FFCC00` (Gelb) | `#006600` (Grün) | `Enemy/Green/BodyPart/Torso.xml` |
| Enemy Red | `#CC0000` (Rot) | `#3B3B3B` (Dunkelgrau) | `Enemy/Red/BodyPart/Torso.xml` |
| Enemy White | `#0066FF` (Blau) | `#FFFFFF` (Weiß) | `Enemy/White/BodyPart/Torso.xml` |

Das rote Kopfband (`#C00E0E`) und der Hautton (`#D2AD81`) sind bei **allen**
Figuren identisch — offenbar ein figurenübergreifendes Clan-Symbol statt
einer Fraktionsfarbe. Auch die Schwertfarben (Silberklinge `#CCCCCC`,
goldener Griff `#FFCC66`) wurden 1:1 aus `BodyPart/Sword.xml` übernommen
und sind bei jeder Figur identisch. Die grobe Silhouette (Rumpf schulterbreit
und taillenschmal, Kopf breiter als hoch) wurde an die tatsächliche
Bounding-Box der Original-Formen angenähert.

## Architektur

```
/
├── index.html                  alle Bildschirme (Menü, Spiel, Pause, …)
├── assets/
│   ├── css/style.css            gemeinsames Stylesheet
│   ├── js/
│   │   ├── levels.js             extrahierte Original-Leveldaten
│   │   ├── strings.js            Original-Sprachdaten (EN/DE)
│   │   ├── render.js             Ninja-Figur zeichnen (ersetzt die Vektor-Bodyparts)
│   │   ├── entities.js           Hero, Enemy, PowerUp, Projectile
│   │   ├── gamemanager.js        Spiellogik, Level-Aufbau, Game-Loop
│   │   ├── ui.js                 Menüs, Einstellungen, Highscore
│   │   └── main.js               Boot
│   ├── sounds/*.mp3               Original-Audiodateien
│   └── img/background.png         Original-Hintergrundbild
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
