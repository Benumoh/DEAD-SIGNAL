import * as THREE from '../assets/vendor/three.module.js';

const paint = (color, roughness = 0.58) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.12 });

export class Vehicle {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'rescue vehicle';
    this.position = this.group.position;
    this.velocity = 0;
    this.maxSpeed = 22;
    this.maxReverse = -8;
    this.steering = 0;
    this.brakeLamps = [];
    this.headlights = [];
    this._build();
  }

  _build() {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.8, 4.1), paint('#74776c'));
    body.position.y = 0.8;
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.24, 1.2), paint('#878779'));
    hood.position.set(0, 1.2, -1.25);
    hood.castShadow = true;
    this.group.add(hood);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.72, 1.85), paint('#363f3c', 0.32));
    cabin.position.set(0, 1.43, 0.25);
    cabin.castShadow = true;
    this.group.add(cabin);

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.16, 0.18), paint('#555a52', 0.72));
    bumper.position.set(0, 0.45, -2.05);
    bumper.castShadow = true;
    this.group.add(bumper);
    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.34, 0.06),
      new THREE.MeshStandardMaterial({ color: '#242a27', roughness: 0.82, metalness: 0.25 }),
    );
    grille.position.set(0, 0.86, -2.09);
    this.group.add(grille);
    const grilleBars = paint('#73766c', 0.48);
    for (let y = 0; y < 3; y += 1) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.025, 0.025), grilleBars);
      bar.position.set(0, 0.76 + y * 0.09, -2.13);
      this.group.add(bar);
    }
    const rust = new THREE.MeshStandardMaterial({ color: '#754735', roughness: 1 });
    for (const side of [-1, 1]) {
      const scrape = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.17, 0.52), rust);
      scrape.position.set(side * 1.055, 0.8, -0.08);
      scrape.rotation.y = side * 0.08;
      this.group.add(scrape);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.055, 0.035), paint('#373d39', 0.5));
      handle.position.set(side * 0.84, 1.1, -0.23);
      this.group.add(handle);
    }

    const glassMat = new THREE.MeshStandardMaterial({ color: '#8b9b91', roughness: 0.24, metalness: 0.2, transparent: true, opacity: 0.7 });
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.46, 0.55), glassMat);
    windshield.position.set(0, 1.55, -0.69);
    windshield.rotation.x = -0.18;
    this.group.add(windshield);

    const tireMat = paint('#202421');
    const rimMat = paint('#999b8e', 0.42);
    this.wheels = [];
    for (const x of [-0.95, 0.95]) {
      for (const z of [-1.32, 1.32]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.24, 12), tireMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.43, z);
        wheel.castShadow = true;
        this.group.add(wheel);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.25, 10), rimMat);
        rim.rotation.z = Math.PI / 2;
        rim.position.copy(wheel.position);
        this.group.add(rim);
        this.wheels.push(wheel, rim);
      }
    }

    const lampMat = new THREE.MeshStandardMaterial({ color: '#f1e9b8', emissive: '#e7d391', emissiveIntensity: 1.2 });
    for (const x of [-0.71, 0.71]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.07), lampMat);
      lamp.position.set(x, 0.96, -2.07);
      this.group.add(lamp);

      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 29, 14, 1, true),
        new THREE.MeshBasicMaterial({
          color: '#e5d9b6',
          transparent: true,
          opacity: 0.045,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      beam.rotation.x = -Math.PI / 2;
      beam.position.set(x * 0.9, 0.82, -16.2);
      this.group.add(beam);

      const headlight = new THREE.SpotLight('#f5e7bd', 20, 34, Math.PI / 7, 0.55, 1.5);
      headlight.position.set(x * 0.9, 0.87, -2.1);
      headlight.target.position.set(x, 0.15, -24);
      this.group.add(headlight, headlight.target);
      this.headlights.push(headlight);
    }

    const rearLampMat = new THREE.MeshStandardMaterial({
      color: '#8e3a30',
      emissive: '#681a14',
      emissiveIntensity: 0.65,
    });
    for (const x of [-0.72, 0.72]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.06), rearLampMat);
      lamp.position.set(x, 0.98, 2.07);
      this.group.add(lamp);
      this.brakeLamps.push(lamp);
    }
  }

  update(delta, keys, resolveCollision) {
    const throttle = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
    const brake = keys.has('Space');
    if (throttle !== 0) {
      this.velocity += throttle * 13 * delta;
    } else {
      this.velocity *= Math.exp(-(brake ? 5.5 : 3) * delta);
    }
    this.velocity = THREE.MathUtils.clamp(this.velocity, this.maxReverse, this.maxSpeed);
    this.steering = Number(keys.has('KeyA')) - Number(keys.has('KeyD'));

    const speedFactor = Math.min(1, Math.abs(this.velocity) / 3);
    this.group.rotation.y += this.steering * speedFactor * delta * 1.25 * Math.sign(this.velocity || 1);
    this.group.rotation.z = THREE.MathUtils.lerp(
      this.group.rotation.z,
      -this.steering * speedFactor * 0.035,
      1 - Math.exp(-delta * 5),
    );
    const braking = keys.has('Space') || throttle < 0;
    for (const lamp of this.brakeLamps) lamp.material.emissiveIntensity = braking ? 2 : 0.65;
    const old = this.position.clone();
    const dx = Math.sin(this.group.rotation.y) * this.velocity * delta;
    const dz = -Math.cos(this.group.rotation.y) * this.velocity * delta;
    this.position.x += dx;
    this.position.z += dz;
    if (resolveCollision(this.position)) {
      this.position.copy(old);
      this.velocity *= -0.2;
    }
    for (const wheel of this.wheels) wheel.rotation.x += this.velocity * delta / 0.39;
  }

  reset(position) {
    this.position.copy(position);
    this.group.rotation.set(0, 0, 0);
    this.velocity = 0;
    this.steering = 0;
    for (const lamp of this.brakeLamps) lamp.material.emissiveIntensity = 0.65;
    for (const wheel of this.wheels) wheel.rotation.x = 0;
  }

  get speedMph() {
    return Math.round(Math.abs(this.velocity) * 2.237);
  }
}
