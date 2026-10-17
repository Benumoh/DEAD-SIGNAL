import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_MISSIONS,
  CampaignProgress,
  gradeForScore,
  MissionController,
  MISSION_IDS,
  MISSION_PHASES,
  SPECIAL_OPERATIONS,
} from '../js/missions.js';
import { FIELD_MISSIONS } from '../js/field-missions.js';

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

test('campaign registry contains 24 ordered missions and a separate tunnel operation', () => {
  const campaign = new CampaignProgress(null);
  assert.equal(CAMPAIGN_MISSIONS.length, 24);
  assert.equal(CAMPAIGN_MISSIONS[0].id, MISSION_IDS.RESCUE_RUN);
  assert.equal(CAMPAIGN_MISSIONS[0].implemented, true);
  assert.equal(campaign.stateFor(CAMPAIGN_MISSIONS[0].id), 'available');
  assert.equal(campaign.stateFor(CAMPAIGN_MISSIONS[1].id), 'locked');
  assert.equal(CAMPAIGN_MISSIONS[9].title, 'Blackout Tunnel');
  assert.notEqual(CAMPAIGN_MISSIONS[9].id, MISSION_IDS.BLACKOUT_TUNNEL);
  assert.equal(SPECIAL_OPERATIONS[0].id, MISSION_IDS.BLACKOUT_TUNNEL);
  assert.equal(SPECIAL_OPERATIONS[0].implemented, true);
});

test('campaign completion persists locally and unlocks only the next mission', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const campaign = new CampaignProgress(storage);
  const rescue = new MissionController({ startedAt: 0 });
  rescue.reachStation();
  rescue.rescueSurvivor();
  rescue.enterVehicle();
  campaign.record(rescue.reachEscape(10_000, 90));

  assert.equal(campaign.stateFor(CAMPAIGN_MISSIONS[0].id), 'completed');
  assert.equal(campaign.stateFor(CAMPAIGN_MISSIONS[1].id), 'available');
  assert.equal(campaign.stateFor(CAMPAIGN_MISSIONS[2].id), 'locked');

  const restored = new CampaignProgress(storage);
  assert.equal(restored.stateFor(CAMPAIGN_MISSIONS[0].id), 'completed');
  assert.equal(restored.stateFor(CAMPAIGN_MISSIONS[1].id), 'available');
  assert.equal(restored.get(MISSION_IDS.RESCUE_RUN), null);
});

test('the tunnel result completes campaign mission 10 and unlocks mission 11', () => {
  const campaign = new CampaignProgress(null);
  const tunnel = new MissionController({ startedAt: 0, missionId: MISSION_IDS.BLACKOUT_TUNNEL });
  tunnel.reachTunnelEntrance();
  tunnel.enterTunnel();
  tunnel.reachSignalDevice();
  tunnel.investigateRelay();
  campaign.record(tunnel.reachTunnelExit(10_000, 100));

  assert.equal(campaign.stateFor('blackout-tunnel-10'), 'completed');
  assert.equal(campaign.stateFor(CAMPAIGN_MISSIONS[10].id), 'available');
  assert.equal(campaign.stateFor(CAMPAIGN_MISSIONS[9].id), 'completed');
});

test('every campaign mission is playable and field missions stay within the infected pool', () => {
  for (const mission of CAMPAIGN_MISSIONS) {
    assert.equal(mission.implemented, true);
    if (mission.launchId !== MISSION_IDS.BLACKOUT_TUNNEL && mission.launchId !== MISSION_IDS.RESCUE_RUN) {
      assert.ok(FIELD_MISSIONS[mission.launchId], mission.id);
    }
  }
  assert.equal(Object.keys(FIELD_MISSIONS).length, 22);
});

test('field mission advances through stages, ignores duplicate triggers and scores against par', () => {
  const id = 'last-fuel-stop-03';
  const mission = new MissionController({ startedAt: 0, missionId: id });
  const stages = FIELD_MISSIONS[id].stages;
  assert.equal(mission.phase, MISSION_PHASES.FIELD);
  assert.equal(mission.fieldProgress(0), false);
  assert.equal(mission.fieldProgress(0), false);
  assert.equal(mission.fieldProgress(0), true);
  assert.equal(mission.completeFieldStage(0, 20_000, 100), null);
  assert.equal(mission.stageIndex, 1);
  assert.equal(mission.completeFieldStage(0, 20_000, 100), null);
  assert.equal(mission.stageIndex, 1);
  mission.completeFieldStage(1, 30_000, 100);
  assert.equal(mission.stageIndex, stages.length - 1);
  const result = mission.completeFieldStage(stages.length - 1, 60_000, 100);
  assert.equal(result.components.completionTime, 180);
  assert.equal(result.score, 1000 + 200 + 180 + 200);
  assert.equal(mission.completeFieldStage(stages.length - 1, 61_000, 100), null);
  assert.equal(mission.result.score, result.score);

  mission.reset(100_000, id);
  assert.equal(mission.stageIndex, 0);
  assert.equal(mission.result, null);
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
