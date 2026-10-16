import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CampaignProgress,
  gradeForScore,
  MissionController,
  MISSION_IDS,
  MISSION_PHASES,
} from '../js/missions.js';

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

test('mission completion snapshots a single score and cannot repeat', () => {
  const mission = new MissionController({ startedAt: 10_000 });
  mission.reachStation();
  mission.rescueSurvivor();
  mission.enterVehicle();
  const result = mission.reachEscape(40_000, 100);
  assert.equal(mission.phase, MISSION_PHASES.COMPLETE);
  assert.equal(result.score, 1670);
  assert.equal(result.elapsedSeconds, 30);
  assert.equal(result.survivorRescued, true);
  assert.equal(result.grade, 'S');
  assert.deepEqual(result.components, {
    missionCompletion: 1000,
    objectiveBonus: 200,
    completionTime: 270,
    remainingHealth: 200,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.components), true);
  assert.equal(mission.reachEscape(40_000), null);
  assert.equal(mission.score, 1670);
});

test('score bounds time and health bonuses and a failed mission cannot complete', () => {
  const mission = new MissionController({ startedAt: 0 });
  mission.reachStation();
  mission.rescueSurvivor();
  mission.enterVehicle();
  const result = mission.reachEscape(400_000, 25);
  assert.equal(result.score, 1250);
  assert.equal(result.components.completionTime, 0);
  assert.equal(result.components.remainingHealth, 50);
  assert.equal(result.grade, 'C');
  assert.equal(mission.fail(), false);

  const failed = new MissionController();
  assert.equal(failed.fail(), true);
  assert.equal(failed.reachStation(), false);
});

test('grade thresholds are stable at each boundary', () => {
  assert.equal(gradeForScore(1650), 'S');
  assert.equal(gradeForScore(1649), 'A');
  assert.equal(gradeForScore(1500), 'A');
  assert.equal(gradeForScore(1499), 'B');
  assert.equal(gradeForScore(1400), 'B');
  assert.equal(gradeForScore(1399), 'C');
});

test('reset starts a distinct mission and clears all prior run results', () => {
  const mission = new MissionController({ startedAt: 10_000 });
  mission.reachStation();
  mission.rescueSurvivor();
  mission.enterVehicle();
  const previousResult = mission.reachEscape(40_000, 40);

  mission.reset(50_000);
  assert.equal(mission.phase, MISSION_PHASES.REACH_STATION);
  assert.equal(mission.startedAt, 50_000);
  assert.equal(mission.score, null);
  assert.equal(mission.result, null);
  assert.equal(mission.survivorRescued, false);
  assert.equal(previousResult.score, 1550);
  assert.equal(mission.rescueSurvivor(), false);
});

test('Blackout Tunnel follows ordered phases and awards a single result', () => {
  const mission = new MissionController({
    startedAt: 10_000,
    missionId: MISSION_IDS.BLACKOUT_TUNNEL,
  });
  assert.equal(mission.phase, MISSION_PHASES.TRAVEL_TUNNEL);
  assert.equal(mission.reachStation(), false);
  assert.equal(mission.reachTunnelEntrance(), true);
  assert.equal(mission.reachTunnelEntrance(), false);
  assert.equal(mission.enterTunnel(), true);
  assert.equal(mission.reachSignalDevice(), true);
  assert.equal(mission.investigateRelay(), true);
  assert.equal(mission.investigateRelay(), false);
  assert.equal(mission.clueFound, true);

  const result = mission.reachTunnelExit(50_000, 100);
  assert.equal(result.missionId, MISSION_IDS.BLACKOUT_TUNNEL);
  assert.equal(result.missionName, 'The Blackout Tunnel');
  assert.equal(result.objectiveLabel, 'SIGNAL DEVICE');
  assert.equal(result.objectiveFound, true);
  assert.equal(result.clueFound, true);
  assert.equal(result.survivorRescued, null);
  assert.equal(result.score, 1710);
  assert.equal(result.grade, 'S');
  assert.deepEqual(result.components, {
    missionCompletion: 1000,
    objectiveBonus: 250,
    completionTime: 260,
    remainingHealth: 200,
  });
  assert.equal(mission.reachTunnelExit(60_000), null);
});

test('campaign keeps each mission result when another mission completes', () => {
  const campaign = new CampaignProgress();
  const rescue = new MissionController({ startedAt: 0 });
  rescue.reachStation();
  rescue.rescueSurvivor();
  rescue.enterVehicle();
  const rescueResult = rescue.reachEscape(10_000, 90);

  const tunnel = new MissionController({ startedAt: 0, missionId: MISSION_IDS.BLACKOUT_TUNNEL });
  tunnel.reachTunnelEntrance();
  tunnel.enterTunnel();
  tunnel.reachSignalDevice();
  tunnel.investigateRelay();
  const tunnelResult = tunnel.reachTunnelExit(12_000, 80);
  campaign.record(rescueResult);
  campaign.record(tunnelResult);

  assert.equal(campaign.get(MISSION_IDS.RESCUE_RUN), rescueResult);
  assert.equal(campaign.get(MISSION_IDS.BLACKOUT_TUNNEL), tunnelResult);
  assert.equal(campaign.get('unknown'), null);
});

test('replaying Blackout Tunnel resets its phases, clue and score snapshot', () => {
  const mission = new MissionController({ startedAt: 10_000, missionId: MISSION_IDS.BLACKOUT_TUNNEL });
  mission.reachTunnelEntrance();
  mission.enterTunnel();
  mission.reachSignalDevice();
  mission.investigateRelay();
  const previousResult = mission.reachTunnelExit(30_000, 60);

  mission.reset(40_000, MISSION_IDS.BLACKOUT_TUNNEL);
  assert.equal(mission.phase, MISSION_PHASES.TRAVEL_TUNNEL);
  assert.equal(mission.startedAt, 40_000);
  assert.equal(mission.score, null);
  assert.equal(mission.result, null);
  assert.equal(mission.clueFound, false);
  assert.equal(mission.survivorRescued, false);
  assert.equal(previousResult.clueFound, true);
  assert.equal(previousResult.score, 1650);
});
