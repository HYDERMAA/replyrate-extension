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
// update() is wired now for commit 5 (optimistic stage change); commit 3
// only calls the constructor and unmount via JobList's full re-render path.
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

  const stageChip = document.createElement('span');
  stageChip.className = 'rr-row-stage';
  root.appendChild(stageChip);

  function paint(j) {
    // Source badge: visible "LinkedIn" plus aria-label "From LinkedIn" per
    // spec line 165. Slight redundancy for SR users; the explicit "From"
    // disambiguates the source pill from the company string that follows.
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

    // Stage chip + row-level stage data attr (drives Rejected opacity).
    const stage = j.stage || 'saved';
    stageChip.dataset.stage = stage;
    stageChip.textContent = STRINGS.tracker.stages[stage] || stage;
    root.dataset.stage = stage;
  }

  paint(jobLead);
  parent.appendChild(root);

  function openOriginal() {
    if (!jobLead.sourceUrl) return;
    chrome.tabs.create({ url: jobLead.sourceUrl, active: true })
      .catch((err) => console.warn('[tracker] open original failed', err));
  }
  function onClick() { openOriginal(); }
  function onKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      openOriginal();
    }
  }
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeydown);

  return {
    unmount() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeydown);
      root.remove();
    },
    update(newJobLead, isNew) {
      jobLead = newJobLead;
      paint(newJobLead);
      if (isNew) {
        root.classList.remove('rr-row-new');
        // Force reflow so the animation restarts.
        void root.offsetWidth;
        root.classList.add('rr-row-new');
      }
    },
  };
}

// JobList: container + list of JobRows. Returns { unmount, setEntries(jobs, newIds) }.
// setEntries does a full re-render (acceptable at v1 list sizes per spec
// performance line 195). Rows whose id is in `newIds` get the flash class.
function JobList(parent, state, initialEntries, initialNewIds) {
  const list = document.createElement('div');
  list.className = 'rr-job-list';
  list.setAttribute('role', 'list');
  parent.appendChild(list);

  let rows = [];

  function render(entries, newIds) {
    rows.forEach((r) => r.unmount());
    rows = entries.map((j) => JobRow(list, j, { isNew: !!(newIds && newIds.has(j.id)) }));
  }
  render(initialEntries, initialNewIds);

  return {
    unmount() {
      rows.forEach((r) => r.unmount());
      rows = [];
      list.remove();
    },
    setEntries(entries, newIds) { render(entries, newIds); },
  };
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
  // (we never silently mutate it), so a user filtered to Saved who deletes
  // their last Saved row sees the filter linger; a subsequent matching save
  // appears, a non-matching save renders FilteredEmptyState.
  let currentFilter = null;

  const skeleton = renderTrackerSkeleton(parent);

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

  function reconcileList(newlyAddedIds) {
    const allEntries = jobsArrayFromMap();
    const filtered = currentFilter
      ? allEntries.filter((j) => j.stage === currentFilter)
      : allEntries;

    // Mode rules. Filter state is preserved across mode changes; we never
    // silently mutate currentFilter. When total === 0, the filter is
    // meaningless visually so we render JobListEmptyState, but currentFilter
    // stays set in memory for the lingering-filter case.
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
        listHandle = JobList(parent, state, filtered, filteredNewIds);
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
          newlyAddedIds.add(change.newValue.id);
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

  (async () => {
    try {
      const all = await chrome.storage.local.get(null);
      if (unmounted) return;
      Object.entries(all).forEach(([key, value]) => {
        if (isJobKey(key)) jobsByKey.set(key, value);
      });
      skeleton.remove();
      stripHandle = StageStrip(
        parent, state,
        deriveStageCounts(Array.from(jobsByKey.values())),
        { onSelect: setFilter }
      );
      // Initial mount: no `newlyAddedIds` so existing jobs do NOT flash.
      reconcileList(new Set());
      chrome.storage.onChanged.addListener(onStorageChanged);
      listenerAttached = true;
    } catch (err) {
      if (unmounted) return;
      console.error('[tracker] initial load failed', err);
      // Commit 5 will add a proper error state with retry. For now leave
      // the skeleton up so the user sees something rather than a blank
      // panel; the listener is not attached on failure.
    }
  })();

  return function unmount() {
    unmounted = true;
    if (listenerAttached) chrome.storage.onChanged.removeListener(onStorageChanged);
    if (stripHandle) stripHandle.unmount();
    teardownCurrentListHandle();
    if (skeleton.parentNode) skeleton.remove();
  };
}
// ── end Wave 1 task 9 part 2/3/4 ───────────────────────────────────────────

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
