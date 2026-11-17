# Porto Sol — Neon Streets: build notes

Game: an original top-down open-world crime game for make.fun bounty
gta6-01 ("Make GTA 6"). Fictional coastal city Porto Sol; Mara the fixer
hands out 5 story missions. No Rockstar names, characters, map or assets.

## Test results

### Logic tests (headless Node, real world.js) — /tmp/test-world.mjs
33 passed, 0 failed:
- City generated: 30+ buildings, 14 traffic cars, 10+ parked cars, 26 pedestrians
- Player walks, stays in the world
- Enter/exit car works; stealing raises wanted and fires EVENT_STEAL
- Car accelerates and the player rides it
- Mission 1 (Get Wheels) completes at the garage and pays $150
- Police spawn for wanted 3 and close in on the player
- Wanted decays to 0 when clean (22 s per star)
- Busted after police hold the player on foot (1.2 s)
- Wasted at 0 health
- Mission 4 spawns 3 thugs; all 3 can be shot dead (thug health 120)
- Save/load round-trip preserves money, health, mission
- Same seed gives the same city (deterministic)
- All 4 shot scenes stage (start/title, play in a car, chase with wanted 3
  and police, mission cleanup mid-fight)

### Story-chain test (headless Node) — /tmp/test-missions.mjs
15 passed, 0 failed: all 5 missions complete in order (Get Wheels $150,
Courier Run $300, Shake the Tail $250, Clean Up Crew $400, The Big Score
$1200), wanted jumps to 4 on the van steal, story completes after mission 5,
total earnings $2,300.

### Live browser test (headless Chrome via CDP) — /tmp/browser-test.mjs
- Title screen loads, canvas present, Space starts the game
- Pause (P) and restart (R) work
- All 4 screenshot scenes reach window.__shotReady
- 0 console errors, 0 failed requests, 0 external requests
- Screenshots (1280x720 JPEG, all under 256 KiB):
  - 1-start.jpg 83,075 B — title panel over the living city
  - 2-play.jpg 85,902 B — driving on the road, HUD + minimap + mission tracker
  - 3-chase.jpg 90,253 B — 3 wanted stars, police car ramming the player car
  - 4-mission.jpg 86,646 B — dock clean-up mid-fight, thug health bars, mission marker

### Bugs found and fixed during the build
1. Car-building collision only checked 4 edge midpoints, so cars drove
   through building corners. Fixed: check all 4 corners + 4 midpoints, and
   restore the pre-move position on collision instead of sliding back.
2. The screenshot autopilot drove in a straight line to its target, cutting
   across blocks. Fixed: route through the street grid (nearest
   intersection, then along roads to the target intersection).
3. The mission banner showed the full briefing paragraph, overflowing its
   panel. Fixed: short objective text in the banner, truncated at 72 chars.
4. The mission shot's fight ended before the frame (autopilot kills all 3
   thugs in ~2 s). Fixed: thug health 70 -> 120 and a 1-second staging
   window, so the frame shows the fight mid-way with health bars visible.
5. The chase shot showed no police in frame. Fixed: the scene frames the
   nearest police car right behind the player's car after the real chase.
6. main.js consumed one-shot input twice (ENTER/PUNCH lost between
   handleActions and stepWorld). Fixed: takeActions once per frame, shared,
   and one-shot flags go to the first simulation step only.

## Dossier build
- `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` writes
  out/dossier.json and copies game/ + screenshots/ to out/.
- `node cli/makefun.mjs check --repo ~/workspace/makefun/gta6-entry --worktree`
  from the kit dir: competition_open, snapshot, license_osi, entrypoint pass;
  transcript checks fail/skip without the sealed recording (expected — the
  recording seals separately at submit time).

## Files
- main.ts, serve.ts, LICENSE (MIT), README.md, shots.json
- game/index.html, game/src/config.js, random.js, sound.js, world.js,
  input.js, render.js, shots.js, main.js
- vendor/makefun-game.ts (kit copy, unchanged, sha256 verified)
- screenshots/1-start.jpg, 2-play.jpg, 3-chase.jpg, 4-mission.jpg
