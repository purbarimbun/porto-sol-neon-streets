// Porto Sol — Neon Streets: boot and the one loop. Input is read every frame,
// the world advances in fixed 1/60 s steps, and the renderer paints what is
// there. Screens: title, play, paused, busted, wasted, and a story-complete
// panel. Save/load lives in localStorage; M mutes; R restarts.
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createSound } from './sound.js';
import {
  createWorld, EVENT_BUSTED, EVENT_CRASH, EVENT_MISSION_DONE, EVENT_MISSION_FAIL,
  EVENT_PICKUP, EVENT_SHOT, EVENT_STEAL, EVENT_WASTED,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH,
  ACTION_RESTART, createInput,
} from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const sound = createSound();

function readJson(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const target = world.missionTarget();
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, {
      mission: world.state.mission, target, message: '',
      hasSave: false, overTitle: scene.overTitle, overLines: scene.overLines,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = 0;
  try { best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { best = 0; }
  let hasSave = readJson(SAVE_KEY) !== null;
  let accumulator = 0;
  let last = performance.now();
  let message = '';
  let messageTimer = 0;
  let overTitle = 'WASTED';
  let overLines = [''];

  function announce(text) {
    status.textContent = text;
  }

  function showMessage(text, seconds) {
    message = text;
    messageTimer = seconds || 4;
  }

  function saveGame() {
    writeJson(SAVE_KEY, world.saveData());
    hasSave = true;
  }

  function startGame(fresh) {
    if (fresh) {
      world.reset();
      try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      hasSave = false;
      showMessage(world.state.mission ? `${world.state.mission.name}: ${world.state.mission.objective}` : '', 5);
    } else {
      const save = readJson(SAVE_KEY);
      if (save && world.loadData(save)) {
        showMessage('Welcome back to Porto Sol.', 4);
      } else {
        world.reset();
      }
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    sound.unlock();
    announce('Playing Porto Sol. Mara has a job for you.');
  }

  function endGame(title, lines) {
    overTitle = title;
    overLines = lines;
    screen = SCREEN_OVER;
    sound.stopEngine();
    sound.stopSiren();
    if (world.state.player.money > best) {
      best = world.state.player.money;
      try { window.localStorage.setItem(BEST_KEY, String(best)); } catch { /* ignore */ }
    }
    announce(`${title}. You earned $${world.state.player.money}.`);
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = sound.toggleMute();
      showMessage(muted ? 'Sound muted (M to unmute)' : 'Sound on', 2);
    }
    if (actions & ACTION_RESTART && screen === SCREEN_PLAY) {
      startGame(true);
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(true);
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame(true);
      return;
    }
    if (screen === SCREEN_STORY) {
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        sound.stopEngine();
        sound.stopSiren();
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function stepWorld(actions) {
    const move = input.move();
    const mouse = input.mouse();
    const aim = renderer.screenToWorld(mouse.x, mouse.y);
    const events = world.step(STEP, {
      mx: move.x,
      my: move.y,
      enter: !!(actions & ACTION_ENTER),
      punch: !!(actions & ACTION_PUNCH),
      shoot: input.shooting(),
      aimX: aim.x,
      aimY: aim.y,
      handbrake: input.handbrake(),
    });
    // The one-shot flags are taken once per frame in frame() and shared
    // between handleActions (confirm/pause/mute/restart) and this step
    // (enter/punch), so no press is ever lost or counted twice.
    if (events & EVENT_SHOT) {
      sound.shot();
    }
    if (events & EVENT_STEAL) {
      sound.carEnter();
      showMessage('Car stolen! The police are watching…', 3);
    }
    if (events & EVENT_CRASH) sound.crash();
    if (events & EVENT_PICKUP) sound.pickup();
    if (events & EVENT_MISSION_DONE) {
      sound.missionDone();
      showMessage(world.state.missionMessage, 5);
      saveGame();
      if (world.state.storyComplete) {
        screen = SCREEN_STORY;
        overLines = ['You pulled off the Big Score. Porto Sol is yours now.', `You earned $${world.state.player.money} across 5 missions.`];
        announce('Story complete. Porto Sol is yours.');
        return;
      }
      const next = world.state.missionIndex + 1;
      world.startMission(next);
      if (world.state.mission) showMessage(`${world.state.mission.name}: ${world.state.mission.objective}`, 5);
    }
    if (events & EVENT_MISSION_FAIL) {
      sound.fail();
      showMessage(world.state.missionMessage, 5);
      // Retry the same mission.
      world.startMission(world.state.missionIndex);
      if (world.state.mission) showMessage(`${world.state.mission.name}: ${world.state.mission.objective}`, 5);
    }
    if (events & EVENT_BUSTED) {
      sound.busted();
      endGame('BUSTED', ['The Porto Sol police took you in.', `You earned $${world.state.player.money}. Mara will bail you out… for a price.`]);
    } else if (events & EVENT_WASTED) {
      sound.fail();
      endGame('WASTED', ['Porto Sol was too much for you.', `You earned $${world.state.player.money}.`]);
    }
    // Engine hum and siren follow the driving and the heat.
    const player = world.state.player;
    if (player.inCar) {
      sound.startEngine();
      sound.setEngine(Math.abs(player.inCar.speed) / 520);
    } else {
      sound.stopEngine();
    }
    if (world.state.wanted > 0) sound.startSiren();
    else sound.stopSiren();
    if (messageTimer > 0) {
      messageTimer -= STEP;
      if (messageTimer <= 0) message = '';
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_PLAY) {
      // One-shot presses (enter car, punch) belong to the first step only:
      // repeating them across the frame's catch-up steps would enter and
      // immediately exit the same car.
      let stepActions = actions;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepWorld(stepActions);
        stepActions = 0;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, {
      mission: world.state.mission,
      target: world.missionTarget(),
      message,
      hasSave,
      overTitle,
      overLines,
    });
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      sound.stopEngine();
      sound.stopSiren();
      announce('Paused.');
    }
  });
  // Autosave every 10 seconds of play.
  setInterval(() => {
    if (screen === SCREEN_PLAY) saveGame();
  }, 10000);

  announce('Porto Sol — Neon Streets. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
