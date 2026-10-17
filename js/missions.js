import { FIELD_MISSIONS } from './field-missions.js';

export const MISSION_IDS = Object.freeze({
  RESCUE_RUN: 'rescue-run-01',
  BLACKOUT_TUNNEL: 'blackout-tunnel',
});

const CAMPAIGN_MISSION_DATA = [
  ['rescue-run-01', 'Rescue a Friend', 'First Contact', 'Easy', 'A distress call from a close friend leads to an abandoned highway service station.', 'Find the survivor and escape together.', 'County Road 09 and roadside service station', true],
  ['find-survivors-02', 'Find Survivors', 'First Contact', 'Easy', 'A nearby settlement may shelter survivors guided there by a mysterious emergency broadcast.', 'Search the settlement, rescue the group, and reach safety.', 'Rural settlement'],
  ['last-fuel-stop-03', 'The Last Fuel Stop', 'First Contact', 'Easy', 'An abandoned fuel station may hold the supplies needed to keep moving.', 'Recover fuel and supplies before the infected close in.', 'Abandoned fuel station'],
  ['missing-convoy-04', 'The Missing Convoy', 'First Contact', 'Medium', 'A trail of military wreckage leads toward a lost communications device.', 'Investigate the wreckage and survive the ambush.', 'Long rural highway'],
  ['broken-bridge-05', 'The Broken Bridge', 'Roads of the Dead', 'Medium', 'Survivors are stranded beyond a deliberately disabled bridge.', 'Find a rural detour and reach the survivors.', 'Damaged bridge and forest road'],
  ['highway-dead-06', 'Highway of the Dead', 'Roads of the Dead', 'Medium', 'Infected move between abandoned vehicles across a blocked highway.', 'Navigate the wrecks and reach the evacuation point.', 'Blocked highway'],
  ['silent-hospital-07', 'The Silent Hospital', 'Roads of the Dead', 'Medium', 'A missing doctor may know what happened during the first days of the outbreak.', 'Search the hospital, recover medical supplies, and escape.', 'Abandoned hospital'],
  ['signal-lost-08', 'Signal Lost', 'Roads of the Dead', 'Medium', 'A forest road swallows radio signals and the landmarks are fading.', 'Use signs and a damaged map to locate the missing survivor.', 'Forest road'],
  ['quarantine-gate-09', 'The Quarantine Gate', 'Quarantine', 'Medium', 'A military checkpoint was sealed before the outbreak was made public.', 'Find another way inside and recover an access item.', 'Military checkpoint'],
  ['blackout-tunnel-10', 'Blackout Tunnel', 'Quarantine', 'Hard', 'Broken lights and abandoned vehicles conceal a transmitter beneath the tunnel.', 'Navigate the blackout and escape the infected pursuit.', 'Long emergency tunnel'],
  ['convoys-secret-11', "The Convoy's Secret", 'Quarantine', 'Hard', 'The convoy route crosses an industrial district filled with infected.', 'Recover the data device and escape.', 'Industrial district'],
  ['no-safe-road-12', 'No Safe Road', 'Quarantine', 'Hard', 'A mountain pass is shorter, while an overrun settlement may offer a safer detour.', 'Choose a route and reach the destination.', 'Mountain pass or settlement'],
  ['moving-horde-13', 'The Moving Horde', 'The Infected Frontier', 'Hard', 'A shifting horde occupies the road and reacts to a mysterious signal.', 'Time the crossing and use alternate paths to survive.', 'Open highway and side routes'],
  ['power-station-14', 'The Power Station', 'The Infected Frontier', 'Hard', 'A communications relay can be restored at an abandoned power station.', 'Reach the station and restore the relay.', 'Industrial service roads'],
  ['last-broadcast-15', 'The Last Broadcast', 'The Infected Frontier', 'Hard', 'A repeating emergency transmission appears to draw survivors into danger.', 'Recover the recording equipment and escape.', 'Remote broadcast site'],
  ['safe-house-siege-16', 'The Safe House Siege', 'The Infected Frontier', 'Hard', 'A group of survivors needs transport before a large horde arrives.', 'Deliver the survivors and help secure the safe house.', 'Fortified safe house'],
  ['dead-frequency-17', 'Dead Frequency', 'The Conspiracy', 'Hard', 'Several radio towers may reveal where the suspicious transmissions originate.', 'Collect signal readings from the towers.', 'Radio towers and rural roads'],
  ['restricted-zone-18', 'The Restricted Zone', 'The Conspiracy', 'Hard', 'Official records conflict with the story told to the public.', 'Recover access information and escape the perimeter.', 'Quarantine highway and service road'],
  ['research-facility-19', 'The Research Facility', 'The Conspiracy', 'Nightmare', 'An abandoned facility holds records about the infected and the emergency network.', 'Recover the research records and return to the vehicle.', 'Restricted research facility'],
  ['false-rescue-20', 'The False Rescue', 'The Conspiracy', 'Nightmare', 'A distress call may be a trap designed to manipulate rescue operations.', 'Identify the false transmission and escape the ambush.', 'Remote settlement'],
  ['fallen-city-21', 'The Fallen City', 'The Last Signal', 'Nightmare', 'Blocked highways and damaged infrastructure divide a ruined city.', 'Recover the component needed to disable the misleading broadcasts.', 'Ruined city'],
  ['final-convoy-22', 'The Final Convoy', 'The Last Signal', 'Nightmare', 'A survivor convoy must cross an extended route under pursuit.', 'Escort the convoy through dangerous bottlenecks.', 'Extended highway route'],
  ['into-dead-zone-23', 'Into the Dead Zone', 'The Last Signal', 'Nightmare', 'The source region of the emergency transmissions lies beyond a hostile road network.', 'Recover the final evidence and reach the central transmitter.', 'Dead zone'],
  ['dead-signal-24', 'Dead Signal', 'The Last Signal', 'Nightmare', 'The central facility can shut down the manipulated network or redirect survivors toward evacuation.', 'Choose the broadcast outcome and complete the evacuation.', 'Central broadcast facility'],
];

export const CAMPAIGN_MISSIONS = Object.freeze(CAMPAIGN_MISSION_DATA.map((data, index, missions) => Object.freeze({
  number: index + 1,
  id: data[0],
  title: data[1],
  chapter: data[2],
  difficulty: data[3],
  description: data[4],
  objective: data[5],
  environment: data[6],
  implemented: true,
  // Campaign Mission 10 is played with the dedicated tunnel script.
  launchId: data[0] === 'blackout-tunnel-10' ? MISSION_IDS.BLACKOUT_TUNNEL : data[0],
  prerequisites: Object.freeze(index === 0 ? [] : [missions[index - 1][0]]),
})));

export const SPECIAL_OPERATIONS = Object.freeze([
  Object.freeze({
    id: MISSION_IDS.BLACKOUT_TUNNEL,
    title: 'The Blackout Tunnel',
    chapter: 'Standalone Operation',
    difficulty: 'Hard',
    description: 'Investigate the military relay inside the blackout tunnel, then escape the infected pursuit.',
    objective: 'Recover the relay clue and reach the tunnel exit.',
    environment: 'Blackout tunnel',
    implemented: true,
  }),
]);

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
  FIELD: 'field',
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
  ...Object.fromEntries(CAMPAIGN_MISSIONS.filter((mission) => FIELD_MISSIONS[mission.id]).map((mission) => [
    mission.id,
    Object.freeze({
      name: mission.title,
      startPhase: MISSION_PHASES.FIELD,
      objectiveLabel: 'OBJECTIVES',
      objectiveReward: 200,
      parSeconds: FIELD_MISSIONS[mission.id].parSeconds,
      field: FIELD_MISSIONS[mission.id],
    }),
  ])),
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

  get fieldStage() {
    const field = MISSION_INFO[this.missionId]?.field;
    return this.phase === MISSION_PHASES.FIELD && field ? field.stages[this.stageIndex] ?? null : null;
  }

  get objective() {
    const stage = this.fieldStage;
    if (stage) {
      const needed = stage.points ? stage.points.length : 0;
      return needed > 1 ? `${stage.objective} (${this.stageProgress}/${needed})` : stage.objective;
    }
    return OBJECTIVES[this.phase];
  }

  // Returns true once the current collect stage has all its items.
  fieldProgress(expectedIndex) {
    const stage = this.fieldStage;
    if (!stage || expectedIndex !== this.stageIndex) return false;
    this.stageProgress += 1;
    const done = this.stageProgress >= (stage.points ? stage.points.length : 1);
    if (!done) this._notify();
    return done;
  }

  // expectedIndex guards against duplicate triggers for the same stage.
  completeFieldStage(expectedIndex, now = Date.now(), remainingHealth = 100, choice = null) {
    const stage = this.fieldStage;
    if (!stage || expectedIndex !== this.stageIndex) return null;
    if (choice) this.choice = choice;
    const field = MISSION_INFO[this.missionId].field;
    if (this.stageIndex < field.stages.length - 1) {
      this.stageIndex += 1;
      this.stageProgress = 0;
      this._notify();
      return null;
    }
    return this._complete(now, remainingHealth);
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
    this.stageIndex = 0;
    this.stageProgress = 0;
    this.choice = null;
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
    const isField = Boolean(missionInfo.field);
    const objectiveFound = isField
      ? true
      : this.missionId === MISSION_IDS.RESCUE_RUN ? this.survivorRescued : this.clueFound;
    const timeWindow = isField ? Math.min(300, missionInfo.parSeconds) : 300;
    const components = Object.freeze({
      missionCompletion: 1000,
      objectiveBonus: objectiveFound ? missionInfo.objectiveReward : 0,
      completionTime: Math.max(0, timeWindow - elapsedSeconds),
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
      objectiveSummary: isField ? `${missionInfo.field.stages.length} of ${missionInfo.field.stages.length} objectives` : null,
      choice: this.choice ?? null,
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
  constructor(storage = undefined) {
    this.results = new Map();
    this.completedMissionIds = new Set();
    this.storage = storage;
    if (this.storage === undefined) {
      try {
        this.storage = globalThis.localStorage ?? null;
      } catch (error) {
        this.storage = null;
        console.error('Campaign progress storage is unavailable.', error);
      }
    }
    this._load();
  }

  record(result) {
    if (!result || !Object.isFrozen(result) || !MISSION_INFO[result.missionId]) {
      throw new TypeError('Campaign results must be a completed, immutable mission result.');
    }
    this.results.set(result.missionId, result);
    const campaignMission = CAMPAIGN_MISSIONS.find((mission) => mission.launchId === result.missionId);
    if (campaignMission && !this.completedMissionIds.has(campaignMission.id)) {
      this.completedMissionIds.add(campaignMission.id);
      this._save();
    }
  }

  get(missionId) {
    return this.results.get(missionId) ?? null;
  }

  stateFor(missionId) {
    const mission = CAMPAIGN_MISSIONS.find((entry) => entry.id === missionId);
    if (!mission) return null;
    if (this.completedMissionIds.has(missionId)) return 'completed';
    if (mission.prerequisites.some((prerequisite) => !this.completedMissionIds.has(prerequisite))) return 'locked';
    return mission.implemented ? 'available' : 'unlocked';
  }

  _load() {
    if (!this.storage) return;
    try {
      const stored = this.storage.getItem('dead-signal:campaign-progress:v1');
      if (stored === null) return;
      const progress = JSON.parse(stored);
      if (progress.version !== 1 || !Array.isArray(progress.completedMissionIds)) {
        throw new TypeError('Stored campaign progress has an unsupported format.');
      }
      const knownIds = new Set(CAMPAIGN_MISSIONS.map((mission) => mission.id));
      for (const missionId of progress.completedMissionIds) {
        if (knownIds.has(missionId)) this.completedMissionIds.add(missionId);
      }
    } catch (error) {
      console.error('Could not load local campaign progress.', error);
    }
  }

  _save() {
    if (!this.storage) return;
    try {
      this.storage.setItem('dead-signal:campaign-progress:v1', JSON.stringify({
        version: 1,
        completedMissionIds: [...this.completedMissionIds],
      }));
    } catch (error) {
      console.error('Could not save local campaign progress.', error);
    }
  }
}
