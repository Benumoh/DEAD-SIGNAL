import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROAD_LAYOUTS,
  MISSION_ROADS,
  layoutForMission,
  roadCenter,
  footLimit,
  vehicleLimit,
  maxSlope,
} from '../js/roads.js';

test('all 24 missions map to a defined road layout', () => {
  const ids = Object.keys(MISSION_ROADS);
  assert.equal(ids.length, 24);
  for (const id of ids) {
    assert.ok(ROAD_LAYOUTS[MISSION_ROADS[id]], id);
    assert.equal(layoutForMission(id), ROAD_LAYOUTS[MISSION_ROADS[id]]);
  }
});

test('roads stay straight at the spawn area and remain drivable', () => {
  for (const layout of Object.values(ROAD_LAYOUTS)) {
    assert.equal(roadCenter(layout, 20), 0);
    assert.equal(roadCenter(layout, 0), 0);
    assert.ok(layout.halfWidth >= 4.8);
    assert.ok(maxSlope(layout) <= 0.7);
    assert.ok(vehicleLimit(layout) < footLimit(layout));
  }
});
