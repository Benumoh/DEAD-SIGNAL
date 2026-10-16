# DEAD SIGNAL

A static, low-poly third-person zombie-survival driving prototype. Find the service station, rescue the survivor, then drive to the escape point.

## Play

Open the root `index.html` on a static host. For local browser testing, start the included static preview server:

```sh
npm run serve
```

Then open `http://localhost:8000`. No build step or backend is required; Three.js is included under `assets/vendor/`.

## Controls

- **W / A / S / D** — walk or drive
- **Shift** — run
- **Space** — brake while driving
- **E** — enter/exit the vehicle or rescue the survivor
- **Right mouse drag** — rotate the on-foot camera

The car starts near the survivor. Drive north along the marked highway to the service station, park, leave the vehicle and approach the survivor. Interact, return to the car and drive south to the marked escape point.

## start.ng

The game uses the documented hidden connect frame (`https://start.ng/connect`) with origin and source checks:

- `startng:whoami` supplies the signed-in character or start.ng guest, and refreshes when the tab regains focus.
- The character's name, face and documented style colors are shown in-game and used for the low-poly player model.
- The survivor-run score is sent once per mission with `startng:score`; the live top-ten board is read through `https://api.start.ng/games/{game}/leaderboard?limit=10`.
- Guests can play and see the board but cannot submit scores. The local preview is explicitly unauthenticated and does not invent a guest identity or local leaderboard.
- The published start.ng docs do not specify a friends-list or friend-score API. No friend feature is fabricated; the supported global leaderboard is the closest documented comparison.
- Identity, score submission, and score reads require a live `*.start.ng` game. They cannot be fully verified from localhost.

There are no private credentials or custom server. Publishing is documented at [start.ng/docs](https://start.ng/docs): push this repository publicly, call `POST https://api.start.ng/games/check` with `{"repo_url":"https://github.com/<owner>/DEAD-SIGNAL","name":"dead-signal"}`, fix any errors, then call `POST https://api.start.ng/games/publish` with the same body. For a new game, follow the returned `approve_url` to approve it. start.ng watches the published branch for later pushes.

## Project structure

```text
index.html
cover.png
css/styles.css
js/main.js
js/game.js
js/player.js
js/vehicle.js
js/infected.js
js/missions.js
js/ui.js
js/startng-integration.js
assets/vendor/three.module.js
assets/vendor/three.core.js
assets/favicon.svg
tests/missions.test.js
```

## Test

```powershell
npm test
```

The automated tests verify mission order, duplicate completion protection and scoring. Use the manual checklist below for browser-only gameplay.

## Manual gameplay checks

1. Load `index.html` through a local static server and check that the world, HUD, station, vehicle and infected render without console errors.
2. Walk with WASD, run with Shift, and rotate the camera by right-dragging.
3. Press E beside the rescue vehicle; drive with WASD, steer with A/D, and brake with Space.
4. Drive to the service station until the objective changes. Slow down, press E to exit, approach the survivor and press E.
5. Return to the vehicle and drive to the escape marker. Verify the completion overlay and score appear once.
6. On a published `*.start.ng` URL, verify identity, guest/sign-in behavior, leaderboard data and one signed-in score submission.
7. Check that the game and `cover.png` load from the published start.ng address.
