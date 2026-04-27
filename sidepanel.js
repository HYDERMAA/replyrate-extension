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
  // Wave 1 task 9 part 5: hand-rolled three-dot icon for OverflowMenu trigger.
  dotsThreeVertical: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="12" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="18" r="2"/></svg>',
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

// Wave 1 task 9 part 2: stage ordering. Used by StageStrip and Tracker.
const STAGE_ORDER = ['saved', 'applied', 'replied', 'interviewing', 'offer', 'rejected'];

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
  // Wave 1 task 9 part 1: per-tab labels and coming-soon copy. Tracker has
  // no emptyBody after part 2 because the tab now mounts the real Tracker
  // module instead of an EmptyState placeholder.
  tabs: {
    overview: { label: 'Overview', emptyBody: 'Save a job from LinkedIn, Lever, or Indeed to start.' },
    contacts: { label: 'Contacts', emptyBody: 'Contact discovery ships in the next update.' },
    messages: { label: 'Messages', emptyBody: 'Message generation ships in the next update.' },
    tracker:  { label: 'Tracker' },
    insights: { label: 'Insights', emptyBody: 'Reply rate insights ship after you start sending.' },
  },
  // Wave 1 task 9 part 2: tracker copy.
  tracker: {
    allLabel: 'All',
    stages: {
      saved:        'Saved',
      applied:      'Applied',
      replied:      'Replied',
      interviewing: 'Interviewing',
      offer:        'Offer',
      rejected:     'Rejected',
    },
    empty: {
      heading: 'No jobs saved yet',
      body:    'Click the ReplyRate icon on a LinkedIn, Lever, or Indeed job page to save it.',
    },
    // Wave 1 task 9 part 3: row + time copy. Single source-name mapping
    // (full names) used for both visible badge text and accessible name.
    row: {
      sourceLabels: { linkedin: 'LinkedIn', lever: 'Lever', indeed: 'Indeed' },
      sourceAriaPrefix: 'From ',
      // Wave 1 task 9 part 5.
      stageChange: {
        errorPill: "Couldn't save. Try again.",
      },
      overflow: {
        label: 'Job actions',
        openOriginal: 'Open original',
        delete: 'Delete',
      },
    },
    time: {
      justNow:    'Just now',
      minutesAgo: (n) => n + 'm ago',
      hoursAgo:   (n) => n + 'h ago',
      yesterday:  'Yesterday',
      daysAgo:    (n) => n + ' days ago',
      monthsShort: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    },
    // Wave 1 task 9 part 4: filter copy.
    filter: {
      emptyHeading: (stageLabel) => 'No jobs in ' + stageLabel + ' stage yet.',
      showAll: 'Show all',
    },
    // Wave 1 task 9 part 5: confirm dialog, toast, error state.
    confirm: {
      heading: 'Delete this job?',
      body:    "This can't be undone.",
      cancel:  'Cancel',
      delete:  'Delete',
    },
    toast: {
      deleted: 'Job deleted.',
      undo:    'Undo',
    },
    error: {
      heading: "Couldn't load your tracker.",
      retry:   'Retry',
    },
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

// ── Wave 1 task 9 part 2: tracker modules ──────────────────────────────────

// Reduces the in-memory map of JobLeads to per-stage counts. Stages outside
// STAGE_ORDER are silently ignored (defensive against schema drift).
function deriveStageCounts(jobs) {
  const counts = { saved: 0, applied: 0, replied: 0, interviewing: 0, offer: 0, rejected: 0 };
  for (const job of jobs) {
    const stage = job && job.stage;
    if (counts[stage] !== undefined) counts[stage]++;
  }
  return counts;
}

function isJobKey(key) { return /^rr_job_/.test(key); }

function StageStrip(parent, _state, initialCounts, options) {
  options = options || {};
  const onSelect = options.onSelect || (() => {});
  // Mirrors Tracker's currentFilter (kept in sync via setSelected). Used by
  // the click handler to decide whether to toggle off vs. switch to a new
  // filter when the user clicks a chip.
  let currentSelected = null;

  const root = document.createElement('nav');
  root.className = 'rr-stage-strip';
  root.setAttribute('aria-label', 'Pipeline by stage');

  // All pill (far left). Single-line "All (N)" per spec.
  const allPill = document.createElement('button');
  allPill.type = 'button';
  allPill.className = 'rr-chip rr-chip-all';
  allPill.dataset.stage = '__all';
  root.appendChild(allPill);

  // Six stage chips: stacked label-above-count.
  const chips = {};
  STAGE_ORDER.forEach((stageId) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'rr-chip';
    chip.dataset.stage = stageId;
    const label = document.createElement('span');
    label.className = 'rr-chip-label';
    label.textContent = STRINGS.tracker.stages[stageId];
    const count = document.createElement('span');
    count.className = 'rr-chip-count';
    chip.appendChild(label);
    chip.appendChild(count);
    root.appendChild(chip);
    chips[stageId] = count;
  });

  parent.appendChild(root);

  function handleClick(event) {
    const chip = event.target.closest('.rr-chip');
    if (!chip || !root.contains(chip)) return;
    const stage = chip.dataset.stage;
    if (stage === '__all') {
      // All pill always clears the filter, regardless of current state.
      onSelect(null);
    } else if (stage === currentSelected) {
      // Re-clicking the active stage clears the filter (toggle off).
      onSelect(null);
    } else {
      onSelect(stage);
    }
  }
  root.addEventListener('click', handleClick);

  function setCounts(newCounts) {
    let total = 0;
    STAGE_ORDER.forEach((stageId) => {
      const n = newCounts[stageId] || 0;
      total += n;
      chips[stageId].textContent = String(n);
    });
    allPill.textContent = STRINGS.tracker.allLabel + ' (' + total + ')';
  }

  function setSelected(stageId) {
    currentSelected = stageId;
    const allChips = root.querySelectorAll('.rr-chip');
    allChips.forEach((chip) => {
      const chipStage = chip.dataset.stage;
      const isPressed = chipStage === '__all' ? stageId === null : chipStage === stageId;
      chip.setAttribute('aria-pressed', isPressed ? 'true' : 'false');
    });
  }

  setCounts(initialCounts);
  setSelected(null); // initial: no filter, All pill is pressed.

  return {
    unmount() {
      root.removeEventListener('click', handleClick);
      root.remove();
    },
    setCounts,
    setSelected,
  };
}

function JobListEmptyState(parent) {
  return EmptyState(parent, {
    icon: TAB_ICON.tracker,
    heading: STRINGS.tracker.empty.heading,
    body:    STRINGS.tracker.empty.body,
  });
}

// Wave 1 task 9 part 4: shown when a stage filter is active and the filter
// has zero matches. "Show all" is a button (state change, not navigation),
// styled as a link via .rr-link.
function FilteredEmptyState(parent, stageLabel, onShowAll) {
  const root = document.createElement('div');
  root.className = 'rr-empty rr-filtered-empty';
  root.setAttribute('role', 'status');

  const body = document.createElement('p');
  body.className = 'rr-empty-body';
  body.textContent = STRINGS.tracker.filter.emptyHeading(stageLabel);
  root.appendChild(body);

  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'rr-link';
  link.textContent = STRINGS.tracker.filter.showAll;
  link.addEventListener('click', onShowAll);
  root.appendChild(link);

  parent.appendChild(root);

  return {
    unmount() {
      link.removeEventListener('click', onShowAll);
      root.remove();
    },
  };
}

function renderTrackerSkeleton(parent) {
  const root = document.createElement('div');
  root.className = 'rr-tracker-skeleton';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-busy', 'true');
  root.setAttribute('aria-label', 'Loading tracker');

  const stripSkel = document.createElement('div');
  stripSkel.className = 'rr-skeleton-strip';
  // 1 All-pill placeholder + 6 stage chip placeholders.
  const all = document.createElement('div');
  all.className = 'rr-skeleton rr-skeleton-chip-all';
  stripSkel.appendChild(all);
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('div');
    c.className = 'rr-skeleton rr-skeleton-chip';
    stripSkel.appendChild(c);
  }
  root.appendChild(stripSkel);

  // 3 row placeholders per spec "Skeleton rows (3 placeholder shapes)".
  const listSkel = document.createElement('div');
  listSkel.className = 'rr-list-skeleton';
  for (let i = 0; i < 3; i++) {
    const r = document.createElement('div');
    r.className = 'rr-skeleton rr-skeleton-row';
    listSkel.appendChild(r);
  }
  root.appendChild(listSkel);

  parent.appendChild(root);
  return root;
}

// ── Wave 1 task 9 part 3: time formatting + source domain extraction ──────

const ABS_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit',
});
function formatAbsoluteTime(ts) { return ABS_TIME_FORMAT.format(new Date(ts)); }

function formatRelativeTime(ts, now) {
  const T = STRINGS.tracker.time;
  const nowMs = now == null ? Date.now() : now;
  const diff = Math.max(0, nowMs - ts);
  if (diff < 60000)             return T.justNow;
  if (diff < 60 * 60000)        return T.minutesAgo(Math.floor(diff / 60000));
  if (diff < 24 * 60 * 60000)   return T.hoursAgo(Math.floor(diff / (60 * 60000)));
  if (diff < 48 * 60 * 60000)   return T.yesterday;
  if (diff < 7 * 24 * 60 * 60000) return T.daysAgo(Math.floor(diff / (24 * 60 * 60000)));
  const d = new Date(ts);
  const nowD = new Date(nowMs);
  const month = T.monthsShort[d.getMonth()];
  return d.getFullYear() === nowD.getFullYear()
    ? month + ' ' + d.getDate()
    : month + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function sourceDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./i, ''); }
  catch (e) { return ''; }
}

// JobRow: one entry in the list. Returns { unmount, update(jobLead, isNew) }.
// Wave 1 task 9 part 5: hosts a StageDropdown (replaces the static stage
// chip) and an OverflowMenu (Open original / Delete). Row click/Enter still
// opens the source URL; clicks on the inner trigger buttons stop propagation
// so they don't fire the row's open-URL handler.
function JobRow(parent, jobLead, options) {
  options = options || {};

  const root = document.createElement('div');
  root.className = 'rr-row' + (options.isNew ? ' rr-row-new' : '');
  root.setAttribute('role', 'link');
  root.tabIndex = 0;
  root.dataset.jobId = jobLead.id;

  const badge = document.createElement('span');
  badge.className = 'rr-source-badge';
  root.appendChild(badge);

  const body = document.createElement('div');
  body.className = 'rr-row-body';
  const titleEl = document.createElement('div');
  titleEl.className = 'rr-row-title';
  const companyEl = document.createElement('div');
  companyEl.className = 'rr-row-company';
  const metaEl = document.createElement('div');
  metaEl.className = 'rr-row-meta';
  body.appendChild(titleEl);
  body.appendChild(companyEl);
  body.appendChild(metaEl);
  root.appendChild(body);

  // Stage area (hosts dropdown trigger + any error pill above it).
  const stageArea = document.createElement('div');
  stageArea.className = 'rr-row-stage-area';
  root.appendChild(stageArea);

  // Overflow area (hosts three-dot menu trigger).
  const overflowArea = document.createElement('div');
  overflowArea.className = 'rr-row-overflow-area';
  root.appendChild(overflowArea);

  parent.appendChild(root);

  function paintNonStage(j) {
    // Source badge.
    const sourceType = j.sourceType || 'unknown';
    const fullName = STRINGS.tracker.row.sourceLabels[sourceType];
    badge.dataset.source = fullName ? sourceType : 'unknown';
    badge.textContent = fullName || (sourceType ? sourceType.replace(/^./, c => c.toUpperCase()) : 'Unknown');
    badge.setAttribute('aria-label', STRINGS.tracker.row.sourceAriaPrefix + badge.textContent);

    // Title (fallback when missing).
    titleEl.textContent = j.title || '(untitled)';

    // Company or source-domain fallback.
    companyEl.textContent = j.company || sourceDomain(j.sourceUrl || '') || '';

    // Meta: location + time, joined by middle dot when both present.
    metaEl.textContent = '';
    if (j.location) {
      const loc = document.createElement('span');
      loc.className = 'rr-row-location';
      loc.textContent = j.location;
      metaEl.appendChild(loc);
      const sep = document.createElement('span');
      sep.className = 'rr-row-sep';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = '·';
      metaEl.appendChild(sep);
    }
    const timeEl = document.createElement('time');
    timeEl.className = 'rr-row-time';
    const ts = j.lastActionAt || j.createdAt || Date.now();
    timeEl.dateTime = new Date(ts).toISOString();
    const abs = formatAbsoluteTime(ts);
    const rel = formatRelativeTime(ts);
    timeEl.textContent = rel;
    timeEl.title = abs;
    timeEl.setAttribute('aria-label', abs + ', ' + rel);
    metaEl.appendChild(timeEl);

    // Row-level stage data attr (drives Rejected opacity).
    root.dataset.stage = j.stage || 'saved';
  }

  paintNonStage(jobLead);

  // StageDropdown owns the visible stage chip via setStage.
  const dropdown = StageDropdown(stageArea, jobLead, async (newStage) => {
    if (newStage === jobLead.stage) return;
    // Capture prior with structuredClone for forward-safety. JobLead is a
    // flat object today (no nested arrays/objects), so a spread would also
    // work, but structuredClone is the standard "deep snapshot" idiom.
    const prior = (typeof structuredClone === 'function')
      ? structuredClone(jobLead)
      : JSON.parse(JSON.stringify(jobLead));
    const updated = Object.assign({}, jobLead, { stage: newStage, lastActionAt: Date.now() });

    // Optimistic local-row update. We deliberately don't re-render the whole
    // list here: that would unmount this JobRow and decouple our dropdown
    // handle from the live DOM mid-promise. The post-storage-success
    // onStorageChanged event will fire reconcileList: idempotent with what
    // we just applied.
    jobLead = updated;
    dropdown.setStage(updated.stage);
    paintNonStage(updated);
    dropdown.setBusy(true);

    try {
      if (options.onStageChange) await options.onStageChange(prior, updated);
    } catch (err) {
      // Revert this row to prior. Tracker has already reverted its map and
      // strip counts inside its commitStageChange catch.
      jobLead = prior;
      dropdown.setStage(prior.stage);
      paintNonStage(prior);
      dropdown.showError(STRINGS.tracker.row.stageChange.errorPill);
    } finally {
      dropdown.setBusy(false);
    }
  });

  const overflow = OverflowMenu(overflowArea, jobLead, {
    onOpenOriginal: () => { if (options.onOpenOriginal) options.onOpenOriginal(jobLead); },
    onDelete:       () => { if (options.onDelete) options.onDelete(jobLead, overflow.triggerEl); },
  });

  function openOriginal() {
    if (!jobLead.sourceUrl) return;
    chrome.tabs.create({ url: jobLead.sourceUrl, active: true })
      .catch((err) => console.warn('[tracker] open original failed', err));
  }
  function onClick(event) {
    // Trigger button clicks stop propagation in their own handlers, so any
    // click that reaches the row root is on row body (open URL).
    if (event.defaultPrevented) return;
    openOriginal();
  }
  function onKeydown(event) {
    // Only act on Enter when the key event originated on the row itself,
    // not on inner buttons (dropdown trigger, overflow trigger). Buttons
    // handle their own Enter/Space natively.
    if (event.target !== root) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      openOriginal();
    }
  }
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeydown);

  return {
    unmount() {
      dropdown.unmount();
      overflow.unmount();
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeydown);
      root.remove();
    },
    update(newJobLead, isNew) {
      jobLead = newJobLead;
      paintNonStage(newJobLead);
      dropdown.setStage(newJobLead.stage);
      if (isNew) {
        root.classList.remove('rr-row-new');
        void root.offsetWidth; // force reflow so the animation restarts
        root.classList.add('rr-row-new');
      }
    },
  };
}

// JobList: container + list of JobRows. Returns { unmount, setEntries, updateRow }.
// setEntries does a full re-render (acceptable at v1 list sizes per spec
// performance line 195). Rows whose id is in `newIds` get the flash class.
// Wave 1 task 9 part 5: updateRow(jobId, jobLead, isNew) lets Tracker patch
// a single row in place without re-rendering the whole list (used by the
// optimistic stage-change path's revert hook).
function JobList(parent, state, initialEntries, initialNewIds, options) {
  options = options || {};
  const list = document.createElement('div');
  list.className = 'rr-job-list';
  list.setAttribute('role', 'list');
  parent.appendChild(list);

  let rows = [];
  const rowsByJobId = new Map();

  function render(entries, newIds) {
    rows.forEach((r) => r.unmount());
    rowsByJobId.clear();
    rows = entries.map((j) => {
      const r = JobRow(list, j, {
        isNew: !!(newIds && newIds.has(j.id)),
        onStageChange:  options.onStageChange,
        onDelete:       options.onDelete,
        onOpenOriginal: options.onOpenOriginal,
      });
      rowsByJobId.set(j.id, r);
      return r;
    });
  }
  render(initialEntries, initialNewIds);

  return {
    unmount() {
      rows.forEach((r) => r.unmount());
      rows = [];
      rowsByJobId.clear();
      list.remove();
    },
    setEntries(entries, newIds) { render(entries, newIds); },
    updateRow(jobId, jobLead, isNew) {
      const r = rowsByJobId.get(jobId);
      if (r) r.update(jobLead, isNew);
    },
  };
}

// ── Wave 1 task 9 part 5: dropdown / menu / dialog / toast / error ─────────

// StageDropdown: WAI listbox pattern. Trigger is mounted in `parent`; the
// listbox is portaled to document.body when open and removed on close.
function StageDropdown(parent, jobLead, onSelect) {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'rr-row-stage rr-stage-dropdown-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  parent.appendChild(trigger);

  let listbox = null;
  let optionEls = [];
  let activeIndex = 0;
  let typeaheadBuffer = '';
  let typeaheadTimer = null;

  function paintTrigger(stageId) {
    trigger.dataset.stage = stageId;
    trigger.textContent = STRINGS.tracker.stages[stageId] || stageId;
  }
  paintTrigger(jobLead.stage);

  function buildListbox(currentStage) {
    const ul = document.createElement('ul');
    ul.className = 'rr-listbox';
    ul.setAttribute('role', 'listbox');
    ul.tabIndex = -1;
    ul.setAttribute('aria-label', 'Pick a stage');
    optionEls = STAGE_ORDER.map((stageId, idx) => {
      const li = document.createElement('li');
      li.id = 'rr-stage-option-' + jobLead.id + '-' + stageId;
      li.className = 'rr-option';
      li.setAttribute('role', 'option');
      li.dataset.stage = stageId;
      li.textContent = STRINGS.tracker.stages[stageId] || stageId;
      li.setAttribute('aria-selected', stageId === currentStage ? 'true' : 'false');
      li.addEventListener('click', (e) => { e.stopPropagation(); selectStage(stageId); });
      li.addEventListener('mouseenter', () => setActive(idx));
      ul.appendChild(li);
      return li;
    });
    return ul;
  }

  // Two-phase mount: place listbox at 0,0 with visibility:hidden to measure
  // its rendered size, then position relative to trigger. Prefer below; flip
  // up only if there's not enough space below AND more space above.
  function position() {
    const rect = trigger.getBoundingClientRect();
    listbox.style.visibility = 'hidden';
    listbox.style.top = '0px';
    listbox.style.left = '0px';
    const lh = listbox.offsetHeight;
    const lw = listbox.offsetWidth;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const flipUp = spaceBelow < lh && spaceAbove > spaceBelow;
    listbox.style.top = (flipUp ? rect.top - lh - 4 : rect.bottom + 4) + 'px';
    let left = rect.right - lw;
    if (left < 8) left = 8;
    if (left + lw > window.innerWidth - 8) left = window.innerWidth - lw - 8;
    listbox.style.left = left + 'px';
    listbox.style.visibility = 'visible';
  }

  function setActive(idx) {
    activeIndex = idx;
    optionEls.forEach((el, i) => el.classList.toggle('rr-option-active', i === idx));
    listbox.setAttribute('aria-activedescendant', optionEls[idx].id);
    optionEls[idx].scrollIntoView({ block: 'nearest' });
  }

  function open() {
    if (listbox) return;
    listbox = buildListbox(jobLead.stage);
    document.body.appendChild(listbox);
    position();
    activeIndex = STAGE_ORDER.indexOf(jobLead.stage);
    if (activeIndex < 0) activeIndex = 0;
    setActive(activeIndex);
    listbox.focus();
    trigger.setAttribute('aria-expanded', 'true');
    listbox.addEventListener('keydown', onListboxKeydown);
    document.addEventListener('mousedown', onOutsideClick, true);
    window.addEventListener('scroll', onScrollClose, true);
    window.addEventListener('resize', onScrollClose);
  }

  function close(returnFocus) {
    if (!listbox) return;
    listbox.removeEventListener('keydown', onListboxKeydown);
    document.removeEventListener('mousedown', onOutsideClick, true);
    window.removeEventListener('scroll', onScrollClose, true);
    window.removeEventListener('resize', onScrollClose);
    listbox.remove();
    listbox = null;
    optionEls = [];
    trigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) trigger.focus();
  }

  function selectStage(stageId) {
    close(true);
    onSelect(stageId);
  }

  function onListboxKeydown(event) {
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); setActive((activeIndex + 1) % STAGE_ORDER.length); return;
      case 'ArrowUp':   event.preventDefault(); setActive((activeIndex - 1 + STAGE_ORDER.length) % STAGE_ORDER.length); return;
      case 'Home':      event.preventDefault(); setActive(0); return;
      case 'End':       event.preventDefault(); setActive(STAGE_ORDER.length - 1); return;
      case 'Enter':
      case ' ':         event.preventDefault(); selectStage(STAGE_ORDER[activeIndex]); return;
      case 'Escape':    event.preventDefault(); close(true); return;
      case 'Tab':       close(false); return;
      default:
        if (event.key.length === 1 && /[a-zA-Z]/.test(event.key)) {
          typeaheadBuffer += event.key.toLowerCase();
          clearTimeout(typeaheadTimer);
          typeaheadTimer = setTimeout(() => { typeaheadBuffer = ''; }, 600);
          const idx = STAGE_ORDER.findIndex((s) => s.toLowerCase().startsWith(typeaheadBuffer));
          if (idx >= 0) setActive(idx);
        }
    }
  }

  function onOutsideClick(event) {
    if (listbox && !listbox.contains(event.target) && event.target !== trigger) close(false);
  }
  function onScrollClose() { close(false); }

  function onTriggerClick(event) {
    event.stopPropagation();
    if (listbox) close(true);
    else open();
  }
  function onTriggerKeydown(event) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      open();
    }
  }
  trigger.addEventListener('click', onTriggerClick);
  trigger.addEventListener('keydown', onTriggerKeydown);

  return {
    unmount() {
      close(false);
      trigger.removeEventListener('click', onTriggerClick);
      trigger.removeEventListener('keydown', onTriggerKeydown);
      trigger.remove();
    },
    setStage: paintTrigger,
    setBusy(busy) {
      trigger.setAttribute('aria-busy', busy ? 'true' : 'false');
      trigger.disabled = !!busy;
    },
    showError(msg) {
      // Error pill is a sibling of the trigger inside the row's stage-area.
      // .rr-row-stage-area is align-items: flex-end + flex-direction: column,
      // so the pill stacks above the (reverted) stage chip. Auto-dismiss 4s.
      const existing = parent.querySelector('.rr-row-error-pill');
      if (existing) existing.remove();
      const pill = document.createElement('span');
      pill.className = 'rr-row-error-pill';
      pill.setAttribute('role', 'alert');
      pill.textContent = msg;
      parent.insertBefore(pill, trigger);
      setTimeout(() => { if (pill.parentNode) pill.remove(); }, 4000);
    },
  };
}

// OverflowMenu: WAI menu pattern. Trigger is mounted in `parent`; menu is
// portaled to document.body when open.
function OverflowMenu(parent, jobLead, options) {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'rr-overflow-trigger';
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', STRINGS.tracker.row.overflow.label);
  trigger.innerHTML = ICONS.dotsThreeVertical;
  parent.appendChild(trigger);

  let menu = null;
  let itemEls = [];
  let activeIndex = 0;

  const ITEMS = [
    { id: 'open',   label: STRINGS.tracker.row.overflow.openOriginal, action: () => options.onOpenOriginal && options.onOpenOriginal() },
    { id: 'delete', label: STRINGS.tracker.row.overflow.delete,       action: () => options.onDelete && options.onDelete(),
      destructive: true },
  ];

  function position() {
    const rect = trigger.getBoundingClientRect();
    menu.style.visibility = 'hidden';
    menu.style.top = '0px'; menu.style.left = '0px';
    const mh = menu.offsetHeight;
    const mw = menu.offsetWidth;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < mh && rect.top > spaceBelow;
    menu.style.top = (flipUp ? rect.top - mh - 4 : rect.bottom + 4) + 'px';
    let left = rect.right - mw;
    if (left < 8) left = 8;
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    menu.style.left = left + 'px';
    menu.style.visibility = 'visible';
  }

  function setActive(idx) {
    activeIndex = idx;
    itemEls.forEach((el, i) => el.classList.toggle('rr-menuitem-active', i === idx));
    if (itemEls[idx]) itemEls[idx].focus();
  }

  function open() {
    if (menu) return;
    menu = document.createElement('ul');
    menu.className = 'rr-menu';
    menu.setAttribute('role', 'menu');
    itemEls = ITEMS.map((it, i) => {
      const li = document.createElement('li');
      li.className = 'rr-menuitem' + (it.destructive ? ' rr-menuitem-destructive' : '');
      li.setAttribute('role', 'menuitem');
      li.tabIndex = -1;
      li.textContent = it.label;
      li.dataset.id = it.id;
      li.addEventListener('click', (e) => { e.stopPropagation(); activate(i); });
      li.addEventListener('mouseenter', () => setActive(i));
      menu.appendChild(li);
      return li;
    });
    document.body.appendChild(menu);
    position();
    activeIndex = 0;
    setActive(0);
    trigger.setAttribute('aria-expanded', 'true');
    menu.addEventListener('keydown', onMenuKeydown);
    document.addEventListener('mousedown', onOutsideClick, true);
    window.addEventListener('scroll', onScrollClose, true);
    window.addEventListener('resize', onScrollClose);
  }

  function close(returnFocus) {
    if (!menu) return;
    menu.removeEventListener('keydown', onMenuKeydown);
    document.removeEventListener('mousedown', onOutsideClick, true);
    window.removeEventListener('scroll', onScrollClose, true);
    window.removeEventListener('resize', onScrollClose);
    menu.remove();
    menu = null;
    itemEls = [];
    trigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) trigger.focus();
  }

  function activate(idx) {
    const item = ITEMS[idx];
    close(true);
    item.action();
  }

  function onMenuKeydown(event) {
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); setActive((activeIndex + 1) % ITEMS.length); return;
      case 'ArrowUp':   event.preventDefault(); setActive((activeIndex - 1 + ITEMS.length) % ITEMS.length); return;
      case 'Home':      event.preventDefault(); setActive(0); return;
      case 'End':       event.preventDefault(); setActive(ITEMS.length - 1); return;
      case 'Enter':
      case ' ':         event.preventDefault(); activate(activeIndex); return;
      case 'Escape':    event.preventDefault(); close(true); return;
      case 'Tab':       close(false); return;
    }
  }
  function onOutsideClick(event) {
    if (menu && !menu.contains(event.target) && event.target !== trigger) close(false);
  }
  function onScrollClose() { close(false); }

  function onTriggerClick(event) {
    event.stopPropagation();
    if (menu) close(true);
    else open();
  }
  function onTriggerKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      open();
    }
  }
  trigger.addEventListener('click', onTriggerClick);
  trigger.addEventListener('keydown', onTriggerKeydown);

  return {
    unmount() {
      close(false);
      trigger.removeEventListener('click', onTriggerClick);
      trigger.removeEventListener('keydown', onTriggerKeydown);
      trigger.remove();
    },
    triggerEl: trigger, // expose for focus return after dialog
  };
}

// ConfirmDialog: WAI dialog pattern. Modal with focus trap, Escape closes,
// backdrop click closes, focus returns to options.returnFocusTo on any close.
function ConfirmDialog(parent, options) {
  const headingId = 'rr-dialog-heading-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const backdrop = document.createElement('div');
  backdrop.className = 'rr-dialog-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'rr-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', headingId);

  const heading = document.createElement('h2');
  heading.id = headingId;
  heading.className = 'rr-dialog-heading';
  heading.textContent = options.heading;
  dialog.appendChild(heading);

  const body = document.createElement('p');
  body.className = 'rr-dialog-body';
  body.textContent = options.body;
  dialog.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'rr-dialog-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'rr-btn-secondary';
  cancelBtn.textContent = options.cancelLabel;
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'rr-btn-destructive';
  confirmBtn.textContent = options.confirmLabel;
  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  dialog.appendChild(actions);

  backdrop.appendChild(dialog);
  parent.appendChild(backdrop);

  let closed = false;

  function close() {
    if (closed) return;
    closed = true;
    backdrop.removeEventListener('mousedown', onBackdropClick);
    dialog.removeEventListener('keydown', onKeydown);
    backdrop.remove();
    if (options.returnFocusTo && options.returnFocusTo.focus && document.contains(options.returnFocusTo)) {
      options.returnFocusTo.focus();
    }
  }

  function onCancel()  { close(); if (options.onCancel)  options.onCancel(); }
  function onConfirm() { close(); if (options.onConfirm) options.onConfirm(); }

  cancelBtn.addEventListener('click', onCancel);
  confirmBtn.addEventListener('click', onConfirm);

  // Focus trap: query the focusable elements at each Tab keypress so that
  // dynamically added/removed elements (none today, but defensive) are
  // handled correctly. With only two buttons this is constant cost anyway.
  function getFocusable() {
    return Array.from(dialog.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
  }
  function onKeydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); return; }
    if (event.key !== 'Tab') return;
    const focusable = getFocusable();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  dialog.addEventListener('keydown', onKeydown);

  function onBackdropClick(event) {
    if (event.target === backdrop) onCancel();
  }
  backdrop.addEventListener('mousedown', onBackdropClick);

  // Initial focus: Cancel (less destructive default per WAI APG).
  cancelBtn.focus();

  return { unmount: close };
}

// Toast: singleton replacement pattern (caller dismisses prior before
// mounting new). 5s auto-dismiss timer; Undo click cancels timer + fires
// onAction; dismissNow cancels timer + removes DOM without firing either
// callback (used when a new toast replaces this one OR when Tracker
// unmounts mid-toast).
function Toast(parent, options) {
  const root = document.createElement('div');
  root.className = 'rr-toast';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');

  const body = document.createElement('span');
  body.className = 'rr-toast-body';
  body.textContent = options.body;
  root.appendChild(body);

  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'rr-toast-action';
  action.textContent = options.actionLabel;
  root.appendChild(action);

  parent.appendChild(root);

  let consumed = false;
  const duration = options.duration || 5000;
  const timer = setTimeout(() => {
    if (consumed) return;
    consumed = true;
    if (root.parentNode) root.remove();
    if (options.onAutoDismiss) options.onAutoDismiss();
  }, duration);

  action.addEventListener('click', () => {
    if (consumed) return;
    // Order matters: clear the timer FIRST so it can't race with the click,
    // then mark consumed, then DOM removal, then user callback.
    clearTimeout(timer);
    consumed = true;
    if (root.parentNode) root.remove();
    if (options.onAction) options.onAction();
  });

  function dismissNow() {
    if (consumed) return;
    clearTimeout(timer);
    consumed = true;
    if (root.parentNode) root.remove();
    // Note: dismissNow does NOT fire onAction or onAutoDismiss. It's used
    // for replacement (caller has already handled "what happens to the
    // pending action") and for Tracker unmount cleanup.
  }

  return { unmount: dismissNow, dismissNow };
}

// ErrorState: initial-load failure surface with Retry. Replaces the
// skeleton entirely; Retry re-runs the initial load from scratch.
function ErrorState(parent, errMessage, onRetry) {
  const root = document.createElement('div');
  root.className = 'rr-tracker-error';
  root.setAttribute('role', 'alert');

  const heading = document.createElement('p');
  heading.className = 'rr-tracker-error-heading';
  heading.textContent = STRINGS.tracker.error.heading;
  root.appendChild(heading);

  if (errMessage) {
    const detail = document.createElement('p');
    detail.className = 'rr-tracker-error-detail';
    detail.textContent = errMessage;
    root.appendChild(detail);
  }

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'rr-btn';
  retry.textContent = STRINGS.tracker.error.retry;
  retry.addEventListener('click', () => { if (onRetry) onRetry(); });
  root.appendChild(retry);

  parent.appendChild(root);

  return { unmount() { root.remove(); } };
}

// Tracker owns the in-memory job map and the chrome.storage.onChanged
// subscription. Sync function returning the unmount handle immediately;
// async initial load runs internally and bails on `unmounted` if torn
// down mid-load (boot retry, App re-mount, etc).
function Tracker(parent, state) {
  let unmounted = false;
  let stripHandle = null;
  let listenerAttached = false;
  const jobsByKey = new Map();
  // listMode: 'empty' | 'list' | 'filtered_empty'
  //   'empty'          - total === 0; JobListEmptyState mounted (filter ignored visually)
  //   'list'           - total > 0; JobList mounted (filtered or full entries)
  //   'filtered_empty' - filter active and matches === 0; FilteredEmptyState mounted
  let listMode = null;
  let listHandle = null;
  // Tracks the filter label currently displayed by FilteredEmptyState so we
  // remount when the user switches between two empty stages without leaving
  // the filtered_empty mode.
  let displayedFilterLabel = null;
  // Filter is in-memory only; null = "show all". Per spec, NOT persisted
  // across panel close/reopen. Filter state is preserved across mode changes
  // (we never silently mutate it).
  let currentFilter = null;
  // Wave 1 task 9 part 5 state.
  let skeleton = null;
  let errorHandle = null;
  let currentDialogHandle = null;
  let currentToastHandle = null;
  // Ids restored via Undo. onStorageChanged consults this set so the restored
  // row does NOT flash like a fresh capture. One-shot per id.
  const recentlyRestoredIds = new Set();
  // Portal mount target for ConfirmDialog and Toast. document.body is the
  // panel's root in chrome.sidePanel context.
  const panelRoot = document.body;

  function jobsArrayFromMap() {
    return Array.from(jobsByKey.values()).sort(
      (a, b) => (b.lastActionAt || 0) - (a.lastActionAt || 0)
    );
  }

  function filterNewIds(newIds, filteredEntries) {
    if (!newIds || newIds.size === 0) return new Set();
    const filteredIdSet = new Set(filteredEntries.map((j) => j.id));
    const out = new Set();
    newIds.forEach((id) => { if (filteredIdSet.has(id)) out.add(id); });
    return out;
  }

  function teardownCurrentListHandle() {
    if (!listHandle) return;
    if (listMode === 'empty') listHandle();        // bare unmount fn
    else listHandle.unmount();                     // { unmount, ... } object
    listHandle = null;
  }

  function setFilter(stageId) {
    if (stageId === currentFilter) return;
    currentFilter = stageId;
    if (stripHandle) stripHandle.setSelected(currentFilter);
    reconcileList(new Set());
  }

  // Per-row callbacks passed to JobList -> JobRow. These are the only
  // entry points by which the row's dropdown / menu / dialog flows mutate
  // Tracker state (jobsByKey, strip counts, storage).

  // commitStageChange runs the optimistic map+strip update and the storage
  // write. JobRow has already optimistically updated its own DOM by the time
  // this runs; on failure we revert map+strip and re-throw so JobRow can
  // revert its row UI and show the error pill.
  async function commitStageChange(prior, updated) {
    const key = 'rr_job_' + prior.id;
    jobsByKey.set(key, updated);
    if (stripHandle) stripHandle.setCounts(deriveStageCounts(Array.from(jobsByKey.values())));
    // Note: we do NOT call reconcileList here. Re-rendering would unmount
    // the JobRow whose dropdown handle is mid-promise. The post-write
    // onStorageChanged event will fire reconcileList naturally; the mode
    // it computes is consistent with our optimistic state.
    try {
      await chrome.storage.local.set({ [key]: updated });
    } catch (err) {
      console.error('[tracker] stage write failed', err);
      jobsByKey.set(key, prior);
      if (stripHandle) stripHandle.setCounts(deriveStageCounts(Array.from(jobsByKey.values())));
      throw err;
    }
  }

  function openOriginal(jobLead) {
    if (!jobLead.sourceUrl) return;
    chrome.tabs.create({ url: jobLead.sourceUrl, active: true })
      .catch((e) => console.warn('[tracker] open original failed', e));
  }

  function trackerDeleteFlow(jobLead, returnFocusTo) {
    if (currentDialogHandle) currentDialogHandle.unmount();
    currentDialogHandle = ConfirmDialog(panelRoot, {
      heading:      STRINGS.tracker.confirm.heading,
      body:         STRINGS.tracker.confirm.body,
      cancelLabel:  STRINGS.tracker.confirm.cancel,
      confirmLabel: STRINGS.tracker.confirm.delete,
      returnFocusTo,
      onCancel:  () => { currentDialogHandle = null; },
      onConfirm: () => {
        currentDialogHandle = null;
        const key = 'rr_job_' + jobLead.id;
        const cached = jobsByKey.get(key);
        if (!cached) return;
        // Capture deep snapshot for Undo restoration. Preserves id,
        // createdAt, lastActionAt verbatim so the row reappears in its
        // prior chronological position.
        const snapshot = (typeof structuredClone === 'function')
          ? structuredClone(cached)
          : JSON.parse(JSON.stringify(cached));
        chrome.storage.local.remove(key).then(
          () => showDeleteToast(key, snapshot),
          (err) => console.error('[tracker] delete failed', err)
        );
      },
    });
  }

  function showDeleteToast(key, deletedValue) {
    if (currentToastHandle) currentToastHandle.dismissNow();
    currentToastHandle = Toast(panelRoot, {
      body:        STRINGS.tracker.toast.deleted,
      actionLabel: STRINGS.tracker.toast.undo,
      duration:    5000,
      onAction: () => {
        currentToastHandle = null;
        // Mark the id so the upcoming storage event doesn't flash the row.
        recentlyRestoredIds.add(deletedValue.id);
        chrome.storage.local.set({ [key]: deletedValue }).catch((err) => {
          console.error('[tracker] undo failed', err);
          recentlyRestoredIds.delete(deletedValue.id);
        });
      },
      onAutoDismiss: () => {
        currentToastHandle = null;
        // Delete is now permanent. Storage was already cleared at delete time;
        // there is no further action.
      },
    });
  }

  function reconcileList(newlyAddedIds) {
    const allEntries = jobsArrayFromMap();
    const filtered = currentFilter
      ? allEntries.filter((j) => j.stage === currentFilter)
      : allEntries;

    let newMode;
    if (allEntries.length === 0) {
      newMode = 'empty';
    } else if (currentFilter && filtered.length === 0) {
      newMode = 'filtered_empty';
    } else {
      newMode = 'list';
    }
    const newFilterLabel = currentFilter
      ? (STRINGS.tracker.stages[currentFilter] || currentFilter)
      : null;

    const modeChanged = newMode !== listMode;
    const labelChanged = newMode === 'filtered_empty' && newFilterLabel !== displayedFilterLabel;

    if (modeChanged || labelChanged) {
      teardownCurrentListHandle();
      if (newMode === 'empty') {
        listHandle = JobListEmptyState(parent);
        displayedFilterLabel = null;
      } else if (newMode === 'filtered_empty') {
        listHandle = FilteredEmptyState(parent, newFilterLabel, () => setFilter(null));
        displayedFilterLabel = newFilterLabel;
      } else { // 'list'
        const filteredNewIds = filterNewIds(newlyAddedIds, filtered);
        listHandle = JobList(parent, state, filtered, filteredNewIds, {
          onStageChange:  commitStageChange,
          onDelete:       trackerDeleteFlow,
          onOpenOriginal: openOriginal,
        });
        displayedFilterLabel = null;
      }
      listMode = newMode;
    } else if (newMode === 'list') {
      const filteredNewIds = filterNewIds(newlyAddedIds, filtered);
      listHandle.setEntries(filtered, filteredNewIds);
    }
    // 'empty' -> 'empty' or 'filtered_empty' -> 'filtered_empty' (same label):
    // no-op. Strip counts already updated by stripHandle.setCounts above this call.
  }

  function onStorageChanged(changes, areaName) {
    if (areaName !== 'local' || !stripHandle) return;
    let touched = false;
    const newlyAddedIds = new Set();
    for (const key of Object.keys(changes)) {
      if (!isJobKey(key)) continue;
      const change = changes[key];
      const wasInMap = jobsByKey.has(key);
      if (change.newValue !== undefined) {
        if (!wasInMap && change.newValue && change.newValue.id) {
          if (recentlyRestoredIds.has(change.newValue.id)) {
            // Suppress flash for Undo-restored rows; one-shot consumption.
            recentlyRestoredIds.delete(change.newValue.id);
          } else {
            newlyAddedIds.add(change.newValue.id);
          }
        }
        jobsByKey.set(key, change.newValue);
      } else {
        jobsByKey.delete(key);
      }
      touched = true;
    }
    if (touched) {
      stripHandle.setCounts(deriveStageCounts(Array.from(jobsByKey.values())));
      reconcileList(newlyAddedIds);
    }
  }

  // Initial load. Idempotent: Retry from ErrorState calls back into this.
  function attemptInitialLoad() {
    if (errorHandle) { errorHandle.unmount(); errorHandle = null; }
    if (!skeleton || !skeleton.parentNode) skeleton = renderTrackerSkeleton(parent);

    chrome.storage.local.get(null).then(
      (all) => {
        if (unmounted) return;
        jobsByKey.clear();
        Object.entries(all).forEach(([k, v]) => { if (isJobKey(k)) jobsByKey.set(k, v); });
        if (skeleton && skeleton.parentNode) skeleton.remove();
        skeleton = null;
        if (!stripHandle) {
          stripHandle = StageStrip(
            parent, state,
            deriveStageCounts(Array.from(jobsByKey.values())),
            { onSelect: setFilter }
          );
        } else {
          stripHandle.setCounts(deriveStageCounts(Array.from(jobsByKey.values())));
          stripHandle.setSelected(currentFilter);
        }
        // Initial mount: no `newlyAddedIds` so existing jobs do NOT flash.
        reconcileList(new Set());
        if (!listenerAttached) {
          chrome.storage.onChanged.addListener(onStorageChanged);
          listenerAttached = true;
        }
      },
      (err) => {
        if (unmounted) return;
        console.error('[tracker] initial load failed', err);
        if (skeleton && skeleton.parentNode) skeleton.remove();
        skeleton = null;
        errorHandle = ErrorState(parent, err && err.message, attemptInitialLoad);
      }
    );
  }
  attemptInitialLoad();

  return function unmount() {
    unmounted = true;
    if (listenerAttached) chrome.storage.onChanged.removeListener(onStorageChanged);
    // E1/E2/E3: tear down any open dialog or toast on Tracker unmount.
    if (currentDialogHandle) { currentDialogHandle.unmount(); currentDialogHandle = null; }
    if (currentToastHandle) { currentToastHandle.dismissNow(); currentToastHandle = null; }
    if (errorHandle) { errorHandle.unmount(); errorHandle = null; }
    if (stripHandle) stripHandle.unmount();
    teardownCurrentListHandle();
    if (skeleton && skeleton.parentNode) skeleton.remove();
  };
}
// ── end Wave 1 task 9 part 2/3/4/5 ─────────────────────────────────────────

function App(parent, state) {
  parent.innerHTML = '';
  const tabsUnmount = Tabs(parent, state);

  const content = document.createElement('div');
  content.className = 'rr-tab-content';
  parent.appendChild(content);

  // Mount one tabpanel per tab upfront. Tracker gets its real module; the
  // other four show a coming-soon EmptyState. No mount/unmount churn on
  // tab switch (visibility is toggled via the `hidden` attribute).
  const panels = TAB_IDS.map((id) => {
    const panel = document.createElement('section');
    panel.setAttribute('role', 'tabpanel');
    panel.id = 'rr-tabpanel-' + id;
    panel.setAttribute('aria-labelledby', 'rr-tab-' + id);
    panel.className = 'rr-tabpanel';
    panel.dataset.tab = id;
    content.appendChild(panel);
    const contentUnmount = id === 'tracker'
      ? Tracker(panel, state)
      : EmptyState(panel, {
          icon: TAB_ICON[id],
          body: STRINGS.tabs[id].emptyBody,
        });
    return { id, panel, unmount: contentUnmount };
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
