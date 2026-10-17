import * as THREE from '../assets/vendor/three.module.js';
import { ROAD_Z_END, ROAD_Z_START, roadCenter } from './roads.js';

const STEP = 2;

function seededRandom(text) {
  let seed = 0x9e3779b1;
  for (const char of text) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

// Builds a flat ribbon that follows the road centre line between two lateral offsets.
function ribbon(layout, left, right, zFrom, zTo, y) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const steps = Math.max(1, Math.ceil(Math.abs(zFrom - zTo) / STEP));
  for (let index = 0; index <= steps; index += 1) {
    const z = zFrom + ((zTo - zFrom) * index) / steps;
    const center = roadCenter(layout, z);
    positions.push(center + left, y, z, center + right, y, z);
    const v = (ROAD_Z_START - z) / (ROAD_Z_START - ROAD_Z_END);
    uvs.push(0, v, 1, v);
    if (index > 0) {
      const base = (index - 1) * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  return { positions, uvs, indices };
}

function mergeRibbons(parts) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (const part of parts) {
    const offset = positions.length / 3;
    positions.push(...part.positions);
    uvs.push(...part.uvs);
    indices.push(...part.indices.map((value) => value + offset));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function ribbonMesh(parts, material, receiveShadow = false) {
  const mesh = new THREE.Mesh(mergeRibbons(parts), material);
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

function tangentAngle(layout, z) {
  return Math.atan((roadCenter(layout, z + 1) - roadCenter(layout, z - 1)) / 2);
}

function instanced(geometry, material, matrices, colors = null) {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  const transform = new THREE.Object3D();
  matrices.forEach((entry, index) => {
    transform.position.set(entry.x, entry.y, entry.z);
    transform.rotation.set(0, entry.yaw ?? 0, 0);
    transform.scale.set(entry.sx ?? 1, entry.sy ?? 1, entry.sz ?? 1);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    if (colors) mesh.setColorAt(index, new THREE.Color(colors[index % colors.length]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// Scatter positions on either side of the road, outside the barrier.
function scatter(layout, random, count, minGap, maxGap, build) {
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const z = ROAD_Z_START - random() * (ROAD_Z_START - ROAD_Z_END);
    const side = random() < 0.5 ? -1 : 1;
    const gap = layout.halfWidth + minGap + random() * (maxGap - minGap);
    entries.push(build({ x: roadCenter(layout, z) + side * gap, z, side, random }));
  }
  return entries;
}

const PROP_BUILDERS = {
  trees(layout, random, group) {
    const entries = scatter(layout, random, 80, 4, 24, ({ x, z }) => ({ x, z, scale: 0.8 + random() * 0.9 }));
    const trunk = instanced(
      new THREE.CylinderGeometry(0.26, 0.42, 4.7, 7),
      new THREE.MeshStandardMaterial({ color: '#48473d', roughness: 1 }),
      entries.map((entry) => ({ x: entry.x, y: 2.35 * entry.scale, z: entry.z, sx: entry.scale, sy: entry.scale, sz: entry.scale })),
    );
    const crown = instanced(
      new THREE.ConeGeometry(2.1, 5.8, 7),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }),
      entries.map((entry) => ({ x: entry.x, y: 6 * entry.scale, z: entry.z, sx: entry.scale, sy: entry.scale, sz: entry.scale })),
      ['#404b42', '#4b5549', '#525a4e', '#5a5a44'],
    );
    trunk.castShadow = true;
    crown.castShadow = true;
    group.add(trunk, crown);
  },
  rocks(layout, random, group) {
    const entries = scatter(layout, random, 70, 3, 22, ({ x, z }) => ({ x, z, scale: 0.8 + random() * 3 }));
    group.add(instanced(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }),
      entries.map((entry) => ({
        x: entry.x, y: entry.scale * 0.45, z: entry.z, yaw: random() * 3, sx: entry.scale * 1.2, sy: entry.scale * 0.8, sz: entry.scale,
      })),
      ['#77756c', '#69685f', '#85817a'],
    ));
  },
  buildings(layout, random, group) {
    const entries = scatter(layout, random, 36, 7, 30, ({ x, z }) => ({
      x, z, w: 4 + random() * 6, h: 4 + random() * 13, d: 4 + random() * 6,
    }));
    const mesh = instanced(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96 }),
      entries.map((entry) => ({ x: entry.x, y: entry.h / 2, z: entry.z, sx: entry.w, sy: entry.h, sz: entry.d, yaw: random() * 0.3 })),
      ['#6f716b', '#7c7769', '#5f625e', '#85796a'],
    );
    mesh.castShadow = true;
    group.add(mesh);
  },
  houses(layout, random, group) {
    const entries = scatter(layout, random, 24, 7, 22, ({ x, z }) => ({ x, z, w: 5 + random() * 3, d: 5 + random() * 3 }));
    const mesh = instanced(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96 }),
      entries.map((entry) => ({ x: entry.x, y: 1.6, z: entry.z, sx: entry.w, sy: 3.2, sz: entry.d, yaw: random() * 0.4 })),
      ['#8c7c68', '#7a6f60', '#90877a'],
    );
    mesh.castShadow = true;
    group.add(mesh);
  },
  rubble(layout, random, group) {
    const entries = scatter(layout, random, 60, 2.4, 6, ({ x, z }) => ({ x, z, scale: 0.4 + random() * 1.1 }));
    group.add(instanced(
      new THREE.DodecahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: '#7b7a72', roughness: 1 }),
      entries.map((entry) => ({ x: entry.x, y: entry.scale * 0.3, z: entry.z, yaw: random() * 3, sx: entry.scale * 1.3, sy: entry.scale * 0.6, sz: entry.scale })),
    ));
  },
  poles(layout, random, group) {
    const matrices = [];
    for (let z = ROAD_Z_START; z > ROAD_Z_END; z -= 22) {
      const side = matrices.length % 2 ? 1 : -1;
      matrices.push({ x: roadCenter(layout, z) + side * (layout.halfWidth + 2.6), y: 3.2, z });
    }
    const mesh = instanced(
      new THREE.CylinderGeometry(0.08, 0.12, 6.4, 6),
      new THREE.MeshStandardMaterial({ color: '#4c4f48', roughness: 0.9 }),
      matrices,
    );
    mesh.castShadow = true;
    group.add(mesh);
  },
  wrecks(layout, random, group) {
    const entries = scatter(layout, random, 22, 2.6, 7, ({ x, z }) => ({ x, z }));
    group.add(instanced(
      new THREE.BoxGeometry(2.2, 1.2, 4.3),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.94, metalness: 0.08 }),
      entries.map((entry) => ({ x: entry.x, y: 0.7, z: entry.z, yaw: random() * 3 })),
      ['#525853', '#665b49', '#4a4f58', '#6b4a41'],
    ));
  },
  drums(layout, random, group) {
    const entries = scatter(layout, random, 40, 2.4, 6, ({ x, z }) => ({ x, z }));
    group.add(instanced(
      new THREE.CylinderGeometry(0.4, 0.4, 1, 8),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }),
      entries.map((entry) => ({ x: entry.x, y: 0.5, z: entry.z })),
      ['#8f4a34', '#4d5d4a', '#a38a3d'],
    ));
  },
  tanks(layout, random, group) {
    const entries = scatter(layout, random, 12, 10, 28, ({ x, z }) => ({ x, z, r: 2.5 + random() * 2.5, h: 5 + random() * 9 }));
    const mesh = instanced(
      new THREE.CylinderGeometry(1, 1, 1, 14),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0.2 }),
      entries.map((entry) => ({ x: entry.x, y: entry.h / 2, z: entry.z, sx: entry.r, sy: entry.h, sz: entry.r })),
      ['#7d8079', '#6c6f69', '#8a7a58'],
    );
    mesh.castShadow = true;
    group.add(mesh);
  },
  pylons(layout, random, group) {
    const matrices = [];
    for (let z = ROAD_Z_START; z > ROAD_Z_END; z -= 14) {
      for (const side of [-1, 1]) {
        matrices.push({ x: roadCenter(layout, z) + side * (layout.halfWidth + 1.7), y: -4, z, sx: 1, sy: 1, sz: 1 });
      }
    }
    group.add(instanced(
      new THREE.BoxGeometry(0.9, 9, 0.9),
      new THREE.MeshStandardMaterial({ color: '#6a6e68', roughness: 1 }),
      matrices,
    ));
  },
};

function buildBarrier(layout, group) {
  const { height, color } = layout.barrier;
  const matrices = [];
  for (let z = ROAD_Z_START - 2; z > ROAD_Z_END; z -= 3.2) {
    for (const side of [-1, 1]) {
      matrices.push({
        x: roadCenter(layout, z) + side * (layout.halfWidth + 1.7),
        y: height / 2 + 0.2,
        z,
        yaw: tangentAngle(layout, z),
        sy: height / 0.65,
      });
    }
  }
  const mesh = instanced(
    new THREE.BoxGeometry(0.28, 0.65, 3.3),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
    matrices,
  );
  mesh.castShadow = true;
  group.add(mesh);
}

export function buildRoadLayout(layout, textures) {
  const group = new THREE.Group();
  group.name = `road-${layout.id}`;
  const half = layout.halfWidth;
  const zFrom = ROAD_Z_START;
  const zTo = ROAD_Z_END;

  group.add(ribbonMesh(
    [ribbon(layout, -half, half, zFrom, zTo, 0)],
    new THREE.MeshStandardMaterial({ map: textures.road, color: layout.roadColor, roughness: 1 }),
    true,
  ));
  group.add(ribbonMesh(
    [ribbon(layout, -half - 2.3, -half, zFrom, zTo, -0.005), ribbon(layout, half, half + 2.3, zFrom, zTo, -0.005)],
    new THREE.MeshStandardMaterial({ map: textures.ground, color: '#aaa993', roughness: 1 }),
    true,
  ));

  const lineParts = [];
  const edge = half - 0.18;
  if (layout.lines !== 'none') {
    lineParts.push(ribbon(layout, -edge - 0.055, -edge + 0.055, zFrom, zTo, 0.012));
    lineParts.push(ribbon(layout, edge - 0.055, edge + 0.055, zFrom, zTo, 0.012));
  }
  if (layout.lines === 'dashed') {
    for (let z = zFrom; z > zTo; z -= 13) lineParts.push(ribbon(layout, -0.065, 0.065, z, z - 5, 0.012));
  } else if (layout.lines === 'double') {
    lineParts.push(ribbon(layout, -0.2, -0.1, zFrom, zTo, 0.012), ribbon(layout, 0.1, 0.2, zFrom, zTo, 0.012));
  }
  if (lineParts.length) {
    group.add(ribbonMesh(lineParts, new THREE.MeshStandardMaterial({ color: layout.lineColor, roughness: 1 })));
  }

  buildBarrier(layout, group);
  const random = seededRandom(layout.id);
  for (const prop of layout.props) PROP_BUILDERS[prop](layout, random, group);
  return group;
}
