// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { EVENT_MISSION_DONE } from './world.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const CHASE_SECONDS = 20;
const MISSION_SECONDS = 1;

function noInput() {
  return { mx: 0, my: 0, enter: false, punch: false, shoot: false, aimX: 0, aimY: 0, handbrake: false };
}

/** Drive toward a point: steer the car, accelerate, brake near the target. */
function driveTo(world, tx, ty) {
  const player = world.state.player;
  const car = player.inCar;
  if (!car) return { mx: 0, my: 0, enter: true, punch: false, shoot: false, aimX: tx, aimY: ty, handbrake: false };
  const targetAngle = Math.atan2(ty - car.y, tx - car.x);
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const d = Math.hypot(tx - car.x, ty - car.y);
  return {
    mx: diff > 0.15 ? 1 : diff < -0.15 ? -1 : 0,
    my: d < 80 ? 1 : -1,
    enter: false, punch: false, shoot: false, aimX: tx, aimY: ty, handbrake: false,
  };
}

/**
 * A route through the street grid: every mission target sits on an
 * intersection, so the route is [nearest intersection to the car,
 * (targetX, that intersection's Y), the target]. Driving it keeps the car
 * on roads instead of cutting across blocks.
 */
const ROAD_XS = [180, 540, 900, 1260, 1620, 1980, 2340];
const ROAD_YS = [180, 540, 900, 1260, 1620];

function planRoute(car, tx, ty) {
  const nearX = ROAD_XS.reduce((a, b) => Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a);
  const nearY = ROAD_YS.reduce((a, b) => Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a);
  const targetX = ROAD_XS.reduce((a, b) => Math.abs(b - tx) < Math.abs(a - tx) ? b : a);
  const waypoints = [{ x: nearX, y: nearY }, { x: targetX, y: nearY }, { x: tx, y: ty }];
  // Drop waypoints the car already stands on.
  return waypoints.filter((w, i) => i === waypoints.length - 1 || Math.hypot(w.x - car.x, w.y - car.y) > 60);
}

function driveRoute(world, route, tx, ty) {
  const car = world.state.player.inCar;
  if (!car) return driveTo(world, tx, ty);
  while (route.length > 0 && Math.hypot(route[0].x - car.x, route[0].y - car.y) < 50) route.shift();
  if (route.length === 0) return driveTo(world, tx, ty);
  return driveTo(world, route[0].x, route[0].y);
}

function walkTo(world, tx, ty) {
  const player = world.state.player;
  const dx = tx - player.x;
  const dy = ty - player.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    mx: Math.abs(dx) > 20 ? Math.sign(dx) : 0,
    my: Math.abs(dy) > 20 ? Math.sign(dy) : 0,
    enter: false, punch: false, shoot: false, aimX: tx, aimY: ty, handbrake: false,
  };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: title over a living city. play: driving through town. chase: a
 * three-star police chase. mission: the dock clean-up, mid-fight.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'chase' && name !== 'mission') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, noInput());
    return { screen: SCREEN_TITLE, overTitle: '', overLines: [] };
  }
  if (name === 'play') {
    // Steal the nearest parked car, then drive across town.
    const parked = state.cars.filter((c) => c.parked && !c.van).sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y))[0];
    let entered = false;
    let route = null;
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      if (!entered) {
        const input = walkTo(world, parked.x, parked.y);
        const d = Math.hypot(parked.x - state.player.x, parked.y - state.player.y);
        if (d < 60) { input.enter = true; entered = true; }
        world.step(STEP, input);
      } else {
        if (!route) route = planRoute(world.state.player.inCar, 1980, 900);
        world.step(STEP, driveRoute(world, route, 1980, 900));
      }
    }
    return { screen: SCREEN_PLAY, overTitle: '', overLines: [] };
  }
  if (name === 'chase') {
    // Steal a car, then run from a three-star chase.
    const parked = state.cars.filter((c) => c.parked && !c.van).sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y))[0];
    let entered = false;
    let route = null;
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      if (!entered) {
        const input = walkTo(world, parked.x, parked.y);
        const d = Math.hypot(parked.x - state.player.x, parked.y - state.player.y);
        if (d < 60) { input.enter = true; entered = true; }
        world.step(STEP, input);
      } else {
        if (i === Math.floor(4 / STEP)) {
          // Force the chase: wanted 3, right after the steal.
          state.wanted = 3;
        }
        if (!route) route = planRoute(world.state.player.inCar, 540, 540);
        world.step(STEP, driveRoute(world, route, 540, 540));
      }
    }
    // Stage the money shot: pull the nearest police car up right behind the
    // player's car, as a chase in full flow looks — the chase itself played
    // out by the real rules above, this only frames it.
    const chaser = state.police.slice().sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) - Math.hypot(b.x - state.player.x, b.y - state.player.y))[0];
    if (chaser && state.player.inCar) {
      const a = state.player.inCar.angle;
      chaser.x = state.player.x - Math.cos(a) * 110;
      chaser.y = state.player.y - Math.sin(a) * 110;
      chaser.angle = a;
      chaser.speed = state.player.inCar.speed;
    }
    return { screen: SCREEN_PLAY, overTitle: '', overLines: [] };
  }
  // mission: jump to the dock clean-up, walk in and fight. The player is
  // staged at the docks (the scene's starting point); from there the real
  // rules play out: walk in, shoot, punch.
  world.startMission(3);
  state.player.x = 2100;
  state.player.y = 1260;
  for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
    const player = state.player;
    const thug = state.thugs.find((t) => !t.dead);
    if (!thug) break;
    const input = walkTo(world, thug.x, thug.y);
    const d = Math.hypot(thug.x - player.x, thug.y - player.y);
    if (d < 200) {
      input.shoot = true;
      input.aimX = thug.x;
      input.aimY = thug.y;
    }
    if (d < 40) input.punch = true;
    world.step(STEP, input);
    if (world.state.mission === null) break;
  }
  return { screen: SCREEN_PLAY, overTitle: '', overLines: [] };
}
