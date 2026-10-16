import * as THREE from '../assets/vendor/three.module.js';
import { Infected } from './infected.js';
import { MissionController, MISSION_PHASES } from './missions.js';
import { Player } from './player.js';
import { StartNgIntegration } from './startng-integration.js';
import { UI } from './ui.js';
import { Vehicle } from './vehicle.js';

const WORLD = Object.freeze({
  station: new THREE.Vector3(-5, 0, -29),
  survivor: new THREE.Vector3(-5.5, 0, -25.4),
  escape: new THREE.Vector3(0, 0, -91),
});

const clamp = THREE.MathUtils.clamp;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ui = new UI();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#9ba09a');
    this.scene.fog = new THREE.Fog('#a3a9a1', 32, 142);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 180);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;

    this.keys = new Set();
    this.driving = false;
    this.cameraYaw = 0;
    this.dragging = false;
    this.interactionRequested = false;
    this.elapsed = 0;
    this.radioIndex = 0;
    this.radioTimer = 0;
    this.lastTimestamp = 0;
    this.disposed = false;
    this.collisionCircles = [];

    this._buildWorld();
    this.player = new Player(null);
    this.player.group.position.set(2.8, 0, 13.2);
    this.scene.add(this.player.group);

    this.vehicle = new Vehicle();
    this.vehicle.position.set(0, 0, 10.1);
    this.scene.add(this.vehicle.group);

    this.infected = new Infected(new THREE.Vector3(-14.2, 0, -44));
    this.scene.add(this.infected.group);
    this._buildSurvivor();
    this._buildEscapeMarker();

    this.mission = new MissionController({
      onChange: (phase, objective) => {
        this.ui.setObjective(objective);
        if (phase === MISSION_PHASES.FIND_SURVIVOR) {
          this.ui.radio(1);
          this.ui.showToast('Service station reached. Find the survivor.');
        } else if (phase === MISSION_PHASES.RETURN_VEHICLE) {
          this.ui.radio(2);
          this.ui.showToast('Survivor rescued. Get back to the vehicle.');
        } else if (phase === MISSION_PHASES.REACH_ESCAPE) {
          this.ui.radio(3);
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

  _buildWorld() {
    this.scene.add(new THREE.HemisphereLight('#d2d5c9', '#353c37', 2.1));
    const sun = new THREE.DirectionalLight('#e4d7b7', 2.1);
    sun.position.set(-25, 42, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -90;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 190),
      new THREE.MeshStandardMaterial({ color: '#687269', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.09, -27);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 150),
      new THREE.MeshStandardMaterial({ color: '#343a38', roughness: 0.96 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -28);
    road.receiveShadow = true;
    this.scene.add(road);

    const lineMat = new THREE.MeshStandardMaterial({ color: '#beb9a3', roughness: 0.9 });
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

    const fogLight = new THREE.PointLight('#d5c99f', 26, 29, 2);
    fogLight.position.set(-9, 6, -30);
    this.scene.add(fogLight);
    this._buildStation();
    this._buildRoadside();
    this._buildAbandonedCar();
    this._buildBoundaryMarkers();
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
  }

  _buildAbandonedCar() {
    const wreck = new THREE.Group();
    wreck.position.set(10.8, 0, -7);
    wreck.rotation.y = 0.42;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.75, 4.3),
      new THREE.MeshStandardMaterial({ color: '#525853', roughness: 0.95 }),
    );
    body.position.y = 0.75;
    body.rotation.z = -0.07;
    body.castShadow = true;
    wreck.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.7, 1.8),
      new THREE.MeshStandardMaterial({ color: '#2f3532', roughness: 0.5 }),
    );
    cabin.position.set(0, 1.37, 0.25);
    cabin.castShadow = true;
    wreck.add(cabin);
    this.scene.add(wreck);
    this.collisionCircles.push({ x: 10.8, z: -7, radius: 2.5 });

    const wreckLight = new THREE.PointLight('#ce7855', 7, 9, 2);
    wreckLight.position.set(10.8, 0.8, -7);
    this.scene.add(wreckLight);
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
    this.scene.add(beam);
  }

  _bindEvents() {
    addEventListener('resize', this._onResize);
    addEventListener('keydown', this._onKeyDown);
    addEventListener('keyup', this._onKeyUp);
    addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    addEventListener('pointerup', this._onPointerUp);
    addEventListener('pointermove', this._onPointerMove);
    document.getElementById('restart-button').addEventListener('click', () => location.reload());
    document.getElementById('leaderboard-button').addEventListener('click', () => this.platform.showLeaderboard());
    document.getElementById('close-leaderboard').addEventListener('click', () => this.ui.closeLeaderboard());
  }

  _resize() {
    const width = this.canvas.clientWidth || innerWidth;
    const height = this.canvas.clientHeight || innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  _resolveOnFootCollision(position) {
    position.x = clamp(position.x, -16, 16);
    position.z = clamp(position.z, -101, 37);
    for (const circle of this.collisionCircles) {
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
    if (Math.abs(position.x) > 15.5 || position.z < -101 || position.z > 37) return true;
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
    const carDistance = playerPosition.distanceTo(this.vehicle.position);
    const survivorDistance = playerPosition.distanceTo(WORLD.survivor);
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
    if (this.mission.phase === MISSION_PHASES.FIND_SURVIVOR
      && playerPosition.distanceTo(WORLD.survivor) < 3.5) {
      this.ui.setPrompt('Rescue survivor');
    } else if (playerPosition.distanceTo(this.vehicle.position) < 4) {
      this.ui.setPrompt('Enter vehicle');
    } else {
      this.ui.setPrompt('');
    }
  }

  _updateMission() {
    if (this.mission.phase === MISSION_PHASES.REACH_STATION
      && this.vehicle.position.distanceTo(WORLD.station) < 12) {
      this.mission.reachStation();
    }
    if (this.mission.phase === MISSION_PHASES.REACH_ESCAPE
      && this.vehicle.position.distanceTo(WORLD.escape) < 4) {
      const score = this.mission.reachEscape();
      if (score !== null) {
        this.ui.showEnd({ complete: true, score });
        this.ui.setPrompt('');
        this.platform.submitScore(score);
      }
    }
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
    const delta = Math.min(0.04, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;
    this.elapsed += delta;

    const terminal = this.mission.phase === MISSION_PHASES.COMPLETE || this.mission.phase === MISSION_PHASES.FAILED;
    if (!terminal) {
      if (this.interactionRequested) this._interact();
      if (this.driving) {
        this.vehicle.update(delta, this.keys, (position) => this._resolveVehicleCollision(position));
        this.infected.update(delta, null, () => {});
        if (this.infected.active
          && this.vehicle.position.distanceTo(this.infected.group.position) < 2.1
          && Math.abs(this.vehicle.velocity) > 3) {
          this.infected.escape();
          this.ui.showToast('Infected neutralized.');
        }
      } else {
        this.player.update(delta, this.keys, this.cameraYaw, (position) => this._resolveOnFootCollision(position));
        this.infected.update(delta, this.player, (damage) => {
          if (this.player.damage(damage)) {
            this.ui.setHealth(this.player.health);
            this.ui.showToast('Infected attack. Keep moving.');
            if (this.player.health <= 0 && this.mission.fail()) {
              this.ui.showEnd({ complete: false });
              this.ui.setPrompt('');
            }
          }
        });
      }

      this._updateMission();
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
    this.ui.setTime(this.elapsed);
    this.radioTimer += delta;
    if (this.radioTimer > 38) {
      this.radioTimer = 0;
      this.radioIndex += 1;
      this.ui.radio(this.radioIndex);
    }
    this.survivorMarker.rotation.z += delta * 0.55;
    this.escapeMarker.rotation.z -= delta * 0.25;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._frame);
  };

  _onResize = () => this._resize();

  _onKeyDown = (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (event.code === 'KeyE' && !event.repeat) this.interactionRequested = true;
    if (event.code === 'Escape' && !document.getElementById('leaderboard-screen').hidden) this.ui.closeLeaderboard();
    this.keys.add(event.code);
  };

  _onKeyUp = (event) => this.keys.delete(event.code);
  _onBlur = () => {
    this.keys.clear();
    this.dragging = false;
  };
  _onContextMenu = (event) => event.preventDefault();
  _onPointerDown = (event) => {
    if (event.button === 2) this.dragging = true;
  };
  _onPointerUp = () => {
    this.dragging = false;
  };
  _onPointerMove = (event) => {
    if (this.dragging && !this.driving) this.cameraYaw -= event.movementX * 0.004;
  };
}
