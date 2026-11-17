// Porto Sol — Neon Streets: the game's rules and state, with no drawing and no
// browser in it. A top-down open world: grid streets, buildings, beach and
// harbour, traffic cars, pedestrians, police, a wanted level, five story
// missions from Mara the fixer, and combat on foot. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound.
import { CAR, GRID, MISSIONS, PALETTE, PLAYER, PEDS, POLICE, TRAFFIC, WANTED, WORLD } from './config.js';
import { pick } from './random.js';

export const EVENT_HIT = 1;
export const EVENT_SHOT = 2;
export const EVENT_MISSION_DONE = 4;
export const EVENT_MISSION_FAIL = 8;
export const EVENT_BUSTED = 16;
export const EVENT_WASTED = 32;
export const EVENT_PICKUP = 64;
export const EVENT_STEAL = 128;
export const EVENT_CRASH = 256;
export const EVENT_OVER = EVENT_BUSTED | EVENT_WASTED;

const ROAD_XS = [];
for (let x = GRID.first; x < WORLD.width - 100; x += GRID.spacing) ROAD_XS.push(x);
const ROAD_YS = [];
for (let y = GRID.first; y < 1700; y += GRID.spacing) ROAD_YS.push(y);

export const GARAGE = { x: 1980, y: 900 };
export const HARBOUR = { x: 2340, y: 1620 };
export const PARK = { x: 1260, y: 900 };
export const DOCKS = { x: 2340, y: 1260 };
export const BANK = { x: 1260, y: 540 };

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(random) {
  // ---- City generation (seeded, so the same seed builds the same city) ----
  const buildings = [];
  const trees = [];
  for (let row = 0; row < ROAD_YS.length - 1; row += 1) {
    for (let col = 0; col < ROAD_XS.length - 1; col += 1) {
      const bx = ROAD_XS[col] + GRID.road / 2 + 12;
      const by = ROAD_YS[row] + GRID.road / 2 + 12;
      const bw = GRID.spacing - GRID.road - 24;
      const bh = GRID.spacing - GRID.road - 24;
      // The middle block is the park; the bank plaza block stays open.
      if (col === 3 && row === 2) {
        for (let t = 0; t < 9; t += 1) {
          trees.push({ x: bx + 30 + random() * (bw - 60), y: by + 30 + random() * (bh - 60), r: 12 + random() * 8 });
        }
        continue;
      }
      if (col === 3 && row === 1) continue; // bank plaza, open square
      const split = random() < 0.5;
      if (split) {
        buildings.push({ x: bx, y: by, w: bw / 2 - 8, h: bh, color: pick(random, PALETTE.carColors), floors: 2 + Math.floor(random() * 6) });
        buildings.push({ x: bx + bw / 2 + 8, y: by, w: bw / 2 - 8, h: bh, color: pick(random, PALETTE.carColors), floors: 2 + Math.floor(random() * 6) });
      } else {
        buildings.push({ x: bx, y: by, w: bw, h: bh, color: pick(random, PALETTE.carColors), floors: 3 + Math.floor(random() * 8) });
      }
    }
  }
  // Harbour warehouses along the east docks.
  buildings.push({ x: 2380, y: 1080, w: 110, h: 90, color: '#7a6a4a', floors: 1 });
  buildings.push({ x: 2380, y: 1300, w: 110, h: 90, color: '#6a5a3a', floors: 1 });

  function onRoad(x, y) {
    if (y > 1740) return false;
    for (const rx of ROAD_XS) if (Math.abs(x - rx) < GRID.road / 2) return true;
    for (const ry of ROAD_YS) if (Math.abs(y - ry) < GRID.road / 2) return true;
    return false;
  }

  function inBuilding(x, y, pad) {
    for (const b of buildings) {
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
    }
    return null;
  }

  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of ROAD_XS) {
      for (const ry of ROAD_YS) {
        const d = dist(x, y, rx, ry);
        if (d < bestD) { bestD = d; best = { x: rx, y: ry }; }
      }
    }
    return best;
  }

  // ---- Entities ----
  const player = {
    x: 1260, y: 1000, angle: -Math.PI / 2, health: PLAYER.health, ammo: PLAYER.pistolAmmo,
    money: 0, punchTimer: 0, shootTimer: 0, invulnerable: 0, inCar: null, bustTimer: 0,
  };

  function makeCar(x, y, angle, opts) {
    return {
      x, y, angle, speed: 0, color: opts.color || pick(random, PALETTE.carColors),
      traffic: !!opts.traffic, police: !!opts.police, parked: !!opts.parked,
      van: !!opts.van, axis: opts.axis || 'x', dir: opts.dir || 1, lane: opts.lane || 0,
      targetSpeed: opts.targetSpeed || 0, dead: false,
    };
  }

  const cars = [];
  // Parked cars along the roads.
  for (let i = 0; i < 10; i += 1) {
    const vertical = random() < 0.5;
    const road = vertical ? pick(random, ROAD_XS) : pick(random, ROAD_YS);
    const along = 300 + random() * 1200;
    const off = (random() < 0.5 ? -1 : 1) * (GRID.road / 2 - 14);
    cars.push(makeCar(
      vertical ? road + off : along,
      vertical ? along : road + off,
      vertical ? (off > 0 ? Math.PI / 2 : -Math.PI / 2) : (off > 0 ? 0 : Math.PI),
      { parked: true },
    ));
  }
  // Traffic cars cruising the streets.
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const vertical = random() < 0.5;
    const road = vertical ? pick(random, ROAD_XS) : pick(random, ROAD_YS);
    const along = 200 + random() * 1400;
    const lane = (random() < 0.5 ? -1 : 1) * 22;
    const dir = random() < 0.5 ? 1 : -1;
    const car = makeCar(
      vertical ? road + lane : along,
      vertical ? along : road + lane,
      vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      { traffic: true, axis: vertical ? 'y' : 'x', dir, lane, targetSpeed: TRAFFIC.speed + random() * TRAFFIC.speedJitter },
    );
    car.speed = car.targetSpeed;
    cars.push(car);
  }
  // The armoured van, parked at the bank plaza for the final mission.
  const van = makeCar(BANK.x + 60, BANK.y - 20, Math.PI, { van: true, parked: true, color: PALETTE.van });
  cars.push(van);

  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const road = pick(random, ROAD_XS);
    const along = 200 + random() * 1400;
    peds.push({
      x: road + (random() < 0.5 ? -1 : 1) * (GRID.road / 2 + 8),
      y: along, angle: random() * Math.PI * 2, speed: PEDS.speed + random() * PEDS.speedJitter,
      color: pick(random, ['#e8b4b8', '#a8c8e8', '#d8e8a8', '#e8d8a8', '#c8a8e8']),
      fleeing: 0, dead: false, walkPhase: random() * 6,
    });
  }

  const police = [];
  const bullets = [];
  const thugs = [];
  const pickups = [];
  const particles = [];

  const state = {
    player, cars, peds, police, bullets, thugs, pickups, particles, buildings, trees,
    wanted: 0, wantedTimer: 0, clock: 8 * 60, elapsed: 0,
    missionIndex: 0, mission: null, missionMessage: '', storyComplete: false,
    busted: false, wasted: false, kills: 0, carsStolen: 0,
  };

  function addPickup(x, y, kind) {
    pickups.push({ x, y, kind, t: 0 });
  }

  function spawnPickupNear(x, y) {
    const kinds = ['cash', 'health', 'ammo'];
    addPickup(x + (random() - 0.5) * 120, y + (random() - 0.5) * 120, pick(random, kinds));
  }

  // ---- Missions ----
  function missionTarget() {
    const m = state.mission;
    if (!m) return null;
    if (m.id === 'wheels') return m.phase === 'deliver' ? { ...GARAGE, label: 'Mara\u2019s garage' } : null;
    if (m.id === 'courier') return { ...HARBOUR, label: 'Harbour docks' };
    if (m.id === 'tail') return m.phase === 'park' ? { ...PARK, label: 'Sunset Park' } : null;
    if (m.id === 'cleanup') return { ...DOCKS, label: 'The docks' };
    if (m.id === 'score') return m.phase === 'deliver' ? { ...GARAGE, label: 'Mara\u2019s garage' } : { ...BANK, label: 'Armoured van' };
    return null;
  }

  function startMission(index) {
    if (index >= MISSIONS.length) {
      state.mission = null;
      state.storyComplete = true;
      return;
    }
    const def = MISSIONS[index];
    state.missionIndex = index;
    state.mission = { ...def, phase: 'start', timer: def.timeLimit || 0, message: def.briefing };
    if (def.id === 'wheels') state.mission.phase = 'steal';
    if (def.id === 'courier') state.mission.phase = 'deliver';
    if (def.id === 'tail') {
      state.mission.phase = 'lose';
      setWanted(2);
    }
    if (def.id === 'cleanup') {
      state.mission.phase = 'fight';
      thugs.length = 0;
      for (let i = 0; i < 3; i += 1) {
        thugs.push({ x: DOCKS.x - 60 + i * 55, y: DOCKS.y - 40 + (i % 2) * 80, angle: 0, health: 120, punchTimer: 0, speed: 150, dead: false });
      }
    }
    if (def.id === 'score') {
      state.mission.phase = 'steal';
      van.parked = true;
      van.x = BANK.x + 60;
      van.y = BANK.y - 20;
    }
  }

  function completeMission() {
    const m = state.mission;
    if (!m) return 0;
    player.money += m.reward;
    state.missionMessage = `${m.name} complete! +$${m.reward}`;
    const reward = m.reward;
    state.mission = null;
    return reward;
  }

  function failMission(reason) {
    const m = state.mission;
    if (!m) return;
    state.missionMessage = `${m.name} failed: ${reason}. Talk to Mara and try again.`;
    state.mission = null;
  }

  function setWanted(level) {
    state.wanted = clamp(level, 0, WANTED.max);
    state.wantedTimer = 0;
  }

  function addWanted(amount) {
    setWanted(state.wanted + amount);
  }

  function spawnPolice() {
    const want = Math.min(state.wanted, 4);
    while (police.length < want) {
      const near = nearestRoadPoint(player.x, player.y);
      const angle = random() * Math.PI * 2;
      const px = clamp(player.x + Math.cos(angle) * POLICE.spawnDistance, 100, WORLD.width - 100);
      const py = clamp(player.y + Math.sin(angle) * POLICE.spawnDistance, 100, WORLD.height - 100);
      police.push(makeCar(near.x, near.y, angleTo(near.x, near.y, px, py), { police: true, color: PALETTE.police }));
      police[police.length - 1].x = px;
      police[police.length - 1].y = py;
    }
    while (police.length > want) police.pop();
  }

  function nearestCarTo(x, y, maxDist, onlyStealable) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (car.dead || car.police) continue;
      if (onlyStealable && car.traffic) continue;
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function resolveCircle(x, y, radius) {
    // Push a circle out of buildings and the world edge; returns corrected position.
    let nx = clamp(x, 20, WORLD.width - 20);
    let ny = clamp(y, 20, WORLD.height - 20);
    const b = inBuilding(nx, ny, radius);
    if (b) {
      const left = Math.abs(nx - (b.x - radius));
      const right = Math.abs(nx - (b.x + b.w + radius));
      const top = Math.abs(ny - (b.y - radius));
      const bottom = Math.abs(ny - (b.y + b.h + radius));
      const min = Math.min(left, right, top, bottom);
      if (min === left) nx = b.x - radius;
      else if (min === right) nx = b.x + b.w + radius;
      else if (min === top) ny = b.y - radius;
      else ny = b.y + b.h + radius;
    }
    return { x: nx, y: ny };
  }

  function carHitsBuilding(car) {
    const halfL = CAR.length / 2;
    const halfW = CAR.width / 2;
    const cos = Math.cos(car.angle);
    const sin = Math.sin(car.angle);
    // All four corners plus the four edge midpoints: a car turning into a
    // building corner must be caught, not just one driving straight at a wall.
    for (const [dx, dy] of [[halfL, halfW], [halfL, -halfW], [-halfL, halfW], [-halfL, -halfW], [halfL, 0], [-halfL, 0], [0, halfW], [0, -halfW]]) {
      const px = car.x + dx * cos - dy * sin;
      const py = car.y + dx * sin + dy * cos;
      if (inBuilding(px, py, 2)) return true;
    }
    return false;
  }

  function stepTraffic(dt) {
    for (const car of cars) {
      if (!car.traffic || car.dead) continue;
      // Drive along its road; at an intersection, sometimes turn.
      const speed = car.targetSpeed * car.dir;
      let nx = car.x;
      let ny = car.y;
      if (car.axis === 'x') nx += speed * dt;
      else ny += speed * dt;
      // Turn at intersections.
      const onX = ROAD_XS.some((rx) => Math.abs(nx - rx) < 6);
      const onY = ROAD_YS.some((ry) => Math.abs(ny - ry) < 6);
      if (onX && onY && random() < 0.02) {
        if (car.axis === 'x') {
          car.axis = 'y';
          car.dir = random() < 0.5 ? 1 : -1;
          car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          car.x = ROAD_XS.find((rx) => Math.abs(nx - rx) < 6) + car.lane;
        } else {
          car.axis = 'x';
          car.dir = random() < 0.5 ? 1 : -1;
          car.angle = car.dir > 0 ? 0 : Math.PI;
          car.y = ROAD_YS.find((ry) => Math.abs(ny - ry) < 6) + car.lane;
        }
        continue;
      }
      // Bounce at the world edge.
      if (nx < 120 || nx > WORLD.width - 120 || ny < 120 || ny > 1680) {
        car.dir *= -1;
        car.angle += Math.PI;
        continue;
      }
      // Slow for the car ahead on the same road.
      let blocked = false;
      for (const other of cars) {
        if (other === car || other.dead) continue;
        if (car.axis === 'x' && Math.abs(other.y - car.y) < 30 && (other.x - car.x) * car.dir > 0 && (other.x - car.x) * car.dir < 70) blocked = true;
        if (car.axis === 'y' && Math.abs(other.x - car.x) < 30 && (other.y - car.y) * car.dir > 0 && (other.y - car.y) * car.dir < 70) blocked = true;
      }
      if (!blocked) {
        car.x = nx;
        car.y = ny;
        car.speed = car.targetSpeed;
      } else {
        car.speed = 0;
      }
    }
  }

  function stepPeds(dt, shooting) {
    for (const ped of peds) {
      if (ped.dead) continue;
      ped.walkPhase += dt * 6;
      if (shooting || state.wanted > 0) ped.fleeing = 2;
      if (ped.fleeing > 0) {
        ped.fleeing -= dt;
        const a = angleTo(player.x, player.y, ped.x, ped.y);
        ped.x += Math.cos(a) * ped.speed * 1.8 * dt;
        ped.y += Math.sin(a) * ped.speed * 1.8 * dt;
      } else {
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (random() < 0.005) ped.angle = random() * Math.PI * 2;
      }
      const fixed = resolveCircle(ped.x, ped.y, 10);
      ped.x = fixed.x;
      ped.y = fixed.y;
      if (ped.y > 1740) ped.y = 1700;
    }
  }

  function stepPolice(dt) {
    spawnPolice();
    for (const car of police) {
      const targetAngle = angleTo(car.x, car.y, player.x, player.y);
      const diff = angleDiff(car.angle, targetAngle);
      car.angle += clamp(diff, -2.8 * dt, 2.8 * dt);
      car.speed = Math.min(POLICE.maxSpeed, car.speed + POLICE.accel * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      car.x = nx;
      car.y = ny;
      if (carHitsBuilding(car)) {
        car.speed *= 0.4;
        // Bounce off the wall and try another angle instead of grinding
        // against the same building while the player is on the other side.
        car.angle += (random() < 0.5 ? 1 : -1) * 0.9;
        car.x -= Math.cos(car.angle) * car.speed * dt * 2;
        car.y -= Math.sin(car.angle) * car.speed * dt * 2;
      }
      // Ram the player.
      const d = dist(car.x, car.y, player.x, player.y);
      if (d < 46) {
        if (player.inCar) {
          player.health -= POLICE.ramDamage * dt * 2;
          car.speed *= 0.6;
          player.inCar.speed *= 0.85;
        } else {
          player.bustTimer += dt;
        }
      }
    }
    if (state.wanted === 0) {
      for (const car of police) car.speed = Math.max(0, car.speed - 300 * dt);
    }
  }

  function stepThugs(dt) {
    for (const thug of thugs) {
      if (thug.dead) continue;
      thug.punchTimer = Math.max(0, thug.punchTimer - dt);
      const d = dist(thug.x, thug.y, player.x, player.y);
      if (!player.inCar && d < 420) {
        thug.angle = angleTo(thug.x, thug.y, player.x, player.y);
        if (d > 30) {
          thug.x += Math.cos(thug.angle) * thug.speed * dt;
          thug.y += Math.sin(thug.angle) * thug.speed * dt;
        } else if (thug.punchTimer === 0 && player.invulnerable === 0) {
          thug.punchTimer = 0.6;
          player.health -= 10;
          player.invulnerable = 0.5;
        }
      }
    }
  }

  function stepBullets(dt) {
    for (const b of bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      // Hit a thug.
      for (const thug of thugs) {
        if (!thug.dead && dist(b.x, b.y, thug.x, thug.y) < 16) {
          thug.health -= PLAYER.pistolDamage;
          b.life = 0;
          particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, color: '#ffcf3f' });
          if (thug.health <= 0) {
            thug.dead = true;
            state.kills += 1;
            addPickup(thug.x, thug.y, 'cash');
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit a police car.
      for (const car of police) {
        if (dist(b.x, b.y, car.x, car.y) < 30) {
          b.life = 0;
          car.speed *= 0.7;
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit a pedestrian (a crime).
      for (const ped of peds) {
        if (!ped.dead && dist(b.x, b.y, ped.x, ped.y) < 14) {
          ped.dead = true;
          b.life = 0;
          addWanted(WANTED.shootPed);
          break;
        }
      }
      if (b.life <= 0) continue;
      if (inBuilding(b.x, b.y, 0)) b.life = 0;
    }
    for (let i = bullets.length - 1; i >= 0; i -= 1) if (bullets[i].life <= 0) bullets.splice(i, 1);
  }

  function stepMission(dt) {
    const m = state.mission;
    if (!m) return 0;
    let events = 0;
    if (m.timeLimit) {
      m.timer -= dt;
      if (m.timer <= 0) {
        failMission('time ran out');
        return EVENT_MISSION_FAIL;
      }
    }
    const target = missionTarget();
    if (m.id === 'wheels') {
      if (m.phase === 'steal' && player.inCar) {
        m.phase = 'deliver';
        m.message = 'Nice wheels. Now bring it to my garage on Coral Row.';
      } else if (m.phase === 'deliver' && player.inCar && dist(player.x, player.y, GARAGE.x, GARAGE.y) < 110) {
        completeMission();
        events |= EVENT_MISSION_DONE;
      }
    } else if (m.id === 'courier') {
      if (dist(player.x, player.y, HARBOUR.x, HARBOUR.y) < 110) {
        completeMission();
        events |= EVENT_MISSION_DONE;
      }
    } else if (m.id === 'tail') {
      if (m.phase === 'lose' && state.wanted === 0) {
        m.phase = 'park';
        m.message = 'Heat is off. Meet me at Sunset Park.';
      } else if (m.phase === 'park' && dist(player.x, player.y, PARK.x, PARK.y) < 100) {
        completeMission();
        events |= EVENT_MISSION_DONE;
      }
    } else if (m.id === 'cleanup') {
      if (thugs.length > 0 && thugs.every((t) => t.dead)) {
        completeMission();
        events |= EVENT_MISSION_DONE;
      }
    } else if (m.id === 'score') {
      if (m.phase === 'steal' && player.inCar === van) {
        m.phase = 'deliver';
        setWanted(4);
        m.message = 'The van is yours. The whole city is coming — get to the garage!';
      } else if (m.phase === 'deliver' && player.inCar === van && dist(player.x, player.y, GARAGE.x, GARAGE.y) < 110) {
        completeMission();
        events |= EVENT_MISSION_DONE;
      }
    }
    if (target && m.phase !== 'steal' && m.phase !== 'lose' && m.phase !== 'fight') {
      // Marker reached checks above use the same targets; nothing extra here.
    }
    return events;
  }

  function reset() {
    player.x = 1260;
    player.y = 1000;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.ammo = PLAYER.pistolAmmo;
    player.money = 0;
    player.inCar = null;
    player.bustTimer = 0;
    player.invulnerable = 0;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.clock = 8 * 60;
    state.elapsed = 0;
    state.busted = false;
    state.wasted = false;
    state.kills = 0;
    state.carsStolen = 0;
    state.storyComplete = false;
    police.length = 0;
    bullets.length = 0;
    pickups.length = 0;
    particles.length = 0;
    for (const car of cars) {
      if (car.van) { car.x = BANK.x + 60; car.y = BANK.y - 20; car.parked = true; car.speed = 0; }
      car.dead = false;
    }
    startMission(0);
  }

  /**
   * One fixed step. `input` is { mx, my, enter, punch, shoot, aimX, aimY,
   * handbrake }. Returns event bit flags.
   */
  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    state.clock += dt / 2; // one game minute every two real seconds
    if (state.clock >= 24 * 60) state.clock -= 24 * 60;
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.punchTimer > 0) player.punchTimer = Math.max(0, player.punchTimer - dt);
    if (player.shootTimer > 0) player.shootTimer = Math.max(0, player.shootTimer - dt);
    if (player.bustTimer > 0 && state.wanted === 0) player.bustTimer = 0;

    // Wanted decay: stay clean and the heat fades.
    if (state.wanted > 0) {
      state.wantedTimer += dt;
      if (state.wantedTimer >= WANTED.decaySeconds) {
        state.wanted -= 1;
        state.wantedTimer = 0;
      }
    }

    const car = player.inCar;
    if (car) {
      // Driving: arcade car physics.
      const forward = input.my < 0 ? 1 : input.my > 0 ? -0.4 : 0;
      const accel = input.my < 0 ? CAR.accel : input.my > 0 ? CAR.reverseAccel : 0;
      car.speed += (input.my < 0 ? accel : input.my > 0 ? -accel : -Math.sign(car.speed) * CAR.brake * 0.4) * dt;
      if (input.my === 0) car.speed -= Math.sign(car.speed) * 120 * dt;
      const max = input.my > 0 ? CAR.maxReverse : CAR.maxSpeed;
      car.speed = clamp(car.speed, -max, max);
      if (Math.abs(car.speed) < 4 && input.my === 0) car.speed = 0;
      const steer = input.mx * CAR.steer * (car.speed >= 0 ? 1 : -1);
      const grip = input.handbrake ? CAR.handbrakeGrip : CAR.grip;
      car.angle += steer * clamp(Math.abs(car.speed) / 200, 0, 1) * dt * (input.handbrake ? 1.6 : 1);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const oldX = car.x;
      const oldY = car.y;
      car.x = nx;
      car.y = ny;
      if (carHitsBuilding(car)) {
        // Restore the pre-move position: a car can never end a step inside
        // a building, however it approached the corner.
        car.x = oldX;
        car.y = oldY;
        if (Math.abs(car.speed) > 200) events |= EVENT_CRASH;
        car.speed *= 0.4;
      }
      if (car.y > 1740) { car.y = 1740; car.speed *= 0.5; } // beach slows you down
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      if (input.enter) {
        // Step out of the car.
        const outX = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
        const outY = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
        const fixed = resolveCircle(outX, outY, PLAYER.radius);
        player.x = fixed.x;
        player.y = fixed.y;
        player.inCar = null;
        car.speed = 0;
      }
    } else {
      // On foot.
      const len = Math.hypot(input.mx, input.my) || 1;
      const speed = PLAYER.walkSpeed;
      const nx = player.x + (input.mx / len) * speed * dt * (input.mx || input.my ? 1 : 0);
      const ny = player.y + (input.my / len) * speed * dt * (input.mx || input.my ? 1 : 0);
      if (input.mx || input.my) player.angle = Math.atan2(input.my, input.mx);
      const fixed = resolveCircle(nx, ny, PLAYER.radius);
      player.x = fixed.x;
      player.y = fixed.y;
      if (player.y > 1760) player.y = 1760;

      if (input.enter) {
        const near = nearestCarTo(player.x, player.y, CAR.enterRange, false);
        if (near) {
          player.inCar = near;
          if (near.parked || near.traffic) {
            near.parked = false;
            near.traffic = false;
            near.speed = 0;
            state.carsStolen += 1;
            addWanted(WANTED.steal);
            events |= EVENT_STEAL;
          }
        }
      }

      // Punch.
      if (input.punch && player.punchTimer === 0) {
        player.punchTimer = PLAYER.punchCooldown;
        const px = player.x + Math.cos(player.angle) * PLAYER.punchRange;
        const py = player.y + Math.sin(player.angle) * PLAYER.punchRange;
        let hitSomething = false;
        for (const thug of thugs) {
          if (!thug.dead && dist(px, py, thug.x, thug.y) < 26) {
            thug.health -= PLAYER.punchDamage;
            hitSomething = true;
            if (thug.health <= 0) {
              thug.dead = true;
              state.kills += 1;
              addPickup(thug.x, thug.y, 'cash');
            }
          }
        }
        for (const ped of peds) {
          if (!ped.dead && dist(px, py, ped.x, ped.y) < 24) {
            ped.dead = true;
            hitSomething = true;
            addWanted(WANTED.shootPed);
          }
        }
        if (hitSomething) events |= EVENT_HIT;
      }

      // Shoot at the mouse aim point.
      if (input.shoot && player.shootTimer === 0 && player.ammo > 0) {
        player.shootTimer = PLAYER.pistolCooldown;
        player.ammo -= 1;
        const aim = Math.atan2(input.aimY - player.y, input.aimX - player.x);
        player.angle = aim;
        bullets.push({
          x: player.x + Math.cos(aim) * 20, y: player.y + Math.sin(aim) * 20,
          vx: Math.cos(aim) * 900, vy: Math.sin(aim) * 900, life: PLAYER.pistolRange / 900,
        });
        events |= EVENT_SHOT;
      }
    }

    stepTraffic(dt);
    stepPeds(dt, !!(input.shoot || input.punch));
    stepThugs(dt);
    stepBullets(dt);
    if (state.wanted > 0) stepPolice(dt);
    else if (police.length > 0) {
      // Police drift off once the heat is gone.
      for (const pcar of police) pcar.speed = Math.max(0, pcar.speed - 300 * dt);
      if (police.every((p) => p.speed === 0)) police.length = 0;
    }

    // Pickups.
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const pk = pickups[i];
      pk.t += dt;
      if (dist(player.x, player.y, pk.x, pk.y) < 30) {
        if (pk.kind === 'cash') { player.money += 50; }
        else if (pk.kind === 'health') { player.health = Math.min(PLAYER.health, player.health + 40); }
        else if (pk.kind === 'ammo') { player.ammo += 12; }
        pickups.splice(i, 1);
        events |= EVENT_PICKUP;
      } else if (pk.t > 60) {
        pickups.splice(i, 1);
      }
    }

    // Particles.
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      particles[i].life -= dt;
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // Busted / wasted.
    if (player.bustTimer >= POLICE.bustTime && !player.inCar) {
      state.busted = true;
      events |= EVENT_BUSTED;
    }
    if (player.health <= 0) {
      player.health = 0;
      state.wasted = true;
      events |= EVENT_WASTED;
    }

    events |= stepMission(dt);
    return events;
  }

  function saveData() {
    return {
      money: player.money, missionIndex: state.missionIndex, health: player.health,
      ammo: player.ammo, x: player.x, y: player.y, clock: state.clock, kills: state.kills,
    };
  }

  function loadData(data) {
    if (!data || typeof data !== 'object') return false;
    player.money = data.money || 0;
    player.health = data.health || PLAYER.health;
    player.ammo = data.ammo || PLAYER.pistolAmmo;
    player.x = clamp(data.x || 1260, 20, WORLD.width - 20);
    player.y = clamp(data.y || 1000, 20, WORLD.height - 20);
    state.clock = data.clock || 8 * 60;
    state.kills = data.kills || 0;
    startMission(Math.min(data.missionIndex || 0, MISSIONS.length - 1));
    return true;
  }

  reset();
  return {
    state, reset, step, startMission, missionTarget, nearestCarTo,
    saveData, loadData, GARAGE, HARBOUR, PARK, DOCKS, BANK,
  };
}
