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

    const lampMat = new THREE.MeshStandardMaterial({ color: '#f1e9b8', emissive: '#a99c5d', emissiveIntensity: 0.5 });
    for (const x of [-0.71, 0.71]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.07), lampMat);
      lamp.position.set(x, 0.96, -2.07);
      this.group.add(lamp);
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

  get speedMph() {
    return Math.round(Math.abs(this.velocity) * 2.237);
  }
}
