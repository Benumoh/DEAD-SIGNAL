import * as THREE from '../assets/vendor/three.module.js';

export class Infected {
  constructor(position) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.active = true;
    this.attackCooldown = 0;
    this.speed = 5.3;
    this._build();
  }

  _build() {
    const skin = new THREE.MeshStandardMaterial({ color: '#63715c', roughness: 1 });
    const tornClothes = new THREE.MeshStandardMaterial({ color: '#493d39', roughness: 1 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.72, 3, 7), tornClothes);
    body.position.y = 1.03;
    body.castShadow = true;
    this.group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 10, 8), skin);
    head.position.y = 1.8;
    head.castShadow = true;
    this.group.add(head);
    const eyes = new THREE.MeshStandardMaterial({ color: '#d58a60', emissive: '#9a3a2d', emissiveIntensity: 0.3 });
    for (const x of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), eyes);
      eye.position.set(x, 1.82, -0.26);
      this.group.add(eye);
    }
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 3, 6), tornClothes);
      arm.position.set(side * 0.49, 1.12, -0.18);
      arm.rotation.x = -0.5;
      arm.rotation.z = side * 0.17;
      arm.castShadow = true;
      this.group.add(arm);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.58, 0.25), tornClothes);
      leg.position.set(side * 0.17, 0.36, 0);
      this.group.add(leg);
    }
  }

  update(delta, target, onAttack) {
    if (!this.active) return;
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    if (!target) return;
    const offset = target.position.clone().sub(this.group.position);
    const distance = offset.length();
    if (distance < 23 && distance > 1.35) {
      offset.y = 0;
      offset.normalize();
      this.group.position.addScaledVector(offset, this.speed * delta);
      this.group.rotation.y = Math.atan2(offset.x, -offset.z);
    } else if (distance <= 1.35 && this.attackCooldown <= 0) {
      this.attackCooldown = 1.8;
      onAttack(8);
    }
  }

  escape() {
    this.active = false;
    this.group.visible = false;
  }
}
