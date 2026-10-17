// Procedural audio built with the Web Audio API, so the game ships no audio files.
// The context is created on the first user gesture because browsers block autoplay.
const STORAGE_KEY = 'dead-signal:muted';

const MOOD_ROOTS = Object.freeze({
  menu: 55,
  county: 55,
  settlement: 49,
  highway: 58.27,
  bridge: 43.65,
  ruins: 46.25,
  forest: 51.91,
  checkpoint: 61.74,
  industrial: 41.2,
  mountain: 48.99,
});

// Minor-pentatonic ratios used for the sparse eerie notes.
const SCALE = [1, 1.2, 1.333, 1.5, 1.8, 2, 2.4, 3];

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try {
      this.muted = globalThis.localStorage?.getItem(STORAGE_KEY) === '1';
    } catch (error) {
      console.error('Sound preference storage is unavailable.', error);
    }
    this.root = MOOD_ROOTS.menu;
    this.ducked = false;
    this.threat = 0;
    this.beatTimer = 1;
    this.beatCount = 0;
    this.stepTimer = 0;
    this.growlTimer = 2;
  }

  get available() {
    return Boolean(this.ctx);
  }

  unlock() {
    if (!this.ctx) {
      const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      if (!Context) return;
      try {
        this.ctx = new Context();
      } catch (error) {
        console.error('Audio could not start.', error);
        return;
      }
      this._build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  _build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.75;
    this.sfxBus.connect(this.master);

    const length = ctx.sampleRate * 2;
    this.noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;

    this._buildMusic();
    this._buildEngine();
  }

  _noiseSource(loop = false) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = loop;
    return source;
  }

  _buildMusic() {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.connect(this.musicBus);
    this.droneA = ctx.createOscillator();
    this.droneA.type = 'sawtooth';
    this.droneB = ctx.createOscillator();
    this.droneB.type = 'triangle';
    this.droneA.frequency.value = this.root;
    this.droneB.frequency.value = this.root * 1.498;
    this.droneB.detune.value = 7;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.22;
    this.droneA.connect(droneGain);
    this.droneB.connect(droneGain);
    droneGain.connect(filter);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 170;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);
    this.droneFilter = filter;

    const wind = this._noiseSource(true);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 380;
    windFilter.Q.value = 0.8;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.07;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.musicBus);
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.11;
    const windDepth = ctx.createGain();
    windDepth.gain.value = 160;
    windLfo.connect(windDepth);
    windDepth.connect(windFilter.frequency);

    for (const node of [this.droneA, this.droneB, lfo, wind, windLfo]) node.start();
  }

  _buildEngine() {
    const ctx = this.ctx;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    this.engineA = ctx.createOscillator();
    this.engineA.type = 'sawtooth';
    this.engineB = ctx.createOscillator();
    this.engineB.type = 'square';
    this.engineA.frequency.value = 40;
    this.engineB.frequency.value = 20;
    this.engineA.connect(filter);
    this.engineB.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.sfxBus);
    this.engineA.start();
    this.engineB.start();
    this.engineFilter = filter;
  }

  setMood(name) {
    this.root = MOOD_ROOTS[name] ?? MOOD_ROOTS.menu;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.droneA.frequency.setTargetAtTime(this.root, now, 1.2);
    this.droneB.frequency.setTargetAtTime(this.root * 1.498, now, 1.2);
  }

  setDucked(ducked) {
    this.ducked = ducked;
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, this.muted ? '1' : '0');
    } catch (error) {
      console.error('Sound preference could not be saved.', error);
    }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  // Called every frame with the gameplay state; schedules ambience, engine, steps and growls.
  update(delta, { inRun, running, driving, speedMph, moving, sprinting, threatDistance }) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    // Music and ambience play only during an active run (silent on menus and the debrief).
    this.musicBus.gain.setTargetAtTime(!inRun ? 0 : this.ducked ? 0.1 : 0.34, now, 0.15);
    if (!inRun) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.12);
      this.stepTimer = 0;
      return;
    }
    this.threat = running && threatDistance < 30 ? 1 - threatDistance / 30 : 0;
    this.droneFilter.frequency.setTargetAtTime(420 + this.threat * 500, now, 0.5);

    const interval = 1.7 - this.threat * 1;
    this.beatTimer -= delta;
    if (this.beatTimer <= 0) {
      this.beatTimer = interval;
      this.beatCount += 1;
      this._heartbeat(0.14 + this.threat * 0.2);
      if (this.beatCount % 4 === 0) this._eerieNote();
    }

    const engineOn = running && driving;
    const speed = engineOn ? Math.min(1, speedMph / 70) : 0;
    this.engineGain.gain.setTargetAtTime(engineOn ? 0.05 + speed * 0.07 : 0, now, 0.12);
    this.engineA.frequency.setTargetAtTime(38 + speed * 95, now, 0.1);
    this.engineB.frequency.setTargetAtTime(19 + speed * 48, now, 0.1);
    this.engineFilter.frequency.setTargetAtTime(280 + speed * 520, now, 0.1);

    if (running && !driving && moving) {
      this.stepTimer -= delta;
      if (this.stepTimer <= 0) {
        this.stepTimer = sprinting ? 0.32 : 0.5;
        this._step();
      }
    } else {
      this.stepTimer = 0;
    }

    if (running && threatDistance < 14) {
      this.growlTimer -= delta;
      if (this.growlTimer <= 0) {
        this.growlTimer = 2.5 + Math.random() * 2.5;
        this.growl();
      }
    }
  }

  _tone({ type = 'sine', from, to = from, duration, gain = 0.2, attack = 0.005, delay = 0, bus = this.sfxBus, filter = null }) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    let node = osc;
    if (filter) {
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = filter;
      osc.connect(lowpass);
      node = lowpass;
    }
    node.connect(env);
    env.connect(bus);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  _burst({ duration, gain, filter, delay = 0, type = 'lowpass' }) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const start = ctx.currentTime + delay;
    const source = this._noiseSource();
    const biquad = ctx.createBiquadFilter();
    biquad.type = type;
    biquad.frequency.value = filter;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(biquad);
    biquad.connect(env);
    env.connect(this.sfxBus);
    source.start(start, Math.random());
    source.stop(start + duration + 0.05);
  }

  _heartbeat(gain) {
    this._tone({ from: 62, to: 38, duration: 0.28, gain, attack: 0.01, bus: this.musicBus });
  }

  _eerieNote() {
    const note = this.root * 4 * SCALE[Math.floor(Math.random() * SCALE.length)];
    this._tone({ from: note, to: note * 0.995, duration: 3.2, gain: 0.05, attack: 1.1, bus: this.musicBus });
  }

  _step() {
    this._burst({ duration: 0.09, gain: 0.16, filter: 500 + Math.random() * 400 });
  }

  growl() {
    this._tone({ type: 'sawtooth', from: 78 + Math.random() * 20, to: 46, duration: 0.8, gain: 0.13, attack: 0.08, filter: 380 });
  }

  click() {
    this._tone({ type: 'square', from: 520, to: 360, duration: 0.06, gain: 0.07 });
  }

  tick(final = false) {
    this._tone({ type: 'sine', from: final ? 1180 : 780, duration: final ? 0.28 : 0.12, gain: 0.14 });
  }

  chime() {
    this._tone({ from: 660, duration: 0.35, gain: 0.14 });
    this._tone({ from: 990, duration: 0.5, gain: 0.12, delay: 0.1 });
  }

  pickup() {
    this._tone({ type: 'triangle', from: 440, to: 880, duration: 0.18, gain: 0.16 });
  }

  hit() {
    this._burst({ duration: 0.22, gain: 0.3, filter: 900 });
    this._tone({ from: 130, to: 45, duration: 0.3, gain: 0.3 });
  }

  thump() {
    this._burst({ duration: 0.16, gain: 0.2, filter: 600 });
    this._tone({ from: 95, to: 40, duration: 0.2, gain: 0.25 });
  }

  success() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
      this._tone({ type: 'triangle', from: freq, duration: 0.6, gain: 0.15, delay: index * 0.14 });
    });
  }

  fail() {
    [330, 262, 208, 156].forEach((freq, index) => {
      this._tone({ type: 'sawtooth', from: freq, to: freq * 0.9, duration: 0.7, gain: 0.1, delay: index * 0.2, filter: 700 });
    });
  }
}
