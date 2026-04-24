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
  // Persist full JD (including description — too big for URL) to chrome.storage
  // so the SPA's apIngestFromExtension drain picks it up on arrival.
  await chrome.storage.local.set({ ['rr-pending-' + Date.now()]: job });

  const params = new URLSearchParams({
    rr_save: '1',
    company: job.company,
    role: job.role,
    url: job.url,
    location: job.location || '',
  });
  const targetUrl = `https://replyrate.ai/?aud=jobs&${params.toString()}#apps`;

  // Reuse an existing ReplyRate tab if one is open — avoids accumulating
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
