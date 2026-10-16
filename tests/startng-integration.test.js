import test from 'node:test';
import assert from 'node:assert/strict';
import { StartNgIntegration } from '../js/startng-integration.js';

function withStartNgLocation(callback) {
  const previousLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: { hostname: 'dead-signal.start.ng', hash: '', pathname: '/', search: '' },
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: { getItem: () => null, setItem: () => {} },
  });
  try {
    return callback();
  } finally {
    if (previousLocation) Object.defineProperty(globalThis, 'location', previousLocation);
    else delete globalThis.location;
    if (previousStorage) Object.defineProperty(globalThis, 'sessionStorage', previousStorage);
    else delete globalThis.sessionStorage;
  }
}

function makeUi() {
  return {
    statuses: [],
    toasts: [],
    setScoreSubmission(status, message) {
      this.statuses.push({ status, message });
    },
    showToast(message) {
      this.toasts.push(message);
    },
  };
}

test('score submissions are idempotent per run and allow a later replay run', async () => {
  await withStartNgLocation(async () => {
    const ui = makeUi();
    const integration = new StartNgIntegration(ui);
    integration.connected = true;
    integration.authenticated = true;
    let requests = 0;
    integration._ask = async (message, replyType) => {
      requests += 1;
      assert.equal(message.type, 'startng:score');
      assert.equal(replyType, 'startng:scoreSaved');
      return { ok: true, result: { rank: 3 } };
    };

    assert.equal(await integration.submitScore(1500, 'run-1'), true);
    assert.equal(await integration.submitScore(1500, 'run-1'), false);
    assert.equal(await integration.submitScore(1550, 'run-2'), true);
    assert.equal(requests, 2);
    assert.equal(ui.statuses.at(-1).status, 'success');
  });
});

test('unconfirmed scores are not reported as recorded', async () => {
  await withStartNgLocation(async () => {
    const ui = makeUi();
    const integration = new StartNgIntegration(ui);
    integration.connected = true;
    integration.authenticated = true;
    integration._ask = async () => ({ ok: false });

    assert.equal(await integration.submitScore(1200, 'run-1'), false);
    assert.equal(ui.statuses.at(-1).status, 'failed');
    assert.match(ui.statuses.at(-1).message, /Not confirmed/);
  });
});

test('guest scores are not submitted or presented as saved', async () => {
  await withStartNgLocation(async () => {
    const ui = makeUi();
    const integration = new StartNgIntegration(ui);
    integration.connected = true;
    integration.authenticated = false;
    let requested = false;
    integration._ask = async () => {
      requested = true;
      return { ok: true };
    };

    assert.equal(await integration.submitScore(1200, 'run-1'), false);
    assert.equal(requested, false);
    assert.equal(ui.statuses.at(-1).status, 'unavailable');
    assert.match(ui.statuses.at(-1).message, /Not submitted/);
  });
});
