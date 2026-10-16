import test from 'node:test';
import assert from 'node:assert/strict';
import { MissionController, MISSION_PHASES } from '../js/missions.js';

test('rescue run advances only through the required objective order', () => {
  const mission = new MissionController({ startedAt: 10_000 });
  assert.equal(mission.phase, MISSION_PHASES.REACH_STATION);
  assert.equal(mission.rescueSurvivor(), false);
  assert.equal(mission.enterVehicle(), false);
  assert.equal(mission.reachStation(), true);
  assert.equal(mission.reachStation(), false);
  assert.equal(mission.phase, MISSION_PHASES.FIND_SURVIVOR);
  assert.equal(mission.enterVehicle(), false);
  assert.equal(mission.rescueSurvivor(), true);
  assert.equal(mission.phase, MISSION_PHASES.RETURN_VEHICLE);
  assert.equal(mission.reachEscape(20_000), null);
  assert.equal(mission.enterVehicle(), true);
  assert.equal(mission.phase, MISSION_PHASES.REACH_ESCAPE);
});

test('mission completion awards one deterministic score and cannot repeat', () => {
  const mission = new MissionController({ startedAt: 10_000 });
  mission.reachStation();
  mission.rescueSurvivor();
  mission.enterVehicle();
  assert.equal(mission.reachEscape(40_000), 1270);
  assert.equal(mission.phase, MISSION_PHASES.COMPLETE);
  assert.equal(mission.reachEscape(40_000), null);
  assert.equal(mission.score, 1270);
});

test('time bonus floors at zero and a failed mission cannot complete', () => {
  const mission = new MissionController({ startedAt: 0 });
  mission.reachStation();
  mission.rescueSurvivor();
  mission.enterVehicle();
  assert.equal(mission.reachEscape(400_000), 1000);
  assert.equal(mission.fail(), false);

  const failed = new MissionController();
  assert.equal(failed.fail(), true);
  assert.equal(failed.reachStation(), false);
});
