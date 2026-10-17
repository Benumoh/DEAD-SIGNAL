import { CAMPAIGN_MISSIONS } from './missions.js';

const byId = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.objective = byId('objective');
    this.prompt = byId('interaction-prompt');
    this.toast = byId('toast');
    this.toastTimer = null;
    this.scoreRunId = null;
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

  setMissionLocation(text) {
    byId('mission-location').textContent = text;
  }

  setMissionLabel(text) {
    document.querySelector('.brand small').textContent = text;
  }

  setRadioMessage(text, outage = false) {
    byId('radio-line').textContent = text;
    byId('radio').classList.toggle('signal-lost', outage);
  }

  setRadioOutage(active) {
    byId('radio').classList.toggle('signal-lost', active);
    if (active) this.setRadioMessage('CARRIER LOST // Follow the amber emergency lamps.', true);
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

  resetRun() {
    clearTimeout(this.toastTimer);
    this.toast.classList.remove('visible');
    this.scoreRunId = null;
    this.setObjective('Reach the service station.');
    this.setPrompt('');
    this.setHealth(100);
    this.setVehicleState(false);
    this.setTime(0);
    this.setMissionLabel('RESCUE RUN // 01');
    this.setMissionLocation('COUNTY ROAD 09');
    this.setRadioOutage(false);
    this.radio(0);
    this.lastRadioAt = 0;
  }

  radio(index) {
    const line = this.radioLines[index % this.radioLines.length];
    byId('radio-line').textContent = line;
  }

  showToast(text, runId = null) {
    if (runId && this.scoreRunId !== runId) return;
    this.toast.textContent = text;
    this.toast.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove('visible'), 2600);
  }

  showMenu() {
    byId('mission-selection-screen').hidden = true;
    byId('mission-briefing-screen').hidden = true;
    byId('menu-screen').hidden = false;
    byId('leaderboard-button').hidden = true;
    this.setPauseButtonVisible(false);
    this._focusFirst('menu-screen');
  }

  setPauseButtonVisible(visible) {
    byId('pause-button').hidden = !visible;
    byId('touch-controls').hidden = !visible;
  }

  showPause() {
    this.setPauseButtonVisible(false);
    byId('pause-screen').hidden = false;
    this._focusFirst('pause-screen');
  }

  hidePause() {
    byId('pause-screen').hidden = true;
  }

  showCountdown(seconds) {
    byId('countdown-number').textContent = String(seconds);
    byId('resume-countdown').hidden = false;
  }

  hideCountdown() {
    byId('resume-countdown').hidden = true;
  }

  // Moves focus between enabled buttons on the visible full-screen menu.
  navigateScreens(key) {
    const screen = ['menu-screen', 'mission-selection-screen', 'mission-briefing-screen', 'pause-screen', 'end-screen']
      .map(byId)
      .find((element) => !element.hidden);
    if (!screen) return false;
    const buttons = [...screen.querySelectorAll('button:not(:disabled)')];
    if (!buttons.length) return false;
    const direction = key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1;
    const current = buttons.indexOf(buttons.includes(document.activeElement) ? document.activeElement : this.navCurrent);
    const next = current < 0 ? 0 : (current + direction + buttons.length) % buttons.length;
    buttons[next].focus();
    this.navCurrent = buttons[next];
    buttons[next].scrollIntoView({ block: 'nearest' });
    return true;
  }

  // Used by on-screen OK: a tapped nav button may hold focus, so fall back to the last focused menu button.
  activateCurrent() {
    const target = document.activeElement?.closest('.screen button') ?? this.navCurrent;
    if (target && !target.disabled && target.offsetParent !== null) target.click();
  }

  _focusFirst(screenId, selector = 'button:not(:disabled)') {
    const target = byId(screenId).querySelector(selector);
    target?.focus({ preventScroll: true });
    this.navCurrent = target;
  }

  showMissionSelection(campaignMissions, specialOperations, progress, onSelect) {
    byId('menu-screen').hidden = true;
    byId('mission-briefing-screen').hidden = true;
    byId('mission-selection-screen').hidden = false;
    byId('leaderboard-button').hidden = true;
    const campaignList = byId('campaign-mission-list');
    campaignList.replaceChildren();

    const chapters = new Map();
    for (const mission of campaignMissions) {
      if (!chapters.has(mission.chapter)) chapters.set(mission.chapter, []);
      chapters.get(mission.chapter).push(mission);
    }
    for (const [chapterName, missions] of chapters) {
      const chapter = document.createElement('section');
      chapter.className = 'chapter-group';
      const heading = document.createElement('h3');
      heading.textContent = chapterName;
      const grid = document.createElement('div');
      grid.className = 'chapter-grid';
      for (const mission of missions) {
        grid.append(this._createMissionCard(mission, progress.stateFor(mission.id), onSelect));
      }
      chapter.append(heading, grid);
      campaignList.append(chapter);
    }

    const specialList = byId('special-mission-list');
    specialList.replaceChildren();
    for (const mission of specialOperations) {
      specialList.append(this._createMissionCard(mission, 'available', onSelect));
    }
    byId('selection-back-button').onclick = () => this.showMenu();
    this._focusFirst('mission-selection-screen', '.mission-card button:not(:disabled)');
  }

  showMissionBriefing(mission, onStart, onBack) {
    byId('menu-screen').hidden = true;
    byId('mission-selection-screen').hidden = true;
    byId('mission-briefing-screen').hidden = false;
    byId('leaderboard-button').hidden = true;
    byId('briefing-chapter').textContent = mission.number
      ? `CHAPTER ${mission.chapter.toUpperCase()} // MISSION ${String(mission.number).padStart(2, '0')}`
      : mission.chapter.toUpperCase();
    byId('briefing-title').textContent = mission.title;
    byId('briefing-description').textContent = mission.description;
    byId('briefing-difficulty').textContent = mission.difficulty;
    byId('briefing-environment').textContent = mission.environment;
    byId('briefing-objective').textContent = mission.objective;
    const startButton = byId('briefing-start-button');
    startButton.disabled = false;
    startButton.focus({ preventScroll: true });
    this.navCurrent = startButton;
    startButton.onclick = () => {
      if (startButton.disabled) return;
      startButton.disabled = true;
      onStart();
    };
    byId('briefing-back-button').onclick = () => {
      startButton.disabled = false;
      onBack();
    };
  }

  hideMenu() {
    byId('menu-screen').hidden = true;
    byId('mission-selection-screen').hidden = true;
    byId('mission-briefing-screen').hidden = true;
    byId('leaderboard-button').hidden = false;
    this.setPauseButtonVisible(true);
  }

  _createMissionCard(mission, state, onSelect) {
    const card = document.createElement('article');
    card.className = 'mission-card';
    card.dataset.state = state;

    const number = document.createElement('p');
    number.className = 'mission-number';
    number.textContent = mission.number ? `MISSION ${String(mission.number).padStart(2, '0')}` : 'SPECIAL OPERATION';
    const title = document.createElement('h4');
    title.textContent = mission.title;
    const description = document.createElement('p');
    description.textContent = mission.description;
    const details = document.createElement('p');
    details.textContent = `${mission.difficulty} // ${mission.environment}`;
    const objective = document.createElement('p');
    objective.textContent = `OBJECTIVE: ${mission.objective}`;
    const stateLabel = document.createElement('p');
    stateLabel.className = 'mission-state';
    stateLabel.textContent = this._missionStateLabel(mission, state);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = state === 'completed' ? 'REPLAY BRIEFING' : 'VIEW BRIEFING';
    button.disabled = !mission.implemented || state === 'locked';
    button.addEventListener('click', () => onSelect(mission));
    card.append(number, title, description, details, objective, stateLabel, button);
    return card;
  }

  _missionStateLabel(mission, state) {
    if (state === 'completed') return 'COMPLETED // REPLAY AVAILABLE';
    if (state === 'available') return 'AVAILABLE';
    if (state === 'unlocked') return 'UNLOCKED // CONTENT IN DEVELOPMENT';
    const prerequisite = mission.prerequisites?.[0];
    const required = prerequisite
      ? CAMPAIGN_MISSIONS.find((entry) => entry.id === prerequisite)?.number
      : null;
    return required ? `LOCKED // COMPLETE MISSION ${String(required).padStart(2, '0')}` : 'LOCKED';
  }

  showEnd({ complete, result = null, runId = null }) {
    byId('end-kicker').textContent = complete ? 'MISSION DEBRIEF' : 'SIGNAL LOST';
    byId('end-title').textContent = complete ? 'YOU MADE IT OUT.' : 'YOU DID NOT MAKE IT OUT.';
    byId('end-message').textContent = complete
      ? result?.missionId === 'blackout-tunnel'
        ? 'The relay carries a recovery-network tag. The evacuation message was bait.'
        : 'The survivor is safe. For tonight, that is enough.'
      : 'The emergency band goes quiet. Start a new run and try again.';
    byId('debrief-stats').hidden = !complete;
    byId('score-submit-status').hidden = !complete;
    if (complete && result) {
      this.scoreRunId = runId;
      const minutes = Math.floor(result.elapsedSeconds / 60).toString().padStart(2, '0');
      const seconds = (result.elapsedSeconds % 60).toString().padStart(2, '0');
      byId('debrief-mission').textContent = result.missionName;
      byId('debrief-score').textContent = result.score.toLocaleString();
      byId('debrief-time').textContent = `${minutes}:${seconds}`;
      byId('debrief-metric-label').textContent = result.objectiveLabel;
      byId('debrief-rescue').textContent = result.objectiveFound
        ? result.missionId === 'blackout-tunnel' ? 'RECOVERED' : 'RESCUED'
        : result.missionId === 'blackout-tunnel' ? 'NOT FOUND' : 'NOT RESCUED';
      byId('debrief-grade').textContent = result.grade;
      this.setScoreSubmission('pending', 'Score submission status pending…', runId);
    }
    byId('end-screen').hidden = false;
    this.setPauseButtonVisible(false);
    this._focusFirst('end-screen');
  }

  hideEnd() {
    byId('end-screen').hidden = true;
  }

  setScoreSubmission(status, message, runId = null) {
    if (runId && this.scoreRunId !== runId) return;
    const element = byId('score-submit-status');
    element.dataset.status = status;
    element.textContent = message;
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
    byId('leaderboard-button').hidden = true;
    byId('leaderboard-screen').hidden = false;
  }

  closeLeaderboard() {
    byId('leaderboard-screen').hidden = true;
    byId('leaderboard-button').hidden = false;
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
    byId('board-note').textContent = entries.length ? 'Live scores from start.ng. Guests can view records.' : 'No mission scores have been recorded yet.';
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
