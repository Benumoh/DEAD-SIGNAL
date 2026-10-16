export const MISSION_IDS = Object.freeze({
  RESCUE_RUN: 'rescue-run-01',
  BLACKOUT_TUNNEL: 'blackout-tunnel',
});

export const MISSION_PHASES = Object.freeze({
  REACH_STATION: 'reach_station',
  FIND_SURVIVOR: 'find_survivor',
  RETURN_VEHICLE: 'return_vehicle',
  REACH_ESCAPE: 'reach_escape',
  TRAVEL_TUNNEL: 'travel_tunnel',
  ENTER_TUNNEL: 'enter_tunnel',
  NAVIGATE_BLACKOUT: 'navigate_blackout',
  INVESTIGATE_RELAY: 'investigate_relay',
  ESCAPE_TUNNEL: 'escape_tunnel',
  COMPLETE: 'complete',
  FAILED: 'failed',
});

const MISSION_INFO = Object.freeze({
  [MISSION_IDS.RESCUE_RUN]: Object.freeze({
    name: 'County Road 09 // Rescue Run',
    startPhase: MISSION_PHASES.REACH_STATION,
    objectiveLabel: 'SURVIVOR',
    objectiveReward: 200,
  }),
  [MISSION_IDS.BLACKOUT_TUNNEL]: Object.freeze({
    name: 'The Blackout Tunnel',
    startPhase: MISSION_PHASES.TRAVEL_TUNNEL,
    objectiveLabel: 'SIGNAL DEVICE',
    objectiveReward: 250,
  }),
});

const OBJECTIVES = Object.freeze({
  [MISSION_PHASES.REACH_STATION]: 'Reach the service station.',
  [MISSION_PHASES.FIND_SURVIVOR]: 'Find the survivor.',
  [MISSION_PHASES.RETURN_VEHICLE]: 'Return to the vehicle.',
  [MISSION_PHASES.REACH_ESCAPE]: 'Drive to the escape point.',
  [MISSION_PHASES.TRAVEL_TUNNEL]: 'Follow the emergency signal to the tunnel.',
  [MISSION_PHASES.ENTER_TUNNEL]: 'Enter the abandoned tunnel.',
  [MISSION_PHASES.NAVIGATE_BLACKOUT]: 'Follow the emergency lamps through the blackout.',
  [MISSION_PHASES.INVESTIGATE_RELAY]: 'Investigate the military communications relay.',
  [MISSION_PHASES.ESCAPE_TUNNEL]: 'Get back to the vehicle and reach the tunnel exit.',
  [MISSION_PHASES.COMPLETE]: 'Mission complete.',
  [MISSION_PHASES.FAILED]: 'You did not make it out.',
});

export function gradeForScore(score) {
  if (score >= 1650) return 'S';
  if (score >= 1500) return 'A';
  if (score >= 1400) return 'B';
  return 'C';
}

export class MissionController {
  constructor({ startedAt = Date.now(), missionId = MISSION_IDS.RESCUE_RUN, onChange = () => {} } = {}) {
    this.onChange = onChange;
    this.reset(startedAt, missionId);
  }

  get objective() {
    return OBJECTIVES[this.phase];
  }

  reset(startedAt = Date.now(), missionId = this.missionId) {
    const missionInfo = MISSION_INFO[missionId];
    if (!missionInfo) throw new RangeError(`Unknown mission: ${missionId}`);
    this.missionId = missionId;
    this.phase = missionInfo.startPhase;
    this.startedAt = startedAt;
    this.score = null;
    this.survivorRescued = false;
    this.clueFound = false;
    this.result = null;
    this._notify();
  }

  reachStation() {
    return this._transition(MISSION_PHASES.REACH_STATION, MISSION_PHASES.FIND_SURVIVOR);
  }

  rescueSurvivor() {
    const rescued = this._transition(MISSION_PHASES.FIND_SURVIVOR, MISSION_PHASES.RETURN_VEHICLE);
    if (rescued) this.survivorRescued = true;
    return rescued;
  }

  enterVehicle() {
    return this._transition(MISSION_PHASES.RETURN_VEHICLE, MISSION_PHASES.REACH_ESCAPE);
  }

  reachEscape(now = Date.now(), remainingHealth = 100) {
    if (this.missionId !== MISSION_IDS.RESCUE_RUN || this.phase !== MISSION_PHASES.REACH_ESCAPE) return null;
    return this._complete(now, remainingHealth);
  }

  reachTunnelEntrance() {
    return this._transition(MISSION_PHASES.TRAVEL_TUNNEL, MISSION_PHASES.ENTER_TUNNEL);
  }

  enterTunnel() {
    return this._transition(MISSION_PHASES.ENTER_TUNNEL, MISSION_PHASES.NAVIGATE_BLACKOUT);
  }

  reachSignalDevice() {
    return this._transition(MISSION_PHASES.NAVIGATE_BLACKOUT, MISSION_PHASES.INVESTIGATE_RELAY);
  }

  investigateRelay() {
    const found = this._transition(MISSION_PHASES.INVESTIGATE_RELAY, MISSION_PHASES.ESCAPE_TUNNEL);
    if (found) this.clueFound = true;
    return found;
  }

  reachTunnelExit(now = Date.now(), remainingHealth = 100) {
    if (this.missionId !== MISSION_IDS.BLACKOUT_TUNNEL || this.phase !== MISSION_PHASES.ESCAPE_TUNNEL) return null;
    return this._complete(now, remainingHealth);
  }

  _complete(now, remainingHealth) {
    this.phase = MISSION_PHASES.COMPLETE;
    const missionInfo = MISSION_INFO[this.missionId];
    const elapsedSeconds = Math.max(0, Math.floor((now - this.startedAt) / 1000));
    const health = Math.max(0, Math.min(100, Number(remainingHealth) || 0));
    const objectiveFound = this.missionId === MISSION_IDS.RESCUE_RUN
      ? this.survivorRescued
      : this.clueFound;
    const components = Object.freeze({
      missionCompletion: 1000,
      objectiveBonus: objectiveFound ? missionInfo.objectiveReward : 0,
      completionTime: Math.max(0, 300 - elapsedSeconds),
      remainingHealth: Math.round(health * 2),
    });
    this.score = Object.values(components).reduce((total, points) => total + points, 0);
    this.result = Object.freeze({
      missionId: this.missionId,
      missionName: missionInfo.name,
      score: this.score,
      elapsedSeconds,
      objectiveLabel: missionInfo.objectiveLabel,
      objectiveFound,
      survivorRescued: this.missionId === MISSION_IDS.RESCUE_RUN ? this.survivorRescued : null,
      clueFound: this.missionId === MISSION_IDS.BLACKOUT_TUNNEL ? this.clueFound : null,
      remainingHealth: health,
      components,
      grade: gradeForScore(this.score),
    });
    this._notify();
    return this.result;
  }

  fail() {
    if (this.phase === MISSION_PHASES.COMPLETE || this.phase === MISSION_PHASES.FAILED) return false;
    this.phase = MISSION_PHASES.FAILED;
    this._notify();
    return true;
  }

  _transition(from, to) {
    if (this.phase !== from) return false;
    this.phase = to;
    this._notify();
    return true;
  }

  _notify() {
    this.onChange(this.phase, this.objective);
  }
}

export class CampaignProgress {
  constructor() {
    this.results = new Map();
  }

  record(result) {
    if (!result || !Object.isFrozen(result) || !MISSION_INFO[result.missionId]) {
      throw new TypeError('Campaign results must be a completed, immutable mission result.');
    }
    this.results.set(result.missionId, result);
  }

  get(missionId) {
    return this.results.get(missionId) ?? null;
  }
}
