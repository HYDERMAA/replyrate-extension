// ReplyRate side panel shell.
// Wave 0 task 4: state machine + i18n scaffold only. Tracker UI lands in Wave 1 task 9.

const STATES = Object.freeze({
  COLLAPSED: 'collapsed',
  LOADING:   'loading',
  READY:     'ready',
  ERROR:     'error',
});

// Single source of truth for all UI copy. Per build rule: every UI string
// editable in one place, i18n-ready even though not localised yet.
const STRINGS = {
  brand: { name: 'ReplyRate' },
  state: {
    loading:   { pill: 'Loading',  msg: 'Loading your workspace' },
    collapsed: { pill: 'Idle',     msg: 'Panel is idle. Open a supported job page to get started.', action: 'Expand' },
    ready:     { pill: 'Ready',    msg: 'Workspace ready. Tracker UI ships in the next wave.' },
    error:     { pill: 'Error',    msg: 'Something went wrong loading the panel.', action: 'Retry' },
  },
};

const $ = (id) => document.getElementById(id);
const pill = $('rr-state-pill');

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const path = el.getAttribute('data-i18n').split('.');
    let val = STRINGS;
    for (const k of path) { val = val && val[k]; if (val == null) return; }
    if (typeof val === 'string') el.textContent = val;
  });
}

function setState(next, errorMsg) {
  if (!Object.values(STATES).includes(next)) return;
  document.body.dataset.state = next;
  pill.textContent = STRINGS.state[next].pill;
  if (next === STATES.ERROR) {
    const msgEl = $('rr-error-msg');
    if (msgEl) msgEl.textContent = errorMsg || STRINGS.state.error.msg;
  }
}

async function rehydrate() {
  // Read-only probe so a broken chrome.storage.local surfaces a real error.
  // Schema keys are rr_-prefixed per the briefing. UserProfile lookup is the
  // canonical "is the workspace alive?" check; Wave 1 task 9 will widen this.
  await chrome.storage.local.get(['rr_user_profile']);
  return STATES.READY;
}

async function boot() {
  applyI18n();
  setState(STATES.LOADING);
  try {
    const next = await rehydrate();
    setState(next);
  } catch (err) {
    console.error('[sidepanel] rehydrate failed', err);
    setState(STATES.ERROR, STRINGS.state.error.msg);
  }
}

$('rr-retry-btn').addEventListener('click', boot);
$('rr-expand-btn').addEventListener('click', () => setState(STATES.READY));

// Service worker can drive state changes by sending { type: 'rr_set_state', state, error }.
// Hook is wired now so Wave 0 tasks 5/8 do not need to touch this file.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'rr_set_state') setState(msg.state, msg.error);
});

boot();
