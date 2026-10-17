// Data-driven definitions for campaign missions 2-24 (except 1 and 10, which keep their dedicated scripts).
// Every mission plays on the shared county road (x within +/-5, z from +13 down to -95), so what changes
// between missions is the objective chain, locations, infected pressure and atmosphere.
export const FIELD_INFECTED_POOL = 12;

export const FIELD_STAGE_TYPES = Object.freeze(['reach', 'collect', 'survive', 'escape', 'choice']);

const DIFFICULTY_INFECTED = Object.freeze({
  Easy: Object.freeze({ speed: 3.6, aggroRange: 26 }),
  Medium: Object.freeze({ speed: 4.0, aggroRange: 32 }),
  Hard: Object.freeze({ speed: 4.5, aggroRange: 40 }),
  Nightmare: Object.freeze({ speed: 5.0, aggroRange: 48 }),
});

const reach = (objective, x, z, options = {}) => ({ type: 'reach', objective, pos: [x, z], radius: 7, ...options });
const collect = (objective, prompt, points, options = {}) => ({ type: 'collect', objective, prompt, points, ...options });
const survive = (objective, seconds, options = {}) => ({ type: 'survive', objective, seconds, ...options });
const escape = (objective, x, z, options = {}) => ({ type: 'escape', objective, pos: [x, z], radius: 5, ...options });
const choice = (objective, prompt, options, extra = {}) => ({ type: 'choice', objective, prompt, options, ...extra });
// Evenly spaced infected on alternating sides of the road between two z positions.
const crowd = (count, from, to) => Array.from({ length: count }, (_, index) => [
  index % 2 === 0 ? -3.5 : 3.5,
  count === 1 ? from : from + ((to - from) * index) / (count - 1),
]);

const DUSK = Object.freeze({ background: '#8a7b66', near: 22, far: 120 });
const OVERCAST = Object.freeze({ background: '#87918a', near: 24, far: 132 });
const FOG = Object.freeze({ background: '#a3aaa4', near: 8, far: 58 });
const NIGHT = Object.freeze({ background: '#1d252b', near: 10, far: 70 });
const SMOKE = Object.freeze({ background: '#6e6a62', near: 14, far: 84 });
const DAWN = Object.freeze({ background: '#9aa0a8', near: 20, far: 120 });

const DEFINITIONS = [
  ['find-survivors-02', 'Find Survivors', 'Rural Settlement', 240, OVERCAST, '“All units, the settlement beacon is still repeating. Check every building.”', [
    reach('Drive to the settlement gate.', 0, -28),
    collect('Find the survivors.', 'Rescue survivor', [[-3, -40], [3, -48], [-2, -56]], { spawn: crowd(1, -62, -62), radio: '“If anyone is alive in there, knock on something.”' }),
    escape('Drive the group to safety.', 0, -92),
  ]],
  ['last-fuel-stop-03', 'The Last Fuel Stop', 'Abandoned Fuel Station', 240, DUSK, '“The tank is nearly dry. The old fuel stop might still have something.”', [
    collect('Recover fuel cans.', 'Take fuel can', [[3, -18], [-3, -34], [2, -50]], { spawn: crowd(2, -44, -62) }),
    survive('Hold out while the car refuels.', 18, { spawn: crowd(3, -30, -42), radio: '“Noise is drawing them. Keep moving around the car.”' }),
    escape('Drive on before the road closes.', 0, -92),
  ]],
  ['missing-convoy-04', 'The Missing Convoy', 'Long Rural Highway', 270, SMOKE, '“Convoy last pinged on this road. Look for burned-out trucks.”', [
    reach('Investigate the convoy wreckage.', 0, -35),
    collect('Recover the communications device.', 'Take device', [[3, -48]], { spawn: crowd(3, -56, -66), radio: '“Movement ahead. This was an ambush.”' }),
    survive('Survive the ambush.', 15),
    escape('Get out of the kill zone.', 0, -92),
  ]],
  ['broken-bridge-05', 'The Broken Bridge', 'Damaged Bridge', 270, FOG, '“Bridge is out. There has to be a way around.”', [
    reach('Drive to the broken bridge.', 0, -45, { vehicle: true }),
    collect('Find the detour markers.', 'Read marker', [[-4, -58], [4, -72]], { spawn: crowd(2, -62, -78) }),
    reach('Reach the stranded survivors.', 0, -90, { radius: 6 }),
    escape('Drive the survivors back to safety.', 0, -12),
  ]],
  ['highway-dead-06', 'Highway of the Dead', 'Blocked Highway', 270, SMOKE, '“Wrecks across every lane. Pick your line carefully.”', [
    reach('Weave through the first wrecks.', 3, -35, { vehicle: true, spawn: crowd(2, -40, -48) }),
    reach('Keep driving through the blockage.', -3, -60, { vehicle: true, spawn: crowd(2, -66, -74) }),
    reach('Clear the last bottleneck.', 2, -80, { vehicle: true }),
    escape('Reach the evacuation point.', 0, -95),
  ]],
  ['silent-hospital-07', 'The Silent Hospital', 'Abandoned Hospital', 300, NIGHT, '“Power is out across the whole wing. Use the emergency lighting.”', [
    reach('Reach the hospital entrance.', 0, -45),
    collect('Recover medical supplies.', 'Take supplies', [[-3, -55], [3, -62], [-2, -70]], { spawn: crowd(3, -58, -72) }),
    collect('Find the missing doctor.', 'Rescue the doctor', [[0, -82]]),
    escape('Escape with the doctor.', 0, -8),
  ]],
  ['signal-lost-08', 'Signal Lost', 'Forest Road', 270, FOG, '“Radio is useless in this forest. Rely on the road signs.”', [
    reach('Follow the forest road.', 0, -30),
    collect('Read the road signs.', 'Read sign', [[-3, -42], [3, -58], [-3, -74]], { spawn: crowd(2, -50, -66) }),
    collect('Locate the missing survivor.', 'Rescue survivor', [[0, -88]]),
    escape('Lead the survivor out.', 0, -20),
  ]],
  ['quarantine-gate-09', 'The Quarantine Gate', 'Military Checkpoint', 300, NIGHT, '“The gate is sealed from the inside. Find another way in.”', [
    reach('Drive to the sealed gate.', 0, -40, { vehicle: true }),
    choice('Choose another way inside.', 'Use entrance', [
      { label: 'Maintenance hatch', pos: [-4, -52] },
      { label: 'Cut the fence', pos: [4, -52], spawn: crowd(2, -58, -64) },
    ]),
    collect('Recover the access card.', 'Take access card', [[0, -72]], { spawn: crowd(2, -76, -84) }),
    escape('Escape the checkpoint.', 0, -92),
  ]],
  ['convoys-secret-11', "The Convoy's Secret", 'Industrial District', 300, SMOKE, '“Convoy route runs through the industrial yard. Expect company.”', [
    reach('Drive into the industrial district.', 0, -35),
    survive('Hold the yard entrance.', 18, { spawn: crowd(4, -45, -60) }),
    collect('Recover the data device.', 'Take data device', [[2, -62]], { spawn: crowd(3, -68, -78) }),
    escape('Escape the district.', 0, -92),
  ]],
  ['no-safe-road-12', 'No Safe Road', 'Mountain Pass or Settlement', 300, DAWN, '“Two ways forward. Neither is safe.”', [
    choice('Choose your route.', 'Take route', [
      { label: 'Mountain pass', pos: [-4, -22], spawn: crowd(5, -40, -75) },
      { label: 'Overrun settlement', pos: [4, -22], spawn: crowd(3, -40, -62) },
    ]),
    reach('Push on toward the destination.', 0, -70),
    escape('Reach the destination.', 0, -95),
  ]],
  ['moving-horde-13', 'The Moving Horde', 'Open Highway', 330, OVERCAST, '“A horde is moving on the road. Time your crossing.”', [
    reach('Approach the horde carefully.', 0, -30, { spawn: crowd(5, -48, -70) }),
    survive('Wait for the horde to pass.', 25, { spawn: crowd(3, -36, -44), radio: '“They are following the signal, not you. Stay quiet.”' }),
    reach('Cross the open road.', 0, -72),
    escape('Reach the far side.', 0, -95),
  ]],
  ['power-station-14', 'The Power Station', 'Industrial Service Roads', 330, NIGHT, '“Relay needs power. The station breakers are still intact.”', [
    reach('Drive to the power station.', 0, -50, { vehicle: true }),
    collect('Restore the relay breakers.', 'Throw breaker', [[-3, -62], [3, -62]], { spawn: crowd(4, -66, -80) }),
    survive('Hold while the relay boots.', 15, { spawn: crowd(3, -56, -70) }),
    escape('Drive clear of the station.', 0, -92),
  ]],
  ['last-broadcast-15', 'The Last Broadcast', 'Remote Broadcast Site', 330, FOG, '“The broadcast keeps repeating. Someone built a trap out of it.”', [
    reach('Approach the broadcast site.', 0, -40),
    collect('Recover the recording equipment.', 'Take equipment', [[3, -55]]),
    survive('Hold the broadcast site.', 20, { spawn: crowd(4, -60, -74) }),
    collect('Recover the tape.', 'Take tape', [[-3, -78]], { spawn: crowd(2, -82, -88) }),
    escape('Escape the site.', 0, -95),
  ]],
  ['safe-house-siege-16', 'The Safe House Siege', 'Fortified Safe House', 330, DUSK, '“A horde is closing on the safe house. Get everyone out.”', [
    collect('Load the survivors.', 'Load survivor', [[0, -15], [3, -22], [-3, -26]], { spawn: crowd(3, -34, -50) }),
    escape('Drive the survivors to the safe house.', 0, -90),
    survive('Hold the gate.', 20, { spawn: crowd(4, -62, -80) }),
  ]],
  ['dead-frequency-17', 'Dead Frequency', 'Radio Towers', 330, NIGHT, '“Four towers. Take a reading at each base.”', [
    collect('Collect signal readings.', 'Take reading', [[3, -25], [-3, -45], [3, -65], [-3, -85]], { spawn: crowd(4, -40, -78) }),
    escape('Return to the vehicle with the readings.', 0, -8),
  ]],
  ['restricted-zone-18', 'The Restricted Zone', 'Quarantine Highway', 360, SMOKE, '“Perimeter is live. Stay off the main road if you can.”', [
    reach('Reach the perimeter.', 0, -35, { vehicle: true }),
    collect('Recover access records.', 'Take records', [[-3, -50], [3, -70]], { spawn: crowd(5, -56, -78) }),
    escape('Escape the perimeter.', 0, -95),
  ]],
  ['research-facility-19', 'The Research Facility', 'Restricted Research Facility', 390, NIGHT, '“Records first. Do not wake anything you cannot outrun.”', [
    reach('Reach the facility entrance.', 0, -45),
    collect('Recover the research records.', 'Take records', [[-3, -55], [3, -65], [-3, -78]], { spawn: crowd(6, -58, -84) }),
    survive('Hold until the vehicle is clear.', 20, { spawn: crowd(3, -48, -60) }),
    escape('Return to the vehicle.', 0, -12),
  ]],
  ['false-rescue-20', 'The False Rescue', 'Remote Settlement', 390, FOG, '“Two transmissions claim the same survivors. One has a valid authentication tag.”', [
    reach('Approach the settlement.', 0, -30),
    choice('Identify the false transmission.', 'Follow transmission', [
      { label: 'Western transmission', pos: [-3, -50], spawn: crowd(5, -56, -72) },
      { label: 'Eastern transmission (valid tag)', pos: [3, -50], spawn: crowd(1, -60, -60) },
    ]),
    survive('Survive the ambush.', 20, { spawn: crowd(4, -56, -70) }),
    escape('Escape the settlement.', 0, -95),
  ]],
  ['fallen-city-21', 'The Fallen City', 'Ruined City', 390, SMOKE, '“Blocked streets everywhere. Follow the cleared lanes.”', [
    reach('Cross the ruined avenue.', 3, -30, { vehicle: true }),
    reach('Pass the collapsed overpass.', -3, -55, { vehicle: true, spawn: crowd(3, -62, -72) }),
    collect('Recover the broadcast component.', 'Take component', [[0, -78]], { spawn: crowd(5, -70, -88) }),
    escape('Escape the city.', 0, -10),
  ]],
  ['final-convoy-22', 'The Final Convoy', 'Extended Highway Route', 420, DAWN, '“Everyone on board. We are not stopping until the end of the road.”', [
    collect('Board the convoy survivors.', 'Load survivor', [[0, -12], [3, -16], [-3, -20], [0, -24]]),
    reach('Escort the convoy through the first bottleneck.', 0, -45, { vehicle: true, spawn: crowd(4, -52, -66) }),
    reach('Escort the convoy through the second bottleneck.', 0, -70, { vehicle: true, spawn: crowd(4, -74, -88) }),
    escape('Deliver the convoy.', 0, -95),
  ]],
  ['into-dead-zone-23', 'Into the Dead Zone', 'Dead Zone', 420, NIGHT, '“Past this line there is no recovery network. You are on your own.”', [
    reach('Cross into the dead zone.', 0, -40),
    collect('Recover the final evidence.', 'Take evidence', [[-3, -55], [3, -68], [0, -82]], { spawn: crowd(6, -56, -84) }),
    survive('Hold the evidence site.', 25, { spawn: crowd(4, -45, -60) }),
    escape('Reach the central transmitter.', 0, -95),
  ]],
  ['dead-signal-24', 'Dead Signal', 'Central Broadcast Facility', 450, NIGHT, '“This is it. Whatever you choose, it goes out to everyone.”', [
    reach('Reach the central facility.', 0, -45),
    survive('Hold the facility.', 20, { spawn: crowd(5, -55, -80) }),
    choice('Choose the broadcast outcome.', 'Use terminal', [
      { label: 'Shut down the network', pos: [-4, -70] },
      { label: 'Redirect survivors', pos: [4, -70] },
    ]),
    escape('Complete the evacuation.', 0, -95),
  ]],
];

function validate(definition) {
  const [id, , , , , , stages] = definition;
  const total = stages.reduce((sum, stage) => {
    const options = stage.options ? Math.max(...stage.options.map((option) => option.spawn?.length ?? 0)) : 0;
    return sum + (stage.spawn?.length ?? 0) + options;
  }, 0);
  if (!stages.length || !FIELD_STAGE_TYPES.includes(stages.at(-1).type)) throw new RangeError(`${id}: invalid stages`);
  if (total > FIELD_INFECTED_POOL) throw new RangeError(`${id}: spawns ${total} infected, pool is ${FIELD_INFECTED_POOL}`);
}

export const FIELD_MISSIONS = Object.freeze(Object.fromEntries(DEFINITIONS.map((definition) => {
  validate(definition);
  const [id, , environment, parSeconds, atmosphere, radio, stages] = definition;
  return [id, Object.freeze({
    id,
    environment,
    parSeconds,
    atmosphere,
    radio,
    stages: Object.freeze(stages.map((stage) => Object.freeze(stage))),
  })];
})));

export function infectedSettingsFor(difficulty) {
  return DIFFICULTY_INFECTED[difficulty] ?? DIFFICULTY_INFECTED.Medium;
}

export function stageTargets(stage) {
  if (stage.points) return stage.points;
  if (stage.options) return stage.options.map((option) => option.pos);
  return stage.pos ? [stage.pos] : [];
}
