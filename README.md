# porto-sol-neon-streets

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/purbarimbun/porto-sol-neon-streets/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/purbarimbun/porto-sol-neon-streets/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Porto Sol — Neon Streets: a complete original top-down open-world crime game for the make.fun bounty "Make GTA 6". Explore a coastal city on foot and by car, steal cars, dodge police, complete 5 story missions.

## Run it

```sh
node serve.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=6d39qsdp&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

# Porto Sol — Neon Streets

An original open-world crime game for the make.fun bounty **“Make GTA 6”**
(`gta6-01`). You are a new driver in Porto Sol, a sun-soaked coastal city.
Mara the fixer has five jobs for you — steal cars, outrun the police, and
pull off the Big Score. Everything is original: the city, the characters,
the vehicles, the story, the art and the sounds. No Rockstar Games names,
characters, map or assets are used anywhere.

## The city

Porto Sol is a 2560×1920 top-down open world: a grid of streets with
traffic lights, blocks of buildings, Sunset Park, a sandy beach and the
harbour docks. Traffic cars cruise the streets, pedestrians walk the
sidewalks, and police cars answer your wanted level.

## What to do

- **On foot:** walk the streets, punch thugs (F), shoot with the pistol
  (aim with the mouse, click to fire).
- **By car:** press E near any parked or traffic car to steal it — stealing
  raises your wanted level. Drive with WASD, Space is the handbrake.
- **Wanted level:** 1–5 stars. Police chase and ram you; stay clean and the
  heat fades. Get caught on foot and you are BUSTED; lose all your health
  and you are WASTED.
- **Missions (from Mara):** 1. Get Wheels — steal a car for the garage.
  2. Courier Run — deliver a package to the harbour in 90 seconds.
  3. Shake the Tail — lose the police, then meet Mara at the park.
  4. Clean Up Crew — defeat 3 thugs at the docks, on foot.
  5. The Big Score — steal the armoured van and outrun the whole city.
  Each mission pays cash; finishing all five completes the story.
- **HUD:** health, money, wanted stars, ammo, mission tracker, clock, and a
  live minimap showing you, the police and the mission marker.
- **Save:** your progress autosaves every 10 seconds and when a mission
  finishes; continue from the title screen. Best earnings are kept too.

## Controls

| Action | Controls |
| --- | --- |
| Move / drive | WASD or arrow keys |
| Enter / exit car | E |
| Punch | F |
| Aim and shoot | Mouse + click |
| Handbrake | Space |
| Pause | P or Esc |
| Mute | M |
| Restart | R |
| Start / continue | Space or click |

## How to run

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

Open http://localhost:8080 in a desktop browser. No build step, no
libraries, no network requests — everything is plain static files under
`game/` (HTML + ES modules + canvas, sound synthesized with WebAudio).

Screenshots are staged deterministically, e.g.
`http://localhost:8080/?shot=play&seed=1` — see `shots.json` for the four
submitted shots (title, driving, police chase, mission fight).

## Files

- `main.ts` — the entry program: copies `game/` + `screenshots/` to the
  output directory and writes `dossier.json` with the vendored make.fun
  library (`vendor/makefun-game.ts`, copied unchanged from the kit).
- `game/index.html`, `game/src/*.js` — the game itself: `config.js`
  (tuning), `world.js` (city, traffic, police, missions, combat),
  `render.js` (camera, city, HUD, minimap), `input.js`, `sound.js`,
  `shots.js` (screenshot scenes), `main.js` (loop, screens, save/load).
- `screenshots/` — 4 real renders of the game running (1280×720 JPEG).
- `shots.json` — the shot list used to capture them.
- `serve.ts` — tiny local static server for development.

## Originality

Porto Sol was written from scratch for this bounty: its own city layout,
names (Porto Sol, Mara, Coral Row, Sunset Park), characters, vehicles and
story, art (all canvas-drawn — no images, no copied sprites), sounds
(synthesized, no audio files). It shares no game code with the kit's
starter (Block Dodger).

## License

MIT — see `LICENSE`.
