import * as THREE from '../assets/vendor/three.module.js';
import { GameAudio } from './audio.js';
import { Infected } from './infected.js';
import { FIELD_INFECTED_POOL, FIELD_MISSIONS, infectedSettingsFor, stageTargets } from './field-missions.js';
import { buildRoadLayout } from './road-builder.js';
import { footLimit, layoutForMission, ROAD_LAYOUTS, roadCenter, vehicleLimit } from './roads.js';
import {
  CAMPAIGN_MISSIONS,
  CampaignProgress,
  MISSION_IDS,
  MissionController,
  MISSION_PHASES,
  SPECIAL_OPERATIONS,
} from './missions.js';
import { Player } from './player.js';
import { StartNgIntegration } from './startng-integration.js';
import { UI } from './ui.js';
import { Vehicle } from './vehicle.js';

const WORLD = Object.freeze({
  station: new THREE.Vector3(-5, 0, -29),
  survivor: new THREE.Vector3(-5.5, 0, -25.4),
  escape: new THREE.Vector3(0, 0, -91),
});
const START_PLAYER = new THREE.Vector3(2.8, 0, 13.2);
const START_VEHICLE = new THREE.Vector3(0, 0, 10.1);
const START_INFECTED = new THREE.Vector3(-14.2, 0, -44);
// Pursuers wake only after the relay is investigated and start well behind it.
const TUNNEL_INFECTED_STARTS = [new THREE.Vector3(-3.9, 0, -38), new THREE.Vector3(3.6, 0, -35)];

const clamp = THREE.MathUtils.clamp;

function createSurfaceTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = kind === 'road' ? 1024 : 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create procedural surface textures.');
  const road = kind === 'road';
  context.fillStyle = road ? '#353936' : '#596157';
  context.fillRect(0, 0, canvas.width, canvas.height);

  let seed = road ? 0x2f64a1 : 0x7c348d;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const speckleCount = road ? 18000 : 14000;
  for (let index = 0; index < speckleCount; index += 1) {
    const shade = Math.floor(random() * (road ? 34 : 38));
    const alpha = 0.08 + random() * 0.2;
    context.fillStyle = road
      ? `rgba(${shade + 36},${shade + 39},${shade + 37},${alpha})`
      : `rgba(${shade + 52},${shade + 62},${shade + 50},${alpha})`;
    const size = road ? 1 + random() * 2 : 1 + random() * 3;
    context.fillRect(random() * canvas.width, random() * canvas.height, size, size);
  }

  if (road) {
    for (let index = 0; index < 13; index += 1) {
      const x = 24 + random() * (canvas.width - 48);
      const y = random() * canvas.height;
      context.beginPath();
      context.moveTo(x, y);
      let crackX = x;
      let crackY = y;
      for (let segment = 0; segment < 5; segment += 1) {
        crackX += (random() - 0.5) * 34;
        crackY += 8 + random() * 26;
        context.lineTo(crackX, crackY);
      }
      context.strokeStyle = 'rgba(15,18,16,0.38)';
      context.lineWidth = 1 + random() * 2;
      context.stroke();
      if (index % 3 === 0) {
        context.fillStyle = 'rgba(91,78,61,0.22)';
        context.fillRect(x - 24, y - 8, 48 + random() * 30, 14 + random() * 8);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.repeat.set(road ? 1 : 8, road ? 8 : 8);
  return texture;
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ui = new UI();
    this.audio = new GameAudio();
    this.lastCountdownTick = 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#87918a');
    this.scene.fog = new THREE.Fog('#87918a', 24, 132);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 180);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.keys = new Set();
    this.driving = false;
    this.cameraYaw = 0;
    this.dragging = false;
    this.interactionRequested = false;
    this.elapsed = 0;
    this.runActive = false;
    this.paused = false;
    this.resumeCountdown = 0;
    this.pauseStartedAt = 0;
    this.runSequence = 0;
    this.runId = null;
    this.radioIndex = 0;
    this.radioTimer = 0;
    this.blackoutRemaining = 0;
    this.lastTimestamp = 0;
    this.disposed = false;
    this.collisionCircles = [];
    this.relayPosition = new THREE.Vector3(-4.1, 0, -68);

    this._buildWorld();
    this.campaignProgress = new CampaignProgress();
    this.player = new Player(null);
    this.player.group.position.copy(START_PLAYER);
    this.scene.add(this.player.group);

    this.vehicle = new Vehicle();
    this.vehicle.position.copy(START_VEHICLE);
    this.scene.add(this.vehicle.group);

    this.infected = new Infected(START_INFECTED);
    this.scene.add(this.infected.group);
    this.tunnelInfected = [
      new Infected(TUNNEL_INFECTED_STARTS[0], 1),
      new Infected(TUNNEL_INFECTED_STARTS[1], 2),
    ];
    for (const infected of this.tunnelInfected) {
      infected.active = false;
      infected.aggroRange = 70;
      infected.group.visible = false;
      this.scene.add(infected.group);
    }
    this._buildSurvivor();
    this._buildEscapeMarker();
    this._buildFieldAssets();

    this.mission = new MissionController({
      onChange: (phase, objective) => {
        this.ui.setObjective(objective);
        if (this.runActive && phase !== MISSION_PHASES.COMPLETE && phase !== MISSION_PHASES.FAILED) this.audio.chime();
        if (phase === MISSION_PHASES.FIND_SURVIVOR) {
          this.ui.radio(1);
          this.ui.showToast('Service station reached. Find the survivor.');
        } else if (phase === MISSION_PHASES.RETURN_VEHICLE) {
          this.ui.radio(2);
          this.ui.showToast('Survivor rescued. Get back to the vehicle.');
        } else if (phase === MISSION_PHASES.REACH_ESCAPE) {
          this.ui.radio(3);
        } else if (phase === MISSION_PHASES.ENTER_TUNNEL) {
          this.ui.setRadioMessage('“The checkpoint is just beyond the tunnel. Keep moving.”');
        } else if (phase === MISSION_PHASES.NAVIGATE_BLACKOUT) {
          this.blackoutRemaining = 12;
          this.ui.setRadioOutage(true);
          this.ui.showToast('Signal lost. Follow the amber emergency lamps.');
        } else if (phase === MISSION_PHASES.INVESTIGATE_RELAY) {
          this.relayDevice.visible = true;
          this.relayMarker.visible = true;
          this.ui.setRadioOutage(false);
          this.ui.setRadioMessage('“...military relay is repeating a recovery-network tag: NORTHSTAR.”');
          this.ui.showToast('A relay is transmitting inside the tunnel.');
        } else if (phase === MISSION_PHASES.ESCAPE_TUNNEL) {
          this.ui.setRadioMessage('“Dispatch, you sent us into a dead zone. Signal source is confirmed. Get out!”');
          this.ui.showToast('Relay clue secured. Infected closing in.');
          for (const infected of this.tunnelInfected) {
            infected.active = true;
            infected.group.visible = true;
          }
        }
      },
    });
    this.platform = new StartNgIntegration(this.ui, (player) => this.player.setStyle(player.style));
    this._bindEvents();
    this._resize();
    this._placeCamera(1);
  }

  start() {
    this.platform.initialize();
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this._frame);
  }

  _openMissionSelection() {
    this.ui.showMissionSelection(
      CAMPAIGN_MISSIONS,
      SPECIAL_OPERATIONS,
      this.campaignProgress,
      (mission) => {
        this.selectedMissionId = mission.launchId ?? mission.id;
        this.ui.showMissionBriefing(
          mission,
          () => this._startMission(mission.launchId ?? mission.id),
          () => this._openMissionSelection(),
        );
      },
    );
  }

  _startMission(missionId) {
    const playableMissionIds = [MISSION_IDS.RESCUE_RUN, MISSION_IDS.BLACKOUT_TUNNEL, ...Object.keys(FIELD_MISSIONS)];
    if (this.runActive || !playableMissionIds.includes(missionId)) return false;
    this.selectedMissionId = missionId;
    this.paused = false;
    this.resumeCountdown = 0;
    this.audio.setDucked(false);
    this.ui.hidePause();
    this.ui.hideCountdown();
    this.keys.clear();
    this.dragging = false;
    this.interactionRequested = false;
    this.driving = false;
    this.cameraYaw = 0;
    this.elapsed = 0;
    this.radioIndex = 0;
    this.radioTimer = 0;
    this.blackoutRemaining = 0;
    this.runSequence += 1;
    this.runId = `${missionId}-run-${this.runSequence}`;
    this.player.reset(START_PLAYER);
    this.vehicle.reset(START_VEHICLE);
    this.infected.reset(START_INFECTED);
    this.infected.active = missionId === MISSION_IDS.RESCUE_RUN;
    this.infected.group.visible = this.infected.active;
    for (const [index, infected] of this.tunnelInfected.entries()) {
      infected.reset(TUNNEL_INFECTED_STARTS[index]);
      infected.active = false;
      infected.group.visible = false;
    }
    this.survivor.visible = true;
    this.survivorMarker.visible = true;
    this.survivorMarker.rotation.set(Math.PI / 2, 0, 0);
    this.escapeMarker.rotation.set(Math.PI / 2, 0, 0);
    const tunnelMission = missionId === MISSION_IDS.BLACKOUT_TUNNEL;
    const field = FIELD_MISSIONS[missionId] ?? null;
    this._applyRoadLayout(layoutForMission(missionId));
    this.tunnelGroup.visible = tunnelMission;
    this.survivor.visible = !tunnelMission && !field;
    this.survivorMarker.visible = !tunnelMission && !field;
    this.escapeMarker.visible = !field;
    this.escapeBeam.visible = !field;
    this.relayDevice.visible = false;
    this.relayMarker.visible = false;
    this.ui.resetRun();
    this._resetFieldAssets();
    this._setAtmosphere(field?.atmosphere);
    this.mission.reset(Date.now(), missionId);
    if (field) {
      const campaign = CAMPAIGN_MISSIONS.find((entry) => entry.launchId === missionId);
      this.ui.setMissionLabel(`${campaign.title.toUpperCase()} // ${String(campaign.number).padStart(2, '0')}`);
      this.ui.setMissionLocation(campaign.environment.toUpperCase());
      this.ui.setRadioMessage(field.radio);
      this._applyFieldStage();
    }
    if (tunnelMission) {
      this.ui.setMissionLabel('BLACKOUT TUNNEL // SPECIAL');
      this.ui.setMissionLocation('BLACKOUT TUNNEL');
      this.ui.setRadioMessage('“Evacuation checkpoint beyond the old tunnel. Come in, survivor.”');
    }
    this.runActive = true;
    this.lastTimestamp = performance.now();
    this.ui.hideEnd();
    this.ui.hideMenu();
    this._placeCamera(1);
    return true;
  }

  _buildWorld() {
    this.scene.add(new THREE.HemisphereLight('#c5cbc2', '#303732', 1.65));
    const sun = new THREE.DirectionalLight('#e4d5b4', 2.35);
    sun.position.set(-25, 42, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 42;
    sun.shadow.camera.bottom = -58;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 190),
      new THREE.MeshStandardMaterial({ map: createSurfaceTexture('ground'), color: '#a2a99e', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.09, -27);
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;
    this.roadTextures = { road: createSurfaceTexture('road'), ground: createSurfaceTexture('ground') };
    this.roadLayouts = new Map();
    this.roadLayout = ROAD_LAYOUTS.county;
    const countyStart = this.scene.children.length;
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 150),
      new THREE.MeshStandardMaterial({ map: createSurfaceTexture('road'), color: '#c0c2b9', roughness: 1 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -28);
    road.receiveShadow = true;
    this.scene.add(road);

    const lineMat = new THREE.MeshStandardMaterial({ color: '#aaa58e', roughness: 1 });
    for (let z = 38; z > -101; z -= 13) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 5), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.012, z);
      this.scene.add(dash);
    }
    for (const x of [-5.82, 5.82]) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 150), lineMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.012, -28);
      this.scene.add(edge);
    }

    const shoulderMaterial = new THREE.MeshStandardMaterial({
      map: createSurfaceTexture('ground'),
      color: '#aaa993',
      roughness: 1,
    });
    for (const x of [-7.1, 7.1]) {
      const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 150), shoulderMaterial);
      shoulder.rotation.x = -Math.PI / 2;
      shoulder.position.set(x, -0.005, -28);
      shoulder.receiveShadow = true;
      this.scene.add(shoulder);
    }

    const fogLight = new THREE.PointLight('#d5c99f', 18, 27, 2);
    fogLight.position.set(-9, 6, -30);
    this.scene.add(fogLight);
    this._buildStation();
    this._buildRoadside();
    this._buildAbandonedCar();
    this._buildBoundaryMarkers();
    this.countyGroup = new THREE.Group();
    this.countyGroup.add(...this.scene.children.slice(countyStart));
    this.scene.add(this.countyGroup);
    this._buildTunnel();
  }

  _applyRoadLayout(layout) {
    this.roadLayout = layout;
    const county = layout.id === 'county';
    this.countyGroup.visible = county;
    for (const [id, group] of this.roadLayouts) group.visible = id === layout.id;
    if (!county && !this.roadLayouts.has(layout.id)) {
      const group = buildRoadLayout(layout, this.roadTextures);
      this.roadLayouts.set(layout.id, group);
      this.scene.add(group);
    }
    this.ground.material.color.set(layout.groundColor);
    this.audio.setMood(layout.id);
  }

  _roadX(z) {
    return roadCenter(this.roadLayout, z);
  }

  _buildTunnel() {
    this.tunnelGroup = new THREE.Group();
    const concrete = new THREE.MeshStandardMaterial({ color: '#343a36', roughness: 0.96 });
    const stainedConcrete = new THREE.MeshStandardMaterial({ color: '#4b4c42', roughness: 0.94 });
    const amber = new THREE.MeshStandardMaterial({
      color: '#d99b55',
      emissive: '#b96b22',
      emissiveIntensity: 1.4,
      roughness: 0.45,
    });
    const structure = [
      [new THREE.BoxGeometry(0.75, 6.5, 64), -9.25, 3.25, -61],
      [new THREE.BoxGeometry(0.75, 6.5, 64), 9.25, 3.25, -61],
      [new THREE.BoxGeometry(19.2, 0.8, 64), 0, 6.65, -61],
    ];
    for (const [geometry, x, y, z] of structure) {
      const wall = new THREE.Mesh(geometry, concrete);
      wall.position.set(x, y, z);
      wall.receiveShadow = true;
      wall.castShadow = true;
      this.tunnelGroup.add(wall);
    }

    for (const z of [-34, -47, -60, -73, -86]) {
      const supports = [
        [new THREE.BoxGeometry(0.42, 6.4, 0.48), -8.72, 3.2, z],
        [new THREE.BoxGeometry(0.42, 6.4, 0.48), 8.72, 3.2, z],
        [new THREE.BoxGeometry(17.8, 0.42, 0.48), 0, 6.15, z],
      ];
      for (const [geometry, x, y, depth] of supports) {
        const support = new THREE.Mesh(geometry, stainedConcrete);
        support.position.set(x, y, depth);
        support.castShadow = true;
        support.receiveShadow = true;
        this.tunnelGroup.add(support);
      }
    }

    for (const z of [-42, -55, -68, -81]) {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 1.5), concrete);
      housing.position.set(0, 5.95, z);
      this.tunnelGroup.add(housing);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.7), amber);
      lamp.position.set(0, 5.78, z);
      this.tunnelGroup.add(lamp);
      const light = new THREE.PointLight('#e5a45e', 2.8, 15, 2);
      light.position.set(0, 5.45, z);
      this.tunnelGroup.add(light);
    }

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 1.1, 0.16),
      new THREE.MeshStandardMaterial({ color: '#34362e', emissive: '#65421f', emissiveIntensity: 0.55 }),
    );
    sign.position.set(0, 4.7, -33.1);
    this.tunnelGroup.add(sign);
    for (const x of [-8.4, 8.4]) {
      const guide = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 60), amber);
      guide.position.set(x, 0.3, -61);
      this.tunnelGroup.add(guide);
    }

    this.relayDevice = new THREE.Group();
    this.relayDevice.position.copy(this.relayPosition);
    const relayBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 0.65), stainedConcrete);
    relayBody.position.y = 0.8;
    relayBody.castShadow = true;
    this.relayDevice.add(relayBody);
    const relayPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.36, 0.08),
      new THREE.MeshStandardMaterial({ color: '#8c3830', emissive: '#b43c2d', emissiveIntensity: 1.1 }),
    );
    relayPanel.position.set(0, 1.05, -0.37);
    this.relayDevice.add(relayPanel);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 1.45, 6), stainedConcrete);
    antenna.position.set(0.25, 2.1, 0);
    this.relayDevice.add(antenna);
    this.tunnelGroup.add(this.relayDevice);
    this.relayMarker = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.055, 6, 24),
      new THREE.MeshStandardMaterial({ color: '#d2e99a', emissive: '#829c47', emissiveIntensity: 0.8 }),
    );
    this.relayMarker.rotation.x = Math.PI / 2;
    this.relayMarker.position.set(this.relayPosition.x, 0.08, this.relayPosition.z);
    this.tunnelGroup.add(this.relayMarker);
    this.tunnelGroup.visible = false;
    this.scene.add(this.tunnelGroup);
  }

  _buildStation() {
    const building = new THREE.Group();
    building.position.set(-11.6, 0, -34);
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(8.3, 4.2, 6.2),
      new THREE.MeshStandardMaterial({ color: '#887e69', roughness: 0.95 }),
    );
    wall.position.y = 2.1;
    wall.castShadow = true;
    wall.receiveShadow = true;
    building.add(wall);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(9.1, 0.32, 7),
      new THREE.MeshStandardMaterial({ color: '#303835', roughness: 0.88 }),
    );
    roof.position.y = 4.35;
    roof.castShadow = true;
    building.add(roof);

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(5.3, 0.9, 0.16),
      new THREE.MeshStandardMaterial({ color: '#3c514a', emissive: '#13241e', emissiveIntensity: 0.38 }),
    );
    sign.position.set(0, 3.1, 3.16);
    building.add(sign);
    this.scene.add(building);

    const pumpMat = new THREE.MeshStandardMaterial({ color: '#a69b79', roughness: 0.8 });
    for (const x of [-10.5, -7.2]) {
      const pump = new THREE.Group();
      pump.position.set(x, 0, -28.4);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.7, 0.7), pumpMat);
      base.position.y = 0.88;
      base.castShadow = true;
      pump.add(base);
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.35, 0.04),
        new THREE.MeshStandardMaterial({ color: '#222a25', emissive: '#789060', emissiveIntensity: 0.65 }),
      );
      screen.position.set(0, 1.2, 0.37);
      pump.add(screen);
      this.scene.add(pump);
      this.collisionCircles.push({ x, z: -28.4, radius: 0.72 });
    }

    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 0.23, 1.8),
      new THREE.MeshStandardMaterial({ color: '#9b4e3e', roughness: 0.9 }),
    );
    awning.position.set(-7.5, 3.3, -28.5);
    awning.castShadow = true;
    this.scene.add(awning);
  }

  _buildRoadside() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#48473d', roughness: 1 });
    const crownMats = ['#404b42', '#4b5549', '#525a4e'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    for (let z = 42; z >= -98; z -= 12) {
      for (const side of [-1, 1]) {
        const jitter = Math.sin(z * 1.8 + side) * 2.1;
        const x = side * (14 + Math.abs(jitter));
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.42, 4.7, 7), trunkMat);
        trunk.position.set(x, 2.35, z + jitter);
        trunk.castShadow = true;
        this.scene.add(trunk);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(2.1, 5.8, 7), crownMats[Math.abs(z) % crownMats.length]);
        crown.position.set(x, 6, z + jitter);
        crown.castShadow = true;
        this.scene.add(crown);
        if (Math.abs(x) < 17) this.collisionCircles.push({ x, z: z + jitter, radius: 1.1 });
      }
    }

    for (const side of [-1, 1]) {
      const barrier = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.65, 112),
        new THREE.MeshStandardMaterial({ color: '#65685e', roughness: 0.9 }),
      );
      barrier.position.set(side * 7.7, 0.52, -30);
      barrier.castShadow = true;
      this.scene.add(barrier);
      this.collisionCircles.push({ x: side * 7.7, z: -30, radius: 0.85, length: 112 });
      for (let z = 28; z >= -88; z -= 14) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.48, 0.85, 0.55),
          new THREE.MeshStandardMaterial({ color: '#594a3e', roughness: 1 }),
        );
        post.position.set(side * 7.85, 0.45, z);
        post.castShadow = true;
        this.scene.add(post);
      }
    }

    let seed = 0x517a2d;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const shrubMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
    const shrubs = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.72, 0), shrubMaterial, 170);
    const debris = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.42, 0),
      new THREE.MeshStandardMaterial({ color: '#79786d', roughness: 1 }),
      95,
    );
    const transform = new THREE.Object3D();
    const tint = new THREE.Color();
    for (let index = 0; index < shrubs.count; index += 1) {
      const side = random() < 0.5 ? -1 : 1;
      const scale = 0.48 + random() * 0.82;
      transform.position.set(side * (8.9 + random() * 3.5), scale * 0.55, 34 - random() * 133);
      transform.rotation.set(0, random() * Math.PI, 0);
      transform.scale.set(scale * (0.8 + random() * 0.5), scale, scale * (0.8 + random() * 0.5));
      transform.updateMatrix();
      shrubs.setMatrixAt(index, transform.matrix);
      tint.setHSL(0.24 + random() * 0.07, 0.12 + random() * 0.16, 0.2 + random() * 0.1);
      shrubs.setColorAt(index, tint);
    }
    for (let index = 0; index < debris.count; index += 1) {
      const side = random() < 0.5 ? -1 : 1;
      const scale = 0.25 + random() * 0.85;
      transform.position.set(side * (6.5 + random() * 2.6), scale * 0.25, 34 - random() * 133);
      transform.rotation.set(random() * 0.2, random() * Math.PI, random() * 0.18);
      transform.scale.set(scale * 1.3, scale * 0.45, scale);
      transform.updateMatrix();
      debris.setMatrixAt(index, transform.matrix);
    }
    shrubs.castShadow = false;
    shrubs.receiveShadow = false;
    debris.castShadow = false;
    debris.receiveShadow = false;
    this.scene.add(shrubs, debris);
  }

  _buildAbandonedCar() {
    const wrecks = [
      { x: 10.8, z: -7, yaw: 0.42, color: '#525853', radius: 2.5 },
      { x: -10.2, z: -66, yaw: -0.18, color: '#665b49', radius: 2.6 },
    ];
    const tireMaterial = new THREE.MeshStandardMaterial({ color: '#202320', roughness: 1 });
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: '#252e2d',
      roughness: 0.34,
      metalness: 0.12,
    });
    for (const [index, location] of wrecks.entries()) {
      const wreck = new THREE.Group();
      wreck.position.set(location.x, 0, location.z);
      wreck.rotation.y = location.yaw;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.75, 4.3),
        new THREE.MeshStandardMaterial({ color: location.color, roughness: 0.94, metalness: 0.08 }),
      );
      body.position.y = 0.75;
      body.rotation.z = index === 0 ? -0.07 : 0.035;
      body.castShadow = true;
      body.receiveShadow = true;
      wreck.add(body);
      const hood = new THREE.Mesh(
        new THREE.BoxGeometry(2.05, 0.2, 1.1),
        new THREE.MeshStandardMaterial({ color: '#484b43', roughness: 1 }),
      );
      hood.position.set(0, 1.2, -1.37);
      hood.rotation.z = -0.08;
      hood.castShadow = true;
      wreck.add(hood);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.8), glassMaterial);
      cabin.position.set(0, 1.37, 0.25);
      cabin.castShadow = true;
      wreck.add(cabin);

      const rust = new THREE.MeshStandardMaterial({ color: '#754738', roughness: 1 });
      for (const side of [-1, 1]) {
        const scrape = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.75), rust);
        scrape.position.set(side * 1.105, 0.8, index === 0 ? 0.28 : -0.35);
        scrape.rotation.y = side * 0.06;
        wreck.add(scrape);
        const glassShard = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.025, 0.31),
          new THREE.MeshStandardMaterial({ color: '#707874', roughness: 0.26, metalness: 0.15 }),
        );
        glassShard.position.set(side * 0.42, 1.78, 0.22);
        glassShard.rotation.z = side * 0.24;
        wreck.add(glassShard);
      }
      for (const x of [-0.96, 0.96]) {
        for (const z of [-1.32, 1.32]) {
          if (index === 1 && x > 0 && z > 0) continue;
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.25, 10), tireMaterial);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x, 0.4, z);
          wheel.castShadow = true;
          wreck.add(wheel);
        }
      }
      this.scene.add(wreck);
      this.collisionCircles.push({ x: location.x, z: location.z, radius: location.radius });
      if (index === 0) {
        const wreckLight = new THREE.PointLight('#ce7855', 5, 8, 2);
        wreckLight.position.set(location.x, 0.8, location.z);
        this.scene.add(wreckLight);
      }
    }
  }

  _buildBoundaryMarkers() {
    const reflectorMat = new THREE.MeshStandardMaterial({ color: '#a24f40', emissive: '#63251e', emissiveIntensity: 0.25 });
    for (let z = 35; z >= -95; z -= 10) {
      for (const x of [-7.6, 7.6]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 0.16), reflectorMat);
        post.position.set(x, 0.4, z);
        this.scene.add(post);
      }
    }
  }

  _buildSurvivor() {
    this.survivor = new THREE.Group();
    this.survivor.position.copy(WORLD.survivor);
    const clothing = new THREE.MeshStandardMaterial({ color: '#9d6d4a', roughness: 1 });
    const skin = new THREE.MeshStandardMaterial({ color: '#b98a6b', roughness: 1 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 3, 7), clothing);
    torso.position.y = 0.92;
    torso.castShadow = true;
    this.survivor.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), skin);
    head.position.y = 1.65;
    head.castShadow = true;
    this.survivor.add(head);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.48, 0.28),
      new THREE.MeshStandardMaterial({ color: '#353b38', roughness: 1 }),
    );
    legs.position.y = 0.28;
    this.survivor.add(legs);
    this.scene.add(this.survivor);

    this.survivorMarker = new THREE.Mesh(
      new THREE.TorusGeometry(0.8, 0.045, 5, 24),
      new THREE.MeshStandardMaterial({ color: '#d0da94', emissive: '#626d35', emissiveIntensity: 0.65 }),
    );
    this.survivorMarker.rotation.x = Math.PI / 2;
    this.survivorMarker.position.set(WORLD.survivor.x, 0.08, WORLD.survivor.z);
    this.scene.add(this.survivorMarker);
  }

  _buildEscapeMarker() {
    const material = new THREE.MeshStandardMaterial({
      color: '#d3dc9c',
      emissive: '#586b2f',
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.72,
    });
    this.escapeMarker = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.11, 6, 36), material);
    this.escapeMarker.rotation.x = Math.PI / 2;
    this.escapeMarker.position.set(WORLD.escape.x, 0.07, WORLD.escape.z);
    this.scene.add(this.escapeMarker);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.5, 10, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: '#c9d48c', transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
    );
    beam.position.set(WORLD.escape.x, 5, WORLD.escape.z);
    this.escapeBeam = beam;
    this.scene.add(beam);
  }

  _buildFieldAssets() {
    this.fieldInfected = [];
    for (let index = 0; index < FIELD_INFECTED_POOL; index += 1) {
      const infected = new Infected(new THREE.Vector3(0, 0, 0), index % 3);
      infected.active = false;
      infected.group.visible = false;
      this.scene.add(infected.group);
      this.fieldInfected.push(infected);
    }
    this.fieldMarkers = [];
    const ringGeometry = new THREE.TorusGeometry(1.4, 0.08, 6, 28);
    const beamGeometry = new THREE.CylinderGeometry(0.05, 0.4, 8, 8, 1, true);
    for (let index = 0; index < 4; index += 1) {
      const marker = new THREE.Group();
      const ring = new THREE.Mesh(ringGeometry, new THREE.MeshStandardMaterial({
        color: '#d0da94', emissive: '#626d35', emissiveIntensity: 0.65,
      }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.08;
      const beam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({
        color: '#c9d48c', transparent: true, opacity: 0.12, side: THREE.DoubleSide,
      }));
      beam.position.y = 4;
      marker.add(ring, beam);
      marker.visible = false;
      this.scene.add(marker);
      this.fieldMarkers.push(marker);
    }
    this.fieldSpawnCursor = 0;
    this.fieldSettings = infectedSettingsFor();
    this.fieldTargets = [];
    this.fieldTimer = 0;
  }

  _setAtmosphere(atmosphere) {
    const { background, near, far } = atmosphere ?? { background: '#87918a', near: 24, far: 132 };
    this.scene.background.set(background);
    this.scene.fog.color.set(background);
    this.scene.fog.near = near;
    this.scene.fog.far = far;
  }

  _resetFieldAssets() {
    for (const infected of this.fieldInfected) {
      infected.active = false;
      infected.group.visible = false;
    }
    for (const marker of this.fieldMarkers) marker.visible = false;
    this.fieldSpawnCursor = 0;
    this.fieldTargets = [];
    this.fieldTimer = 0;
  }

  _spawnFieldInfected(positions = []) {
    for (const [x, z] of positions) {
      const infected = this.fieldInfected[this.fieldSpawnCursor];
      if (!infected) return;
      this.fieldSpawnCursor += 1;
      infected.reset(new THREE.Vector3(x + this._roadX(z), 0, z));
      infected.speed = this.fieldSettings.speed;
      infected.aggroRange = this.fieldSettings.aggroRange;
      infected.active = true;
      infected.group.visible = true;
    }
  }

  // Sets up markers, spawns and radio for the mission's current stage.
  _applyFieldStage() {
    const stage = this.mission.fieldStage;
    if (!stage) return;
    const campaign = CAMPAIGN_MISSIONS.find((entry) => entry.launchId === this.mission.missionId);
    this.fieldSettings = infectedSettingsFor(campaign?.difficulty);
    this.fieldTimer = stage.type === 'survive' ? stage.seconds : 0;
    this.fieldTargets = stageTargets(stage).map(([x, z]) => new THREE.Vector3(x + this._roadX(z), 0, z));
    this.fieldMarkers.forEach((marker, index) => {
      const target = this.fieldTargets[index];
      marker.visible = Boolean(target) && stage.type !== 'survive';
      if (target) marker.position.copy(target);
    });
    this._spawnFieldInfected(stage.spawn);
    if (stage.radio) this.ui.setRadioMessage(stage.radio);
    this.ui.showToast(stage.objective);
  }

  _finishFieldStage(choice = null) {
    const index = this.mission.stageIndex;
    const result = this.mission.completeFieldStage(index, Date.now(), this.player.health, choice);
    if (result) this._completeMission(result);
    else if (this.mission.stageIndex !== index) this._applyFieldStage();
  }

  _updateFieldMission(delta) {
    const stage = this.mission.fieldStage;
    if (!stage) return;
    const actor = this.driving ? this.vehicle.position : this.player.position;
    if (stage.type === 'reach') {
      if (stage.vehicle && !this.driving) return;
      if (actor.distanceTo(this.fieldTargets[0]) < stage.radius) this._finishFieldStage();
    } else if (stage.type === 'escape') {
      if (this.driving && this.vehicle.position.distanceTo(this.fieldTargets[0]) < stage.radius) this._finishFieldStage();
    } else if (stage.type === 'survive') {
      this.fieldTimer = Math.max(0, this.fieldTimer - delta);
      this.ui.setObjective(`${stage.objective} (${Math.ceil(this.fieldTimer)}s)`);
      if (this.fieldTimer === 0) this._finishFieldStage();
    }
  }

  _nearestFieldTarget(position) {
    let best = null;
    let bestDistance = 3.2;
    this.fieldTargets.forEach((target, index) => {
      if (!this.fieldMarkers[index].visible) return;
      const distance = position.distanceTo(target);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  }

  _interactField(stage, position) {
    const index = this.fieldTargets.length ? this._nearestFieldTarget(position) : null;
    if (index === null) return false;
    if (stage.type === 'collect') {
      this.fieldMarkers[index].visible = false;
      this.audio.pickup();
      if (this.mission.fieldProgress(this.mission.stageIndex)) this._finishFieldStage();
      return true;
    }
    if (stage.type === 'choice') {
      const option = stage.options[index];
      this._spawnFieldInfected(option.spawn);
      this._finishFieldStage(option.label);
      return true;
    }
    return false;
  }

  _returnToMenu() {
    this.runActive = false;
    this.paused = false;
    this.resumeCountdown = 0;
    this.keys.clear();
    this.dragging = false;
    this.driving = false;
    this.elapsed = 0;
    this.selectedMissionId = MISSION_IDS.RESCUE_RUN;
    this.tunnelGroup.visible = false;
    this.relayDevice.visible = false;
    this.relayMarker.visible = false;
    this.infected.active = false;
    this.infected.group.visible = false;
    for (const infected of this.tunnelInfected) {
      infected.active = false;
      infected.group.visible = false;
    }
    this.survivor.visible = true;
    this.survivorMarker.visible = true;
    this.escapeMarker.visible = true;
    this.escapeBeam.visible = true;
    this._resetFieldAssets();
    this._setAtmosphere();
    this._applyRoadLayout(ROAD_LAYOUTS.county);
    this.audio.setMood('menu');
    this.audio.setDucked(false);
    this.ui.resetRun();
    this.ui.hideEnd();
    this.ui.hidePause();
    this.ui.hideCountdown();
    this.ui.showMenu();
  }

  _pause() {
    if (!this.runActive || this.paused) return;
    this.paused = true;
    this.resumeCountdown = 0;
    this.pauseStartedAt = Date.now();
    this.keys.clear();
    this.dragging = false;
    this.interactionRequested = false;
    this.audio.setDucked(true);
    this.ui.showPause();
  }

  _beginResume() {
    if (!this.paused || this.resumeCountdown > 0) return;
    this.resumeCountdown = 3;
    this.ui.hidePause();
    this.ui.showCountdown(3);
  }

  _cancelResume() {
    if (!this.paused || this.resumeCountdown <= 0) return;
    this.resumeCountdown = 0;
    this.ui.hideCountdown();
    this.ui.showPause();
  }

  _finishResume() {
    // Keep the wall-clock based completion time from counting the paused period.
    this.mission.startedAt += Date.now() - this.pauseStartedAt;
    this.paused = false;
    this.resumeCountdown = 0;
    this.audio.setDucked(false);
    this.ui.hideCountdown();
    this.ui.setPauseButtonVisible(true);
  }

  _bindEvents() {
    this.ui.showMenu();
    addEventListener('resize', this._onResize);
    addEventListener('keydown', this._onKeyDown);
    addEventListener('keyup', this._onKeyUp);
    addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    addEventListener('pointerup', this._onPointerUp);
    addEventListener('pointermove', this._onPointerMove);
    document.getElementById('start-button').addEventListener('click', () => this._openMissionSelection());
    for (const type of ['pointerdown', 'keydown', 'touchstart']) {
      addEventListener(type, () => this.audio.unlock(), { passive: true });
    }
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('button') && event.target.id !== 'sound-button') this.audio.click();
    });
    this.soundButton = document.getElementById('sound-button');
    this._syncSoundButton();
    this.soundButton.addEventListener('click', () => this._toggleSound());
    document.getElementById('replay-button').addEventListener('click', () => this._startMission(this.selectedMissionId));
    document.getElementById('menu-button').addEventListener('click', () => this._returnToMenu());
    document.getElementById('pause-menu-button').addEventListener('click', () => this._returnToMenu());
    document.getElementById('pause-button').addEventListener('click', () => this._pause());
    document.getElementById('resume-button').addEventListener('click', () => this._beginResume());
    document.getElementById('leaderboard-button').addEventListener('click', () => this.platform.showLeaderboard());
    document.getElementById('close-leaderboard').addEventListener('click', () => this.ui.closeLeaderboard());
  }

  _toggleSound() {
    this.audio.unlock();
    this.audio.toggleMute();
    this._syncSoundButton();
  }

  _syncSoundButton() {
    this.soundButton.textContent = this.audio.muted ? 'SOUND OFF' : 'SOUND ON';
    this.soundButton.setAttribute('aria-pressed', String(this.audio.muted));
  }

  _resize() {
    const width = this.canvas.clientWidth || innerWidth;
    const height = this.canvas.clientHeight || innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  _resolveOnFootCollision(position) {
    position.z = clamp(position.z, -101, 37);
    if (this.roadLayout.id !== 'county') {
      const center = this._roadX(position.z);
      const limit = footLimit(this.roadLayout);
      position.x = clamp(position.x, center - limit, center + limit);
    } else {
      position.x = clamp(position.x, -16, 16);
    }
    for (const circle of this.roadLayout.id === 'county' ? this.collisionCircles : []) {
      let dx = position.x - circle.x;
      let dz = position.z - circle.z;
      if (circle.length && Math.abs(dz) < circle.length / 2) {
        const min = circle.radius + 0.5;
        if (Math.abs(dx) < min) position.x = circle.x + Math.sign(dx || 1) * min;
        continue;
      }
      const distanceSq = dx * dx + dz * dz;
      const minimum = circle.radius + 0.42;
      if (distanceSq > 0 && distanceSq < minimum * minimum) {
        const distance = Math.sqrt(distanceSq);
        position.x = circle.x + dx / distance * minimum;
        position.z = circle.z + dz / distance * minimum;
      }
    }
    if (!this.driving) {
      const dx = position.x - this.vehicle.position.x;
      const dz = position.z - this.vehicle.position.z;
      const distance = Math.hypot(dx, dz);
      const minimum = 2.15;
      if (distance > 0 && distance < minimum) {
        position.x = this.vehicle.position.x + dx / distance * minimum;
        position.z = this.vehicle.position.z + dz / distance * minimum;
      }
    }
  }

  _resolveVehicleCollision(position) {
    if (Math.abs(position.x) > 24 || position.z < -101 || position.z > 37) return true;
    if (this.roadLayout.id !== 'county') {
      return Math.abs(position.x - this._roadX(position.z)) > vehicleLimit(this.roadLayout);
    }
    if (Math.abs(position.x) > 15.5) return true;
    for (const circle of this.collisionCircles) {
      if (circle.length && Math.abs(position.z - circle.z) < circle.length / 2) {
        if (Math.abs(position.x - circle.x) < circle.radius + 1.1) return true;
        continue;
      }
      if (Math.hypot(position.x - circle.x, position.z - circle.z) < circle.radius + 1.15) return true;
    }
    return false;
  }

  _interact() {
    this.interactionRequested = false;
    if (this.driving) {
      if (this.vehicle.speedMph > 2) {
        this.ui.showToast('Slow down before leaving the vehicle.');
        return;
      }
      if (!this._exitVehicle()) this.ui.showToast('There is no room to exit here.');
      return;
    }

    const playerPosition = this.player.position;
    const fieldStage = this.mission.fieldStage;
    if (fieldStage && this._interactField(fieldStage, playerPosition)) return;
    const carDistance = playerPosition.distanceTo(this.vehicle.position);
    const survivorDistance = playerPosition.distanceTo(WORLD.survivor);
    if (this.mission.phase === MISSION_PHASES.INVESTIGATE_RELAY
      && playerPosition.distanceTo(this.relayPosition) < 3.2) {
      this.mission.investigateRelay();
      this.relayDevice.visible = false;
      this.relayMarker.visible = false;
      return;
    }
    if (this.mission.phase === MISSION_PHASES.FIND_SURVIVOR && survivorDistance < 3.2) {
      if (this.mission.rescueSurvivor()) {
        this.survivor.visible = false;
        this.survivorMarker.visible = false;
      }
      return;
    }
    if (carDistance < 4) {
      this._enterVehicle();
      return;
    }
    this.ui.showToast('Nothing close enough to interact with.');
  }

  _enterVehicle() {
    this.driving = true;
    this.player.group.visible = false;
    if (this.mission.enterVehicle()) this.cameraYaw = this.vehicle.group.rotation.y;
    this.ui.showToast('Vehicle controls active.');
  }

  _exitVehicle() {
    const yaw = this.vehicle.group.rotation.y;
    const right = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    const exitTarget = this.mission.phase === MISSION_PHASES.FIND_SURVIVOR ? WORLD.survivor : WORLD.station;
    const targetOffset = exitTarget.clone().sub(this.vehicle.position);
    const preferredSide = Math.sign(targetOffset.dot(right)) || 1;
    const candidates = [preferredSide, -preferredSide].map((side) =>
      this.vehicle.position.clone().addScaledVector(right, side * 2.75),
    );
    for (const candidate of candidates) {
      const resolved = candidate.clone();
      const wasDriving = this.driving;
      this.driving = false;
      this._resolveOnFootCollision(resolved);
      this.driving = wasDriving;
      if (resolved.distanceTo(candidate) > 1.1 || this._resolveVehicleCollision(candidate)) continue;
      this.player.position.copy(candidate);
      this.player.yaw = yaw;
      this.player.group.rotation.y = yaw;
      this.player.group.visible = true;
      this.driving = false;
      this.ui.showToast('On foot. Stay alert.');
      return true;
    }
    return false;
  }

  _updatePrompt() {
    if (this.driving) {
      this.ui.setPrompt(this.vehicle.speedMph <= 2 ? 'Exit vehicle' : 'Slow down to exit');
      return;
    }
    const playerPosition = this.player.position;
    const fieldStage = this.mission.fieldStage;
    if (fieldStage && this._nearestFieldTarget(playerPosition) !== null
      && (fieldStage.type === 'collect' || fieldStage.type === 'choice')) {
      const index = this._nearestFieldTarget(playerPosition);
      this.ui.setPrompt(fieldStage.type === 'choice'
        ? `${fieldStage.prompt}: ${fieldStage.options[index].label}`
        : fieldStage.prompt);
      return;
    }
    if (this.mission.phase === MISSION_PHASES.INVESTIGATE_RELAY
      && playerPosition.distanceTo(this.relayPosition) < 3.5) {
      this.ui.setPrompt('Investigate relay');
    } else if (this.mission.phase === MISSION_PHASES.FIND_SURVIVOR
      && playerPosition.distanceTo(WORLD.survivor) < 3.5) {
      this.ui.setPrompt('Rescue survivor');
    } else if (playerPosition.distanceTo(this.vehicle.position) < 4) {
      this.ui.setPrompt('Enter vehicle');
    } else {
      this.ui.setPrompt('');
    }
  }

  _updateMission(delta) {
    if (this.mission.phase === MISSION_PHASES.FIELD) {
      this._updateFieldMission(delta);
      return;
    }
    if (this.mission.phase === MISSION_PHASES.REACH_STATION
      && this.vehicle.position.distanceTo(WORLD.station) < 12) {
      this.mission.reachStation();
    }
    if (this.mission.missionId === MISSION_IDS.BLACKOUT_TUNNEL) {
      const actorPosition = this.driving ? this.vehicle.position : this.player.position;
      if (this.mission.phase === MISSION_PHASES.TRAVEL_TUNNEL && actorPosition.z < -28) {
        this.mission.reachTunnelEntrance();
      }
      if (this.mission.phase === MISSION_PHASES.ENTER_TUNNEL && actorPosition.z < -39) {
        this.mission.enterTunnel();
      }
      if (this.mission.phase === MISSION_PHASES.NAVIGATE_BLACKOUT) {
        if (this.blackoutRemaining > 0) {
          this.blackoutRemaining = Math.max(0, this.blackoutRemaining - delta);
          if (this.blackoutRemaining === 0) {
            this.ui.setRadioMessage('Carrier returning. The emergency lights lead deeper into the tunnel.');
          }
        }
        if (actorPosition.distanceTo(this.relayPosition) < 7) {
          this.mission.reachSignalDevice();
        }
      }
      if (this.mission.phase === MISSION_PHASES.ESCAPE_TUNNEL && this.driving
        && this.vehicle.position.distanceTo(WORLD.escape) < 4) {
        const result = this.mission.reachTunnelExit(Date.now(), this.player.health);
        if (result) this._completeMission(result);
      }
    }
    if (this.mission.phase === MISSION_PHASES.REACH_ESCAPE
      && this.vehicle.position.distanceTo(WORLD.escape) < 4) {
      const result = this.mission.reachEscape(Date.now(), this.player.health);
      if (result) this._completeMission(result);
    }
  }

  _handleInfectedAttack(damage) {
    if (!this.runActive || this.player.health <= 0 || !this.player.damage(damage)) return;
    this.ui.setHealth(this.player.health);
    this.audio.hit();
    this.ui.showToast('Infected attack. Keep moving.');
    if (this.player.health <= 0 && this.mission.fail()) {
      this.runActive = false;
      this.audio.fail();
      this.ui.showEnd({ complete: false });
      this.ui.setPrompt('');
    }
  }

  _nextMissionHandler(result) {
    const index = CAMPAIGN_MISSIONS.findIndex((entry) => entry.launchId === result.missionId);
    const next = index >= 0 ? CAMPAIGN_MISSIONS[index + 1] : null;
    if (!next || this.campaignProgress.stateFor(next.id) === 'locked') return null;
    return () => {
      this.ui.hideEnd();
      this.selectedMissionId = next.launchId;
      this.ui.showMissionBriefing(
        next,
        () => this._startMission(next.launchId),
        () => this._returnToMenu(),
      );
    };
  }

  _completeMission(result) {
    this.campaignProgress.record(result);
    this.runActive = false;
    this.audio.success();
    this.elapsed = result.elapsedSeconds;
    this.ui.showEnd({
      complete: true,
      result,
      runId: this.runId,
      onNext: this._nextMissionHandler(result),
    });
    this.ui.setPrompt('');
    this.platform.submitScore(result.score, this.runId);
  }

  _placeCamera(delta) {
    const target = this.driving ? this.vehicle.position : this.player.position;
    const yaw = this.driving ? this.vehicle.group.rotation.y : this.cameraYaw;
    const distance = this.driving ? 8.7 : 6.2;
    const height = this.driving ? 4.15 : 3.65;
    const desired = new THREE.Vector3(
      target.x + Math.sin(yaw) * distance,
      target.y + height,
      target.z + Math.cos(yaw) * distance,
    );
    this.camera.position.lerp(desired, 1 - Math.exp(-delta * 5.5));
    this.camera.lookAt(target.x, target.y + (this.driving ? 1 : 1.25), target.z);
  }

  _frame = (timestamp) => {
    if (this.disposed) return;
    const realDelta = Math.max(0, (timestamp - this.lastTimestamp) / 1000);
    const delta = Math.min(0.04, realDelta);
    this.lastTimestamp = timestamp;
    if (this.paused && this.resumeCountdown > 0) {
      this.resumeCountdown -= realDelta;
      if (this.resumeCountdown <= 0) this._finishResume();
      else {
        const tick = Math.ceil(this.resumeCountdown);
        if (tick !== this.lastCountdownTick) this.audio.tick(tick === 1);
        this.lastCountdownTick = tick;
        this.ui.showCountdown(tick);
      }
    }
    const terminal = this.mission.phase === MISSION_PHASES.COMPLETE || this.mission.phase === MISSION_PHASES.FAILED;
    if (this.runActive && !terminal && !this.paused) {
      this.elapsed += delta;
      if (this.interactionRequested) this._interact();
      if (this.driving) {
        this.vehicle.update(delta, this.keys, (position) => this._resolveVehicleCollision(position));
        this.infected.update(delta, null, () => {});
        for (const infected of this.tunnelInfected) infected.update(delta, null, () => {});
        for (const infected of this.fieldInfected) {
          infected.update(delta, null, () => {});
          if (infected.active
            && this.vehicle.position.distanceTo(infected.group.position) < 2.1
            && Math.abs(this.vehicle.velocity) > 3) {
            infected.escape();
            this.audio.thump();
            this.ui.showToast('Infected neutralized.');
          }
        }
        if (this.infected.active
          && this.vehicle.position.distanceTo(this.infected.group.position) < 2.1
          && Math.abs(this.vehicle.velocity) > 3) {
          this.infected.escape();
          this.audio.thump();
          this.ui.showToast('Infected neutralized.');
        }
      } else {
        this.player.update(delta, this.keys, this.cameraYaw, (position) => this._resolveOnFootCollision(position));
        this.infected.update(delta, this.player, (damage) => this._handleInfectedAttack(damage));
        for (const infected of this.tunnelInfected) {
          infected.update(delta, this.player, (damage) => this._handleInfectedAttack(damage));
        }
        for (const infected of this.fieldInfected) {
          infected.update(delta, this.player, (damage) => this._handleInfectedAttack(damage));
        }
      }

      this._updateMission(delta);
      if (this.mission.phase === MISSION_PHASES.COMPLETE || this.mission.phase === MISSION_PHASES.FAILED) {
        this.ui.setPrompt('');
      } else {
        this._updatePrompt();
      }
    } else {
      this.interactionRequested = false;
      this.ui.setPrompt('');
    }
    this._placeCamera(delta);
    this.ui.setVehicleState(this.driving, this.driving ? this.vehicle.speedMph : 0);
    this.ui.setTime(this.runActive || terminal ? this.elapsed : 0);
    if (this.runActive && !this.paused && this.mission.missionId === MISSION_IDS.RESCUE_RUN) {
      this.radioTimer += delta;
      if (this.radioTimer > 38) {
        this.radioTimer = 0;
        this.radioIndex += 1;
        this.ui.radio(this.radioIndex);
      }
    }
    this.survivorMarker.rotation.z += delta * 0.55;
    for (const marker of this.fieldMarkers) if (marker.visible) marker.rotation.y += delta * 0.8;
    this.escapeMarker.rotation.z -= delta * 0.25;
    const actorPosition = this.driving ? this.vehicle.position : this.player.position;
    let threatDistance = Infinity;
    for (const infected of [this.infected, ...this.tunnelInfected, ...this.fieldInfected]) {
      if (infected.active) threatDistance = Math.min(threatDistance, actorPosition.distanceTo(infected.group.position));
    }
    this.audio.update(realDelta, {
      inRun: this.runActive && !terminal,
      running: this.runActive && !terminal && !this.paused,
      driving: this.driving,
      speedMph: this.vehicle.speedMph,
      moving: ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((code) => this.keys.has(code)),
      sprinting: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      threatDistance,
    });
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._frame);
  };

  _onResize = () => this._resize();

  _onKeyDown = (event) => {
    const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (['Space', ...navigationKeys].includes(event.code)) event.preventDefault();
    if (!document.getElementById('leaderboard-screen').hidden) {
      if (event.code === 'Escape') this.ui.closeLeaderboard();
      return;
    }
    if (event.code === 'KeyM' && !event.repeat) {
      this._toggleSound();
      return;
    }
    if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) {
      if (this.runActive) {
        if (!this.paused) this._pause();
        else if (this.resumeCountdown > 0) this._cancelResume();
        else this._beginResume();
        return;
      }
      if (event.code === 'Escape') {
        const back = ['mission-briefing-screen', 'mission-selection-screen']
          .find((id) => !document.getElementById(id).hidden);
        if (back) {
          document.getElementById(back === 'mission-briefing-screen' ? 'briefing-back-button' : 'selection-back-button').click();
          return;
        }
      }
    }
    if (navigationKeys.includes(event.code) && this.ui.navigateScreens(event.code)) return;
    if (!this.runActive || this.paused) return;
    if (event.code === 'KeyE' && !event.repeat) this.interactionRequested = true;
    this.keys.add(event.code);
  };

  _onKeyUp = (event) => this.keys.delete(event.code);
  _onBlur = () => {
    this.keys.clear();
    this.dragging = false;
    this._pause();
  };
  _onContextMenu = (event) => event.preventDefault();
  _onPointerDown = (event) => {
    if (this.runActive && !this.paused && event.button === 2) this.dragging = true;
  };
  _onPointerUp = () => {
    this.dragging = false;
  };
  _onPointerMove = (event) => {
    if (this.runActive && !this.paused && this.dragging && !this.driving) this.cameraYaw -= event.movementX * 0.004;
  };
}
