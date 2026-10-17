const STICK_RADIUS = 52;
const STICK_DEADZONE = 0.32;
const LOOK_SENSITIVITY = 0.0055;

// Feeds the same key set and interaction flag the keyboard uses, so touch adds no second input path.
export class TouchControls {
  constructor(game) {
    this.game = game;
    this.enabled = false;
    this.root = document.getElementById('touch-controls');
    this.stick = document.getElementById('touch-stick');
    this.knob = document.getElementById('touch-knob');
    this.stickKeys = new Set();
    this.stickPointer = null;
    this.lookPointer = null;
    this.lastLook = { x: 0, y: 0 };

    this._bindStick();
    this._bindButtons();
    this._bindLook();
    this._observeVisibility();

    const query = new URLSearchParams(location.search);
    if (matchMedia('(pointer: coarse)').matches || query.has('touch')) this.enable();
    addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') this.enable();
    }, { passive: true });
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;
    document.body.classList.add('touch-mode');
  }

  reset() {
    for (const code of this.stickKeys) this.game.keys.delete(code);
    this.stickKeys.clear();
    for (const button of this.root.querySelectorAll('[data-touch-key]')) {
      this.game.keys.delete(button.dataset.touchKey);
      button.classList.remove('active');
    }
    this.stickPointer = null;
    this.lookPointer = null;
    this.knob.style.transform = '';
  }

  _active() {
    return this.game.runActive && !this.game.paused;
  }

  _bindStick() {
    const move = (event) => {
      const rect = this.stick.getBoundingClientRect();
      let dx = event.clientX - (rect.left + rect.width / 2);
      let dy = event.clientY - (rect.top + rect.height / 2);
      const length = Math.hypot(dx, dy);
      if (length > STICK_RADIUS) {
        dx = (dx / length) * STICK_RADIUS;
        dy = (dy / length) * STICK_RADIUS;
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const x = dx / STICK_RADIUS;
      const y = dy / STICK_RADIUS;
      this._setStickKey('KeyW', y < -STICK_DEADZONE);
      this._setStickKey('KeyS', y > STICK_DEADZONE);
      this._setStickKey('KeyA', x < -STICK_DEADZONE);
      this._setStickKey('KeyD', x > STICK_DEADZONE);
    };
    const release = (event) => {
      if (event.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      this.knob.style.transform = '';
      for (const code of this.stickKeys) this.game.keys.delete(code);
      this.stickKeys.clear();
    };
    this.stick.addEventListener('pointerdown', (event) => {
      if (!this._active() || this.stickPointer !== null) return;
      event.preventDefault();
      this.stickPointer = event.pointerId;
      this.stick.setPointerCapture(event.pointerId);
      move(event);
    });
    this.stick.addEventListener('pointermove', (event) => {
      if (event.pointerId === this.stickPointer) move(event);
    });
    this.stick.addEventListener('pointerup', release);
    this.stick.addEventListener('pointercancel', release);
  }

  _setStickKey(code, on) {
    if (on) {
      this.stickKeys.add(code);
      this.game.keys.add(code);
    } else if (this.stickKeys.delete(code)) {
      this.game.keys.delete(code);
    }
  }

  _bindButtons() {
    for (const button of this.root.querySelectorAll('[data-touch-key]')) {
      const code = button.dataset.touchKey;
      const toggle = button.dataset.toggle === 'true';
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        if (!this._active()) return;
        if (toggle) {
          const on = !this.game.keys.has(code);
          if (on) this.game.keys.add(code);
          else this.game.keys.delete(code);
          button.classList.toggle('active', on);
          return;
        }
        if (code === 'KeyE') this.game.interactionRequested = true;
        this.game.keys.add(code);
        button.classList.add('active');
      });
      if (!toggle) {
        const release = () => {
          this.game.keys.delete(code);
          button.classList.remove('active');
        };
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('pointerleave', release);
      }
    }
  }

  // One-finger drag anywhere outside the controls and menus rotates the on-foot camera.
  _bindLook() {
    addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch' || !this._active() || this.lookPointer !== null) return;
      if (event.target.closest('.touch-controls, .pause-button, .board-button, .screen, .menu-nav, a')) return;
      this.lookPointer = event.pointerId;
      this.lastLook = { x: event.clientX, y: event.clientY };
    });
    addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.lookPointer) return;
      if (this._active() && !this.game.driving) {
        this.game.cameraYaw -= (event.clientX - this.lastLook.x) * LOOK_SENSITIVITY;
      }
      this.lastLook = { x: event.clientX, y: event.clientY };
    });
    const end = (event) => {
      if (event.pointerId === this.lookPointer) this.lookPointer = null;
    };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
  }

  _observeVisibility() {
    const observer = new MutationObserver(() => {
      if (this.root.hidden) this.reset();
    });
    observer.observe(this.root, { attributes: true, attributeFilter: ['hidden'] });
  }
}
