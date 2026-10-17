// Road layouts for each mission. Pure data and math so it can be unit tested without WebGL.
// The road always starts straight at the player's spawn (z >= 0) and then bends by `amplitude`
// metres along a sine curve, so spawn points and the first stretch behave like the original road.
export const ROAD_Z_START = 45;
export const ROAD_Z_END = -105;
const CURVE_RAMP = 22;

export const ROAD_LAYOUTS = Object.freeze({
  county: Object.freeze({
    id: 'county', name: 'County Road', halfWidth: 6, amplitude: 0, wavelength: 80,
    roadColor: '#c0c2b9', groundColor: '#a2a99e', lineColor: '#aaa58e', lines: 'dashed',
    barrier: Object.freeze({ height: 0.65, color: '#65685e' }), props: [],
  }),
  settlement: Object.freeze({
    id: 'settlement', name: 'Settlement Road', halfWidth: 6, amplitude: 5, wavelength: 90,
    roadColor: '#b9bab0', groundColor: '#9aa28f', lineColor: '#b4ae92', lines: 'dashed',
    barrier: Object.freeze({ height: 0.6, color: '#6a6a5e' }), props: ['trees', 'houses', 'poles'],
  }),
  highway: Object.freeze({
    id: 'highway', name: 'Highway', halfWidth: 9, amplitude: 0, wavelength: 80,
    roadColor: '#a8aaa5', groundColor: '#8d9187', lineColor: '#d8d2a4', lines: 'double',
    barrier: Object.freeze({ height: 0.85, color: '#8d9088' }), props: ['wrecks', 'poles', 'trees'],
  }),
  bridge: Object.freeze({
    id: 'bridge', name: 'Damaged Bridge', halfWidth: 4.8, amplitude: 0, wavelength: 80,
    roadColor: '#9ea09a', groundColor: '#3d4b52', lineColor: '#c9c3a0', lines: 'dashed',
    barrier: Object.freeze({ height: 1.1, color: '#767a74' }), props: ['pylons'],
  }),
  ruins: Object.freeze({
    id: 'ruins', name: 'Ruined Avenue', halfWidth: 8, amplitude: 4, wavelength: 100,
    roadColor: '#8f918c', groundColor: '#757770', lineColor: '#a9a48d', lines: 'dashed',
    barrier: Object.freeze({ height: 0.7, color: '#5f625c' }), props: ['buildings', 'rubble', 'poles'],
  }),
  forest: Object.freeze({
    id: 'forest', name: 'Forest Road', halfWidth: 5, amplitude: 8, wavelength: 85,
    roadColor: '#8c8a7d', groundColor: '#6b7a5b', lineColor: '#b7ae82', lines: 'none',
    barrier: Object.freeze({ height: 0.5, color: '#4e4a3d' }), props: ['trees', 'trees', 'rocks'],
  }),
  checkpoint: Object.freeze({
    id: 'checkpoint', name: 'Checkpoint Road', halfWidth: 7, amplitude: 0, wavelength: 80,
    roadColor: '#a3a5a0', groundColor: '#838779', lineColor: '#d1c47a', lines: 'edge',
    barrier: Object.freeze({ height: 0.95, color: '#9a9c94' }), props: ['drums', 'poles', 'buildings'],
  }),
  industrial: Object.freeze({
    id: 'industrial', name: 'Industrial Road', halfWidth: 7.5, amplitude: 3, wavelength: 110,
    roadColor: '#8a8d88', groundColor: '#6f726b', lineColor: '#d1b552', lines: 'dashed',
    barrier: Object.freeze({ height: 0.8, color: '#7e6a3f' }), props: ['tanks', 'drums', 'poles'],
  }),
  mountain: Object.freeze({
    id: 'mountain', name: 'Mountain Pass', halfWidth: 4.8, amplitude: 9, wavelength: 95,
    roadColor: '#9a968a', groundColor: '#8a8478', lineColor: '#c7bf98', lines: 'dashed',
    barrier: Object.freeze({ height: 0.55, color: '#6d695d' }), props: ['rocks', 'rocks', 'trees'],
  }),
});

export const MISSION_ROADS = Object.freeze({
  'rescue-run-01': 'county',
  'blackout-tunnel': 'county',
  'find-survivors-02': 'settlement',
  'last-fuel-stop-03': 'county',
  'missing-convoy-04': 'highway',
  'broken-bridge-05': 'bridge',
  'highway-dead-06': 'highway',
  'silent-hospital-07': 'ruins',
  'signal-lost-08': 'forest',
  'quarantine-gate-09': 'checkpoint',
  'convoys-secret-11': 'industrial',
  'no-safe-road-12': 'mountain',
  'moving-horde-13': 'highway',
  'power-station-14': 'industrial',
  'last-broadcast-15': 'mountain',
  'safe-house-siege-16': 'settlement',
  'dead-frequency-17': 'forest',
  'restricted-zone-18': 'checkpoint',
  'research-facility-19': 'industrial',
  'false-rescue-20': 'settlement',
  'fallen-city-21': 'ruins',
  'final-convoy-22': 'highway',
  'into-dead-zone-23': 'ruins',
  'dead-signal-24': 'checkpoint',
});

export function layoutForMission(missionId) {
  return ROAD_LAYOUTS[MISSION_ROADS[missionId]] ?? ROAD_LAYOUTS.county;
}

// Lateral position of the road centre line at world depth z.
export function roadCenter(layout, z) {
  if (!layout.amplitude || z >= 0) return 0;
  const ramp = Math.min(1, -z / CURVE_RAMP);
  const smooth = ramp * ramp * (3 - 2 * ramp);
  return layout.amplitude * smooth * Math.sin((2 * Math.PI * -z) / layout.wavelength);
}

// Horizontal bounds measured from the centre line. The barrier sits 1.7 m outside the road edge.
export function footLimit(layout) {
  return layout.halfWidth + 0.35;
}

export function vehicleLimit(layout) {
  return layout.halfWidth - 0.25;
}

export function maxSlope(layout) {
  return layout.amplitude ? (layout.amplitude * 2 * Math.PI) / layout.wavelength : 0;
}
