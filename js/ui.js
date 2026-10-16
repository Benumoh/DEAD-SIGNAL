const byId = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.objective = byId('objective');
    this.prompt = byId('interaction-prompt');
    this.toast = byId('toast');
    this.toastTimer = null;
    this.lastRadioAt = 0;
    this.radioLines = [
      '“...anyone on this frequency, keep your headlights low.”',
      '“County road is blocked northbound. Service station still has power.”',
      '“You hear that? The dispatch keeps repeating a call sign that was retired years ago.”',
      '“If you found someone, get them south. Do not answer the second voice.”',
    ];
  }

  setObjective(text) {
    this.objective.textContent = text;
  }

  setPrompt(text) {
    if (!text) {
      this.prompt.hidden = true;
      return;
    }
    this.prompt.innerHTML = `<kbd>E</kbd>${text}`;
    this.prompt.hidden = false;
  }

  setHealth(value) {
    const percentage = Math.max(0, Math.min(100, value));
    byId('health-value').textContent = `${percentage}%`;
    byId('health-bar').style.width = `${percentage}%`;
    byId('health-bar').style.background = percentage < 35 ? '#cf6654' : '#c4dc86';
  }

  setVehicleState(driving, speed = 0) {
    byId('vehicle-state').textContent = driving ? 'DRIVING' : 'ON FOOT';
    byId('speed-value').innerHTML = `${speed} <small>MPH</small>`;
  }

  setTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
    byId('mission-clock').textContent = `${minutes}:${remainder}`;
  }

  radio(index) {
    const line = this.radioLines[index % this.radioLines.length];
    byId('radio-line').textContent = line;
  }

  showToast(text) {
    this.toast.textContent = text;
    this.toast.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove('visible'), 2600);
  }

  showEnd({ complete, score = null }) {
    byId('end-kicker').textContent = complete ? 'SIGNAL RESTORED' : 'SIGNAL LOST';
    byId('end-title').textContent = complete ? 'YOU MADE IT OUT.' : 'YOU DID NOT MAKE IT OUT.';
    byId('end-message').textContent = complete
      ? 'The survivor is safe. For tonight, that is enough.'
      : 'The emergency band goes quiet. Start a new run and try again.';
    byId('final-score').textContent = complete ? `RESCUE SCORE  //  ${score.toLocaleString()}` : '';
    byId('end-screen').hidden = false;
  }

  hideEnd() {
    byId('end-screen').hidden = true;
  }

  setPlayer(player, authenticated) {
    const name = player?.name || 'Survivor';
    byId('player-name').textContent = name;
    byId('player-account').textContent = authenticated && player.account ? `@${player.account}` : authenticated ? 'START.NG PLAYER' : 'GUEST // NOT SIGNED IN';
    byId('identity-status').textContent = authenticated ? 'CONNECTED' : 'GUEST';
    byId('identity-status').classList.toggle('offline', !authenticated);
    const face = byId('player-face');
    if (player?.face) {
      face.src = player.face;
      face.hidden = false;
    } else {
      face.removeAttribute('src');
      face.hidden = true;
    }
    byId('sign-in').hidden = authenticated || !this._isStartNgHost();
  }

  _isStartNgHost() {
    return location.hostname.endsWith('.start.ng');
  }

  openLeaderboard() {
    byId('leaderboard-screen').hidden = false;
  }

  closeLeaderboard() {
    byId('leaderboard-screen').hidden = true;
  }

  setLeaderboard(entries, playerId) {
    const list = byId('leaderboard-list');
    list.replaceChildren();
    for (const entry of entries) {
      const item = document.createElement('li');
      item.classList.toggle('self', entry.player_id === playerId);
      const name = document.createElement('span');
      name.innerHTML = `<span class="rank">#${entry.rank}</span>${this._escape(entry.name)}`;
      const score = document.createElement('span');
      score.className = 'record-score';
      score.textContent = Number(entry.score).toLocaleString();
      item.append(name, score);
      list.append(item);
    }
    byId('board-note').textContent = entries.length ? 'Live scores from start.ng. Guests can view records.' : 'No rescue runs have been recorded yet.';
  }

  setLeaderboardMessage(text) {
    byId('board-note').textContent = text;
    byId('leaderboard-list').replaceChildren();
  }

  _escape(value) {
    const element = document.createElement('span');
    element.textContent = value;
    return element.innerHTML;
  }
}
