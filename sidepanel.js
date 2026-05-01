// ReplyRate side panel.
// Wave 0 task 4: state machine + i18n scaffold.
// Wave 1 task 9 part 1: tab navigation shell with coming-soon states.
// Wave 2 task 1 foundation: auth widget in header, Contacts tab scaffold,
// entitlements display, Stripe upgrade link.

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

// Wave 2 task 1: backend + Stripe URLs.
// BACKEND_BASE_URL is hardcoded to production. Same value as background.js
// (vanilla JS, no shared module — drift risk accepted; both files updated
// together when the URL changes).
const BACKEND_BASE_URL = 'https://replyrate.ai';

// ⚠️ TEST MODE ONLY — must replace before public launch.
//
// Stripe Payment Link for the Starter tier (£29/mo). The Pro tier
// payment link isn't surfaced in this commit's UI; only Starter is offered
// from the Upgrade button until tiered upgrade selection lands.
//
// For production: replace with the live-mode payment link URL (no 'test_'
// prefix). Live mode requires:
//   1. Duplicate products in Stripe live mode
//   2. Create live payment links
//   3. Create live webhook destination at /api/stripe-webhook
//   4. Add live STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET to Vercel env vars
//   5. Update this constant
const STRIPE_CHECKOUT_URL_BASE = 'https://buy.stripe.com/test_dRmaEXd3F9ra7BBc7o93y00';

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
  // Wave 2 task 1 continuation: external-link icon for ContactCard's LinkedIn link.
  arrowSquareOut: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z"/></svg>',
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
  // module instead of an EmptyState placeholder. Contacts no longer has
  // emptyBody after Wave 2 task 1 (see contacts.* below).
  tabs: {
    overview: { label: 'Overview', emptyBody: 'Save a job from LinkedIn, Lever, or Indeed to start.' },
    contacts: { label: 'Contacts' },
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
  // Wave 2 task 1 + continuation: contacts tab + auth widget copy.
  contacts: {
    signedOut: {
      heading: 'Sign in to find contacts',
      body:    "Find the right people to reach at companies you've saved. ReplyRate finds verified emails from public profiles.",
      signIn:  'Sign in',
    },
    picker: {
      placeholder: 'Pick a job from your tracker',
      empty:       'No saved jobs yet',
    },
    entitlements: {
      loading:     ' ',
      planSuffix:  ' plan',
      separator:   ' · ',
      // -1 limit means unlimited (paid tier per closed-beta policy). Render
      // "{used} unlocks" without the slash/limit. See web-app stripe-webhook.js
      // PRICE_TO_TIER for the sentinel definition.
      unlocksUsed: (used, limit) => limit === -1
        ? used + ' unlocks'
        : used + ' / ' + limit + ' unlocks used',
      upgrade:     'Upgrade',
    },
    emptyHint:    'Pick a job above to find contacts at that company.',
    search: {
      heading:           'Find contacts at this company',
      companyLabel:      'Company',
      positionLabel:     'Position',
      submit:            'Search contacts',
      searching:         'Searching…',
      errorEmptyInputs:  'Enter both company and position.',
      errorGeneric:      "Couldn't search Apollo. Try again.",
    },
    list: {
      contextSeparator: ' · ',
      newSearch:        'New search',
      empty: {
        heading:    (company) => 'No contacts found at ' + company,
        body:       'Try different keywords or check the company name.',
        editSearch: 'Edit search',
      },
    },
    card: {
      unlockVerified:      'Unlock email (1 credit)',
      unlockPattern:       'Reveal guessed email (1 credit)',
      unlocking:           'Unlocking…',
      copy:                'Copy',
      copied:              'Copied!',
      patternCaveat:       'Pattern-matched guess. Verify before sending.',
      errorGeneric:        "Couldn't reveal. Try again.",
      errorDb:             'Something went wrong. Try again.',
      paywallText:         'Out of unlocks.',
      paywallUpgrade:      'Upgrade',
      openLinkedIn:        'Open in LinkedIn',
      role: {
        hr_ta:                  'HR / TA',
        hiring_manager:         'Hiring Manager',
        director:               'Director',
        individual_contributor: 'Individual Contributor',
        unknown:                'Other',
      },
    },
  },
  auth: {
    signIn:       'Sign in',
    signingIn:    'Signing in…',
    signOut:      'Sign out',
    signInFailed: 'Sign-in failed. Try again.',
  },
};

const $ = (id) => document.getElementById(id);

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
  if (next === STATES.ERROR) {
    const msgEl = $('rr-error-msg');
    if (msgEl) msgEl.textContent = errorMsg || STRINGS.state.error.msg;
  }
}

async function rehydrate() {
  // Read-only probe so a broken chrome.storage.local surfaces a real error.
  // Schema keys are rr_-prefixed per the briefing. Wave 2 task 1: also reads
  // rr_user_session so the panel boots straight into the right signed-in /
  // signed-out shell without a flash.
  const data = await chrome.storage.local.get(['rr_user_profile', 'rr_user_session', STORAGE_KEY_ACTIVE_TAB]);
  const stored = (data[STORAGE_KEY_ACTIVE_TAB] || '').toString().toLowerCase();
  const initialTab = TAB_IDS.includes(stored) ? stored : DEFAULT_TAB;
  const initialSession = data.rr_user_session || null;
  return { state: STATES.READY, initialTab, initialSession };
}

// ── Wave 1 task 9 part 1 + Wave 2 task 1: app state ────────────────────────
// Pub/sub holding active tab (persisted), session (mirrored from
// rr_user_session storage), entitlements (in-memory cache), and selectedJobId
// (in-memory; persisted across panel close in a future commit).
function createAppState(initialTab, initialSession) {
  let activeTab = TAB_IDS.includes(initialTab) ? initialTab : DEFAULT_TAB;
  let session = initialSession || null;
  let entitlements = null;
  let selectedJobId = null;

  const tabSubscribers = new Set();
  const sessionSubscribers = new Set();
  const entitlementsSubscribers = new Set();
  const selectedJobIdSubscribers = new Set();

  function notify(set, label) {
    set.forEach((fn) => {
      try { fn(); } catch (e) { console.error('[panel] ' + label + ' subscriber threw', e); }
    });
  }

  return {
    getActiveTab() { return activeTab; },
    setActiveTab(next) {
      if (!TAB_IDS.includes(next) || next === activeTab) return;
      activeTab = next;
      chrome.storage.local
        .set({ [STORAGE_KEY_ACTIVE_TAB]: next })
        .catch((err) => console.warn('[panel] persist active tab failed', err));
      notify(tabSubscribers, 'tab');
    },
    subscribe(fn) {
      tabSubscribers.add(fn);
      return () => tabSubscribers.delete(fn);
    },

    // Session: sourced from rr_user_session in chrome.storage.local. Background
    // SW writes; panel mirrors via the storage onChanged listener wired in
    // boot(). Modules call subscribeSession to react to sign-in/sign-out.
    getSession() { return session; },
    setSession(next) {
      session = next || null;
      notify(sessionSubscribers, 'session');
    },
    subscribeSession(fn) {
      sessionSubscribers.add(fn);
      return () => sessionSubscribers.delete(fn);
    },

    // Entitlements: in-memory only. Modules call setEntitlements after a
    // fetchEntitlements() roundtrip. No persistence; refetched on each
    // mount/sign-in/tab-switch trigger.
    getEntitlements() { return entitlements; },
    setEntitlements(next) {
      entitlements = next || null;
      notify(entitlementsSubscribers, 'entitlements');
    },
    subscribeEntitlements(fn) {
      entitlementsSubscribers.add(fn);
      return () => entitlementsSubscribers.delete(fn);
    },

    // Selected job: in-memory. Spec line 12: "carries selection across tabs."
    // Tonight's only writer is JobPicker; future Tracker row click also
    // writes here (deferred).
    getSelectedJobId() { return selectedJobId; },
    setSelectedJobId(next) {
      const v = next || null;
      if (v === selectedJobId) return;
      selectedJobId = v;
      notify(selectedJobIdSubscribers, 'selectedJobId');
    },
    subscribeSelectedJobId(fn) {
      selectedJobIdSubscribers.add(fn);
      return () => selectedJobIdSubscribers.delete(fn);
    },
  };
}

// ── Wave 2 task 1: auth helpers ────────────────────────────────────────────
// Panel-side equivalents of the background SW's signIn/signOut/rrApiFetch.
// Differences from background.js:
//   - rrPanelFetch (not rrApiFetch) so the two helpers don't share a name
//     across contexts. Same Authorization-header injection, no refresh logic.
//   - On 401, rrPanelFetch fires signOut() to bounce the user out cleanly.
//     Closed-beta acceptable; production fix is to route panel fetches
//     through a bg message handler that uses bg's rrApiFetch (which has
//     full lazy + 401-retry refresh logic).

async function rrPanelFetch(path, config) {
  const data = await chrome.storage.local.get('rr_user_session');
  const session = data.rr_user_session;
  if (!session || !session.idToken) {
    throw new Error('not_signed_in');
  }

  const baseConfig = config || {};
  const headers = Object.assign({}, baseConfig.headers || {}, {
    'Authorization': 'Bearer ' + session.idToken,
  });

  const res = await fetch(BACKEND_BASE_URL + path, Object.assign({}, baseConfig, { headers }));

  if (res.status === 401) {
    // Stale token or server-side revocation. Panel doesn't refresh; bounce
    // to signed-out so the user re-auths cleanly. Storage event from
    // signOut() will trigger session subscribers, re-rendering the UI.
    console.warn('[panel] 401 from ' + path + '; bouncing to signed-out');
    signOut().catch((err) => console.error('[panel] signOut after 401 failed', err));
  }

  return res;
}

async function signIn() {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'rr_auth_signin' });
    return res || { ok: false, error: 'no_response' };
  } catch (err) {
    console.error('[panel] signIn message failed:', err && err.message);
    return { ok: false, error: 'message_failed' };
  }
}

async function signOut() {
  try {
    await chrome.runtime.sendMessage({ type: 'rr_auth_signout' });
  } catch (err) {
    console.warn('[panel] signOut message failed:', err && err.message);
  }
  // Always treat as signed out client-side, even if the message failed —
  // matches the bg's fail-open contract.
  return { ok: true };
}

async function fetchEntitlements(state) {
  if (!state.getSession()) {
    state.setEntitlements(null);
    return;
  }
  try {
    const res = await rrPanelFetch('/api/user/entitlements');
    if (!res.ok) {
      console.warn('[panel] entitlements fetch returned ' + res.status);
      state.setEntitlements(null);
      return;
    }
    const data = await res.json();
    if (!data || data.ok !== true) {
      console.warn('[panel] entitlements response shape unexpected:', data && data.error);
      state.setEntitlements(null);
      return;
    }
    state.setEntitlements({
      unlocksUsed:           data.unlocksUsed,
      unlocksLimit:          data.unlocksLimit,
      subscriptionStatus:    data.subscriptionStatus,
      subscriptionExpiresAt: data.subscriptionExpiresAt,
    });
  } catch (err) {
    if (err && err.message === 'not_signed_in') {
      state.setEntitlements(null);
      return;
    }
    console.warn('[panel] entitlements fetch failed:', err && err.message);
    state.setEntitlements(null);
  }
}

// ── Wave 2 task 1 continuation: parsing + role bucketing + cache helpers ───

// Best-effort parse of a JobLead.title into { company, position }. Strips
// common platform suffixes (LinkedIn, Indeed) before matching, then tries
// "Position at Company" then "Position - Company" / "Position | Company"
// patterns. Returns empty fields for unparseable titles; user fills them
// in the SearchForm. Pre-fill is convenience, not authoritative.
function parseJobTitle(title) {
  if (!title) return { company: '', position: '' };
  const cleaned = title
    .replace(/\s*\|\s*LinkedIn$/i, '')
    .replace(/\s*-\s*LinkedIn$/i, '')
    .replace(/\s*\|\s*Indeed.*$/i, '')
    .replace(/\s*-\s*Indeed.*$/i, '')
    .trim();
  // Pattern 1: "Position at Company" (Lever, common ATS).
  let m = cleaned.match(/^(.+?)\s+at\s+(.+?)(\s*[-|·•].*)?$/i);
  if (m) return { position: m[1].trim(), company: m[2].trim() };
  // Pattern 2: "Position - Company" / "Position | Company" / "Position · Company".
  m = cleaned.match(/^(.+?)\s*[-|·•]\s*(.+?)(\s*[-|·•].*)?$/);
  if (m) return { position: m[1].trim(), company: m[2].trim() };
  // Fallback: assume the whole title is the position; user fills company.
  return { position: cleaned, company: '' };
}

// Map a job title string to an internal role bucket. Director check first
// so "Director of Engineering" doesn't fall through to manager. Used by
// ContactCard to render the small role label under the contact's title.
function mapTitleToRole(title) {
  if (!title) return 'unknown';
  const t = title.toLowerCase();
  if (/\b(director|vp|vice president|head of|chief|founder)\b/.test(t)) return 'director';
  if (/\b(recruiter|talent|people|hr)\b/.test(t)) return 'hr_ta';
  if (/\b(manager|lead)\b/.test(t)) return 'hiring_manager';
  if (/\b(engineer|developer|designer|analyst|specialist|consultant|associate)\b/.test(t)) return 'individual_contributor';
  return 'unknown';
}

// Read a single JobLead by id from chrome.storage.local. Used by
// ContactsContent to pre-fill SearchForm with parseJobTitle output.
async function getJobLeadById(jobId) {
  if (!jobId) return null;
  const key = 'rr_job_' + jobId;
  const data = await chrome.storage.local.get(key);
  return data[key] || null;
}

// Per-spec rr_contacts_<jobId> cache.
//
// Shape:
//   { searchedAt: number,        // Date.now() at write
//     company: string,           // user-confirmed company sent to apollo-search
//     position: string,          // user-confirmed position sent to apollo-search
//     contacts: [
//       { id, name, first_name, last_name, title, linkedin_url,
//         location, photo_url, confidence, source, is_real,
//         email?,        // present after successful unlock
//         unlockedAt?,   // present after successful unlock
//       }
//     ]
//   }
//
// 7-day TTL. Stale entries are treated as cache miss (user lands on
// SearchForm). Stale-while-revalidate background refetch is documented
// as deferred — current behavior is simpler stale-as-miss.
const CONTACTS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
function contactsCacheKey(jobId) { return 'rr_contacts_' + jobId; }

async function readContactsCache(jobId) {
  if (!jobId) return null;
  const key = contactsCacheKey(jobId);
  const data = await chrome.storage.local.get(key);
  return data[key] || null;
}

async function writeContactsCache(jobId, payload) {
  if (!jobId) return;
  const key = contactsCacheKey(jobId);
  await chrome.storage.local.set({ [key]: payload });
}

// Merge unlock fields (email + unlockedAt) into the existing contact entry
// in the cache. Doesn't overwrite the contacts array — finds the entry by
// contactId and assigns email/unlockedAt onto it. Idempotent: subsequent
// unlocks of the same contactId update in place. No-op if cache or entry
// missing (e.g., user cleared storage between search and unlock).
async function updateUnlockedContact(jobId, contactId, email) {
  const cache = await readContactsCache(jobId);
  if (!cache || !Array.isArray(cache.contacts)) return;
  const idx = cache.contacts.findIndex((c) => c && c.id === contactId);
  if (idx < 0) return;
  cache.contacts[idx] = Object.assign({}, cache.contacts[idx], {
    email: email,
    unlockedAt: Date.now(),
  });
  await writeContactsCache(jobId, cache);
}

function isStaleCache(cache) {
  if (!cache || !cache.searchedAt) return true;
  return (Date.now() - cache.searchedAt) >= CONTACTS_CACHE_TTL_MS;
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

// ── Wave 2 task 1: contacts + auth modules ─────────────────────────────────

function UserMenu(parent, state) {
  const root = document.createElement('div');
  root.className = 'rr-user-menu';
  parent.appendChild(root);

  let isSigningIn = false;
  let signInError = null;
  let signInErrorTimer = null;
  let menuPopup = null;
  let docMousedownAttached = false;
  let docKeydownAttached = false;

  function clearSignInError() {
    if (signInErrorTimer) { clearTimeout(signInErrorTimer); signInErrorTimer = null; }
    signInError = null;
    render();
  }

  function showSignInError(msg) {
    signInError = msg;
    if (signInErrorTimer) clearTimeout(signInErrorTimer);
    signInErrorTimer = setTimeout(clearSignInError, 5000);
    render();
  }

  function onDocMousedown(event) {
    if (menuPopup && !menuPopup.contains(event.target) && !root.contains(event.target)) {
      closeMenu();
    }
  }

  function onMenuKeydown(event) {
    if (event.key === 'Escape' && menuPopup) {
      const trigger = root.querySelector('.rr-user-trigger');
      closeMenu();
      if (trigger) trigger.focus();
    }
  }

  function attachDocListeners() {
    if (!docMousedownAttached) { document.addEventListener('mousedown', onDocMousedown, true); docMousedownAttached = true; }
    if (!docKeydownAttached)   { document.addEventListener('keydown', onMenuKeydown, true);    docKeydownAttached   = true; }
  }
  function detachDocListeners() {
    if (docMousedownAttached) { document.removeEventListener('mousedown', onDocMousedown, true); docMousedownAttached = false; }
    if (docKeydownAttached)   { document.removeEventListener('keydown', onMenuKeydown, true);    docKeydownAttached   = false; }
  }

  function closeMenu() {
    if (!menuPopup) return;
    menuPopup.remove();
    menuPopup = null;
    detachDocListeners();
    const trigger = root.querySelector('.rr-user-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function openMenu(triggerRect) {
    if (menuPopup) return;
    const session = state.getSession();
    if (!session) return;

    menuPopup = document.createElement('ul');
    menuPopup.className = 'rr-menu';
    menuPopup.setAttribute('role', 'menu');
    menuPopup.style.top = (triggerRect.bottom + 4) + 'px';
    menuPopup.style.right = (window.innerWidth - triggerRect.right) + 'px';

    const emailItem = document.createElement('li');
    emailItem.className = 'rr-menuitem rr-menu-static';
    emailItem.textContent = session.email || '(no email)';
    menuPopup.appendChild(emailItem);

    const sep = document.createElement('li');
    sep.setAttribute('role', 'separator');
    sep.style.borderTop = '1px solid var(--border)';
    sep.style.margin = '4px 0';
    menuPopup.appendChild(sep);

    const signOutItem = document.createElement('li');
    signOutItem.className = 'rr-menuitem rr-menuitem-destructive';
    signOutItem.setAttribute('role', 'menuitem');
    signOutItem.tabIndex = 0;
    signOutItem.textContent = STRINGS.auth.signOut;
    signOutItem.addEventListener('click', async () => {
      closeMenu();
      await signOut();
    });
    signOutItem.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); signOutItem.click(); }
    });
    menuPopup.appendChild(signOutItem);

    document.body.appendChild(menuPopup);
    attachDocListeners();
    const trigger = root.querySelector('.rr-user-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    signOutItem.focus();
  }

  async function onSignInClick() {
    if (isSigningIn) return;
    isSigningIn = true;
    if (signInErrorTimer) { clearTimeout(signInErrorTimer); signInErrorTimer = null; }
    signInError = null;
    render();

    const result = await signIn();
    isSigningIn = false;

    if (result && result.ok) {
      // Storage event will update session subscribers. Re-render now to
      // clear the spinner state without waiting for storage round-trip.
      render();
    } else if (result && result.error === 'identity_cancelled') {
      // Silent: user dismissed the Google consent screen.
      render();
    } else {
      showSignInError(STRINGS.auth.signInFailed);
    }
  }

  function render() {
    closeMenu();
    root.innerHTML = '';
    const session = state.getSession();

    if (!session) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rr-btn-secondary';
      btn.disabled = isSigningIn;
      if (isSigningIn) {
        btn.innerHTML = '<span class="rr-spinner rr-spinner-inline" aria-hidden="true"></span>' + STRINGS.auth.signingIn;
      } else {
        btn.textContent = STRINGS.auth.signIn;
        btn.addEventListener('click', onSignInClick);
      }
      root.appendChild(btn);

      if (signInError) {
        const pill = document.createElement('div');
        pill.className = 'rr-user-error';
        pill.setAttribute('role', 'alert');
        pill.textContent = signInError;
        root.appendChild(pill);
      }
    } else {
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'rr-user-trigger';
      trigger.setAttribute('aria-haspopup', 'menu');
      trigger.setAttribute('aria-expanded', 'false');

      const avatar = document.createElement('div');
      avatar.className = 'rr-user-avatar';
      avatar.setAttribute('aria-hidden', 'true');
      const name = session.displayName || session.email || '?';
      avatar.textContent = name.charAt(0).toUpperCase();
      trigger.appendChild(avatar);

      const nameEl = document.createElement('span');
      nameEl.className = 'rr-user-name';
      nameEl.textContent = session.displayName || session.email || 'Signed in';
      trigger.appendChild(nameEl);

      trigger.addEventListener('click', (event) => {
        const t = event.currentTarget;
        if (menuPopup) closeMenu();
        else openMenu(t.getBoundingClientRect());
      });
      root.appendChild(trigger);
    }
  }

  render();
  const unsubscribeSession = state.subscribeSession(render);

  return function unmount() {
    closeMenu();
    if (signInErrorTimer) clearTimeout(signInErrorTimer);
    unsubscribeSession();
    root.remove();
  };
}

function SignInPrompt(parent) {
  const root = document.createElement('div');
  root.className = 'rr-empty';

  const iconEl = document.createElement('div');
  iconEl.className = 'rr-empty-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.innerHTML = ICONS.userCircle;
  root.appendChild(iconEl);

  const heading = document.createElement('h2');
  heading.className = 'rr-empty-heading';
  heading.textContent = STRINGS.contacts.signedOut.heading;
  root.appendChild(heading);

  const body = document.createElement('p');
  body.className = 'rr-empty-body';
  body.textContent = STRINGS.contacts.signedOut.body;
  root.appendChild(body);

  let isSigningIn = false;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'rr-btn rr-signin-prompt-action';
  btn.textContent = STRINGS.contacts.signedOut.signIn;
  btn.addEventListener('click', async () => {
    if (isSigningIn) return;
    isSigningIn = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="rr-spinner rr-spinner-inline" aria-hidden="true"></span>' + STRINGS.auth.signingIn;
    const res = await signIn();
    if (res && res.ok) {
      // session subscriber will replace SignInPrompt with ContactsContent;
      // no further work needed here.
      return;
    }
    // Restore button. Errors surface in UserMenu's pill — Contacts intentionally
    // doesn't double up the error message.
    isSigningIn = false;
    btn.disabled = false;
    btn.textContent = STRINGS.contacts.signedOut.signIn;
  });
  root.appendChild(btn);

  parent.appendChild(root);
  return function unmount() { root.remove(); };
}

function ContactsEmptyHint(parent) {
  const root = document.createElement('div');
  root.className = 'rr-contacts-empty';
  root.textContent = STRINGS.contacts.emptyHint;
  parent.appendChild(root);
  return function unmount() { root.remove(); };
}

function JobPicker(parent, state) {
  const wrap = document.createElement('div');
  wrap.className = 'rr-job-picker-wrap';
  parent.appendChild(wrap);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'rr-job-picker';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');

  const label = document.createElement('span');
  label.className = 'rr-job-picker-label';
  trigger.appendChild(label);
  wrap.appendChild(trigger);

  let jobs = [];
  let listbox = null;
  let unmounted = false;
  let docMousedownAttached = false;
  let docKeydownAttached = false;

  function paintLabel() {
    const id = state.getSelectedJobId();
    const job = id ? jobs.find((j) => j.id === id) : null;
    label.classList.remove('rr-job-picker-placeholder');
    if (job) {
      label.textContent = (job.title || '(untitled)') + (job.company ? ' · ' + job.company : '');
    } else if (jobs.length === 0) {
      label.textContent = STRINGS.contacts.picker.empty;
      label.classList.add('rr-job-picker-placeholder');
    } else {
      label.textContent = STRINGS.contacts.picker.placeholder;
      label.classList.add('rr-job-picker-placeholder');
    }
    trigger.disabled = jobs.length === 0;
  }

  async function loadJobs() {
    const all = await chrome.storage.local.get(null);
    jobs = Object.keys(all)
      .filter(isJobKey)
      .map((k) => all[k])
      .filter((j) => j && j.id)
      .sort((a, b) => (b.lastActionAt || 0) - (a.lastActionAt || 0));
    if (!unmounted) paintLabel();
  }
  loadJobs().catch((err) => console.error('[picker] load failed', err));

  function onDocMousedown(event) {
    if (listbox && !listbox.contains(event.target) && !trigger.contains(event.target)) {
      closeListbox();
    }
  }
  function onListboxKeydown(event) {
    if (event.key === 'Escape' && listbox) { closeListbox(); trigger.focus(); }
  }
  function attachDocListeners() {
    if (!docMousedownAttached) { document.addEventListener('mousedown', onDocMousedown, true); docMousedownAttached = true; }
    if (!docKeydownAttached)   { document.addEventListener('keydown', onListboxKeydown, true); docKeydownAttached   = true; }
  }
  function detachDocListeners() {
    if (docMousedownAttached) { document.removeEventListener('mousedown', onDocMousedown, true); docMousedownAttached = false; }
    if (docKeydownAttached)   { document.removeEventListener('keydown', onListboxKeydown, true); docKeydownAttached   = false; }
  }

  function closeListbox() {
    if (!listbox) return;
    listbox.remove();
    listbox = null;
    trigger.setAttribute('aria-expanded', 'false');
    detachDocListeners();
  }

  function openListbox() {
    if (listbox || jobs.length === 0) return;
    listbox = document.createElement('ul');
    listbox.className = 'rr-listbox';
    listbox.setAttribute('role', 'listbox');
    const r = trigger.getBoundingClientRect();
    listbox.style.top = (r.bottom + 4) + 'px';
    listbox.style.left = r.left + 'px';
    listbox.style.width = r.width + 'px';
    listbox.style.minWidth = '0';

    const selectedId = state.getSelectedJobId();
    jobs.forEach((job) => {
      const opt = document.createElement('li');
      opt.className = 'rr-option';
      opt.setAttribute('role', 'option');
      opt.setAttribute('aria-selected', job.id === selectedId ? 'true' : 'false');
      opt.tabIndex = 0;
      opt.textContent = (job.title || '(untitled)') + (job.company ? ' · ' + job.company : '');
      opt.addEventListener('click', () => {
        state.setSelectedJobId(job.id);
        closeListbox();
      });
      opt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.click(); }
      });
      listbox.appendChild(opt);
    });

    document.body.appendChild(listbox);
    trigger.setAttribute('aria-expanded', 'true');
    attachDocListeners();
  }

  trigger.addEventListener('click', () => {
    if (trigger.disabled) return;
    if (listbox) closeListbox(); else openListbox();
  });

  function onStorageChanged(changes, areaName) {
    if (areaName !== 'local' || unmounted) return;
    let touched = false;
    for (const key of Object.keys(changes)) {
      if (isJobKey(key)) { touched = true; break; }
    }
    if (touched) loadJobs().catch((err) => console.error('[picker] reload failed', err));
  }
  chrome.storage.onChanged.addListener(onStorageChanged);
  const unsubscribeJobId = state.subscribeSelectedJobId(paintLabel);

  return function unmount() {
    unmounted = true;
    chrome.storage.onChanged.removeListener(onStorageChanged);
    unsubscribeJobId();
    closeListbox();
    wrap.remove();
  };
}

function EntitlementsBar(parent, state) {
  const root = document.createElement('div');
  root.className = 'rr-entitlements-bar';
  parent.appendChild(root);

  function paint() {
    root.innerHTML = '';
    const ent = state.getEntitlements();
    const session = state.getSession();
    if (!ent) {
      root.textContent = STRINGS.contacts.entitlements.loading;
      return;
    }
    const text = document.createElement('span');
    text.textContent =
      STRINGS.contacts.entitlements.unlocksUsed(ent.unlocksUsed, ent.unlocksLimit) +
      STRINGS.contacts.entitlements.separator +
      ent.subscriptionStatus +
      STRINGS.contacts.entitlements.planSuffix;
    root.appendChild(text);

    if (ent.subscriptionStatus === 'free' && session && session.uid) {
      const sep = document.createElement('span');
      sep.textContent = STRINGS.contacts.entitlements.separator;
      root.appendChild(sep);

      const upgrade = document.createElement('button');
      upgrade.type = 'button';
      upgrade.className = 'rr-link rr-entitlements-upgrade';
      upgrade.textContent = STRINGS.contacts.entitlements.upgrade;
      upgrade.addEventListener('click', () => {
        const url = STRIPE_CHECKOUT_URL_BASE + '?client_reference_id=' + encodeURIComponent(session.uid);
        chrome.tabs.create({ url, active: true })
          .catch((err) => console.error('[contacts] tabs.create failed', err));
      });
      root.appendChild(upgrade);
    }
  }
  paint();
  const unsubEnt = state.subscribeEntitlements(paint);
  const unsubSession = state.subscribeSession(paint);

  return function unmount() {
    unsubEnt();
    unsubSession();
    root.remove();
  };
}

// ── Wave 2 task 1 continuation: search form, contact list, contact card ───

function SearchForm(parent, state, options) {
  // options: { initialCompany, initialPosition, onSearchSuccess }
  options = options || {};
  const root = document.createElement('div');
  root.className = 'rr-search-form';

  const heading = document.createElement('h3');
  heading.className = 'rr-search-form-heading';
  heading.textContent = STRINGS.contacts.search.heading;
  root.appendChild(heading);

  const companyLabel = document.createElement('label');
  companyLabel.className = 'rr-search-form-label';
  companyLabel.textContent = STRINGS.contacts.search.companyLabel;
  companyLabel.htmlFor = 'rr-search-company';
  root.appendChild(companyLabel);
  const companyInput = document.createElement('input');
  companyInput.type = 'text';
  companyInput.className = 'rr-search-form-input';
  companyInput.id = 'rr-search-company';
  companyInput.value = options.initialCompany || '';
  root.appendChild(companyInput);

  const positionLabel = document.createElement('label');
  positionLabel.className = 'rr-search-form-label';
  positionLabel.textContent = STRINGS.contacts.search.positionLabel;
  positionLabel.htmlFor = 'rr-search-position';
  root.appendChild(positionLabel);
  const positionInput = document.createElement('input');
  positionInput.type = 'text';
  positionInput.className = 'rr-search-form-input';
  positionInput.id = 'rr-search-position';
  positionInput.value = options.initialPosition || '';
  root.appendChild(positionInput);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'rr-btn rr-search-form-submit';
  btn.textContent = STRINGS.contacts.search.submit;
  root.appendChild(btn);

  const errorPill = document.createElement('div');
  errorPill.className = 'rr-search-form-error';
  errorPill.style.display = 'none';
  errorPill.setAttribute('role', 'alert');
  root.appendChild(errorPill);

  let isPending = false;
  let unmounted = false;

  function showError(msg) {
    errorPill.textContent = msg;
    errorPill.style.display = 'block';
  }
  function clearError() {
    errorPill.style.display = 'none';
    errorPill.textContent = '';
  }

  async function onSubmit() {
    if (isPending || unmounted) return;
    const company = companyInput.value.trim();
    const position = positionInput.value.trim();
    if (!company || !position) {
      showError(STRINGS.contacts.search.errorEmptyInputs);
      return;
    }
    clearError();
    isPending = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="rr-spinner rr-spinner-inline" aria-hidden="true"></span>' + STRINGS.contacts.search.searching;

    try {
      const res = await rrPanelFetch('/api/apollo-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: company, position: position }),
      });
      if (unmounted) return;
      if (!res.ok) {
        showError(STRINGS.contacts.search.errorGeneric);
        return;
      }
      const data = await res.json();
      const all = (data && Array.isArray(data.contacts)) ? data.contacts : [];
      // Filter out the synthetic placeholder (is_real:false / id:null) the
      // backend emits when zero real contacts found. Empty results render
      // the "No contacts found" empty state inside ContactList.
      const real = all.filter((c) => c && c.is_real && c.id);
      if (typeof options.onSearchSuccess === 'function') {
        options.onSearchSuccess({ company: company, position: position, contacts: real });
      }
    } catch (err) {
      if (err && err.message === 'not_signed_in') return; // session subscriber will handle
      showError(STRINGS.contacts.search.errorGeneric);
    } finally {
      if (!unmounted) {
        isPending = false;
        btn.disabled = false;
        btn.textContent = STRINGS.contacts.search.submit;
      }
    }
  }

  function onKeydown(event) {
    if (event.key === 'Enter') { event.preventDefault(); onSubmit(); }
  }

  btn.addEventListener('click', onSubmit);
  companyInput.addEventListener('keydown', onKeydown);
  positionInput.addEventListener('keydown', onKeydown);

  parent.appendChild(root);

  return function unmount() {
    unmounted = true;
    btn.removeEventListener('click', onSubmit);
    companyInput.removeEventListener('keydown', onKeydown);
    positionInput.removeEventListener('keydown', onKeydown);
    root.remove();
  };
}

function ContactCard(parent, state, contact, options) {
  // options: { jobId }
  options = options || {};
  const root = document.createElement('div');
  root.className = 'rr-contact-card';

  // Avatar (photo_url img with first-letter circle fallback).
  const avatar = document.createElement('div');
  avatar.className = 'rr-contact-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  if (contact.photo_url) {
    const img = document.createElement('img');
    img.src = contact.photo_url;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      // photo_url 404'd / blocked / hotlink-protected; fall back to initial.
      if (img.parentNode === avatar) avatar.removeChild(img);
      avatar.textContent = (contact.name || '?').charAt(0).toUpperCase();
    };
    avatar.appendChild(img);
  } else {
    avatar.textContent = (contact.name || '?').charAt(0).toUpperCase();
  }
  root.appendChild(avatar);

  const body = document.createElement('div');
  body.className = 'rr-contact-body';

  // Header row: name + confidence badge + LinkedIn icon.
  const headerRow = document.createElement('div');
  headerRow.className = 'rr-contact-header';

  const name = document.createElement('span');
  name.className = 'rr-contact-name';
  name.textContent = contact.name || '(unknown)';
  headerRow.appendChild(name);

  const badge = document.createElement('span');
  badge.className = 'rr-confidence-badge rr-confidence-' + (contact.confidence || 'pattern');
  badge.textContent = contact.confidence === 'verified' ? 'verified' : 'pattern';
  headerRow.appendChild(badge);

  if (contact.linkedin_url) {
    const link = document.createElement('a');
    link.href = contact.linkedin_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'rr-contact-linkedin';
    link.title = STRINGS.contacts.card.openLinkedIn;
    link.setAttribute('aria-label', STRINGS.contacts.card.openLinkedIn);
    link.innerHTML = ICONS.arrowSquareOut;
    headerRow.appendChild(link);
  }

  body.appendChild(headerRow);

  // Title.
  if (contact.title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'rr-contact-title-text';
    titleEl.textContent = contact.title;
    body.appendChild(titleEl);
  }

  // Meta row: bucketed role + location.
  const meta = document.createElement('div');
  meta.className = 'rr-contact-meta';
  const roleKey = mapTitleToRole(contact.title);
  const roleLabel = STRINGS.contacts.card.role[roleKey] || STRINGS.contacts.card.role.unknown;
  const roleEl = document.createElement('span');
  roleEl.className = 'rr-contact-role';
  roleEl.textContent = roleLabel;
  meta.appendChild(roleEl);
  if (contact.location) {
    const sep = document.createElement('span');
    sep.textContent = ' · ';
    meta.appendChild(sep);
    const locEl = document.createElement('span');
    locEl.className = 'rr-contact-location';
    locEl.textContent = contact.location;
    meta.appendChild(locEl);
  }
  body.appendChild(meta);

  // Action row (rendered by renderAction; rebuilt on state change).
  const actionRow = document.createElement('div');
  actionRow.className = 'rr-contact-action-row';
  body.appendChild(actionRow);

  root.appendChild(body);

  // Local state. NOT in appState — UI-local to this card only.
  let isUnlocking = false;
  let isPaywalled = false;
  let unlockError = null;
  let unlockErrorTimer = null;
  let copyTimer = null;
  // Email may be pre-loaded from cache (previously unlocked); preserve it.
  let unlockedEmail = contact.email || null;
  let unmounted = false;

  function clearUnlockError() {
    if (unlockErrorTimer) { clearTimeout(unlockErrorTimer); unlockErrorTimer = null; }
    unlockError = null;
    if (!unmounted) renderAction();
  }
  function showUnlockError(msg) {
    unlockError = msg;
    if (unlockErrorTimer) clearTimeout(unlockErrorTimer);
    unlockErrorTimer = setTimeout(clearUnlockError, 5000);
    renderAction();
  }

  function renderAction() {
    actionRow.innerHTML = '';
    if (unlockedEmail) {
      // Revealed state.
      const emailEl = document.createElement('span');
      emailEl.className = 'rr-contact-email';
      emailEl.textContent = unlockedEmail;
      actionRow.appendChild(emailEl);

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'rr-link rr-contact-copy';
      copyBtn.textContent = STRINGS.contacts.card.copy;
      copyBtn.addEventListener('click', () => {
        try {
          navigator.clipboard.writeText(unlockedEmail);
          copyBtn.textContent = STRINGS.contacts.card.copied;
          if (copyTimer) clearTimeout(copyTimer);
          copyTimer = setTimeout(() => {
            if (!unmounted) copyBtn.textContent = STRINGS.contacts.card.copy;
            copyTimer = null;
          }, 1500);
        } catch (e) {
          console.error('[card] copy failed', e);
        }
      });
      actionRow.appendChild(copyBtn);

      if (contact.confidence === 'pattern') {
        const caveat = document.createElement('div');
        caveat.className = 'rr-pattern-caveat';
        caveat.textContent = STRINGS.contacts.card.patternCaveat;
        actionRow.appendChild(caveat);
      }
    } else if (isPaywalled) {
      const paywall = document.createElement('div');
      paywall.className = 'rr-contact-paywall';
      const text = document.createElement('span');
      text.textContent = STRINGS.contacts.card.paywallText + ' ';
      paywall.appendChild(text);
      const upgradeBtn = document.createElement('button');
      upgradeBtn.type = 'button';
      upgradeBtn.className = 'rr-link';
      upgradeBtn.textContent = STRINGS.contacts.card.paywallUpgrade;
      upgradeBtn.addEventListener('click', () => {
        chrome.storage.local.get('rr_user_session').then((data) => {
          const session = data.rr_user_session;
          if (!session || !session.uid) return;
          const url = STRIPE_CHECKOUT_URL_BASE + '?client_reference_id=' + encodeURIComponent(session.uid);
          chrome.tabs.create({ url, active: true })
            .catch((err) => console.error('[card] tabs.create failed', err));
        });
      });
      paywall.appendChild(upgradeBtn);
      actionRow.appendChild(paywall);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rr-btn rr-unlock-btn';
      btn.disabled = isUnlocking;
      if (isUnlocking) {
        btn.innerHTML = '<span class="rr-spinner rr-spinner-inline" aria-hidden="true"></span>' + STRINGS.contacts.card.unlocking;
      } else {
        btn.textContent = contact.confidence === 'verified'
          ? STRINGS.contacts.card.unlockVerified
          : STRINGS.contacts.card.unlockPattern;
        btn.addEventListener('click', onUnlockClick);
      }
      actionRow.appendChild(btn);

      if (unlockError) {
        const pill = document.createElement('div');
        pill.className = 'rr-contact-error-pill';
        pill.setAttribute('role', 'alert');
        pill.textContent = unlockError;
        actionRow.appendChild(pill);
      }
    }
  }

  async function onUnlockClick() {
    if (isUnlocking) return;
    isUnlocking = true;
    if (unlockErrorTimer) { clearTimeout(unlockErrorTimer); unlockErrorTimer = null; }
    unlockError = null;
    renderAction();

    try {
      const res = await rrPanelFetch('/api/contact-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id, jobId: options.jobId }),
      });
      if (unmounted) return;

      if (res.status === 402) {
        isUnlocking = false;
        isPaywalled = true;
        renderAction();
        return;
      }
      if (!res.ok) {
        isUnlocking = false;
        const msg = res.status === 500
          ? STRINGS.contacts.card.errorDb
          : STRINGS.contacts.card.errorGeneric;
        showUnlockError(msg);
        return;
      }

      const data = await res.json();
      if (!data || data.ok !== true || !data.email) {
        isUnlocking = false;
        showUnlockError(STRINGS.contacts.card.errorGeneric);
        return;
      }

      unlockedEmail = data.email;
      isUnlocking = false;
      renderAction();

      // Persist to cache so re-renders (and panel reload) show the unlocked
      // state without re-spending a credit. Fire-and-forget; UI is already
      // updated.
      updateUnlockedContact(options.jobId, contact.id, data.email)
        .catch((err) => console.error('[card] cache update failed', err));

      // Refresh entitlements counter (server-side increment happened during
      // unlock; pull the fresh value into appState so EntitlementsBar repaints).
      fetchEntitlements(state)
        .catch((err) => console.error('[card] entitlements refresh failed', err));
    } catch (err) {
      isUnlocking = false;
      if (err && err.message === 'not_signed_in') return; // session subscriber will handle
      showUnlockError(STRINGS.contacts.card.errorGeneric);
    }
  }

  renderAction();
  parent.appendChild(root);

  return function unmount() {
    unmounted = true;
    // Clear timers to prevent leaks (unlockErrorTimer auto-clear, copy timer revert).
    if (unlockErrorTimer) { clearTimeout(unlockErrorTimer); unlockErrorTimer = null; }
    if (copyTimer)        { clearTimeout(copyTimer);        copyTimer = null; }
    root.remove();
  };
}

function ContactList(parent, state, options) {
  // options: { jobId, company, position, contacts, onNewSearch, onEditSearch }
  options = options || {};
  const root = document.createElement('div');
  root.className = 'rr-contact-list-wrap';

  // Context bar: "Stripe · Senior Engineer · [New search]"
  const contextBar = document.createElement('div');
  contextBar.className = 'rr-context-bar';
  const contextText = document.createElement('span');
  contextText.textContent =
    options.company +
    STRINGS.contacts.list.contextSeparator +
    options.position +
    STRINGS.contacts.list.contextSeparator;
  contextBar.appendChild(contextText);
  const newSearchLink = document.createElement('button');
  newSearchLink.type = 'button';
  newSearchLink.className = 'rr-link rr-context-bar-link';
  newSearchLink.textContent = STRINGS.contacts.list.newSearch;
  newSearchLink.addEventListener('click', () => {
    if (typeof options.onNewSearch === 'function') options.onNewSearch();
  });
  contextBar.appendChild(newSearchLink);
  root.appendChild(contextBar);

  const cardHandles = [];
  const contacts = Array.isArray(options.contacts) ? options.contacts : [];

  if (contacts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'rr-contact-list-empty';
    const heading = document.createElement('h2');
    heading.className = 'rr-empty-heading';
    heading.textContent = STRINGS.contacts.list.empty.heading(options.company);
    empty.appendChild(heading);
    const body = document.createElement('p');
    body.className = 'rr-empty-body';
    body.textContent = STRINGS.contacts.list.empty.body;
    empty.appendChild(body);
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'rr-btn rr-signin-prompt-action';
    editBtn.textContent = STRINGS.contacts.list.empty.editSearch;
    editBtn.addEventListener('click', () => {
      if (typeof options.onEditSearch === 'function') options.onEditSearch();
    });
    empty.appendChild(editBtn);
    root.appendChild(empty);
  } else {
    const listEl = document.createElement('div');
    listEl.className = 'rr-contact-list';
    contacts.forEach((contact) => {
      const handle = ContactCard(listEl, state, contact, { jobId: options.jobId });
      cardHandles.push(handle);
    });
    root.appendChild(listEl);
  }

  parent.appendChild(root);

  return function unmount() {
    cardHandles.forEach((h) => { try { h(); } catch (e) {} });
    root.remove();
  };
}

function ContactsContent(parent, state) {
  const root = document.createElement('div');
  root.className = 'rr-contacts-content';
  parent.appendChild(root);

  const pickerHandle = JobPicker(root, state);
  const entitlementsHandle = EntitlementsBar(root, state);

  const lowerArea = document.createElement('div');
  root.appendChild(lowerArea);

  // ContactsContent state machine for the lower area:
  //   no selectedJobId          → ContactsEmptyHint
  //   selectedJobId, fresh cache → ContactList
  //   selectedJobId, no cache OR stale (>=7d) → SearchForm
  //   selectedJobId, forceShowForm flag        → SearchForm (set by New search / Edit search)
  //
  // Stale = treat as miss. Stale-while-revalidate (background refetch +
  // "Last refreshed N days ago" hint) is documented as deferred — current
  // behavior is simpler stale-as-miss.
  let lowerHandle = null;
  let unmounted = false;
  let currentJobId = null;
  let forceShowForm = false;

  function teardownLower() {
    if (lowerHandle) { try { lowerHandle(); } catch (e) {} lowerHandle = null; }
  }

  function mountSearchForm(initial) {
    teardownLower();
    lowerHandle = SearchForm(lowerArea, state, {
      initialCompany: initial.company || '',
      initialPosition: initial.position || '',
      onSearchSuccess: (result) => {
        // Persist fresh cache then mount the list view.
        const cachePayload = {
          searchedAt: Date.now(),
          company: result.company,
          position: result.position,
          contacts: result.contacts,
        };
        writeContactsCache(currentJobId, cachePayload)
          .catch((err) => console.error('[contacts] cache write failed', err));
        forceShowForm = false;
        mountList(cachePayload);
      },
    });
  }

  function mountList(cache) {
    teardownLower();
    lowerHandle = ContactList(lowerArea, state, {
      jobId: currentJobId,
      company: cache.company,
      position: cache.position,
      contacts: cache.contacts,
      onNewSearch: () => {
        // "New search" bypasses the cache (does NOT clear it). Pre-fill
        // from the cached company/position so the user can edit and resubmit.
        // Cache is overwritten only when a new search succeeds.
        forceShowForm = true;
        mountSearchForm({
          company: cache.company || '',
          position: cache.position || '',
        });
      },
      onEditSearch: () => {
        // Empty results: user wants to edit and try again.
        forceShowForm = true;
        mountSearchForm({
          company: cache.company || '',
          position: cache.position || '',
        });
      },
    });
  }

  function mountEmptyHint() {
    teardownLower();
    lowerHandle = ContactsEmptyHint(lowerArea);
  }

  async function renderLower() {
    if (unmounted) return;
    const id = state.getSelectedJobId();
    currentJobId = id;
    if (!id) {
      forceShowForm = false;
      mountEmptyHint();
      return;
    }

    if (forceShowForm) {
      // Already showing form via mountSearchForm in onNewSearch / onEditSearch;
      // no need to remount.
      return;
    }

    let cache = null;
    try { cache = await readContactsCache(id); }
    catch (err) { console.error('[contacts] cache read failed', err); }
    if (unmounted) return;
    if (id !== state.getSelectedJobId()) return; // selectedJobId changed mid-read

    if (cache && !isStaleCache(cache)) {
      mountList(cache);
    } else {
      // No cache, or stale. Pre-fill form from the JobLead title parser.
      let parsed = { company: '', position: '' };
      try {
        const job = await getJobLeadById(id);
        if (job && job.title) parsed = parseJobTitle(job.title);
      } catch (err) {
        console.error('[contacts] job read failed', err);
      }
      if (unmounted || id !== state.getSelectedJobId()) return;
      mountSearchForm(parsed);
    }
  }

  renderLower();
  const unsubscribeJobId = state.subscribeSelectedJobId(() => {
    // Switching to a different job resets the form-flag — fresh job gets
    // its own cache lookup, not the stale forceShowForm intent from a
    // prior job.
    forceShowForm = false;
    renderLower();
  });

  return function unmount() {
    unmounted = true;
    unsubscribeJobId();
    teardownLower();
    if (entitlementsHandle) entitlementsHandle();
    if (pickerHandle) pickerHandle();
    root.remove();
  };
}

function Contacts(parent, state) {
  let lastSignedIn = !!state.getSession();
  let innerHandle = null;
  let unmounted = false;

  function mountInner() {
    if (innerHandle) { innerHandle(); innerHandle = null; }
    if (state.getSession()) {
      innerHandle = ContactsContent(parent, state);
    } else {
      innerHandle = SignInPrompt(parent);
    }
  }
  mountInner();

  // Trigger entitlements fetch on initial mount when signed in.
  if (state.getSession()) {
    fetchEntitlements(state).catch((err) => console.error('[contacts] entitlements fetch failed', err));
  }

  function onSessionChange() {
    if (unmounted) return;
    const nowSignedIn = !!state.getSession();
    if (nowSignedIn !== lastSignedIn) {
      lastSignedIn = nowSignedIn;
      mountInner();
      if (nowSignedIn) {
        fetchEntitlements(state).catch((err) => console.error('[contacts] entitlements fetch failed', err));
      }
    }
  }
  const unsubscribeSession = state.subscribeSession(onSessionChange);

  function onTabChange() {
    if (unmounted) return;
    if (state.getActiveTab() === 'contacts' && state.getSession()) {
      fetchEntitlements(state).catch((err) => console.error('[contacts] entitlements fetch failed', err));
    }
  }
  const unsubscribeTab = state.subscribe(onTabChange);

  return function unmount() {
    unmounted = true;
    unsubscribeSession();
    unsubscribeTab();
    if (innerHandle) innerHandle();
  };
}
// ── end Wave 2 task 1 modules ──────────────────────────────────────────────

function App(parent, state) {
  parent.innerHTML = '';
  const tabsUnmount = Tabs(parent, state);

  const content = document.createElement('div');
  content.className = 'rr-tab-content';
  parent.appendChild(content);

  // Mount one tabpanel per tab upfront. Tracker and Contacts get their real
  // modules; the other three show a coming-soon EmptyState. No mount/unmount
  // churn on tab switch (visibility is toggled via the `hidden` attribute).
  const panels = TAB_IDS.map((id) => {
    const panel = document.createElement('section');
    panel.setAttribute('role', 'tabpanel');
    panel.id = 'rr-tabpanel-' + id;
    panel.setAttribute('aria-labelledby', 'rr-tab-' + id);
    panel.className = 'rr-tabpanel';
    panel.dataset.tab = id;
    content.appendChild(panel);
    let contentUnmount;
    if (id === 'tracker') {
      contentUnmount = Tracker(panel, state);
    } else if (id === 'contacts') {
      contentUnmount = Contacts(panel, state);
    } else {
      contentUnmount = EmptyState(panel, {
        icon: TAB_ICON[id],
        body: STRINGS.tabs[id].emptyBody,
      });
    }
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
let userMenuUnmount = null;

// Wave 2 task 1: rr_user_session is the source of truth for auth state.
// Background SW writes (signIn/signOut/refresh); panel mirrors via this
// listener. Attached once (idempotent flag) on first boot(); persists for
// the panel's lifetime since chrome.storage.onChanged listeners are
// document-scoped and can't be re-added without leaks.
let sessionStorageListenerAttached = false;
function attachSessionStorageListener() {
  if (sessionStorageListenerAttached) return;
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if ('rr_user_session' in changes) {
      const newValue = changes.rr_user_session.newValue || null;
      if (appState) appState.setSession(newValue);
    }
  });
  sessionStorageListenerAttached = true;
}

async function boot() {
  applyI18n();
  setState(STATES.LOADING);
  if (appUnmount) { appUnmount(); appUnmount = null; }
  if (userMenuUnmount) { userMenuUnmount(); userMenuUnmount = null; }
  try {
    const { state: nextState, initialTab, initialSession } = await rehydrate();
    if (!appState) {
      appState = createAppState(initialTab, initialSession);
    } else {
      // Retry path: re-sync session in case it changed between boots.
      appState.setSession(initialSession);
    }
    attachSessionStorageListener();
    setState(nextState);
    appUnmount = App($('rr-app-root'), appState);
    userMenuUnmount = UserMenu($('rr-user-menu'), appState);
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

// Wave 1 task 9 part E (test harness): a single guard at the bottom of the
// file lets tests/index.html load this script for its function declarations
// without booting the panel UI or wiring listeners that depend on real DOM
// stubs. Production loads (sidepanel.html) leave RR_TEST_MODE undefined and
// run normally.
if (typeof window === 'undefined' || !window.RR_TEST_MODE) {
  $('rr-retry-btn').addEventListener('click', boot);
  $('rr-expand-btn').addEventListener('click', () => setState(STATES.READY));

  // Service worker can drive state changes by sending { type: 'rr_set_state', state, error, notice? }.
  // Notice rendering is deferred (Option A from Wave 0 task 7); the field is observable in devtools.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'rr_set_state') setState(msg.state, msg.error);
  });

  boot();
}
