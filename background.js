// =============================================================================
// MESSAGE CONTRACT (Wave 0 task 5; Wave 2 task 1 added entries 4-5)
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
// 4. rr_auth_signin                                       direction: sp -> bg
//    request:  { type: 'rr_auth_signin' }
//    response: { ok: true, uid, email, displayName }
//              | { ok: false, error: 'identity_cancelled' | 'identity_failed'
//                                   | 'exchange_failed' | 'signin_threw' }
//    sender:   sp only.   responseStyle: async
//    Runs chrome.identity.getAuthToken({interactive:true}), exchanges the
//    Google OAuth token with the Firebase Auth REST API for an id token,
//    persists the session in chrome.storage.local under rr_user_session.
//
// 5. rr_auth_signout                                      direction: sp -> bg
//    request:  { type: 'rr_auth_signout' }
//    response: { ok: true } always — sign-out is fail-open so the user can
//              never end up stuck signed-in client-side.
//    sender:   sp only.   responseStyle: async
//    Full revoke: removeCachedAuthToken + POST to oauth2.googleapis.com/revoke
//    + clears rr_user_session. Next sign-in re-prompts the Google consent
//    screen.
//
// 6. rr_save_active_tab                                    direction: sp -> bg
//    request:  { type: 'rr_save_active_tab' }
//    response: { ok: true, savedId, deduped, notice: 'saved' | 'already_saved' }
//              | { ok: false, notice: 'unsupported_page' | 'not_a_job_page' | 'storage_error' }
//    sender:   sp only.   responseStyle: async
//    Reads the active tab via chrome.tabs.query (NOT a panel-supplied
//    tabId — panel's tabId could race with tab navigation between message
//    send and handler run). Detects sourceType from URL, canonicalizes,
//    dedupes against rr_job_* keys, writes JobLead. URL-only save: title
//    comes from tab.title, company/location stay null (matches existing
//    capture flow's behavior; floating-button SAVE_JOB extracts those
//    fields but doesn't forward them either).
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

// =============================================================================
// AUTH (Wave 2 task 1 foundation)
// =============================================================================
// Google sign-in via chrome.identity, exchanged with Firebase Auth REST API
// (no SDK bundle, vanilla fetch). Session persisted in chrome.storage.local
// under rr_user_session.
//
// Flow:
//   1. signIn() runs chrome.identity.getAuthToken({interactive:true}) to get
//      a Google OAuth access token.
//   2. exchangeGoogleTokenForFirebase() calls Firebase identitytoolkit
//      signInWithIdp to swap that for a Firebase id token + refresh token.
//   3. setSession() writes { uid, email, displayName, idToken,
//      idTokenExpiresAt, refreshToken } to chrome.storage.local.
//
// Per-request auth (rrApiFetch):
//   - Reads session from storage on every call (SW holds no long-lived state
//     per CLAUDE_CODE_BRIEFING.md build rules).
//   - If idTokenExpiresAt is within 5 min, refreshes via securetoken endpoint
//     before sending the request (lazy refresh).
//   - On 401 response, refreshes once and retries (handles clock skew or
//     server-side revocation that the lazy check missed).
//
// Sign-out:
//   - Full revoke: removeCachedAuthToken + POST to oauth2.googleapis.com/revoke
//   - Clears rr_user_session regardless of revoke success/failure.
//   - Next sign-in re-prompts the Google consent screen.

const FIREBASE_API_KEY = 'AIzaSyC2bvpBWCA0YZAfZlGyjlAT3GPG2wGnc-o';
const BACKEND_BASE_URL = 'https://replyrate.ai';
const FIREBASE_IDP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=' + FIREBASE_API_KEY;
const FIREBASE_TOKEN_URL = 'https://securetoken.googleapis.com/v1/token?key=' + FIREBASE_API_KEY;
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

// 5-minute refresh window — refresh proactively when within this margin of
// expiry to avoid sending a stale token. Matches WAVE2_TASK_CONTACTS_SPEC.md
// line 362.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

async function getSession() {
  const r = await chrome.storage.local.get('rr_user_session');
  return r.rr_user_session || null;
}

async function setSession(session) {
  await chrome.storage.local.set({ rr_user_session: session });
}

async function clearSession() {
  await chrome.storage.local.remove('rr_user_session');
}

// Exchange a Google OAuth access token for a Firebase id token via the
// Identity Toolkit signInWithIdp endpoint. Returns { uid, email, displayName,
// idToken, idTokenExpiresAt, refreshToken } or throws.
async function exchangeGoogleTokenForFirebase(googleAccessToken) {
  const res = await fetch(FIREBASE_IDP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postBody: 'access_token=' + encodeURIComponent(googleAccessToken) + '&providerId=google.com',
      requestUri: 'http://localhost',
      returnIdpCredential: true,
      returnSecureToken: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '<read failed>');
    throw new Error('signInWithIdp ' + res.status + ': ' + text.slice(0, 200));
  }
  const data = await res.json();
  // identitytoolkit returns expiresIn as a string of seconds.
  const expiresInMs = parseInt(data.expiresIn, 10) * 1000;
  return {
    uid: data.localId,
    email: data.email || null,
    displayName: data.displayName || null,
    idToken: data.idToken,
    idTokenExpiresAt: Date.now() + expiresInMs,
    refreshToken: data.refreshToken,
  };
}

// Refresh a Firebase session using the stored refresh token. Note the case
// difference: securetoken returns id_token / refresh_token / expires_in
// (snake_case), unlike identitytoolkit which uses camelCase. We normalize
// to our session shape on write.
async function refreshSession(session) {
  if (!session || !session.refreshToken) throw new Error('no_refresh_token');
  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', session.refreshToken);
  const res = await fetch(FIREBASE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '<read failed>');
    throw new Error('refresh ' + res.status + ': ' + text.slice(0, 200));
  }
  const data = await res.json();
  const expiresInMs = parseInt(data.expires_in, 10) * 1000;
  const refreshed = Object.assign({}, session, {
    idToken: data.id_token,
    idTokenExpiresAt: Date.now() + expiresInMs,
    refreshToken: data.refresh_token || session.refreshToken,
  });
  await setSession(refreshed);
  return refreshed;
}

// Run the chrome.identity flow → exchange → write session. Returns
// { ok: true, uid, email, displayName } or { ok: false, error: <code> }.
// Error codes:
//   identity_cancelled   user dismissed the consent screen
//   identity_failed      chrome.identity rejected (bad client_id, network, etc.)
//   exchange_failed      Firebase signInWithIdp rejected the Google token
async function signIn() {
  let googleToken;
  try {
    googleToken = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (t) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(err.message || 'identity_error'));
        if (!t) return reject(new Error('identity_no_token'));
        resolve(t);
      });
    });
  } catch (err) {
    const m = (err && err.message) || '';
    // Heuristic: distinguish user-cancelled vs misconfig/network. Chrome's
    // exact lastError message varies by version; the substrings checked here
    // are stable across recent Chrome.
    if (m.includes('canceled') || m.includes('cancelled') || m.includes('did not approve')) {
      return { ok: false, error: 'identity_cancelled' };
    }
    console.error('[auth] getAuthToken failed:', m);
    return { ok: false, error: 'identity_failed' };
  }

  let session;
  try {
    session = await exchangeGoogleTokenForFirebase(googleToken);
  } catch (err) {
    console.error('[auth] exchange failed:', err.message);
    return { ok: false, error: 'exchange_failed' };
  }

  await setSession(session);
  return { ok: true, uid: session.uid, email: session.email, displayName: session.displayName };
}

// Full revoke: drop the cached Google token, revoke at oauth2.googleapis.com,
// clear local session. Always clears local session even if revoke fails (so
// the user can never end up "stuck signed in" client-side after asking to
// sign out). Returns { ok: true }.
async function signOut() {
  let googleToken = null;
  try {
    googleToken = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, (t) => {
        // chrome.runtime.lastError is set if no cached token; that's fine
        // for sign-out purposes (already not signed in).
        const _ = chrome.runtime.lastError;
        resolve(t || null);
      });
    });
  } catch (_) { /* ignore */ }

  if (googleToken) {
    try {
      await new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: googleToken }, () => resolve());
      });
    } catch (err) {
      console.warn('[auth] removeCachedAuthToken failed:', err && err.message);
    }
    try {
      await fetch(GOOGLE_REVOKE_URL + '?token=' + encodeURIComponent(googleToken), {
        method: 'POST',
      });
    } catch (err) {
      // Network failure; the user-facing sign-out still succeeds because we
      // clear local session below. The Google token will eventually expire on
      // its own (~1hr).
      console.warn('[auth] revoke POST failed:', err && err.message);
    }
  }

  await clearSession();
  return { ok: true };
}

// Auth-aware fetch. Reads rr_user_session, refreshes lazily if within the
// REFRESH_MARGIN_MS window, sends Authorization: Bearer <idToken>, retries
// once on 401 after a refresh.
//
// `path` is a path relative to BACKEND_BASE_URL (e.g., '/api/user/entitlements').
// `config` is a standard fetch options object; the helper merges in the
// Authorization header without overwriting other headers, body, or signal.
async function rrApiFetch(path, config) {
  let session = await getSession();
  if (!session) throw new Error('not_signed_in');

  // Lazy refresh: if within 5 min of expiry, refresh first.
  if (Date.now() + REFRESH_MARGIN_MS > session.idTokenExpiresAt) {
    try { session = await refreshSession(session); }
    catch (err) {
      console.error('[auth] lazy refresh failed:', err.message);
      throw new Error('refresh_failed');
    }
  }

  const url = BACKEND_BASE_URL + path;
  const baseConfig = config || {};
  const headers = Object.assign({}, baseConfig.headers || {}, {
    'Authorization': 'Bearer ' + session.idToken,
  });

  let res = await fetch(url, Object.assign({}, baseConfig, { headers }));

  // 401 retry: handles clock skew or server-side revocation that the lazy
  // check missed. Refresh once and retry; if the retry refresh fails, surface
  // the original 401 to the caller.
  if (res.status === 401) {
    try { session = await refreshSession(session); }
    catch (err) {
      console.error('[auth] retry refresh failed:', err.message);
      return res;
    }
    const retryHeaders = Object.assign({}, baseConfig.headers || {}, {
      'Authorization': 'Bearer ' + session.idToken,
    });
    res = await fetch(url, Object.assign({}, baseConfig, { headers: retryHeaders }));
  }

  return res;
}

// =============================================================================
// CAPTURE / SAVE FLOW (existing, Wave 0 tasks 7 + 8)
// =============================================================================

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

// Extract role/company/location from a live LinkedIn job page via
// chrome.scripting.executeScript. LinkedIn's tab.title is unreliable
// ('(N) Top job picks for you | LinkedIn' when notification badges are
// showing) so we read the DOM directly. Multi-candidate selector chains
// because LinkedIn rotates classes every ~6-12 months. Returns
// { role, company, location } with each field nullable, or null on
// executeScript failure (tab closed mid-save, URL changed, etc.).
async function extractLinkedInJobDom(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        function pick(selectors) {
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            const text = el && el.textContent && el.textContent.trim();
            if (text) return text;
          }
          return null;
        }
        return {
          role: pick([
            '.job-details-jobs-unified-top-card__job-title h1',
            '.job-details-jobs-unified-top-card__job-title',
            'h1.top-card-layout__title',
            'h1.topcard__title',
          ]),
          company: pick([
            '.job-details-jobs-unified-top-card__company-name a',
            '.job-details-jobs-unified-top-card__company-name',
            'a.topcard__org-name-link',
            '.topcard__org-name-link',
          ]),
          location: pick([
            '.job-details-jobs-unified-top-card__primary-description-container .tvm__text',
            '.job-details-jobs-unified-top-card__bullet',
            '.topcard__flavor--bullet',
          ]),
        };
      },
    });
    const data = results && results[0] && results[0].result;
    if (!data) return null;
    return data;
  } catch (err) {
    console.warn('[save-job] LinkedIn DOM extraction failed', err && err.message);
    return null;
  }
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
  const sourceType = detectSource(url);
  if (!sourceType) {
    // Non-supported tab. Boot path stays silent (no notice surfaced).
    // The explicit Save button (rr_save_active_tab) returns 'unsupported_page'
    // to the panel for toast feedback.
    pushPanelState('ready');
    return;
  }

  const canonicalUrl = canonicalizeUrl(sourceType, url);
  if (!canonicalUrl) {
    // On a supported domain but not a job posting (e.g. linkedin.com/feed,
    // indeed.com/jobs without jk param). LinkedIn keeps its legacy
    // 'rr_notice_not_a_job_page' broadcast for back-compat; Lever/Indeed
    // join the silent branch (the panel doesn't render this notice in UI
    // anyway — Wave 0 task 7 deferred notice rendering).
    if (sourceType === 'linkedin') {
      pushPanelState('ready', null, 'rr_notice_not_a_job_page');
    } else {
      pushPanelState('ready');
    }
    return;
  }

  // Wave 2 task 1 follow-on: extended to all three sources via shared
  // saveJobFromUrl helper. Boot path stays silent on success; broadcasts
  // 'rr_notice_already_saved' on dedupe hit (legacy LinkedIn behavior
  // preserved across all sources for symmetry).
  const result = await saveJobFromUrl(tab, sourceType, canonicalUrl);
  if (result.ok && result.deduped) {
    pushPanelState('ready', null, 'rr_notice_already_saved');
  } else {
    pushPanelState('ready');
  }
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

// ── Wave 2 task 1 follow-on: shared save helpers ───────────────────────────
// Used by both rr_capture_active_tab (boot auto-save, silent) and
// rr_save_active_tab (button click, returns envelope for toast). The two
// flows diverge in feedback only; the actual save logic is shared.

// Detect which job source a URL belongs to. Returns
// 'linkedin' | 'lever' | 'indeed' | null.
function detectSource(url) {
  if (!url) return null;
  if (/^https:\/\/(?:www\.)?linkedin\.com\//i.test(url)) return 'linkedin';
  if (/^https:\/\/(?:[a-z0-9-]+\.)?lever\.co\//i.test(url)) return 'lever';
  if (/^https:\/\/(?:[a-z0-9-]+\.)?indeed\.com\//i.test(url)) return 'indeed';
  return null;
}

// Pick the right canonicalizer per source. Returns canonical URL string
// or null when the URL doesn't represent a specific job posting (e.g.,
// LinkedIn feed page, Indeed search-results page without jk param).
function canonicalizeUrl(sourceType, rawUrl) {
  if (sourceType === 'linkedin') return canonicalLinkedInJobUrl(rawUrl);
  if (sourceType === 'lever')    return canonicalLeverUrl(rawUrl);
  if (sourceType === 'indeed')   return canonicalIndeedUrl(rawUrl);
  return null;
}

// Shared save path. Reads all rr_job_* keys, dedupes by canonical URL,
// either bumps lastActionAt on a hit or writes a fresh JobLead on a miss.
// Returns { ok, savedId, deduped, notice } envelope.
//
// Storage write failures (rare; quota exceeded, transient errors) are
// caught and surfaced as { ok: false, notice: 'storage_error' } so the
// panel can show the error toast.
//
// Dedupe scan is O(n) over all rr_job_* keys — acceptable at closed-beta
// scale (hundreds of jobs per user max). Future optimization: maintain a
// URL->jobId index in chrome.storage.local for O(1) dedupe lookups.
async function saveJobFromUrl(tab, sourceType, canonicalUrl) {
  try {
    const all = await chrome.storage.local.get(null);
    const dupeKey = Object.keys(all).find(
      (k) => k.indexOf('rr_job_') === 0 && all[k] && all[k].sourceUrl === canonicalUrl
    );

    if (dupeKey) {
      const existing = all[dupeKey];
      existing.lastActionAt = Date.now();
      await chrome.storage.local.set({ [dupeKey]: existing });
      return { ok: true, savedId: existing.id, deduped: true, notice: 'already_saved' };
    }

    // Wave 2 task 1 follow-on: extract role/company/location from LinkedIn
    // DOM. LinkedIn's tab.title is unreliable ('(N) Top job picks for you
    // | LinkedIn' when notification badges are showing) so we inject a
    // small extractor into the live tab. Lever/Indeed keep URL-only saves;
    // their titles are usable enough for parseJobTitle in the Contacts
    // SearchForm. Strict improvement: if extraction returns null or all
    // selectors miss (login wall, slow load, LinkedIn redesign), falls
    // back to tab.title — current behavior. Dedupe path above is
    // unchanged: re-saving an existing job still just bumps lastActionAt
    // without re-extracting, so good captured data isn't overwritten if
    // LinkedIn later redesigns selectors.
    let extracted = null;
    if (sourceType === 'linkedin' && tab && tab.id != null) {
      extracted = await extractLinkedInJobDom(tab.id);
    }

    const id = newJobLeadId();
    const now = Date.now();
    const jobLead = {
      id,
      title: (extracted && extracted.role) || (tab && tab.title) || '',
      company: (extracted && extracted.company) || null,
      location: (extracted && extracted.location) || null,
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
    return { ok: true, savedId: id, deduped: false, notice: 'saved' };
  } catch (err) {
    console.error('[save-job] storage write failed', err);
    return { ok: false, notice: 'storage_error' };
  }
}

// Resolve the active tab and run the shared save path. Used by the
// rr_save_active_tab handler (button click). Doesn't trust panel-supplied
// tabId — queries the active tab directly to avoid races with tab
// navigation between message send and handler run.
async function saveActiveTab() {
  let tab;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs && tabs[0];
  } catch (err) {
    console.error('[save-active-tab] tabs.query failed', err);
    return { ok: false, notice: 'storage_error' };
  }
  if (!tab || !tab.url) {
    return { ok: false, notice: 'unsupported_page' };
  }

  const sourceType = detectSource(tab.url);
  if (!sourceType) {
    return { ok: false, notice: 'unsupported_page' };
  }

  const canonicalUrl = canonicalizeUrl(sourceType, tab.url);
  if (!canonicalUrl) {
    return { ok: false, notice: 'not_a_job_page' };
  }

  return saveJobFromUrl(tab, sourceType, canonicalUrl);
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

function handleAuthSignin(msg, sender, sendResponse) {
  signIn().then(
    (res) => sendResponse(res),
    (err) => {
      console.error('[auth] signIn threw:', err);
      sendResponse({ ok: false, error: 'signin_threw' });
    }
  );
}

function handleAuthSignout(msg, sender, sendResponse) {
  // Spec: rr_auth_signout always returns { ok: true }, even if already signed
  // out OR if the revoke side-effect fails. Sign-out is fail-open by design
  // so the client can never end up "stuck signed in" after asking to sign out.
  signOut().then(
    (res) => sendResponse(res),
    (err) => {
      console.error('[auth] signOut threw:', err);
      sendResponse({ ok: true });
    }
  );
}

function handleSaveActiveTab(msg, sender, sendResponse) {
  saveActiveTab().then(
    (res) => sendResponse(res),
    (err) => {
      console.error('[save-active-tab] threw', err);
      sendResponse({ ok: false, notice: 'storage_error' });
    }
  );
}

// ---- Dispatch table --------------------------------------------------------
// Single source of truth for "what message types do we accept and how".
// Append a row here when adding a new type; the contract block at the top of
// this file must list it too.
const MESSAGE_HANDLERS = {
  SAVE_JOB:              { responseStyle: 'async',    requiresTabSender: true,  handler: handleSaveJob },
  rr_capture_active_tab: { responseStyle: 'sync_ack', requiresTabSender: false, handler: handleCaptureActiveTab },
  rr_auth_signin:        { responseStyle: 'async',    requiresTabSender: false, handler: handleAuthSignin },
  rr_auth_signout:       { responseStyle: 'async',    requiresTabSender: false, handler: handleAuthSignout },
  rr_save_active_tab:    { responseStyle: 'async',    requiresTabSender: false, handler: handleSaveActiveTab },
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
