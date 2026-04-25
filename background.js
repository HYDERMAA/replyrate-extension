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
// Strips query, fragment, and any trailing path beyond the numeric job id.
// Returns null when the URL is not a LinkedIn job page (feed, search, etc.).
function canonicalLinkedInJobUrl(rawUrl) {
  if (!rawUrl) return null;
  const m = rawUrl.match(/^https:\/\/(?:www\.)?linkedin\.com\/jobs\/view\/(\d+)/i);
  return m ? 'https://www.linkedin.com/jobs/view/' + m[1] + '/' : null;
}

async function captureActiveTabIfEligible(tabId) {
  console.log('[capture] start, tabId:', tabId);
  if (tabId == null) { pushPanelState('ready'); return; }

  let tab;
  try { tab = await chrome.tabs.get(tabId); }
  catch (err) {
    console.error('[background] tabs.get failed', err);
    pushPanelState('ready');
    return;
  }
  console.log('[capture] tab fetched, url:', tab && tab.url, 'title:', tab && tab.title);

  const url = tab && tab.url;
  const isLinkedIn = url && /^https:\/\/(?:www\.)?linkedin\.com\//i.test(url);
  console.log('[capture] isLinkedIn:', isLinkedIn);
  if (!isLinkedIn) {
    // Non-LinkedIn tab. Other source types land in tasks 6 and 8.
    pushPanelState('ready');
    return;
  }

  const canonicalUrl = canonicalLinkedInJobUrl(url);
  console.log('[capture] canonicalUrl:', canonicalUrl);
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
    console.log('[capture] dupe found, key:', dupeKey);
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
  console.log('[capture] writing new JobLead:', id, jobLead.sourceUrl);
  await chrome.storage.local.set({ ['rr_job_' + id]: jobLead });
  console.log('[capture] write complete');
  pushPanelState('ready');
}

// Message contract (background -> panel):
//   { type: 'rr_set_state', state, error?, notice? }
//   state  - 'collapsed' | 'loading' | 'ready' | 'error'
//   error  - human-readable string when state === 'error'
//   notice - optional i18n key for a non-blocking informational message,
//            e.g. 'rr_notice_not_a_job_page', 'rr_notice_already_saved'.
//            Panel rendering of notices is deferred (Option A); the field
//            is sent today so devtools and future panel UI can observe it.
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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SAVE_JOB') {
    handleSave(msg.job).then(
      (res) => sendResponse({ ok: true, ...res }),
      (err) => sendResponse({ ok: false, error: err.message })
    );
    return true; // async response
  }
  // Message contract (panel -> background):
  //   { type: 'rr_capture_active_tab', tabId }
  // Reply path is the rr_set_state broadcast above, not sendResponse, so
  // we return undefined here (port closes immediately).
  if (msg.type === 'rr_capture_active_tab') {
    console.log('[capture] message received, tabId:', msg.tabId);
    captureActiveTabIfEligible(msg.tabId).catch((err) => {
      console.error('[background] captureActiveTabIfEligible failed', err);
      pushPanelState('ready');
    });
    return false;
  }
});

async function handleSave(job) {
  // Persist full JD (including description, which is too big for URL) to
  // chrome.storage so the SPA's apIngestFromExtension drain picks it up.
  await chrome.storage.local.set({ ['rr-pending-' + Date.now()]: job });

  const params = new URLSearchParams({
    rr_save: '1',
    company: job.company,
    role: job.role,
    url: job.url,
    location: job.location || '',
  });
  const targetUrl = `https://replyrate.ai/?aud=jobs&${params.toString()}#apps`;

  // Reuse an existing ReplyRate tab if one is open, to avoid accumulating
  // a new tab on every save. Prefer the most-recently-queried match.
  const existingTabs = await chrome.tabs.query({ url: 'https://replyrate.ai/*' });

  if (existingTabs.length > 0) {
    const tab = existingTabs[existingTabs.length - 1];
    await chrome.tabs.update(tab.id, { url: targetUrl, active: true });
    if (tab.windowId) {
      try { await chrome.windows.update(tab.windowId, { focused: true }); } catch (e) {}
    }
  } else {
    await chrome.tabs.create({ url: targetUrl });
  }

  return { saved: true };
}
