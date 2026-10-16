import * as THREE from '../assets/vendor/three.module.js';

export class Infected {
  constructor(position, variant = 0) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.active = true;
    this.attackCooldown = 0;
    this.speed = 5.3;
    this.aggroRange = 23;
    this.walkPhase = 0;
    this.legs = [];
    this.arms = [];
    this.variant = variant;
    this._build();
  }

  _build() {
    const skinTones = ['#63715c', '#756b59', '#6e7772'];
    const clothes = ['#493d39', '#343a38', '#51473d'];
    const skin = new THREE.MeshStandardMaterial({ color: skinTones[this.variant % skinTones.length], roughness: 1 });
    const tornClothes = new THREE.MeshStandardMaterial({ color: clothes[this.variant % clothes.length], roughness: 1 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.72, 4, 8), tornClothes);
    body.position.y = 1.03;
    body.castShadow = true;
    this.group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 10, 8), skin);
    head.position.y = 1.8;
    head.castShadow = true;
    this.group.add(head);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.2), skin);
    jaw.position.set(0, 1.58, -0.2);
    this.group.add(jaw);

    const eyes = new THREE.MeshStandardMaterial({ color: '#d58a60', emissive: '#9a3a2d', emissiveIntensity: 0.3 });
    for (const x of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), eyes);
      eye.position.set(x, 1.82, -0.26);
      this.group.add(eye);
    }

    this.legs = [];
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 3, 6), tornClothes);
      arm.position.set(side * 0.49, 1.12, -0.18);
      arm.rotation.x = -0.5;
      arm.rotation.z = side * 0.17;
      arm.castShadow = true;
      this.group.add(arm);
      this.arms.push(arm);

      const leg = new THREE.Group();
      leg.position.set(side * 0.17, 0.66, 0);
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.38, 3, 6), tornClothes);
      shin.position.y = -0.24;
      shin.castShadow = true;
      leg.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.13, 0.37), tornClothes);
      foot.position.set(0, -0.53, -0.06);
      foot.castShadow = true;
      leg.add(foot);
      this.group.add(leg);
      this.legs.push(leg);
    }
  }

  update(delta, target, onAttack) {
    if (!this.active) return;
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    let walking = false;
    if (target) {
      const offset = target.position.clone().sub(this.group.position);
      const distance = offset.length();
      if (distance < this.aggroRange && distance > 1.35) {
        offset.y = 0;
        offset.normalize();
        this.group.position.addScaledVector(offset, this.speed * delta);
        this.group.rotation.y = Math.atan2(offset.x, -offset.z);
        walking = true;
      } else if (distance <= 1.35 && this.attackCooldown <= 0) {
        this.attackCooldown = 1.8;
        onAttack(8);
      }
    }
    const gait = walking ? Math.sin(this.walkPhase += delta * 10) : 0;
    for (let index = 0; index < this.legs.length; index += 1) {
      this.legs[index].rotation.x = gait * (index === 0 ? 0.5 : -0.5);
    }
    for (let index = 0; index < this.arms.length; index += 1) {
      this.arms[index].rotation.x = -0.5 + gait * (index === 0 ? -0.12 : 0.12);
    }
  }

  reset(position) {
    this.group.position.copy(position);
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
    this.active = true;
    this.attackCooldown = 0;
    this.walkPhase = 0;
    for (const leg of this.legs) leg.rotation.x = 0;
    for (const arm of this.arms) arm.rotation.x = -0.5;
  }

  escape() {
    this.active = false;
    this.group.visible = false;
  }
}
