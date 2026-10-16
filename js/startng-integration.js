const START_NG = 'https://start.ng';
const API = 'https://api.start.ng';

export class StartNgIntegration {
  constructor(ui, onPlayer = () => {}) {
    this.ui = ui;
    this.onPlayer = onPlayer;
    this.framePromise = null;
    this.player = null;
    this.authenticated = false;
    this.scoreSubmitted = false;
    this.connected = false;
    this.gameName = location.hostname.endsWith('.start.ng')
      ? location.hostname.slice(0, -'.start.ng'.length)
      : null;
    this.session = null;

    const params = new URLSearchParams(location.hash.slice(1));
    const session = params.get('startng_session');
    if (session) {
      sessionStorage.setItem('startng_session', session);
      history.replaceState(null, '', location.pathname + location.search);
    }
    this.session = sessionStorage.getItem('startng_session');
  }

  async initialize() {
    this.ui.setPlayer({ name: 'Guest' }, false);
    if (this.gameName) {
      this._setSignInLink();
      addEventListener('focus', () => this.refreshIdentity());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.refreshIdentity();
      });
      await this.refreshIdentity();
      return;
    }
    this.ui.setLeaderboardMessage('Live identity and records are available after the game is published on start.ng.');
    document.getElementById('identity-status').textContent = 'LOCAL PREVIEW';
  }

  _setSignInLink() {
    const signIn = document.getElementById('sign-in');
    signIn.href = `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
  }

  async _connectFrame() {
    if (!this.framePromise) {
      this.framePromise = new Promise((resolve, reject) => {
        const frame = document.createElement('iframe');
        frame.src = `${START_NG}/connect`;
        frame.hidden = true;
        frame.onload = () => resolve(frame);
        frame.onerror = () => reject(new Error('Could not load the start.ng connect frame.'));
        document.body.append(frame);
      });
    }
    return this.framePromise;
  }

  async _ask(message, replyType, timeoutMs = 5000) {
    const frame = await this._connectFrame();
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).slice(2);
      const finish = (reply) => {
        clearTimeout(timer);
        removeEventListener('message', onMessage);
        resolve(reply);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);
      const onMessage = (event) => {
        if (event.origin !== START_NG || event.source !== frame.contentWindow) return;
        if (event.data?.type === replyType && event.data.requestId === requestId) finish(event.data);
      };
      addEventListener('message', onMessage);
      frame.contentWindow.postMessage({ ...message, requestId }, START_NG);
    });
  }

  async refreshIdentity() {
    try {
      const reply = await this._ask({ type: 'startng:whoami' }, 'startng:user');
      if (!reply) {
        this.connected = false;
        document.getElementById('identity-status').textContent = 'OFFLINE';
        this.ui.showToast('start.ng did not respond. Playing without a connected account.');
        return;
      }
      this.connected = true;
      this.player = reply.user ?? reply.guest ?? null;
      this.authenticated = Boolean(reply.user);
      this.ui.setPlayer(this.player, this.authenticated);
      if (this.player?.style) this.onPlayer(this.player);
    } catch (error) {
      console.error('start.ng identity connection failed:', error);
      document.getElementById('identity-status').textContent = 'OFFLINE';
      this.ui.showToast('Could not connect to start.ng. The game remains playable as a guest.');
    }
  }

  async submitScore(score) {
    if (this.scoreSubmitted) return;
    this.scoreSubmitted = true;
    if (!this.gameName || !this.connected || !this.authenticated) {
      this.ui.showToast('Run complete. Sign in on start.ng to save a global score.');
      return;
    }
    try {
      const reply = await this._ask({ type: 'startng:score', score }, 'startng:scoreSaved');
      if (!reply?.ok) {
        this.ui.showToast('Your run finished, but start.ng did not save the score.');
        return;
      }
      const rank = Number.isInteger(reply.result?.rank) ? ` // FIELD RANK #${reply.result.rank}` : '';
      this.ui.showToast(`Score recorded${rank}.`);
    } catch (error) {
      console.error('start.ng score submission failed:', error);
      this.ui.showToast('Your run finished, but the score could not reach start.ng.');
    }
  }

  async showLeaderboard() {
    this.ui.openLeaderboard();
    if (!this.gameName) {
      this.ui.setLeaderboardMessage('Live scores are shown on the published start.ng game. This local preview uses no mock leaderboard.');
      return;
    }
    try {
      const response = await fetch(`${API}/games/${encodeURIComponent(this.gameName)}/leaderboard?limit=10`);
      if (!response.ok) throw new Error(`start.ng leaderboard returned HTTP ${response.status}.`);
      const entries = await response.json();
      if (!Array.isArray(entries)) throw new Error('start.ng returned an invalid leaderboard response.');
      this.ui.setLeaderboard(entries, this.player?.id ?? null);
    } catch (error) {
      console.error('start.ng leaderboard request failed:', error);
      this.ui.setLeaderboardMessage('The live start.ng leaderboard could not be loaded. Check the connection and try again.');
    }
  }
}
