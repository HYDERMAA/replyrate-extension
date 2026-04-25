// =============================================================================
// MESSAGE CONTRACT (Wave 0 task 5)
// =============================================================================
// Every cross-context message used by the extension is documented below.
// Adding a new message type is a two-line change: a new entry in this block
// AND a new row in MESSAGE_HANDLERS at the bottom of this file.
//
// Direction legend:
//   bg = background service worker
//   sp = side panel
//   cs = content script (Lever, Indeed; LinkedIn no longer injects per task 7)
//
// 1. rr_set_state                                         direction: bg -> sp
//    request:  { type: 'rr_set_state', state, error?, notice? }
//      state  = 'collapsed' | 'loading' | 'ready' | 'error'
//      error  = human-readable string when state === 'error'
//      notice = optional i18n key, e.g. 'rr_notice_not_a_job_page',
//               'rr_notice_already_saved' (panel rendering deferred)
//    response: none (broadcast, fire-and-forget)
//    sender:   bg only. Use pushPanelState() or pushPanelEvent('state', ...).
//
// 2. rr_capture_active_tab                                direction: sp -> bg
//    request:  { type: 'rr_capture_active_tab', tabId: number }
//    response: { accepted: true } sent synchronously. Capture result follows
//              later via an rr_set_state broadcast.
//    sender:   sp only.   responseStyle: sync_ack
//
// 3. SAVE_JOB                                             direction: cs -> bg
//    request:  { type: 'SAVE_JOB',
//                sourceType: 'lever' | 'indeed',
//                title: string,
//                rawUrl: string }
//    response: { ok: true, id: string, deduped?: true }
//              | { ok: false, error: string }
//    sender:   cs only (requires sender.tab.id).   responseStyle: async
//    SAVE_JOB requires a tab sender by design. Future flows that need to save
//    a job from a non-tab context (manual URL paste, side-panel "add job"
//    button, etc.) should use a new message type, not overload SAVE_JOB.
//
// Future events from bg -> sp (capture_complete, save_complete, ...) go
// through pushPanelEvent so call sites do not need to know the wire format.
// =============================================================================

// Wave 0 task 4: toolbar icon opens the side panel everywhere (including
// LinkedIn, where there is no on-page injection per task 7). Runs on every
// service-worker wake; setPanelBehavior is idempotent.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('[background] setPanelBehavior failed', err));

// Wave 0 task 7: capture lives behind a message contract so tasks 6 and 8
// can reuse it for Lever, Indeed, Greenhouse, Workday by switching on
// sourceType inside captureActiveTabIfEligible. Service worker stays the
// single source of truth for chrome.storage.local writes.

// JobLead id shape: 'job_<unix-millis>_<7-char base36 random>' to mirror the
// SPA's existing app_<ts>_<7char> ids. Cheap collision avoidance, and the
// timestamp prefix keeps a scan over rr_job_* keys roughly chronological.
function newJobLeadId() {
  return 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

// Reduce a LinkedIn job URL to its canonical form:
//   'https://www.linkedin.com/jobs/view/<id>/'
// Handles three URL shapes:
//   1. https://www.linkedin.com/jobs/view/<digits>/... (direct view page)
//   2. https://www.linkedin.com/jobs/collections/...?currentJobId=<digits>
//   3. https://www.linkedin.com/jobs/search/...?currentJobId=<digits>
// Returns null for /feed/, bare /jobs/, /jobs/collections/recommended/ with
// no currentJobId, malformed URLs, and any other LinkedIn URL.
function canonicalLinkedInJobUrl(rawUrl) {
  if (!rawUrl) return null;
  // Fast path: /jobs/view/<digits> (with or without trailing slash and noise).
  const direct = rawUrl.match(/^https:\/\/(?:www\.)?linkedin\.com\/jobs\/view\/(\d+)/i);
  if (direct) return 'https://www.linkedin.com/jobs/view/' + direct[1] + '/';
  // Collections and search list pages carry the active job in ?currentJobId.
  let parsed;
  try { parsed = new URL(rawUrl); }
  catch (e) { return null; }
  if (!/(?:^|\.)linkedin\.com$/i.test(parsed.hostname)) return null;
  if (!parsed.pathname.startsWith('/jobs/collections/') &&
      !parsed.pathname.startsWith('/jobs/search/')) {
    return null;
  }
  const id = parsed.searchParams.get('currentJobId');
  if (!id || !/^\d+$/.test(id)) return null;
  return 'https://www.linkedin.com/jobs/view/' + id + '/';
}

async function captureActiveTabIfEligible(tabId) {
  if (tabId == null) { pushPanelState('ready'); return; }

  let tab;
  try { tab = await chrome.tabs.get(tabId); }
  catch (err) {
    console.error('[background] tabs.get failed', err);
    pushPanelState('ready');
    return;
  }

  const url = tab && tab.url;
  const isLinkedIn = url && /^https:\/\/(?:www\.)?linkedin\.com\//i.test(url);
  if (!isLinkedIn) {
    // Non-LinkedIn tab. Other source types land in tasks 6 and 8.
    pushPanelState('ready');
    return;
  }

  const canonicalUrl = canonicalLinkedInJobUrl(url);
  if (!canonicalUrl) {
    // On linkedin.com but not on /jobs/view/<id>. No capture, but tell the
    // panel why so the UI (when wired) can explain what to click instead.
    pushPanelState('ready', null, 'rr_notice_not_a_job_page');
    return;
  }

  // Linear scan over rr_job_* keys. Acceptable at v1 volumes; task 9+ will
  // index if needed.
  const all = await chrome.storage.local.get(null);
  const dupeKey = Object.keys(all).find(
    (k) => k.indexOf('rr_job_') === 0 && all[k] && all[k].sourceUrl === canonicalUrl
  );

  if (dupeKey) {
    // Touch lastActionAt so the panel can sort by recency without changing
    // createdAt. Skip writing a duplicate JobLead.
    const existing = all[dupeKey];
    existing.lastActionAt = Date.now();
    await chrome.storage.local.set({ [dupeKey]: existing });
    pushPanelState('ready', null, 'rr_notice_already_saved');
    return;
  }

  const id = newJobLeadId();
  const now = Date.now();
  const jobLead = {
    id,
    title: tab.title || '',
    company: null,
    location: null,
    sourceType: 'linkedin',
    sourceUrl: canonicalUrl,
    salaryText: null,
    descriptionHash: null,
    fitBand: null,
    stage: 'saved',
    createdAt: now,
    lastActionAt: now,
    nextActionAt: null,
  };
  await chrome.storage.local.set({ ['rr_job_' + id]: jobLead });
  pushPanelState('ready');
}

// rr_set_state broadcaster. See contract block at top of file. Prefer
// pushPanelEvent('state', { state, error, notice }) at new call sites so
// future event types can be added without churning every caller.
function pushPanelState(state, error, notice) {
  // Fire-and-forget. The panel may not be listening yet if it just opened;
  // its own boot() will land in 'ready' independently.
  try {
    const msg = { type: 'rr_set_state', state };
    if (error)  msg.error  = error;
    if (notice) msg.notice = notice;
    chrome.runtime.sendMessage(msg).catch(() => {});
  } catch (e) { /* ignore */ }
}

// Generalized bg -> sp event broadcast. Wraps pushPanelState today; future
// Wave 1/2 events ('capture_complete', 'save_complete', ...) get added here
// without touching call sites that only need state changes.
function pushPanelEvent(eventType, payload) {
  switch (eventType) {
    case 'state': {
      // payload: { state, error?, notice? }
      const p = payload || {};
      pushPanelState(p.state, p.error, p.notice);
      return;
    }
    default:
      console.warn('[messages] unknown panel event type:', eventType);
  }
}

// Reduce a Lever job URL to its canonical form by stripping query/fragment.
// Lever URLs look like https://jobs.lever.co/<company>/<job-id> with optional
// ?source=... tracking params. Path uniquely identifies the posting; we keep
// the full path including any /apply suffix that Lever sometimes appends.
function canonicalLeverUrl(rawUrl) {
  if (!rawUrl) return null;
  let parsed;
  try { parsed = new URL(rawUrl); }
  catch (e) { return null; }
  if (!/(?:^|\.)lever\.co$/i.test(parsed.hostname)) return null;
  return parsed.origin + parsed.pathname;
}

// Reduce an Indeed job URL to its canonical form. Indeed serves the same
// posting under many hosts (uk.indeed.com, www.indeed.com), via /viewjob and
// /jobs?jk= shapes, with an unbounded set of tracking params. The jk hash is
// the stable id, so we collapse everything to:
//   https://www.indeed.com/viewjob?jk=<id>
// Returns null when no jk param is present (search results lists, etc.).
function canonicalIndeedUrl(rawUrl) {
  if (!rawUrl) return null;
  let parsed;
  try { parsed = new URL(rawUrl); }
  catch (e) { return null; }
  if (!/(?:^|\.)indeed\.com$/i.test(parsed.hostname)) return null;
  // Two URL shapes carry the job id:
  //   1. /viewjob?jk=<id>          direct posting page
  //   2. /jobs?...&vjk=<id>        search-results page with a selected card
  //      /m/jobs?...&vjk=<id>      mobile search-results variant
  // jk and vjk are the same hash (vjk = "viewed job key") so both flows
  // collapse to the same canonical sourceUrl and dedupe across each other.
  let id = parsed.searchParams.get('jk');
  if (!id) {
    const onJobsPath =
      parsed.pathname === '/jobs'   || parsed.pathname.startsWith('/jobs/')   ||
      parsed.pathname === '/m/jobs' || parsed.pathname.startsWith('/m/jobs/');
    if (onJobsPath) id = parsed.searchParams.get('vjk');
  }
  // Indeed ids are 16 hex characters in practice; accept any alphanumeric
  // string defensively. Reject empty / punctuation / encoded values so we
  // don't poison rr_job_* with an unstable canonical form.
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) return null;
  return 'https://www.indeed.com/viewjob?jk=' + id;
}

// Save flow for content-script-driven sources (Lever, Indeed). Mirrors the
// LinkedIn flow in captureActiveTabIfEligible: dedupe by canonical sourceUrl,
// touch lastActionAt on hit, write a fresh JobLead on miss. Returns the
// content-script-friendly result envelope:
//   { ok: true, id }                  fresh write
//   { ok: true, id, deduped: true }   existing record bumped
//   { ok: false, error: <code> }      validation failure, no write
async function saveFromContentScript(msg) {
  const sourceType = msg && msg.sourceType;
  const canonicalize =
    sourceType === 'lever'  ? canonicalLeverUrl  :
    sourceType === 'indeed' ? canonicalIndeedUrl :
    null;
  if (!canonicalize) return { ok: false, error: 'unknown_source' };

  const canonicalUrl = canonicalize(msg.rawUrl);
  if (!canonicalUrl) return { ok: false, error: 'invalid_url' };

  const all = await chrome.storage.local.get(null);
  const dupeKey = Object.keys(all).find(
    (k) => k.indexOf('rr_job_') === 0 && all[k] && all[k].sourceUrl === canonicalUrl
  );

  if (dupeKey) {
    const existing = all[dupeKey];
    existing.lastActionAt = Date.now();
    await chrome.storage.local.set({ [dupeKey]: existing });
    return { ok: true, id: existing.id, deduped: true };
  }

  const id = newJobLeadId();
  const now = Date.now();
  const jobLead = {
    id,
    title: (msg.title || '').toString(),
    company: null,
    location: null,
    sourceType,
    sourceUrl: canonicalUrl,
    salaryText: null,
    descriptionHash: null,
    fitBand: null,
    stage: 'saved',
    createdAt: now,
    lastActionAt: now,
    nextActionAt: null,
  };
  await chrome.storage.local.set({ ['rr_job_' + id]: jobLead });
  return { ok: true, id };
}

// ---- Message handlers ------------------------------------------------------
// Each handler matches its dispatch-table responseStyle:
//   responseStyle: 'async'    => handler must call sendResponse later via a
//                                promise; the dispatcher returns true so the
//                                port stays open.
//   responseStyle: 'sync_ack' => handler must call sendResponse({accepted:true})
//                                synchronously, then kick off async work; the
//                                dispatcher returns false. Real result flows
//                                back via pushPanelEvent broadcasts.

function handleSaveJob(msg, sender, sendResponse) {
  // Open synchronously: the content-script user-gesture decays during the
  // async storage work below, so a post-write open() typically fails. The
  // dispatcher's requiresTabSender:true gate means sender.tab.id is set.
  chrome.sidePanel
    .open({ tabId: sender.tab.id })
    .catch((err) => console.warn('[save-flow] sidePanel.open failed', err));
  saveFromContentScript(msg).then(
    (res) => sendResponse(res),
    (err) => {
      console.error('[background] saveFromContentScript failed', err);
      sendResponse({ ok: false, error: (err && err.message) || 'unknown_error' });
    }
  );
}

function handleCaptureActiveTab(msg, sender, sendResponse) {
  sendResponse({ accepted: true });
  captureActiveTabIfEligible(msg.tabId).catch((err) => {
    console.error('[background] captureActiveTabIfEligible failed', err);
    pushPanelEvent('state', { state: 'ready' });
  });
}

// ---- Dispatch table --------------------------------------------------------
// Single source of truth for "what message types do we accept and how".
// Append a row here when adding a new type; the contract block at the top of
// this file must list it too.
const MESSAGE_HANDLERS = {
  SAVE_JOB:              { responseStyle: 'async',    requiresTabSender: true,  handler: handleSaveJob },
  rr_capture_active_tab: { responseStyle: 'sync_ack', requiresTabSender: false, handler: handleCaptureActiveTab },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const entry = msg && MESSAGE_HANDLERS[msg.type];
  if (!entry) return false;
  if (entry.requiresTabSender && !(sender && sender.tab && sender.tab.id != null)) {
    try { sendResponse({ ok: false, error: 'requires_tab_sender' }); } catch (_) {}
    return false;
  }
  try {
    entry.handler(msg, sender, sendResponse);
  } catch (err) {
    console.error('[messages] handler threw for', msg.type, err);
    try { sendResponse({ ok: false, error: 'handler_threw' }); } catch (_) {}
    return false;
  }
  return entry.responseStyle === 'async';
});
