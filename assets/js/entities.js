/**
 * Ninja Fight — Spielobjekte
 * Hero entspricht HeroController.as + Hero.as (AnimationController),
 * Enemy fasst *Controller.as + Blue/Green/Red/White.as zusammen (im
 * Original nur Stubs ohne Verhalten — hier vollständig mit KI
 * implementiert, siehe README "Behobene Fehler"),
 * PowerUp entspricht PowerUp.as/Heart.as/Sword.as/Shuriken.as,
 * Projectile entspricht dem im Original fehlenden Shuriken-Objekt
 * (KnownBugs #1).
 */

// gemeinsame Schadenstabelle für Held und Gegner
const DAMAGE = { Hit: 1, Kick: 2, Shuriken: 5, Sword: 10 };
const SWORD_PICKUP_DURATION = 5; // Sekunden, wie gewünscht zeitlich begrenzt

/* ==================================================================== */
/* Hero — entspricht HeroController.as                                   */
/* ==================================================================== */
class Hero {
  constructor(game, x, y) {
    this.game = game;
    this.x = x; this.y = y;
    this.vy = 0;
    this.facing = 1;
    this.state = "Idle";
    this.t = 0;
    this.onGround = false;
    this.onLadder = false;
    this.hasSword = false;
    this.swordTimer = 0;
    this.hasShuriken = false;
    this.shurikenCount = 0;
    this.attackTimer = 0;
    this.attackHitDone = false;
    this.width = 24; this.height = 48;
    this.invulnTimer = 0; // kurze Unverwundbarkeit nach einem Treffer
  }

  get box() { return rectOf(this.x - this.width / 2, this.y - this.height, this.width, this.height); }
  get footY() { return this.y; }

  // entspricht moveHorizontal()
  moveHorizontal(dt) {
    const k = this.game.keys;
    if (k.left) { this.facing = -1; this.x -= WALK_SPEED * dt; if (this.state !== "Jump" && !this.onLadder) this.setState("Walk"); }
    else if (k.right) { this.facing = 1; this.x += WALK_SPEED * dt; if (this.state !== "Jump" && !this.onLadder) this.setState("Walk"); }
    else if (this.state === "Walk") this.setState("Idle");
    this.x = clamp(this.x, this.width / 2, STAGE_W - this.width / 2);
  }

  setState(state) {
    if (this.state === state) return;
    // entspricht doAction()/onActionDone() aus AnimationController.as —
    // eine laufende Angriffs-/Sprunganimation wird nicht durch Bewegungs-
    // wechsel unterbrochen (im Original per fehlerhafter Bedingung nie
    // wirksam, siehe README)
    const busy = ["Hit", "Kick", "SwordHit", "Throw", "Die"].includes(this.state) && this.attackTimer > 0;
    if (busy) return;
    this.state = state;
    this.t = 0;
    if (["Hit", "Kick", "SwordHit", "Throw"].includes(state)) { this.attackTimer = 0.35; this.attackHitDone = false; }
    if (state === "Die") this.attackTimer = 0.8;
  }

  hit() { this.setState("Hit"); }
  kick() { this.setState("Kick"); }
  useSword() { if (this.hasSword) { this.setState("SwordHit"); this.game.sound.playSword(); } }
  useShuriken() {
    if (this.hasShuriken && this.shurikenCount > 0) {
      this.setState("Throw");
      this.game.spawnProjectile(this.x + this.facing * 18, this.y - 30, this.facing, "hero");
      this.shurikenCount--;
      if (this.shurikenCount <= 0) this.hasShuriken = false;
    }
  }

  // entspricht update() — Schwerkraft, Kollision, Leiter (Leiter war im
  // Original nicht implementiert, siehe README)
  update(dt) {
    this.t += dt;
    if (this.attackTimer > 0) { this.attackTimer -= dt; if (this.attackTimer <= 0 && this.state !== "Die") this.setState("Idle"); }
    if (this.invulnTimer > 0) this.invulnTimer -= dt;

    const k = this.game.keys;
    if (this.state === "Die") { this.y += 40 * dt; return; }

    // Leiter-Erkennung (Fix für KnownBugs #1 "Leiter funktioniert nicht").
    // Klettern greift nur, solange ausschließlich hoch/runter gedrückt wird
    // — sobald links/rechts gedrückt wird (oder oben/unten losgelassen),
    // verlässt die Figur die Leiter sofort und läuft normal weiter (Fix
    // für "am Ende der Leiter nicht normal weiterlaufen können").
    const ladderZone = this.game.level.ladders.find(l => this.x > l.left - 4 && this.x < l.right + 4 && this.y > l.top - 6 && this.y < l.bottom + 6);
    const wantsToClimb = ladderZone && (k.up || k.down) && !k.left && !k.right;

    if (wantsToClimb) {
      this.onLadder = true;
      this.vy = 0;
      this.y += (k.up ? -1 : 1) * CLIMB_SPEED * dt;
      this.y = clamp(this.y, ladderZone.top, ladderZone.bottom);
      this.setState("Climb");
    } else {
      this.onLadder = false;
      this.moveHorizontal(dt);
    }

    if (!this.onLadder) {
      // Sprung / Schwerkraft (Fix für KnownBugs #1 "Sprung funktioniert nicht")
      if (k.jump && this.onGround) { this.vy = -JUMP_SPEED; this.onGround = false; this.setState("Jump"); }
      this.vy += GRAVITY * dt;
      const nextY = this.y + this.vy * dt;
      const landing = this.findLanding(nextY);
      if (landing && this.vy >= 0) { this.y = landing.y; this.vy = 0; this.onGround = true; if (this.state === "Jump") this.setState(k.left || k.right ? "Walk" : "Idle"); }
      else { this.y = nextY; this.onGround = false; }
    }

    if (this.y > STAGE_H + 80) this.game.onHeroDeath("fall");

    // Schwert ist nur zeitlich begrenzt verfügbar, sobald aufgesammelt
    if (this.hasSword && this.swordTimer > 0) {
      this.swordTimer -= dt;
      if (this.swordTimer <= 0) { this.hasSword = false; this.swordTimer = 0; }
    }

    // Angriffs-Trefferprüfung (Fix für KnownBugs #2 "keine Schadenkollision")
    // — unterschiedlicher Schaden je Angriffsart
    if (this.attackTimer > 0 && !this.attackHitDone && ["Hit", "Kick", "SwordHit"].includes(this.state)) {
      const range = this.state === "SwordHit" ? 46 : this.state === "Kick" ? 34 : 30;
      const dmg = this.state === "SwordHit" ? DAMAGE.Sword : this.state === "Kick" ? DAMAGE.Kick : DAMAGE.Hit;
      const hitBox = rectOf(this.x + (this.facing > 0 ? 0 : -range), this.y - 40, range, 30);
      this.game.enemies.forEach(en => { if (!en.dead && overlaps(hitBox, en.box)) { en.takeDamage(dmg); this.attackHitDone = true; } });
    }

    // Hindernisse / Gefahren
    this.checkHazards();
  }

  findLanding(nextY) {
    const footBoxNext = rectOf(this.x - this.width / 2, nextY - 4, this.width, 8);
    let best = null;
    this.game.level.platforms.forEach(p => {
      const top = p.y;
      if (this.x > p.x && this.x < p.x + p.w && this.y <= top + 2 && nextY >= top) {
        if (!best || top < best.y) best = { y: top };
      }
    });
    return best;
  }

  checkHazards() {
    const foot = { x: this.x, y: this.y };
    this.game.level.knives.forEach(kz => {
      if (foot.x > kz.x && foot.x < kz.x + kz.w && foot.y > kz.y && foot.y < kz.y + kz.h + 6) {
        this.game.onHeroDeath("knives");
      }
    });
    if (this.invulnTimer <= 0) {
      this.game.level.flames.forEach(fl => {
        if (foot.x > fl.x - 2 && foot.x < fl.x + fl.w && foot.y > fl.y - fl.h && foot.y <= fl.y + 4) {
          this.game.changeLifeEnergy(1, true);
          this.invulnTimer = 0.6;
        }
      });
    }
  }

  takeDamage(dmg) {
    if (this.invulnTimer > 0 || this.state === "Die") return;
    this.invulnTimer = 0.8;
    this.game.changeLifeEnergy(dmg, true);
  }

  collectPowerUp(type) {
    if (type === "Heart") this.game.changeLifeEnergy(2, false);
    else if (type === "Sword") { this.hasSword = true; this.swordTimer = SWORD_PICKUP_DURATION; }
    else if (type === "Shuriken") { this.hasShuriken = true; this.shurikenCount += 3; }
    this.game.sound.playCollect();
  }

  draw(ctx) { drawNinja(ctx, this.x, this.y, this.facing, "Hero", this.state, this.t, this.hasSword); }
}

/* ==================================================================== */
/* Enemy — fasst EnemyController/BlueController/.../Blue/Green/Red/White  */
/* zusammen. Im Original reine Stubs ohne jedes Verhalten (KnownBugs #12) */
/* — hier vollständig mit einfacher Patrouillen-KI implementiert.         */
/* ==================================================================== */
const ENEMY_TYPES = {
  Blue: { canShuriken: false, canSword: false },
  Green: { canShuriken: true, canSword: false },
  Red: { canShuriken: false, canSword: true },
  White: { canShuriken: true, canSword: true },
};

const HP_BY_TYPE = { Blue: 10, Green: 20, Red: 30, White: 50 };

class Enemy {
  constructor(game, type, x, y) {
    this.game = game;
    this.type = type;
    this.def = ENEMY_TYPES[type];
    this.x = x; this.y = y;
    this.vy = 0;
    this.facing = Math.random() > 0.5 ? 1 : -1;
    this.state = "Idle";
    this.t = 0;
    this.maxHp = HP_BY_TYPE[type] || 10;
    this.hp = this.maxHp;
    this.hasSword = this.def.canSword; // dauerhaft, keine Uhr (angeborene Fähigkeit)
    this.swordTimer = 0; // >0 nur bei einem GESTOHLENEN, zeitlich begrenzten Schwert
    this.hasShuriken = this.def.canShuriken;
    this.shurikenCount = this.def.canShuriken ? 99 : 0;
    this.dead = false;
    this.width = 24; this.height = 48;
    // deutlich groesserer Streifraum, damit die Gegner sich wirklich ueber
    // die Plattform bewegen statt nur auf der Stelle zu treten
    this.patrolLeft = Math.max(20, x - 220);
    this.patrolRight = Math.min(STAGE_W - 20, x + 220);
    this.attackCooldown = 1 + Math.random() * 2;
    this.attackTimer = 0;
    this.onGround = false;
    this.onLadder = false;
    this.climbCooldown = 3 + Math.random() * 4;
    this.jumpCooldown = 2 + Math.random() * 3;
  }

  get box() { return rectOf(this.x - this.width / 2, this.y - this.height, this.width, this.height); }

  update(dt) {
    if (this.dead) return;
    this.t += dt;
    this.attackCooldown -= dt;
    this.climbCooldown -= dt;
    this.jumpCooldown -= dt;
    if (this.attackTimer > 0) this.attackTimer -= dt;

    // entspricht der (im Original nie implementierten) Feind-KI: Patrouille,
    // gelegentliches Klettern und Springen — deutlich lebendiger als reines
    // Stehenbleiben (Fix fuer KnownBugs #12)
    const ladder = this.findNearbyLadder();
    if (this.attackTimer <= 0) {
      if (this.onLadder) {
        this.climb(dt);
      } else if (ladder && this.climbCooldown <= 0 && Math.abs(this.x - (ladder.left + ladder.right) / 2) < 12) {
        this.onLadder = true;
        this.climbDirection = Math.random() > 0.5 ? -1 : 1;
        this.climbCooldown = 4 + Math.random() * 4;
      } else {
        const lookAhead = 26;
        const supported = this.hasSupportAhead(lookAhead);
        if (!supported) {
          // Kante erkannt — umdrehen statt blind herunterzufallen (Fix:
          // Gegner haben sich vorher zu oft selbst umgebracht)
          this.facing *= -1;
        } else {
          this.x += this.facing * ENEMY_SPEED * dt;
        }
        this.setState("Walk");
        if (this.x <= this.patrolLeft) { this.x = this.patrolLeft; this.facing = 1; }
        else if (this.x >= this.patrolRight) { this.x = this.patrolRight; this.facing = -1; }
        else if (ladder && Math.abs(this.x - (ladder.left + ladder.right) / 2) < 10 && this.climbCooldown <= 0 && Math.random() < 0.02) {
          this.onLadder = true;
          this.climbDirection = Math.random() > 0.5 ? -1 : 1;
          this.climbCooldown = 4 + Math.random() * 4;
        } else if (supported && this.onGround && this.jumpCooldown <= 0 && Math.random() < 0.01) {
          this.vy = -560; this.onGround = false; this.setState("Jump");
          this.jumpCooldown = 2.5 + Math.random() * 3;
        }
      }
    }

    if (!this.onLadder) {
      this.vy += GRAVITY * dt;
      const nextY = this.y + this.vy * dt;
      const landing = this.findLanding(nextY);
      if (landing && this.vy >= 0) {
        this.y = landing.y; this.vy = 0; this.onGround = true; this.fallTime = 0;
        if (this.state === "Jump") this.setState("Walk");
      } else { this.y = nextY; this.onGround = false; this.fallTime = (this.fallTime || 0) + dt; }
    } else {
      this.fallTime = 0;
    }

    // fällt ein Gegner von der Karte (oder bleibt zu lange im Sturz, weil
    // er in einer nicht mehr erreichbaren Vertiefung landet), gilt er als
    // besiegt — sonst wartet man auf einen Gegner, der gar nicht mehr im
    // Spiel ist (Bugfix)
    if (this.y > STAGE_H + 80 || this.fallTime > 3) { this.dead = true; this.game.onEnemyKilled(this); return; }

    // ein gestohlenes (nicht angeborenes) Schwert ist nur zeitlich begrenzt
    if (this.swordTimer > 0) {
      this.swordTimer -= dt;
      if (this.swordTimer <= 0 && !this.def.canSword) { this.hasSword = false; this.swordTimer = 0; }
    }

    // Held angreifen, wenn in Reichweite — unterbricht die Bewegung nur ganz
    // kurz (Angriffsdauer), nicht die gesamte Abklingzeit. Alle Gegner
    // können Schlagen UND Treten (unterschiedlicher Schaden), Shuriken/
    // Schwert nur mit der jeweiligen Spezialfähigkeit.
    const hero = this.game.hero;
    if (hero && !this.game.isHeroDead && this.attackCooldown <= 0 && !this.onLadder) {
      const dist = Math.hypot(hero.x - this.x, hero.y - this.y);
      if (dist < 260) this.facing = hero.x > this.x ? 1 : -1;
      if (dist < 40) {
        const useKick = Math.random() < 0.5;
        this.setState(useKick ? "Kick" : "Hit");
        this.attackTimer = 0.3; this.attackCooldown = 1.4 + Math.random();
        hero.takeDamage(useKick ? DAMAGE.Kick : DAMAGE.Hit);
      } else if (dist < 260 && this.hasShuriken && this.shurikenCount > 0 && Math.random() < 0.5) {
        this.setState("Throw"); this.attackTimer = 0.3; this.attackCooldown = 2 + Math.random() * 1.5;
        this.game.spawnProjectile(this.x + this.facing * 18, this.y - 30, this.facing, "enemy");
        this.shurikenCount--;
        if (this.shurikenCount <= 0) { this.shurikenCount = this.def.canShuriken ? 99 : 0; if (!this.def.canShuriken) this.hasShuriken = false; }
      } else if (dist < 60 && this.hasSword) {
        this.setState("SwordHit"); this.attackTimer = 0.3; this.attackCooldown = 1.6 + Math.random();
        hero.takeDamage(DAMAGE.Sword);
      }
    }

    if (this.attackTimer <= 0 && ["Hit", "Kick", "SwordHit", "Throw"].includes(this.state)) this.setState("Idle");
  }

  findNearbyLadder() {
    return this.game.level.ladders.find(l => Math.abs(this.x - (l.left + l.right) / 2) < 30 && this.y >= l.top - 10 && this.y <= l.bottom + 10);
  }

  // prüft, ob an einer Position ein Stück voraus noch Boden (oder eine
  // Leiter) ist — verhindert, dass Gegner blind über Kanten laufen
  hasSupportAhead(dist) {
    const aheadX = this.x + this.facing * dist;
    const onPlatform = this.game.level.platforms.some(p => aheadX > p.x - 4 && aheadX < p.x + p.w + 4 && Math.abs(p.y - this.y) < 6);
    const onLadder = this.game.level.ladders.some(l => aheadX > l.left - 4 && aheadX < l.right + 4 && this.y >= l.top - 6 && this.y <= l.bottom + 6);
    return onPlatform || onLadder;
  }

  climb(dt) {
    const ladder = this.findNearbyLadder();
    if (!ladder) { this.onLadder = false; this.setState("Idle"); return; }
    this.setState("Climb");
    this.y += this.climbDirection * CLIMB_SPEED * 0.7 * dt;
    if (this.y <= ladder.top + 6 || this.y >= ladder.bottom - 6) {
      this.onLadder = false;
      this.setState("Idle");
    }
  }

  setState(s) { if (this.state !== s) { this.state = s; this.t = 0; } }

  findLanding(nextY) {
    let best = null;
    this.game.level.platforms.forEach(p => {
      const top = p.y;
      if (this.x > p.x && this.x < p.x + p.w && this.y <= top + 2 && nextY >= top) {
        if (!best || top < best.y) best = { y: top };
      }
    });
    return best;
  }

  takeDamage(dmg) {
    if (this.dead) return;
    this.hp -= dmg;
    if (this.hp <= 0) { this.dead = true; this.game.onEnemyKilled(this); }
  }

  // Gegner können Items ebenso einsammeln wie der Held — und sie ihm so
  // vor der Nase wegschnappen
  collectPowerUp(type) {
    if (type === "Heart") this.hp = Math.min(this.maxHp, this.hp + Math.ceil(this.maxHp * 0.2));
    else if (type === "Sword") { this.hasSword = true; if (!this.def.canSword) this.swordTimer = SWORD_PICKUP_DURATION; }
    else if (type === "Shuriken") { this.hasShuriken = true; this.shurikenCount += 3; }
    this.game.sound.playCollect();
  }

  draw(ctx) {
    if (this.dead) return;
    drawNinja(ctx, this.x, this.y, this.facing, this.type, this.state, this.t, this.hasSword);
    drawHealthBar(ctx, this.x, this.y - 70, this.hp, this.maxHp);
  }
}

/* ==================================================================== */
/* Projectile — der im Original fehlende Shuriken-Wurf (KnownBugs #1)     */
/* ==================================================================== */
class Projectile {
  constructor(x, y, dir, owner) {
    this.x = x; this.y = y;
    this.dir = dir;
    this.owner = owner; // "hero" oder "enemy"
    this.speed = 480;
    this.dead = false;
    this.spin = 0;
  }
  update(dt, game) {
    this.x += this.dir * this.speed * dt;
    this.spin += dt * 20;
    if (this.x < -20 || this.x > STAGE_W + 20) this.dead = true;

    if (this.owner === "hero") {
      game.enemies.forEach(en => { if (!en.dead && !this.dead && Math.hypot(en.x - this.x, (en.y - 30) - this.y) < 22) { en.takeDamage(DAMAGE.Shuriken); this.dead = true; } });
    } else if (game.hero && !this.dead && Math.hypot(game.hero.x - this.x, (game.hero.y - 30) - this.y) < 22) {
      game.hero.takeDamage(DAMAGE.Shuriken);
      this.dead = true;
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.spin);
    const s = tileSize("Shuriken");
    drawTile(ctx, "Shuriken", -s.w / 2, -s.h / 2);
    ctx.restore();
  }
}

/* ==================================================================== */
/* PowerUp — entspricht PowerUp.as + Heart/Sword/Shuriken.as               */
/* ==================================================================== */
class PowerUp {
  constructor(type, x, y) {
    this.type = type;
    this.x = x; this.y = y;
    this.vy = 0;
    this.landed = false;
    this.collected = false;
  }
  update(dt, game) {
    if (this.collected) return;
    if (!this.landed) {
      this.vy += GRAVITY * dt;
      const nextY = this.y + this.vy * dt;
      let landing = null;
      game.level.platforms.forEach(p => {
        if (this.x > p.x && this.x < p.x + p.w && this.y <= p.y + 2 && nextY >= p.y) {
          if (!landing || p.y < landing) landing = p.y;
        }
      });
      if (landing != null) { this.y = landing; this.vy = 0; this.landed = true; }
      else this.y = nextY;
    }
    // jeder Charakter kann ein Item einsammeln — auch Gegner, die es dem
    // Helden so vor der Nase wegschnappen können
    const candidates = [];
    if (game.hero && !game.isHeroDead) candidates.push(game.hero);
    game.enemies.forEach(en => { if (!en.dead) candidates.push(en); });
    for (const c of candidates) {
      if (Math.hypot(c.x - this.x, c.y - 20 - this.y) < 26) {
        this.collected = true;
        c.collectPowerUp(this.type);
        break;
      }
    }
  }
  draw(ctx) {
    if (this.collected) return;
    const name = this.type; // "Heart" | "Sword" | "Shuriken"
    const s = tileSize(name);
    if (!s) return;
    const scale = 0.55;
    const w = s.w * scale, h = s.h * scale;
    drawTile(ctx, name, this.x - w / 2, this.y - h - 2, { scale });
  }
}
