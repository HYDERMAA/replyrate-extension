// Test fixtures and helpers ───────────────────────────────────────────────

const fixture = () => document.getElementById('test-fixture');
function clearFixture() {
  const el = fixture();
  while (el.firstChild) el.removeChild(el.firstChild);
}
function makeJob(overrides) {
  const id = (overrides && overrides.id) || ('job_' + Date.now() + '_abcdefg');
  return Object.assign({
    id,
    title: 'Senior Engineer',
    company: 'Acme Corp',
    location: 'London',
    sourceType: 'linkedin',
    sourceUrl: 'https://www.linkedin.com/jobs/view/12345/',
    salaryText: null,
    descriptionHash: null,
    fitBand: null,
    stage: 'saved',
    createdAt: 1700000000000,
    lastActionAt: 1700000000000,
    nextActionAt: null,
  }, overrides);
}

// ── Suite: deriveStageCounts ──────────────────────────────────────────────

describe('deriveStageCounts', () => {
  it('returns all-zero counts for empty input', () => {
    expect(deriveStageCounts([])).toEqual({
      saved: 0, applied: 0, replied: 0, interviewing: 0, offer: 0, rejected: 0,
    });
  });
  it('counts a single saved job', () => {
    const counts = deriveStageCounts([makeJob({ stage: 'saved' })]);
    expect(counts.saved).toBe(1);
    expect(counts.applied).toBe(0);
  });
  it('counts mixed stages correctly', () => {
    const jobs = [
      makeJob({ id: 'a', stage: 'saved' }),
      makeJob({ id: 'b', stage: 'saved' }),
      makeJob({ id: 'c', stage: 'applied' }),
      makeJob({ id: 'd', stage: 'offer' }),
    ];
    expect(deriveStageCounts(jobs)).toEqual({
      saved: 2, applied: 1, replied: 0, interviewing: 0, offer: 1, rejected: 0,
    });
  });
  it('silently ignores unknown stage values (schema drift defense)', () => {
    const counts = deriveStageCounts([makeJob({ stage: 'ghosted' })]);
    expect(counts).toEqual({
      saved: 0, applied: 0, replied: 0, interviewing: 0, offer: 0, rejected: 0,
    });
  });
});

// ── Suite: canonicalLinkedInJobUrl ────────────────────────────────────────

describe('canonicalLinkedInJobUrl', () => {
  it('canonicalises /jobs/view/<id>/', () => {
    expect(canonicalLinkedInJobUrl('https://www.linkedin.com/jobs/view/3829471022/'))
      .toBe('https://www.linkedin.com/jobs/view/3829471022/');
  });
  it('strips query and fragment from /jobs/view/<id>', () => {
    expect(canonicalLinkedInJobUrl('https://www.linkedin.com/jobs/view/3829471022/?refId=abc&trk=xyz'))
      .toBe('https://www.linkedin.com/jobs/view/3829471022/');
  });
  it('extracts currentJobId from /jobs/collections/.../?currentJobId=<id>', () => {
    expect(canonicalLinkedInJobUrl('https://www.linkedin.com/jobs/collections/recommended/?currentJobId=3829471022&originToLandingJobPostings=foo'))
      .toBe('https://www.linkedin.com/jobs/view/3829471022/');
  });
  it('extracts currentJobId from /jobs/search/.../?currentJobId=<id>', () => {
    expect(canonicalLinkedInJobUrl('https://www.linkedin.com/jobs/search/?keywords=python&currentJobId=3829471022&geoId=101'))
      .toBe('https://www.linkedin.com/jobs/view/3829471022/');
  });
  it('returns null for /feed/', () => {
    expect(canonicalLinkedInJobUrl('https://www.linkedin.com/feed/')).toBeNull();
  });
  it('returns null for /jobs/collections/recommended/ with no currentJobId', () => {
    expect(canonicalLinkedInJobUrl('https://www.linkedin.com/jobs/collections/recommended/')).toBeNull();
  });
  it('returns null for non-numeric currentJobId', () => {
    expect(canonicalLinkedInJobUrl('https://www.linkedin.com/jobs/collections/recommended/?currentJobId=abc')).toBeNull();
  });
  it('returns null for malformed URL', () => {
    expect(canonicalLinkedInJobUrl('not a url')).toBeNull();
  });
  it('returns null for non-LinkedIn host', () => {
    expect(canonicalLinkedInJobUrl('https://example.com/jobs/view/123/')).toBeNull();
  });
  it('returns null for null or empty input', () => {
    expect(canonicalLinkedInJobUrl(null)).toBeNull();
    expect(canonicalLinkedInJobUrl('')).toBeNull();
  });
});

// ── Suite: canonicalLeverUrl ──────────────────────────────────────────────

describe('canonicalLeverUrl', () => {
  it('strips query and fragment', () => {
    expect(canonicalLeverUrl('https://jobs.lever.co/acmeco/abc-123-def?source=email&utm=x#section'))
      .toBe('https://jobs.lever.co/acmeco/abc-123-def');
  });
  it('preserves path including /apply suffix', () => {
    expect(canonicalLeverUrl('https://jobs.lever.co/acmeco/abc-123-def/apply'))
      .toBe('https://jobs.lever.co/acmeco/abc-123-def/apply');
  });
  it('returns null for non-Lever host', () => {
    expect(canonicalLeverUrl('https://jobs.example.com/foo')).toBeNull();
  });
  it('returns null for malformed input', () => {
    expect(canonicalLeverUrl('not a url')).toBeNull();
    expect(canonicalLeverUrl(null)).toBeNull();
  });
});

// ── Suite: canonicalIndeedUrl ─────────────────────────────────────────────

describe('canonicalIndeedUrl', () => {
  it('canonicalises /viewjob?jk=<id>', () => {
    expect(canonicalIndeedUrl('https://www.indeed.com/viewjob?jk=f9b2a1c3d4e5'))
      .toBe('https://www.indeed.com/viewjob?jk=f9b2a1c3d4e5');
  });
  it('normalises uk subdomain to www', () => {
    expect(canonicalIndeedUrl('https://uk.indeed.com/viewjob?jk=f9b2a1c3d4e5&from=serp'))
      .toBe('https://www.indeed.com/viewjob?jk=f9b2a1c3d4e5');
  });
  it('extracts vjk from /jobs?vjk=<id>', () => {
    expect(canonicalIndeedUrl('https://uk.indeed.com/jobs?q=python&vjk=f9b2a1c3d4e5'))
      .toBe('https://www.indeed.com/viewjob?jk=f9b2a1c3d4e5');
  });
  it('extracts vjk from /m/jobs?vjk=<id>', () => {
    expect(canonicalIndeedUrl('https://m.indeed.com/m/jobs?q=eng&vjk=f9b2a1c3d4e5'))
      .toBe('https://www.indeed.com/viewjob?jk=f9b2a1c3d4e5');
  });
  it('returns null for /jobs without vjk', () => {
    expect(canonicalIndeedUrl('https://uk.indeed.com/jobs?q=python')).toBeNull();
  });
  it('returns null for non-alphanumeric jk', () => {
    expect(canonicalIndeedUrl('https://www.indeed.com/viewjob?jk=foo$bar')).toBeNull();
  });
  it('returns null for empty vjk', () => {
    expect(canonicalIndeedUrl('https://uk.indeed.com/jobs?vjk=')).toBeNull();
  });
  it('returns null for non-Indeed host', () => {
    expect(canonicalIndeedUrl('https://example.com/viewjob?jk=abc')).toBeNull();
  });
});

// ── Suite: formatRelativeTime ─────────────────────────────────────────────

describe('formatRelativeTime', () => {
  const now = new Date('2026-04-27T12:00:00Z').getTime();
  it('returns "Just now" under 60s', () => {
    expect(formatRelativeTime(now - 30 * 1000, now)).toBe('Just now');
  });
  it('returns "Nm ago" under 60min', () => {
    expect(formatRelativeTime(now - 5 * 60 * 1000, now)).toBe('5m ago');
    expect(formatRelativeTime(now - 59 * 60 * 1000, now)).toBe('59m ago');
  });
  it('returns "Nh ago" under 24h', () => {
    expect(formatRelativeTime(now - 3 * 60 * 60 * 1000, now)).toBe('3h ago');
    expect(formatRelativeTime(now - 23 * 60 * 60 * 1000, now)).toBe('23h ago');
  });
  it('returns "Yesterday" between 24h and 48h', () => {
    expect(formatRelativeTime(now - 30 * 60 * 60 * 1000, now)).toBe('Yesterday');
  });
  it('returns "N days ago" under 7 days', () => {
    expect(formatRelativeTime(now - 3 * 24 * 60 * 60 * 1000, now)).toBe('3 days ago');
    expect(formatRelativeTime(now - 6 * 24 * 60 * 60 * 1000, now)).toBe('6 days ago');
  });
  it('returns "MMM D" within current year', () => {
    const sameYearOld = new Date('2026-01-15T10:00:00Z').getTime();
    expect(formatRelativeTime(sameYearOld, now)).toMatch(/^Jan \d+$/);
  });
  it('returns "MMM D, YYYY" in earlier year', () => {
    const lastYear = new Date('2025-04-01T10:00:00Z').getTime();
    expect(formatRelativeTime(lastYear, now)).toMatch(/^Apr \d+, 2025$/);
  });
  it('handles future timestamps as "Just now" (negative diff clamped)', () => {
    expect(formatRelativeTime(now + 5000, now)).toBe('Just now');
  });
});

// ── Suite: newJobLeadId ───────────────────────────────────────────────────

describe('newJobLeadId', () => {
  it('matches /^job_\\d{13,}_[a-z0-9]{7}$/', () => {
    expect(newJobLeadId()).toMatch(/^job_\d{13,}_[a-z0-9]{7}$/);
  });
  it('returns different ids on consecutive calls', () => {
    const a = newJobLeadId();
    const b = newJobLeadId();
    expect(a === b).toBeFalsy();
  });
});

// ── Suite: structuredClone deep-copy semantics ────────────────────────────
// Direct sanity check that the JS API (used by JobRow.onSelect to capture
// prior) actually deep-copies. The integration revert test below proves the
// behaviour end-to-end; this suite catches a hypothetical browser regression
// or accidental polyfill.

describe('structuredClone deep-copy semantics', () => {
  it('clone is a different object reference', () => {
    const original = makeJob();
    const clone = structuredClone(original);
    expect(clone === original).toBeFalsy();
  });
  it('mutating original.tags does not affect clone (forward-safety for nested fields)', () => {
    const original = Object.assign(makeJob(), { tags: ['urgent'] });
    const clone = structuredClone(original);
    original.tags.push('remote');
    expect(clone.tags).toEqual(['urgent']);
  });
  it('clone preserves primitive fields verbatim', () => {
    const original = makeJob({ createdAt: 1700000000000, lastActionAt: 1700000999999 });
    const clone = structuredClone(original);
    expect(clone.createdAt).toBe(1700000000000);
    expect(clone.lastActionAt).toBe(1700000999999);
  });
});

// ── Suite: Tracker reconcileList state machine ────────────────────────────

describe('Tracker reconcileList state machine', () => {
  let unmount;
  beforeEach(() => {
    __mockChrome.__reset();
    clearFixture();
  });
  afterEach(() => {
    if (unmount) { unmount(); unmount = null; }
  });

  it('renders empty state when storage has no jobs', async () => {
    unmount = Tracker(fixture(), {});
    await tick();
    expect(fixture().querySelector('.rr-empty-heading').textContent).toBe('No jobs saved yet');
  });

  it('renders one row in list mode for one Saved job', async () => {
    __mockChrome.__setStore({ rr_job_a: makeJob({ id: 'a', stage: 'saved' }) });
    unmount = Tracker(fixture(), {});
    await tick();
    expect(fixture().querySelectorAll('.rr-row').length).toBe(1);
    expect(fixture().querySelector('.rr-row-title').textContent).toBe('Senior Engineer');
  });

  it('clicking a stage chip filters the list', async () => {
    __mockChrome.__setStore({
      rr_job_a: makeJob({ id: 'a', stage: 'saved' }),
      rr_job_b: makeJob({ id: 'b', stage: 'applied' }),
    });
    unmount = Tracker(fixture(), {});
    await tick();
    expect(fixture().querySelectorAll('.rr-row').length).toBe(2);
    fixture().querySelector('.rr-chip[data-stage="saved"]').click();
    await tick();
    expect(fixture().querySelectorAll('.rr-row').length).toBe(1);
    expect(fixture().querySelector('.rr-row').dataset.stage).toBe('saved');
  });

  it('renders FilteredEmptyState with stage label when filter has no matches', async () => {
    __mockChrome.__setStore({ rr_job_a: makeJob({ id: 'a', stage: 'saved' }) });
    unmount = Tracker(fixture(), {});
    await tick();
    fixture().querySelector('.rr-chip[data-stage="applied"]').click();
    await tick();
    const body = fixture().querySelector('.rr-filtered-empty .rr-empty-body');
    expect(body.textContent).toContain('Applied');
    expect(fixture().querySelector('.rr-link').textContent).toBe('Show all');
  });

  it('updates the FilteredEmptyState label when switching between empty stages', async () => {
    __mockChrome.__setStore({ rr_job_a: makeJob({ id: 'a', stage: 'saved' }) });
    unmount = Tracker(fixture(), {});
    await tick();
    fixture().querySelector('.rr-chip[data-stage="applied"]').click();
    await tick();
    expect(fixture().querySelector('.rr-filtered-empty .rr-empty-body').textContent).toContain('Applied');
    fixture().querySelector('.rr-chip[data-stage="replied"]').click();
    await tick();
    expect(fixture().querySelector('.rr-filtered-empty .rr-empty-body').textContent).toContain('Replied');
  });

  it('Show all link clears the filter and returns to list mode', async () => {
    __mockChrome.__setStore({ rr_job_a: makeJob({ id: 'a', stage: 'saved' }) });
    unmount = Tracker(fixture(), {});
    await tick();
    fixture().querySelector('.rr-chip[data-stage="applied"]').click();
    await tick();
    fixture().querySelector('.rr-link').click();
    await tick();
    expect(fixture().querySelectorAll('.rr-row').length).toBe(1);
  });

  it('lingering filter: deleting last matching job leaves filter set, JobListEmptyState renders', async () => {
    __mockChrome.__setStore({ rr_job_a: makeJob({ id: 'a', stage: 'saved' }) });
    unmount = Tracker(fixture(), {});
    await tick();
    fixture().querySelector('.rr-chip[data-stage="saved"]').click();
    await tick();
    await chrome.storage.local.remove('rr_job_a');
    await tick();
    expect(fixture().querySelector('.rr-empty-heading').textContent).toBe('No jobs saved yet');
    // Saved chip stays aria-pressed=true (filter lingering in memory)
    expect(fixture().querySelector('.rr-chip[data-stage="saved"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('lingering filter: a matching save after empty surfaces the new row', async () => {
    __mockChrome.__setStore({ rr_job_a: makeJob({ id: 'a', stage: 'saved' }) });
    unmount = Tracker(fixture(), {});
    await tick();
    fixture().querySelector('.rr-chip[data-stage="saved"]').click();
    await tick();
    await chrome.storage.local.remove('rr_job_a');
    await tick();
    // Filter still 'saved' (lingering). Add a saved job; expect it to surface.
    await chrome.storage.local.set({ rr_job_b: makeJob({ id: 'b', stage: 'saved' }) });
    await tick();
    expect(fixture().querySelectorAll('.rr-row').length).toBe(1);
    expect(fixture().querySelector('.rr-row').dataset.jobId).toBe('b');
  });
});

// ── Suite: Optimistic stage change with revert ────────────────────────────

describe('Optimistic stage change with revert', () => {
  let unmount;
  beforeEach(() => { __mockChrome.__reset(); clearFixture(); });
  afterEach(() => { if (unmount) { unmount(); unmount = null; } });

  async function pickStage(newStage) {
    fixture().querySelector('.rr-stage-dropdown-trigger').click();
    await tick();
    document.querySelector('.rr-listbox [data-stage="' + newStage + '"]').click();
    await tick();
  }

  it('on success: row reflects new stage, no error pill', async () => {
    __mockChrome.__setStore({ rr_job_a: makeJob({ id: 'a', stage: 'saved' }) });
    unmount = Tracker(fixture(), {});
    await tick();
    await pickStage('applied');
    await tick();
    expect(fixture().querySelector('.rr-row').dataset.stage).toBe('applied');
    expect(fixture().querySelector('.rr-row-error-pill')).toBeNull();
  });

  it('on storage rejection: row reverts to prior stage, error pill appears', async () => {
    __mockChrome.__setStore({ rr_job_a: makeJob({ id: 'a', stage: 'saved' }) });
    unmount = Tracker(fixture(), {});
    await tick();
    __mockChrome.__setNextSetShouldReject();
    await pickStage('applied');
    await tick();
    expect(fixture().querySelector('.rr-row').dataset.stage).toBe('saved');
    expect(fixture().querySelector('.rr-row-error-pill').textContent)
      .toBe("Couldn't save. Try again.");
  });

  it('strip counts revert when storage rejects', async () => {
    __mockChrome.__setStore({ rr_job_a: makeJob({ id: 'a', stage: 'saved' }) });
    unmount = Tracker(fixture(), {});
    await tick();
    const savedCount = () => fixture().querySelector('.rr-chip[data-stage="saved"] .rr-chip-count').textContent;
    expect(savedCount()).toBe('1');
    __mockChrome.__setNextSetShouldReject();
    await pickStage('applied');
    await tick();
    expect(savedCount()).toBe('1');
  });
});

// ── Suite: Toast timer + Undo race ────────────────────────────────────────
// Uses real setTimeout with sub-second durations. No fake timers; the test
// runner just awaits enough wall time for the timer to fire (or not).

describe('Toast timer and Undo race', () => {
  beforeEach(() => clearFixture());

  it('auto-dismiss fires onAutoDismiss once after duration', async () => {
    const onAction = spy();
    const onAutoDismiss = spy();
    Toast(fixture(), { body: 'x', actionLabel: 'Undo', duration: 50, onAction, onAutoDismiss });
    await tick(80);
    expect(onAutoDismiss).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(0);
  });

  it('Undo click fires onAction once and cancels timer', async () => {
    const onAction = spy();
    const onAutoDismiss = spy();
    Toast(fixture(), { body: 'x', actionLabel: 'Undo', duration: 100, onAction, onAutoDismiss });
    await tick(20);
    fixture().querySelector('.rr-toast-action').click();
    await tick(120);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAutoDismiss).toHaveBeenCalledTimes(0);
  });

  it('dismissNow fires neither callback', async () => {
    const onAction = spy();
    const onAutoDismiss = spy();
    const handle = Toast(fixture(), { body: 'x', actionLabel: 'Undo', duration: 100, onAction, onAutoDismiss });
    await tick(20);
    handle.dismissNow();
    await tick(120);
    expect(onAction).toHaveBeenCalledTimes(0);
    expect(onAutoDismiss).toHaveBeenCalledTimes(0);
    expect(fixture().querySelector('.rr-toast')).toBeNull();
  });

  it('consumed flag prevents post-dismissNow timer firing', async () => {
    const onAutoDismiss = spy();
    const handle = Toast(fixture(), { body: 'x', actionLabel: 'Undo', duration: 30, onAutoDismiss });
    handle.dismissNow();
    await tick(60);
    expect(onAutoDismiss).toHaveBeenCalledTimes(0);
  });
});

// ── Suite: ConfirmDialog focus trap ───────────────────────────────────────

describe('ConfirmDialog focus trap', () => {
  let handle;
  beforeEach(() => { clearFixture(); });
  afterEach(() => { if (handle) { handle.unmount(); handle = null; } });

  function mount(opts) {
    const trigger = document.createElement('button');
    fixture().appendChild(trigger);
    trigger.focus();
    handle = ConfirmDialog(fixture(), Object.assign({
      heading: 'Delete?',
      body: 'Cannot undo.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      returnFocusTo: trigger,
      onCancel: () => {},
      onConfirm: () => {},
    }, opts || {}));
    return trigger;
  }

  function press(key, shiftKey) {
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
  }

  it('initial focus is on Cancel', () => {
    mount();
    const cancel = document.querySelector('.rr-btn-secondary');
    expect(document.activeElement === cancel).toBeTruthy();
  });

  it('Tab from Delete wraps to Cancel', () => {
    mount();
    document.querySelector('.rr-btn-destructive').focus();
    press('Tab', false);
    expect(document.activeElement === document.querySelector('.rr-btn-secondary')).toBeTruthy();
  });

  it('Shift+Tab from Cancel wraps to Delete', () => {
    mount();
    press('Tab', true);
    expect(document.activeElement === document.querySelector('.rr-btn-destructive')).toBeTruthy();
  });

  it('Escape calls onCancel and returns focus to trigger', () => {
    const onCancel = spy();
    const trigger = mount({ onCancel });
    press('Escape', false);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.activeElement === trigger).toBeTruthy();
    handle = null; // already unmounted by close()
  });
});

// ── Suite: recentlyRestoredIds suppression on Undo ────────────────────────
// Verbose-but-realistic: drives the full UI path
// (overflow trigger -> Delete menuitem -> ConfirmDialog Delete -> Toast Undo).

describe('recentlyRestoredIds suppression on Undo', () => {
  let unmount;
  beforeEach(() => { __mockChrome.__reset(); clearFixture(); });
  afterEach(() => { if (unmount) { unmount(); unmount = null; } });

  async function deleteAndUndo() {
    fixture().querySelector('.rr-overflow-trigger').click();
    await tick();
    document.querySelector('.rr-menu .rr-menuitem[data-id="delete"]').click();
    await tick();
    document.querySelector('.rr-dialog .rr-btn-destructive').click();
    await tick();
    document.querySelector('.rr-toast-action').click();
    await tick();
  }

  it('restored row does not have rr-row-new class', async () => {
    __mockChrome.__setStore({ rr_job_a: makeJob({ id: 'a', stage: 'saved' }) });
    unmount = Tracker(fixture(), {});
    await tick();
    await deleteAndUndo();
    const row = fixture().querySelector('.rr-row');
    expect(row).toBeTruthy();
    expect(row.classList.contains('rr-row-new')).toBeFalsy();
    expect(row.dataset.jobId).toBe('a');
  });

  it('restored job is back in storage with original timestamps', async () => {
    const original = makeJob({ id: 'a', stage: 'saved', createdAt: 1700000000000, lastActionAt: 1700000000000 });
    __mockChrome.__setStore({ rr_job_a: original });
    unmount = Tracker(fixture(), {});
    await tick();
    await deleteAndUndo();
    const stored = __mockChrome.__getStore();
    expect(stored.rr_job_a.createdAt).toBe(1700000000000);
    expect(stored.rr_job_a.lastActionAt).toBe(1700000000000);
  });
});

// ── Suite: StageStrip setCounts and setSelected ───────────────────────────

describe('StageStrip setCounts and setSelected', () => {
  let handle;
  beforeEach(() => { clearFixture(); });
  afterEach(() => { if (handle) { handle.unmount(); handle = null; } });

  it('setCounts updates each chip count', () => {
    handle = StageStrip(fixture(), {}, { saved: 0, applied: 0, replied: 0, interviewing: 0, offer: 0, rejected: 0 }, { onSelect: () => {} });
    handle.setCounts({ saved: 3, applied: 2, replied: 0, interviewing: 0, offer: 1, rejected: 0 });
    expect(fixture().querySelector('.rr-chip[data-stage="saved"] .rr-chip-count').textContent).toBe('3');
    expect(fixture().querySelector('.rr-chip[data-stage="applied"] .rr-chip-count').textContent).toBe('2');
    expect(fixture().querySelector('.rr-chip[data-stage="offer"] .rr-chip-count').textContent).toBe('1');
  });

  it('All pill shows total = sum of stage values', () => {
    handle = StageStrip(fixture(), {}, { saved: 0, applied: 0, replied: 0, interviewing: 0, offer: 0, rejected: 0 }, { onSelect: () => {} });
    handle.setCounts({ saved: 3, applied: 2, replied: 1, interviewing: 0, offer: 1, rejected: 1 });
    expect(fixture().querySelector('.rr-chip-all').textContent).toBe('All (8)');
  });

  it('setSelected("saved") sets aria-pressed=true on saved chip only', () => {
    handle = StageStrip(fixture(), {}, { saved: 1, applied: 0, replied: 0, interviewing: 0, offer: 0, rejected: 0 }, { onSelect: () => {} });
    handle.setSelected('saved');
    expect(fixture().querySelector('.rr-chip[data-stage="saved"]').getAttribute('aria-pressed')).toBe('true');
    expect(fixture().querySelector('.rr-chip[data-stage="applied"]').getAttribute('aria-pressed')).toBe('false');
    expect(fixture().querySelector('.rr-chip-all').getAttribute('aria-pressed')).toBe('false');
  });

  it('setSelected(null) sets aria-pressed=true on All pill', () => {
    handle = StageStrip(fixture(), {}, { saved: 1, applied: 0, replied: 0, interviewing: 0, offer: 0, rejected: 0 }, { onSelect: () => {} });
    handle.setSelected(null);
    expect(fixture().querySelector('.rr-chip-all').getAttribute('aria-pressed')).toBe('true');
    expect(fixture().querySelector('.rr-chip[data-stage="saved"]').getAttribute('aria-pressed')).toBe('false');
  });
});
