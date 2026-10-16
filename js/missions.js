export const MISSION_PHASES = Object.freeze({
  REACH_STATION: 'reach_station',
  FIND_SURVIVOR: 'find_survivor',
  RETURN_VEHICLE: 'return_vehicle',
  REACH_ESCAPE: 'reach_escape',
  COMPLETE: 'complete',
  FAILED: 'failed',
});

const OBJECTIVES = Object.freeze({
  [MISSION_PHASES.REACH_STATION]: 'Reach the service station.',
  [MISSION_PHASES.FIND_SURVIVOR]: 'Find the survivor.',
  [MISSION_PHASES.RETURN_VEHICLE]: 'Return to the vehicle.',
  [MISSION_PHASES.REACH_ESCAPE]: 'Drive to the escape point.',
  [MISSION_PHASES.COMPLETE]: 'Mission complete.',
  [MISSION_PHASES.FAILED]: 'You did not make it out.',
});

export class MissionController {
  constructor({ startedAt = Date.now(), onChange = () => {} } = {}) {
    this.phase = MISSION_PHASES.REACH_STATION;
    this.startedAt = startedAt;
    this.onChange = onChange;
    this.score = null;
    this._notify();
  }

  get objective() {
    return OBJECTIVES[this.phase];
  }

  reachStation() {
    return this._transition(MISSION_PHASES.REACH_STATION, MISSION_PHASES.FIND_SURVIVOR);
  }

  rescueSurvivor() {
    return this._transition(MISSION_PHASES.FIND_SURVIVOR, MISSION_PHASES.RETURN_VEHICLE);
  }

  enterVehicle() {
    return this._transition(MISSION_PHASES.RETURN_VEHICLE, MISSION_PHASES.REACH_ESCAPE);
  }

  reachEscape(now = Date.now()) {
    if (this.phase !== MISSION_PHASES.REACH_ESCAPE) return null;
    this.phase = MISSION_PHASES.COMPLETE;
    const elapsedSeconds = Math.max(0, Math.floor((now - this.startedAt) / 1000));
    this.score = 1000 + Math.max(0, 300 - elapsedSeconds);
    this._notify();
    return this.score;
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
