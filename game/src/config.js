// Porto Sol — Neon Streets: every tuning number and colour in one place.
// The city is a fixed 2560x1920 world; the renderer shows a 1280x720 window
// that follows the player, so no rule below depends on the screen size.

export const WORLD = { width: 2560, height: 1920 };
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Streets run every 360 px, roads 96 px wide, so blocks are 264 px squares. */
export const GRID = { spacing: 360, road: 96, first: 180 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 230,
  runSpeed: 300,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchCooldown: 0.35,
  pistolDamage: 34,
  pistolCooldown: 0.28,
  pistolAmmo: 12,
  pistolRange: 460,
  invulnerable: 1.0,
};

export const CAR = {
  width: 26,
  length: 52,
  accel: 420,
  brake: 700,
  reverseAccel: 220,
  maxSpeed: 520,
  maxReverse: 160,
  steer: 2.6,
  grip: 3.2,
  handbrakeGrip: 1.1,
  enterRange: 70,
};

export const POLICE = {
  maxSpeed: 560,
  accel: 480,
  ramDamage: 12,
  bustTime: 1.2,
  spawnDistance: 700,
};

export const TRAFFIC = { count: 14, speed: 130, speedJitter: 50 };
export const PEDS = { count: 26, speed: 55, speedJitter: 25 };

export const WANTED = {
  decaySeconds: 22,
  steal: 1,
  shootPed: 1,
  killCop: 2,
  max: 5,
};

/** Mission list, in story order. Mara the fixer hands them out by phone. */
export const MISSIONS = [
  {
    id: 'wheels',
    name: 'Get Wheels',
    giver: 'Mara',
    briefing: 'You are new in Porto Sol and broke. Steal any car and bring it to my garage on Coral Row.',
    objective: 'Steal a car, then drive to the garage marker',
    reward: 150,
  },
  {
    id: 'courier',
    name: 'Courier Run',
    giver: 'Mara',
    briefing: 'A package for the harbour master. Drive it to the docks in 90 seconds. No questions, no stops.',
    objective: 'Deliver the package to the harbour in 90 seconds',
    reward: 300,
    timeLimit: 90,
  },
  {
    id: 'tail',
    name: 'Shake the Tail',
    giver: 'Mara',
    briefing: 'The harbour job drew heat. Lose the police, then meet me at the park. Stay out of sight until the stars fade.',
    objective: 'Lose the wanted level, then reach the park marker',
    reward: 250,
  },
  {
    id: 'cleanup',
    name: 'Clean Up Crew',
    giver: 'Mara',
    briefing: 'Three thugs from the dock crew are leaning on my drivers. On foot, at the docks. Make them walk away.',
    objective: 'Defeat all 3 thugs at the docks',
    reward: 400,
  },
  {
    id: 'score',
    name: 'The Big Score',
    giver: 'Mara',
    briefing: 'One last job: the armoured van at the bank plaza. Take it, outrun the whole city, bring it to the garage.',
    objective: 'Steal the armoured van and deliver it to the garage',
    reward: 1200,
  },
];

export const SAVE_KEY = 'porto-sol.save';
export const BEST_KEY = 'porto-sol.best';

export const PALETTE = {
  backdrop: '#0d1526',
  grass: '#2e6b3a',
  park: '#3a7d46',
  sand: '#d9c27a',
  water: '#1e6f8e',
  waterDeep: '#155a75',
  road: '#2b2f38',
  roadLine: '#d8c25a',
  sidewalk: '#4a4f5c',
  building: '#5a6274',
  buildingRoof: '#3d4356',
  buildingGlass: '#8fd4e8',
  player: '#ffcf3f',
  playerShirt: '#e84c3d',
  ped: '#c9d1de',
  thug: '#8e3b46',
  police: '#2f6fd0',
  policeLight: '#ff3b30',
  carColors: ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#ecf0f1', '#16a085', '#d35400'],
  van: '#3a3f4a',
  hud: '#101623',
  hudText: '#f2f5f9',
  hudMuted: '#9aa5b5',
  gold: '#f2c94c',
  red: '#e5534b',
  green: '#4ade80',
  marker: '#ffcf3f',
  minimap: '#0a1220',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
