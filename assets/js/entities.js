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

    this.moveHorizontal(dt);

    // Leiter-Erkennung (Fix für KnownBugs #1 "Leiter funktioniert nicht")
    const ladder = this.game.level.ladders.find(l => this.x > l.left && this.x < l.right && this.y > l.top && this.y < l.bottom + 10);
    this.onLadder = !!ladder && (k.up || k.down || this._wasClimbing);
    if (ladder && (k.up || k.down)) {
      this._wasClimbing = true;
      this.vy = 0;
      this.y += (k.up ? -1 : 1) * CLIMB_SPEED * dt;
      this.y = clamp(this.y, ladder.top + 10, ladder.bottom);
      this.setState(k.up || k.down ? "Walk" : "Idle");
    } else {
      this._wasClimbing = false;
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

    // Angriffs-Trefferprüfung (Fix für KnownBugs #2 "keine Schadenkollision")
    if (this.attackTimer > 0 && !this.attackHitDone && ["Hit", "Kick", "SwordHit"].includes(this.state)) {
      const range = this.state === "SwordHit" ? 46 : 30;
      const dmg = this.state === "SwordHit" ? 2 : 1;
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
        if (foot.x > fl.x && foot.x < fl.x + fl.w && foot.y > fl.y && foot.y < fl.y + fl.h + 6) {
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
    else if (type === "Sword") this.hasSword = true;
    else if (type === "Shuriken") { this.hasShuriken = true; this.shurikenCount += 3; }
    this.game.sound.playCollect();
  }

  draw(ctx) { drawNinja(ctx, this.x, this.y, this.facing, "Hero", this.state, this.t); }
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
    this.hp = 3;
    this.dead = false;
    this.width = 24; this.height = 48;
    this.patrolLeft = x - 70; this.patrolRight = x + 70;
    this.attackCooldown = 1 + Math.random() * 2;
    this.attackTimer = 0;
    this.onGround = false;
  }

  get box() { return rectOf(this.x - this.width / 2, this.y - this.height, this.width, this.height); }

  update(dt) {
    if (this.dead) return;
    this.t += dt;
    this.attackCooldown -= dt;
    if (this.attackTimer > 0) this.attackTimer -= dt;

    // einfache Patrouillen-KI (im Original nie implementiert)
    if (this.attackTimer <= 0) {
      this.x += this.facing * ENEMY_SPEED * dt;
      this.setState("Walk");
      if (this.x < this.patrolLeft) { this.x = this.patrolLeft; this.facing = 1; }
      else if (this.x > this.patrolRight) { this.x = this.patrolRight; this.facing = -1; }
    }

    // Schwerkraft + Landung, identisch zum Helden (Fix für KnownBugs #12)
    this.vy += GRAVITY * dt;
    const nextY = this.y + this.vy * dt;
    const landing = this.findLanding(nextY);
    if (landing && this.vy >= 0) { this.y = landing.y; this.vy = 0; this.onGround = true; }
    else { this.y = nextY; this.onGround = false; }

    // Held angreifen, wenn in Reichweite
    const hero = this.game.hero;
    if (hero && !hero.game.isHeroDead && this.attackCooldown <= 0) {
      const dist = Math.hypot(hero.x - this.x, hero.y - this.y);
      this.facing = hero.x > this.x ? 1 : -1;
      if (dist < 40) {
        this.setState("Hit"); this.attackTimer = 0.3; this.attackCooldown = 1.4 + Math.random();
        hero.takeDamage(1);
      } else if (dist < 260 && this.def.canShuriken && Math.random() < 0.5) {
        this.setState("Throw"); this.attackTimer = 0.3; this.attackCooldown = 2 + Math.random() * 1.5;
        this.game.spawnProjectile(this.x + this.facing * 18, this.y - 30, this.facing, "enemy");
      } else if (dist < 60 && this.def.canSword) {
        this.setState("SwordHit"); this.attackTimer = 0.3; this.attackCooldown = 1.6 + Math.random();
        hero.takeDamage(2);
      }
    }

    if (this.attackTimer <= 0 && ["Hit", "SwordHit", "Throw"].includes(this.state)) this.setState("Idle");
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

  draw(ctx) { if (!this.dead) drawNinja(ctx, this.x, this.y, this.facing, this.type, this.state, this.t); }
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
      game.enemies.forEach(en => { if (!en.dead && !this.dead && Math.hypot(en.x - this.x, (en.y - 30) - this.y) < 22) { en.takeDamage(1); this.dead = true; } });
    } else if (game.hero && !this.dead && Math.hypot(game.hero.x - this.x, (game.hero.y - 30) - this.y) < 22) {
      game.hero.takeDamage(1);
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
    if (game.hero && Math.hypot(game.hero.x - this.x, game.hero.y - 20 - this.y) < 26) {
      this.collected = true;
      game.hero.collectPowerUp(this.type);
    }
  }
  draw(ctx) {
    if (this.collected) return;
    const name = this.type; // "Heart" | "Sword" | "Shuriken"
    const s = tileSize(name);
    if (!s) return;
    drawTile(ctx, name, this.x - s.w / 2, this.y - s.h - 2);
  }
}
