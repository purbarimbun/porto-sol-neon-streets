// Drawing only: the world's state and the current screen in, pixels out. A
// camera follows the player through the 2560x1920 city; the 1280x720 window
// is scaled to fit the browser window. Flat shapes, canvas text for the HUD,
// the minimap and the panels.
import { CAR, GRID, PALETTE, PLAYER, VIEW, WORLD } from './config.js';
import { FONT } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_STORY = 'story';

const ROAD_XS = [];
for (let x = GRID.first; x < WORLD.width - 100; x += GRID.spacing) ROAD_XS.push(x);
const ROAD_YS = [];
for (let y = GRID.first; y < 1700; y += GRID.spacing) ROAD_YS.push(y);

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: 0, y: 0 };
  const moneyLabel = cachedLabel('$');
  const ammoLabel = cachedLabel('Ammo ');
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawCity(state, time) {
    // Ground: grass, then the beach and the sea along the south edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, 1740, WORLD.width, 100);
    context.fillStyle = time % 2 < 1 ? PALETTE.water : PALETTE.waterDeep;
    context.fillRect(0, 1840, WORLD.width, 80);
    // Harbour water on the east edge.
    context.fillStyle = PALETTE.water;
    context.fillRect(2480, 1000, 80, 700);

    // Park block.
    context.fillStyle = PALETTE.park;
    context.fillRect(1260 + GRID.road / 2, 900 + GRID.road / 2, GRID.spacing - GRID.road, GRID.spacing - GRID.road);
    for (const tree of state.trees) {
      context.fillStyle = '#1f5c2a';
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#4caf50';
      context.beginPath();
      context.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
      context.fill();
    }

    // Roads and sidewalks.
    for (const rx of ROAD_XS) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(rx - GRID.road / 2 - 10, 0, GRID.road + 20, 1740);
      context.fillStyle = PALETTE.road;
      context.fillRect(rx - GRID.road / 2, 0, GRID.road, 1740);
      context.fillStyle = PALETTE.roadLine;
      for (let y = 0; y < 1740; y += 64) context.fillRect(rx - 2, y, 4, 32);
    }
    for (const ry of ROAD_YS) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, ry - GRID.road / 2 - 10, WORLD.width, GRID.road + 20);
      context.fillStyle = PALETTE.road;
      context.fillRect(0, ry - GRID.road / 2, WORLD.width, GRID.road);
      context.fillStyle = PALETTE.roadLine;
      for (let x = 0; x < WORLD.width; x += 64) context.fillRect(x, ry - 2, 32, 4);
    }

    // Buildings with lit windows.
    for (const b of state.buildings) {
      context.fillStyle = PALETTE.buildingRoof;
      context.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = PALETTE.buildingGlass;
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c * 7 + r * 3 + b.floors) % 3 !== 0) {
            context.fillRect(b.x + 10 + c * 34, b.y + 10 + r * 34, 16, 14);
          }
        }
      }
    }

    // Garage (Mara's) and bank plaza markers on the ground.
    context.fillStyle = '#8e44ad';
    context.fillRect(1980 - 60, 900 - 60, 120, 120);
    context.fillStyle = PALETTE.hudText;
    text('GARAGE', 1980, 906, 18, PALETTE.hudText, 'center');
    context.fillStyle = '#b7950b';
    context.fillRect(1260 - 60, 540 - 60, 120, 120);
    text('BANK', 1260, 546, 18, PALETTE.hudText, 'center');
  }

  function drawCarShape(car) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const halfL = CAR.length / 2;
    const halfW = CAR.width / 2;
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.fillRect(-halfL + 3, -halfW + 3, CAR.length, CAR.width);
    context.fillStyle = car.police ? PALETTE.police : car.color;
    context.fillRect(-halfL, -halfW, CAR.length, CAR.width);
    context.fillStyle = '#1b2634';
    context.fillRect(-halfL + 10, -halfW + 4, 16, CAR.width - 8);
    context.fillStyle = '#bfe8ff';
    context.fillRect(-2, -halfW + 4, 12, CAR.width - 8);
    context.fillStyle = '#f8e71c';
    context.fillRect(halfL - 6, -halfW + 2, 3, 5);
    context.fillRect(halfL - 6, halfW - 7, 3, 5);
    if (car.police) {
      const blink = Math.floor(performance.now() / 300) % 2 === 0;
      context.fillStyle = blink ? '#ff3b30' : '#3b82f6';
      context.fillRect(-halfL + 14, -halfW - 2, 10, 6);
      context.fillStyle = blink ? '#3b82f6' : '#ff3b30';
      context.fillRect(-halfL + 14, halfW - 4, 10, 6);
    }
    if (car.van) {
      context.fillStyle = '#d8d8d8';
      context.fillRect(-halfL + 4, -halfW + 6, CAR.length - 16, CAR.width - 12);
      text('$', 0, 6, 20, '#222', 'center');
    }
    context.restore();
  }

  function drawPerson(x, y, angle, shirt, pants) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.arc(2, 3, 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = pants;
    context.fillRect(-5, 4, 10, 10);
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(9, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawWorld(state, target) {
    drawCity(state, state.elapsed);
    // Mission marker: a pulsing ring on the ground.
    if (target) {
      const pulse = 26 + Math.sin(state.elapsed * 4) * 6;
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(target.x, target.y, pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.moveTo(target.x, target.y - 52);
      context.lineTo(target.x - 10, target.y - 32);
      context.lineTo(target.x + 10, target.y - 32);
      context.closePath();
      context.fill();
    }
    // Pickups.
    for (const pk of state.pickups) {
      context.fillStyle = pk.kind === 'cash' ? PALETTE.gold : pk.kind === 'health' ? '#ff5b5b' : '#7dd3fc';
      context.beginPath();
      context.arc(pk.x, pk.y, 11, 0, Math.PI * 2);
      context.fill();
      text(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : 'A', pk.x, pk.y + 5, 16, '#111', 'center');
    }
    // Parked and traffic cars, then police.
    for (const car of state.cars) if (!car.dead) drawCarShape(car);
    for (const car of state.police) drawCarShape(car);
    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.dead) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.color, '#2b3242');
    }
    // Thugs.
    for (const thug of state.thugs) {
      if (thug.dead) continue;
      drawPerson(thug.x, thug.y, thug.angle, PALETTE.thug, '#1a1a1a');
      context.fillStyle = '#e5534b';
      context.fillRect(thug.x - 16, thug.y - 26, 32 * (thug.health / 120), 5);
    }
    // Bullets and particles.
    context.fillStyle = '#ffe66d';
    for (const b of state.bullets) {
      context.beginPath();
      context.arc(b.x, b.y, 4, 0, Math.PI * 2);
      context.fill();
    }
    for (const p of state.particles) {
      context.fillStyle = p.color;
      context.globalAlpha = Math.max(0, p.life * 3);
      context.beginPath();
      context.arc(p.x, p.y, 5, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    // The player, on foot or in a car (the car is drawn above already).
    const player = state.player;
    if (!player.inCar) {
      const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
      if (!blink) drawPerson(player.x, player.y, player.angle, PALETTE.playerShirt, '#222');
      // Aim line when shooting.
      if (player.ammo > 0) {
        context.strokeStyle = 'rgba(255,255,255,0.25)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(player.x, player.y);
        context.lineTo(player.x + Math.cos(player.angle) * 60, player.y + Math.sin(player.angle) * 60);
        context.stroke();
      }
    }
  }

  function drawMinimap(state, target) {
    const mw = 220;
    const mh = 165;
    const mx = 18;
    const my = VIEW.height - mh - 18;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.fillStyle = 'rgba(10,18,32,0.85)';
    context.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    context.fillStyle = PALETTE.minimap;
    context.fillRect(mx, my, mw, mh);
    context.fillStyle = PALETTE.water;
    context.fillRect(mx, my + 1740 * sy, mw, (WORLD.height - 1740) * sy);
    context.fillStyle = PALETTE.road;
    for (const rx of ROAD_XS) context.fillRect(mx + rx * sx - 2, my, 4, mh);
    for (const ry of ROAD_YS) context.fillRect(mx, my + ry * sy - 2, mw, 4);
    context.fillStyle = PALETTE.park;
    context.fillRect(mx + 1308 * sx, my + 948 * sy, 264 * sx, 264 * sy);
    if (target) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#ff3b30';
    for (const car of state.police) {
      context.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
    }
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(mx + state.player.x * sx, my + state.player.y * sy, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#fff';
    context.lineWidth = 1;
    context.stroke();
  }

  function drawHud(state, mission, message, time) {
    const player = state.player;
    // Top bar background.
    context.fillStyle = 'rgba(16,22,35,0.8)';
    context.fillRect(0, 0, VIEW.width, 64);
    // Health bar.
    context.fillStyle = '#333';
    context.fillRect(18, 18, 200, 18);
    context.fillStyle = player.health > 50 ? PALETTE.green : player.health > 25 ? PALETTE.gold : PALETTE.red;
    context.fillRect(18, 18, 200 * (player.health / 100), 18);
    text('HP', 226, 34, 18, PALETTE.hudText, 'left');
    text(moneyLabel(player.money), 270, 36, 26, PALETTE.gold, 'left');
    // Wanted stars, top right.
    for (let i = 0; i < 5; i += 1) {
      text(i < state.wanted ? '\u2605' : '\u2606', VIEW.width - 30 - i * 34, 40, 30, i < state.wanted ? '#ffd23f' : '#5a6472', 'right');
    }
    // Clock.
    const hours = Math.floor(state.clock / 60) % 24;
    const minutes = Math.floor(state.clock % 60);
    text(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`, VIEW.width / 2, 36, 24, PALETTE.hudText, 'center');
    // Mission tracker.
    if (mission) {
      context.fillStyle = 'rgba(16,22,35,0.8)';
      context.fillRect(VIEW.width / 2 - 260, 70, 520, 44);
      text(`${mission.name} — ${mission.objective}`, VIEW.width / 2, 88, 18, PALETTE.hudText, 'center');
      if (mission.timeLimit) text(`⏱ ${Math.max(0, Math.ceil(mission.timer))}s`, VIEW.width / 2, 108, 16, PALETTE.gold, 'center');
    }
    // Ammo and car hint, bottom right.
    text(ammoLabel(player.ammo), VIEW.width - 18, VIEW.height - 20, 22, PALETTE.hudText, 'right');
    if (!player.inCar) {
      text('E — enter car   F — punch   Click — shoot', VIEW.width - 18, VIEW.height - 48, 16, PALETTE.hudMuted, 'right');
    } else {
      text('E — exit car   Space — handbrake', VIEW.width - 18, VIEW.height - 48, 16, PALETTE.hudMuted, 'right');
    }
    // Mission message banner.
    if (message) {
      context.fillStyle = 'rgba(16,22,35,0.9)';
      const w = Math.min(760, 40 + message.length * 9);
      const shown = message.length > 72 ? message.slice(0, 72) + '…' : message;
      context.fillRect((VIEW.width - w) / 2, 130, w, 40);
      text(shown, VIEW.width / 2, 157, 20, PALETTE.gold, 'center');
    }
    drawMinimap(state, mission ? (mission.id === 'wheels' && mission.phase === 'deliver' ? { x: 1980, y: 900 } : mission.id === 'courier' ? { x: 2340, y: 1620 } : mission.id === 'tail' && mission.phase === 'park' ? { x: 1260, y: 900 } : mission.id === 'cleanup' ? { x: 2340, y: 1260 } : mission.id === 'score' && mission.phase === 'deliver' ? { x: 1980, y: 900 } : mission.id === 'score' ? { x: 1260, y: 540 } : null) : null);
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 32;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(16,22,35,0.94)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 62, 44, PALETTE.hudText, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 110 + i * 32, 20, PALETTE.hudMuted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 30, 22, PALETTE.gold, 'center');
  }

  /** Paint one frame: the world through the camera, then the HUD or a panel. */
  function draw(state, screen, extras) {
    const player = state.player;
    camera.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, player.x));
    camera.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, player.y));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.save();
    context.beginPath();
    context.rect(0, 0, VIEW.width, VIEW.height);
    context.clip();
    context.translate(-camera.x + VIEW.width / 2, -camera.y + VIEW.height / 2);
    drawWorld(state, extras.target || null);
    context.restore();
    if (screen === SCREEN_TITLE) {
      drawPanel('PORTO SOL', ['Neon Streets — an open-world crime story', 'Mara needs a driver. The city needs a legend.', 'WASD move / drive · E enter car · Click shoot · F punch'], extras.hasSave ? 'Press Space to start · C to continue your save' : 'Press Space to start');
      return;
    }
    drawHud(state, extras.mission || null, extras.message || '', state.elapsed);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for no one. Except now.', ''], 'Press P to resume · R to restart');
    } else if (screen === SCREEN_OVER) {
      drawPanel(extras.overTitle || 'WASTED', extras.overLines || [''], 'Press Space to play again');
    } else if (screen === SCREEN_STORY) {
      drawPanel('The Story So Far', extras.overLines || [''], 'Press Space to keep playing');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld(sx, sy) {
    const rect = canvas.getBoundingClientRect();
    const lx = ((sx - rect.left) * (window.devicePixelRatio || 1) - view.x) / view.scale;
    const ly = ((sy - rect.top) * (window.devicePixelRatio || 1) - view.y) / view.scale;
    return { x: lx + camera.x - VIEW.width / 2, y: ly + camera.y - VIEW.height / 2 };
  } };
}
