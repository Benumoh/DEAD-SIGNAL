# DEAD SIGNAL

A static third-person zombie-survival driving game built with Three.js. Start the Rescue a Friend campaign or take the existing Blackout Tunnel as a standalone operation.

The existing stylized 3D scene now uses deterministic procedural asphalt and ground textures, instanced roadside growth and debris, more detailed abandoned vehicles, atmospheric fog, shadowed lighting, and vehicle headlight/brake feedback. The player and infected have lightweight limb motion. The title screen and cover use original locally authored artwork; no external textures, models, or runtime asset downloads are required.

## Play

Open the root `index.html` on a static host. For local browser testing, start the included static preview server:

```sh
npm run serve
```

Then open `http://localhost:8000`. No build step or backend is required; Three.js is included under `assets/vendor/`.

To regenerate the original 1600×1000 cover artwork on Windows PowerShell, run:

```powershell
.\scripts\generate-cover.ps1
```

## Controls

- **W / A / S / D** — walk or drive
- **Shift** — run
- **Space** — brake while driving
- **E** — enter/exit the vehicle or rescue the survivor
- **Right mouse drag** — rotate the on-foot camera
- **Esc / P** or the **PAUSE** button — pause. Resuming (button, Enter, Esc or P) starts a 3-second countdown, and the paused time is excluded from the completion time. Losing window focus also pauses.
- **Arrow keys / Enter / Esc** — move between buttons, select, and go back on the title, mission selection, briefing, pause and debrief screens

The title background is `assets/menu-bg.jpg`.

### Mobile and touch

Touch mode turns on automatically on touch devices (and on the first touch, or with `?touch=1` in the URL):

- **Left stick** — walk or drive (up/down = W/S, left/right = A/D)
- **E / BRK / RUN buttons** — interact, brake, and toggle run
- **One-finger drag** on the scene — rotate the on-foot camera
- **PAUSE** button — pause; resuming uses the same 3-second countdown
- Menus and other screens are operated by tapping their buttons directly; no on-screen navigation pad is shown there

Touch input feeds the same key set the keyboard uses (`js/touch.js`), so no gameplay code is duplicated.

Select **START MISSION** to open the campaign list and briefing. Mission 1, **Rescue a Friend**, is the first playable campaign mission. The Rescue Run car starts near the survivor. Drive north along the marked highway to the service station, park, leave the vehicle and approach the survivor. Interact, return to the car and drive south to the marked escape point.

The 24-mission campaign registry presents six chapters, mission briefings, objectives, locations, difficulty, and prerequisites. All 24 missions are playable and unlock in order. Missions 1 and 10 keep their dedicated scripts (Rescue Run and Blackout Tunnel); the Tunnel's standalone special operation and campaign Mission 10 share the same script, and finishing either marks Mission 10 complete. Missions 2–9 and 11–24 are data-driven chains of objectives (reach a place, collect items, survive a timer, choose a route, escape) defined in `js/field-missions.js`. **Limitation:** every mission plays on the same county road; they differ in objectives, locations, infected pressure (per difficulty, up to 12 infected) and atmosphere, not in unique long-road maps. After a successful debrief, **Next Mission** opens the next briefing (hidden after Mission 24 or if the next mission is locked). Tunnel: drive south to the entrance, follow the amber lamps through the radio outage, investigate the relay, then return to the vehicle and reach the far exit.

Field missions score 1,000 completion + 200 objective bonus + time bonus (the lesser of 300 and the mission's par seconds, minus elapsed seconds) + 2 × remaining health %. Grades use the same thresholds.

## Mission debrief and scoring

Start from the title screen, select a playable operation, review its briefing, and confirm to launch. Complete the rescue route to see the Mission Debrief. It shows the completed run's mission name, score, elapsed time, rescue outcome and grade. Replay resets the mission, timer, score inputs, survivor, player health, vehicle, infected and temporary HUD state without reloading the page. The main menu pauses gameplay; Field Records remains available during gameplay.

Each mission score is calculated once when its final escape objective is completed:

- Mission completion: **1,000 points**
- Rescue Run survivor bonus: **200 points**
- Blackout Tunnel relay clue bonus: **250 points**
- Time bonus: **max(0, 300 − elapsed whole seconds)**
- Remaining-health bonus: **2 × remaining health percentage**

The grade uses the final score: **S ≥ 1,650**, **A ≥ 1,500**, **B ≥ 1,400**, otherwise **C**. Health is the existing player health value; the game has no vehicle-damage statistic. Each completion stores a frozen result snapshot, and each run can award and submit only once.

Campaign completion IDs are saved in browser local storage and unlock the next campaign entry; run scores and debrief snapshots are not persisted locally. Local campaign progress is separate from start.ng identity and scores. Replaying a mission does not clear prior campaign completion.

## Roads and sound

Each mission uses one of nine road layouts (county, settlement, highway, bridge, ruins, forest, checkpoint, industrial, mountain) defined in `js/roads.js` and built by `js/road-builder.js`: curve, width, surface, markings, barriers and roadside props. The county layout and the Blackout Tunnel are unchanged.

Audio is generated with the Web Audio API in `js/audio.js` (no audio files): ambient music per layout, engine, footsteps, infected growls, UI clicks and objective chimes. Sound starts after the first click or key press. Toggle it with the SOUND button or `M`; the choice is saved in `localStorage`.

## start.ng

The game uses the documented hidden connect frame (`https://start.ng/connect`) with origin and source checks:

- `startng:whoami` supplies the signed-in character or start.ng guest, and refreshes when the tab regains focus.
- The character's name, face and documented style colors are shown in-game and used for the low-poly player model.
- The completed run's score is sent through the documented `startng:score` message. Submission is guarded per run, and the debrief reports success only when the matching `startng:scoreSaved` reply confirms `ok: true`; guests are reported as not submitted, while timeouts and rejected submissions are reported as unconfirmed. The live top-ten board is read through `https://api.start.ng/games/{game}/leaderboard?limit=10`.
- Guests can play and see the board but cannot submit scores. The local preview is explicitly unauthenticated and does not invent a guest identity or local leaderboard.
- The published start.ng docs do not specify a friends-list or friend-score API. No friend feature is fabricated; the supported global leaderboard is the closest documented comparison.
- Identity, score submission, and score reads require a live `*.start.ng` game. They cannot be fully verified from localhost.

There are no private credentials or custom server. Publishing is documented at [start.ng/docs](https://start.ng/docs): push this repository publicly, call `POST https://api.start.ng/games/check` with `{"repo_url":"https://github.com/<owner>/DEAD-SIGNAL","name":"dead-signal"}`, fix any errors, then call `POST https://api.start.ng/games/publish` with the same body. For a new game, follow the returned `approve_url` to approve it. start.ng watches the published branch for later pushes.

## Rendering and performance notes

- The game retains its static HTML/CSS/JavaScript and vendored Three.js architecture. Procedural 512px canvas textures are generated once at startup; roadside shrubs and debris use instanced meshes.
- The renderer caps device pixel ratio at 1.5 and uses the existing 1024×1024 directional shadow map with a tighter shadow volume. Fog gives the road depth without a post-processing pass.
- Headlights add two non-shadow-casting spotlights and subtle transparent beam meshes. The game does not add SSAO, bloom, or a post-processing dependency.
- Performance was checked for a successful browser-played rescue run, but no repeatable device-specific frame-rate benchmark was taken. Lower-end GPU performance remains to be measured.
- The supplied reference images were not present as accessible files in the workspace. The new cover/title illustration is original vector artwork based on the written visual brief; it is not a copy of either reference.

## Project structure

assets/title-art.svg
scripts/generate-cover.ps1
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

The automated tests verify mission order, the 24-entry registry, local progression persistence, score components, grade thresholds, replay reset behavior, immutable run results, and per-run score-submission guards. Use the manual checklist below for browser-only gameplay.

## Manual gameplay checks

1. Load `index.html` through a local static server and check that the title screen, world, HUD, station, vehicle and infected render without console errors.
2. Select **Start Mission**. Walk with WASD, run with Shift, and rotate the camera by right-dragging.
3. Press E beside the rescue vehicle; drive with WASD, steer with A/D, and brake with Space.
4. Drive to the service station until the objective changes. Slow down, press E to exit, approach the survivor and press E.
5. Return to the vehicle and drive to the escape marker. Verify the debrief metrics and grade match the run and that score-submission status is honest.
6. Select **Replay Mission**. Confirm the initial position, health, survivor, vehicle, infected, objective and timer are reset; complete the mission again and verify a separate submission attempt.
7. Select **Return to Main Menu**, verify the world is paused, then start another run. Open and close Field Records to confirm it still works.
8. Select **Mission 2 // The Blackout Tunnel**. Drive into the tunnel; confirm the radio outage and amber guide lights, wait for the signal to return, approach and investigate the relay, then escape by vehicle.
9. Confirm the Mission 2 debrief reports the signal device result, score, time and grade. Replay and verify the tunnel, clue, blackout, infected, health and timer reset.
10. Open Field Records and confirm the existing live global board still loads. On a published `*.start.ng` URL, verify identity, guest/sign-in behavior, leaderboard data and one confirmed signed-in score submission per completed run; records are not separated by mission.
11. Check that the game and `cover.png` load from the published start.ng address.
