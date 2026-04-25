// Detect which job board we're on, extract details.
// Wave 0 task 7: linkedin removed from BOARD detection. The static
// content_scripts manifest entry no longer matches linkedin.com, but the
// belt-and-braces guard here means the script stays inert on linkedin even
// if it's ever loaded via programmatic registration in task 6.
const BOARD = (() => {
  const h = location.hostname;
  if (/indeed\./.test(h)) return 'indeed';
  if (/lever\.co/.test(h)) return 'lever';
  return null;
})();

const EXTRACTORS = {
  indeed: () => ({
    company: document.querySelector('[data-testid="inlineHeader-companyName"] a')?.textContent?.trim()
            || document.querySelector('.jobsearch-CompanyInfoContainer')?.innerText?.split('\n')[0]?.trim(),
    role: document.querySelector('h1.jobsearch-JobInfoHeader-title')?.textContent?.trim()
          || document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]')?.textContent?.trim(),
    location: document.querySelector('[data-testid="inlineHeader-companyLocation"]')?.textContent?.trim()
             || document.querySelector('[data-testid="job-location"]')?.textContent?.trim(),
    description: document.querySelector('#jobDescriptionText')?.innerText?.trim(),
    url: location.href.split('?')[0].replace(/#.*$/, ''),
  }),
  lever: () => ({
    company: document.querySelector('.main-header-logo img')?.alt
            || location.hostname.split('.')[2],
    role: document.querySelector('.posting-headline h2')?.textContent?.trim(),
    location: document.querySelector('.sort-by-time .location')?.textContent?.trim(),
    description: document.querySelector('.section-wrapper.page-full-width')?.innerText?.trim(),
    url: location.href.split('?')[0],
  }),
};

function extractJob() {
  const fn = EXTRACTORS[BOARD];
  if (!fn) return null;
  const data = fn();
  if (!data.company || !data.role) return null;
  return {
    ...data,
    board: BOARD,
    savedAt: Date.now(),
  };
}

// Inject floating save button
function injectButton() {
  if (document.getElementById('rr-save-btn')) return;
  const job = extractJob();
  if (!job) return;

  const btn = document.createElement('div');
  btn.id = 'rr-save-btn';
  btn.innerHTML = `
    <button class="rr-save-btn-primary">
      <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 2l4 4 8-8"/></svg>
      Save to ReplyRate
    </button>
    <div class="rr-save-btn-hint">Prep CV, cover letter, and interview from this one click</div>
  `;
  document.body.appendChild(btn);

  // Captured once at mount so we can restore the SVG + label cleanly after
  // the brief success flash (avoids a double-click race that would otherwise
  // overwrite "originalText" with "Saved" and never recover).
  const primary = btn.querySelector('.rr-save-btn-primary');
  const hint = btn.querySelector('.rr-save-btn-hint');
  const primaryOriginalHtml = primary.innerHTML;

  primary.addEventListener('click', () => {
    const fresh = extractJob();
    if (!fresh) return;
    chrome.runtime.sendMessage(
      {
        type: 'SAVE_JOB',
        sourceType: BOARD,            // 'lever' or 'indeed'
        title: fresh.role,            // current extractor's role field is the job title
        rawUrl: window.location.href, // background canonicalises per source
      },
      (res) => {
        if (res && res.ok) {
          primary.textContent = res.deduped ? '✓ Already saved' : '✓ Saved';
          setTimeout(() => { primary.innerHTML = primaryOriginalHtml; }, 1500);
        } else {
          hint.textContent = 'Error: ' + ((res && res.error) || 'Try again');
        }
      }
    );
  });
}

// Wait for the page to fully render (job boards load lazily)
const observer = new MutationObserver(() => injectButton());
observer.observe(document.body, { childList: true, subtree: true });
injectButton();
