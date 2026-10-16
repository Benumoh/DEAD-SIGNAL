import * as THREE from '../assets/vendor/three.module.js';

function material(color, roughness = 0.86) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function safeColor(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export class Player {
  constructor(style = null) {
    this.group = new THREE.Group();
    this.group.name = 'start.ng survivor character';
    this.speed = 4.2;
    this.sprintSpeed = 7.2;
    this.yaw = 0;
    this.health = 100;
    this.invulnerable = 0;
    this.moving = false;
    this._build(style);
  }

  _build(style) {
    const shirt = material(safeColor(style?.primaryColor, '#657466'));
    const trousers = material(safeColor(style?.secondaryColor, '#353d3a'));
    const skin = material(safeColor(style?.skinColor, '#bd8d70'));
    const hair = material(safeColor(style?.hairColor, '#241e1a'));
    const boot = material('#282b28');
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.68, 4, 8), shirt);
    if (style?.body === 'female') body.scale.x = 0.92;
    body.position.y = 1.03;
    body.castShadow = true;
    this.group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 10), skin);
    head.position.y = 1.79;
    head.castShadow = true;
    this.group.add(head);

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.52, 0.31), trousers);
    legs.position.y = 0.38;
    legs.castShadow = true;
    this.group.add(legs);

    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.45, 3, 6), shirt);
      arm.position.set(side * 0.48, 1.03, 0);
      arm.rotation.z = side * -0.12;
      arm.castShadow = true;
      this.group.add(arm);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.14, 0.36), boot);
      shoe.position.set(side * 0.16, 0.08, -0.03);
      shoe.castShadow = true;
      this.group.add(shoe);
    }

    const hairStyle = style?.hair;
    if ((hairStyle && hairStyle !== 'bald') || !style) {
      const capGeometry = new THREE.SphereGeometry(0.3, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2);
      const cap = new THREE.Mesh(capGeometry, hair);
      cap.position.set(0, 1.91, -0.015);
      cap.castShadow = true;
      this.group.add(cap);
      if (hairStyle === 'afro') {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), hair);
        puff.position.y = 1.9;
        puff.castShadow = true;
        this.group.add(puff);
      } else if (hairStyle === 'braids' || hairStyle === 'dreads') {
        for (const side of [-1, 1]) {
          for (const strand of [-1, 0, 1]) {
            const braid = new THREE.Mesh(
              new THREE.CylinderGeometry(0.045, 0.055, hairStyle === 'dreads' ? 0.75 : 0.62, 6),
              hair,
            );
            braid.position.set(side * (0.18 + Math.abs(strand) * 0.045), 1.66, strand * 0.11 + 0.02);
            braid.castShadow = true;
            this.group.add(braid);
          }
        }
      } else if (hairStyle === 'bun') {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 7), hair);
        bun.position.set(0, 1.92, 0.24);
        this.group.add(bun);
      } else if (hairStyle === 'ponytail') {
        const ponytail = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.48, 7), hair);
        ponytail.position.set(0, 1.66, 0.26);
        ponytail.rotation.x = -0.32;
        this.group.add(ponytail);
      }
    }

    const hat = style?.hat;
    if (hat && hat !== 'none') {
      const hatMat = material(hat === 'crown' ? '#c7a94c' : '#3b4541');
      if (hat === 'tophat') {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 8), hatMat);
        top.position.y = 2.2;
        this.group.add(top);
      } else if (hat === 'crown') {
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.31, 0.22, 8), hatMat);
        crown.position.y = 2.09;
        this.group.add(crown);
      } else {
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.29, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
        crown.position.y = 1.98;
        this.group.add(crown);
        if (hat === 'cap') {
          const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.18), hatMat);
          brim.position.set(0, 1.98, -0.28);
          this.group.add(brim);
        }
      }
    }
    if (style?.accessory === 'backpack') {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.5, 0.22), material('#514638'));
      pack.position.set(0, 1.08, 0.32);
      this.group.add(pack);
    } else if (style?.accessory === 'glasses') {
      const frames = material('#252a28');
      for (const side of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.035), frames);
        lens.position.set(side * 0.105, 1.82, -0.26);
        this.group.add(lens);
      }
    } else if (style?.accessory === 'beard') {
      const beard = new THREE.Mesh(new THREE.SphereGeometry(0.2, 9, 7), hair);
      beard.scale.set(1, 0.65, 0.75);
      beard.position.set(0, 1.62, -0.15);
      this.group.add(beard);
    } else if (style?.accessory === 'earrings') {
      const earringMat = material('#d2b66d', 0.35);
      for (const side of [-1, 1]) {
        const earring = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 5), earringMat);
        earring.position.set(side * 0.28, 1.68, -0.01);
        this.group.add(earring);
      }
    } else if (style?.accessory === 'scarf') {
      const scarf = new THREE.Mesh(
        new THREE.TorusGeometry(0.25, 0.09, 5, 10),
        material('#a05242'),
      );
      scarf.position.y = 1.43;
      scarf.rotation.x = Math.PI / 2;
      this.group.add(scarf);
    }
  }

  setStyle(style) {
    this.group.clear();
    this._build(style);
  }

  update(delta, keys, cameraYaw, resolveCollision) {
    const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
    const sideways = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
    const input = new THREE.Vector2(sideways, forward);
    if (input.lengthSq() > 1) input.normalize();
    this.moving = input.lengthSq() > 0;

    if (this.moving) {
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? this.sprintSpeed : this.speed;
      const sin = Math.sin(cameraYaw);
      const cos = Math.cos(cameraYaw);
      const dx = (input.x * cos - input.y * sin) * speed * delta;
      const dz = (input.x * sin - input.y * cos) * speed * delta;
      const old = this.group.position.clone();
      this.group.position.x += dx;
      this.group.position.z += dz;
      resolveCollision(this.group.position);
      const moved = this.group.position.clone().sub(old);
      if (moved.lengthSq() > 0.0001) this.yaw = Math.atan2(moved.x, -moved.z);
    }

    this.invulnerable = Math.max(0, this.invulnerable - delta);
    this.group.rotation.y = this.yaw;
    this.group.visible = this.invulnerable <= 0 || Math.floor(this.invulnerable * 12) % 2 === 0;
  }

  damage(amount) {
    if (this.invulnerable > 0 || this.health <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.invulnerable = 0.75;
    return true;
  }

  get position() {
    return this.group.position;
  }
}
