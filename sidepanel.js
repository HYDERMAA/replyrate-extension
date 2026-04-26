// ReplyRate side panel.
// Wave 0 task 4: state machine + i18n scaffold.
// Wave 1 task 9 part 1: tab navigation shell with coming-soon states.

const STATES = Object.freeze({
  COLLAPSED: 'collapsed',
  LOADING:   'loading',
  READY:     'ready',
  ERROR:     'error',
});

// ── Wave 1 task 9 part 1: tabs ─────────────────────────────────────────────
const TAB_IDS = ['overview', 'contacts', 'messages', 'tracker', 'insights'];
const DEFAULT_TAB = 'tracker';
const STORAGE_KEY_ACTIVE_TAB = 'rr_panel_active_tab';

// Phosphor "regular flat" SVGs (sourced from local install). viewBox 0 0 256 256,
// fill="currentColor" so colour follows the parent. Decorative wherever placed
// (sibling text label provides accessible name); marked aria-hidden by callers.
const ICONS = {
  house:          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z"/></svg>',
  userCircle:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM74.08,197.5a64,64,0,0,1,107.84,0,87.83,87.83,0,0,1-107.84,0ZM96,120a32,32,0,1,1,32,32A32,32,0,0,1,96,120Zm97.76,66.41a79.66,79.66,0,0,0-36.06-28.75,48,48,0,1,0-59.4,0,79.66,79.66,0,0,0-36.06,28.75,88,88,0,1,1,131.52,0Z"/></svg>',
  envelope:       '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48Zm-96,85.15L52.57,64H203.43ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z"/></svg>',
  clipboardText:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M168,152a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,152Zm-8-40H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm56-64V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V48A16,16,0,0,1,56,32H92.26a47.92,47.92,0,0,1,71.48,0H200A16,16,0,0,1,216,48ZM96,64h64a32,32,0,0,0-64,0ZM200,48H173.25A47.93,47.93,0,0,1,176,64v8a8,8,0,0,1-8,8H88a8,8,0,0,1-8-8V64a47.93,47.93,0,0,1,2.75-16H56V216H200Z"/></svg>',
  chartLine:      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0v94.37L90.73,98a8,8,0,0,1,10.07-.38l58.81,44.11L218.73,90a8,8,0,1,1,10.54,12l-64,56a8,8,0,0,1-10.07.38L96.39,114.29,40,163.63V200H224A8,8,0,0,1,232,208Z"/></svg>',
};

// Map tab id -> Phosphor icon. Spec table names "home" and "clipboard-list";
// Phosphor's equivalents are house and clipboard-text.
const TAB_ICON = {
  overview: ICONS.house,
  contacts: ICONS.userCircle,
  messages: ICONS.envelope,
  tracker:  ICONS.clipboardText,
  insights: ICONS.chartLine,
};
// ── end Wave 1 task 9 part 1 (constants) ───────────────────────────────────

// Single source of truth for all UI copy. Per build rule: every UI string
// editable in one place, i18n-ready even though not localised yet.
const STRINGS = {
  brand: { name: 'ReplyRate' },
  state: {
    loading:   { pill: 'Loading',  msg: 'Loading your workspace' },
    collapsed: { pill: 'Idle',     msg: 'Panel is idle. Open a supported job page to get started.', action: 'Expand' },
    ready:     { pill: 'Ready' },
    error:     { pill: 'Error',    msg: 'Something went wrong loading the panel.', action: 'Retry' },
  },
  // Wave 1 task 9 part 1: per-tab labels and coming-soon copy. Tracker copy
  // is an honest placeholder; commit 2 replaces it with the real Tracker.
  tabs: {
    overview: { label: 'Overview', emptyBody: 'Save a job from LinkedIn, Lever, or Indeed to start.' },
    contacts: { label: 'Contacts', emptyBody: 'Contact discovery ships in the next update.' },
    messages: { label: 'Messages', emptyBody: 'Message generation ships in the next update.' },
    tracker:  { label: 'Tracker',  emptyBody: 'Tracker UI ships in the next commit.' },
    insights: { label: 'Insights', emptyBody: 'Reply rate insights ship after you start sending.' },
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
  const pillCopy = STRINGS.state[next] && STRINGS.state[next].pill;
  if (pillCopy) pill.textContent = pillCopy;
  if (next === STATES.ERROR) {
    const msgEl = $('rr-error-msg');
    if (msgEl) msgEl.textContent = errorMsg || STRINGS.state.error.msg;
  }
}

async function rehydrate() {
  // Read-only probe so a broken chrome.storage.local surfaces a real error.
  // Schema keys are rr_-prefixed per the briefing.
  const data = await chrome.storage.local.get(['rr_user_profile', STORAGE_KEY_ACTIVE_TAB]);
  const stored = (data[STORAGE_KEY_ACTIVE_TAB] || '').toString().toLowerCase();
  const initialTab = TAB_IDS.includes(stored) ? stored : DEFAULT_TAB;
  return { state: STATES.READY, initialTab };
}

// ── Wave 1 task 9 part 1: app state ────────────────────────────────────────
// Tiny pub/sub holding the active tab. Persists changes to chrome.storage.local
// fire-and-forget; UI does not block on the write.
function createAppState(initialTab) {
  let activeTab = TAB_IDS.includes(initialTab) ? initialTab : DEFAULT_TAB;
  const subscribers = new Set();
  return {
    getActiveTab() { return activeTab; },
    setActiveTab(next) {
      if (!TAB_IDS.includes(next) || next === activeTab) return;
      activeTab = next;
      chrome.storage.local
        .set({ [STORAGE_KEY_ACTIVE_TAB]: next })
        .catch((err) => console.warn('[panel] persist active tab failed', err));
      subscribers.forEach((fn) => { try { fn(); } catch (e) { console.error('[panel] subscriber threw', e); } });
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

// ── Wave 1 task 9 part 1: modules ──────────────────────────────────────────
// Each module is a function (parent, props) => unmount handler per the briefing.

function EmptyState(parent, { icon, heading, body }) {
  const root = document.createElement('div');
  root.className = 'rr-empty';
  if (icon) {
    const iconEl = document.createElement('div');
    iconEl.className = 'rr-empty-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.innerHTML = icon;
    root.appendChild(iconEl);
  }
  if (heading) {
    const h = document.createElement('h2');
    h.className = 'rr-empty-heading';
    h.textContent = heading;
    root.appendChild(h);
  }
  if (body) {
    const p = document.createElement('p');
    p.className = 'rr-empty-body';
    p.textContent = body;
    root.appendChild(p);
  }
  parent.appendChild(root);
  return function unmount() { root.remove(); };
}

function Tabs(parent, state) {
  const tablist = document.createElement('nav');
  tablist.className = 'rr-tabs';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Sections');
  TAB_IDS.forEach((id) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.id = 'rr-tab-' + id;
    btn.setAttribute('aria-controls', 'rr-tabpanel-' + id);
    btn.dataset.tab = id;
    btn.className = 'rr-tab';
    btn.innerHTML =
      '<span class="rr-tab-icon" aria-hidden="true">' + TAB_ICON[id] + '</span>' +
      '<span class="rr-tab-label"></span>';
    btn.querySelector('.rr-tab-label').textContent = STRINGS.tabs[id].label;
    tablist.appendChild(btn);
  });
  parent.appendChild(tablist);

  const buttons = () => Array.from(tablist.querySelectorAll('[role="tab"]'));

  function update() {
    const activeId = state.getActiveTab();
    buttons().forEach((b) => {
      const isActive = b.dataset.tab === activeId;
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      b.setAttribute('tabindex', isActive ? '0' : '-1');
    });
  }

  function onClick(event) {
    const btn = event.target.closest('[role="tab"]');
    if (!btn) return;
    state.setActiveTab(btn.dataset.tab);
  }

  // WAI APG manual activation: Arrow / Home / End move focus only (roving
  // tabindex). Enter and Space activate via the button's native click event.
  function onKeydown(event) {
    const tab = event.target.closest('[role="tab"]');
    if (!tab) return;
    const list = buttons();
    const currentIndex = list.indexOf(tab);
    let next = currentIndex;
    switch (event.key) {
      case 'ArrowLeft':  next = (currentIndex - 1 + list.length) % list.length; break;
      case 'ArrowRight': next = (currentIndex + 1) % list.length; break;
      case 'Home':       next = 0; break;
      case 'End':        next = list.length - 1; break;
      default: return;
    }
    event.preventDefault();
    list[currentIndex].setAttribute('tabindex', '-1');
    list[next].setAttribute('tabindex', '0');
    list[next].focus();
  }

  tablist.addEventListener('click', onClick);
  tablist.addEventListener('keydown', onKeydown);
  update();
  const unsubscribe = state.subscribe(update);

  return function unmount() {
    unsubscribe();
    tablist.removeEventListener('click', onClick);
    tablist.removeEventListener('keydown', onKeydown);
    tablist.remove();
  };
}

function App(parent, state) {
  parent.innerHTML = '';
  const tabsUnmount = Tabs(parent, state);

  const content = document.createElement('div');
  content.className = 'rr-tab-content';
  parent.appendChild(content);

  // Mount one tabpanel per tab upfront. Five EmptyStates is cheap and avoids
  // mount/unmount churn on every tab switch.
  const panels = TAB_IDS.map((id) => {
    const panel = document.createElement('section');
    panel.setAttribute('role', 'tabpanel');
    panel.id = 'rr-tabpanel-' + id;
    panel.setAttribute('aria-labelledby', 'rr-tab-' + id);
    panel.className = 'rr-tabpanel';
    panel.dataset.tab = id;
    content.appendChild(panel);
    const emptyUnmount = EmptyState(panel, {
      icon: TAB_ICON[id],
      body: STRINGS.tabs[id].emptyBody,
    });
    return { id, panel, unmount: emptyUnmount };
  });

  function showActivePanel() {
    const activeId = state.getActiveTab();
    panels.forEach((p) => { p.panel.hidden = p.id !== activeId; });
  }
  showActivePanel();
  const unsubscribe = state.subscribe(showActivePanel);

  return function unmount() {
    unsubscribe();
    panels.forEach((p) => p.unmount());
    tabsUnmount();
    parent.innerHTML = '';
  };
}
// ── end Wave 1 task 9 part 1 (modules) ─────────────────────────────────────

let appState = null;
let appUnmount = null;

async function boot() {
  applyI18n();
  setState(STATES.LOADING);
  if (appUnmount) { appUnmount(); appUnmount = null; }
  try {
    const { state: nextState, initialTab } = await rehydrate();
    if (!appState) appState = createAppState(initialTab);
    setState(nextState);
    appUnmount = App($('rr-app-root'), appState);
    // Wave 0 task 7: ask the service worker to consider capturing the
    // currently-active tab. SW handles URL check, dedupe, write, and posts
    // rr_set_state back with any applicable notice.
    requestActiveTabCapture();
  } catch (err) {
    console.error('[sidepanel] rehydrate failed', err);
    setState(STATES.ERROR, STRINGS.state.error.msg);
  }
}

// Note: capture roundtrip completes after the initial setState(READY).
// Tracker rendering (commits 2 onward) must re-read storage on rr_set_state
// with notice, not assume ready means "panel knows current storage state".
async function requestActiveTabCapture() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) return;
    chrome.runtime
      .sendMessage({ type: 'rr_capture_active_tab', tabId: tab.id })
      .catch(() => {});
  } catch (err) {
    console.error('[sidepanel] active tab query failed', err);
  }
}

$('rr-retry-btn').addEventListener('click', boot);
$('rr-expand-btn').addEventListener('click', () => setState(STATES.READY));

// Service worker can drive state changes by sending { type: 'rr_set_state', state, error, notice? }.
// Notice rendering is deferred (Option A from Wave 0 task 7); the field is observable in devtools.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'rr_set_state') setState(msg.state, msg.error);
});

boot();
