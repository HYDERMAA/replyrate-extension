chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SAVE_JOB') {
    handleSave(msg.job).then(
      (res) => sendResponse({ ok: true, ...res }),
      (err) => sendResponse({ ok: false, error: err.message })
    );
    return true; // async response
  }
});

async function handleSave(job) {
  // Option A: send to authenticated endpoint (if user logged into replyrate.ai in main browser session)
  // Option B (MVP): open replyrate.ai with data in URL, let the SPA ingest
  const params = new URLSearchParams({
    rr_save: '1',
    company: job.company,
    role: job.role,
    url: job.url,
    location: job.location || '',
  });
  // Store the JD in extension local storage (too big for URL)
  await chrome.storage.local.set({ ['rr-pending-' + Date.now()]: job });
  // Open replyrate and pass the storage key
  chrome.tabs.create({ url: `https://replyrate.ai/?aud=jobs&${params.toString()}#apps` });
  return { saved: true };
}
