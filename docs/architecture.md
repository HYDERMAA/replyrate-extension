# Architecture

## 1. Overview

The ReplyRate extension helps users save job postings, track applications, and generate outreach. As of today only the save-and-track surface is shipped.

Two capture paths:
- LinkedIn: user clicks the toolbar icon. The side panel opens (Chrome routes the click via setPanelBehavior). The panel asks the service worker to consider the active tab for capture.
- Lever, Indeed: user clicks a floating "Save to ReplyRate" button injected into the page by content.js. The button sends a SAVE_JOB message to the service worker.

In both paths the service worker canonicalises the URL, dedupes against existing entries in chrome.storage.local, writes a JobLead under the key `rr_job_<id>`, and opens or refreshes the side panel.

The side panel reads chrome.storage.local on boot, subscribes to chrome.storage.onChanged, and renders a tab strip (Overview, Contacts, Messages, Tracker, Insights). Only the Tracker tab has functional content today; the other four tabs render coming-soon empty states.

ASCII flow:

```
[LinkedIn job page]                       [Lever / Indeed job page]
        |                                            |
        | toolbar click                              | floating button click
        v                                            v
[Chrome opens side panel]                  [content.js sends SAVE_JOB]
        |                                            |
        | panel boots and renders loading state      |
        | THEN sends rr_capture_active_tab           |
        v                                            v
   [service worker: background.js]  <----------- (same SW)
        |
        | canonicalise, dedupe, write rr_job_<id>
        v
   [chrome.storage.local]
        |
        | onChanged event
        v
   [side panel: sidepanel.js Tracker]
        |
        | reconcileList -> JobList -> JobRow flash
        v
   [user sees the new row]
```

The panel boot ordering matters: the panel renders its loading skeleton first, THEN posts rr_capture_active_tab to the SW. The SW never sees the message before the panel has at least painted; if the user-gesture window had decayed by the time the SW writes storage, the resulting onChanged event still arrives at a live listener.

The extension talks to no backend today. All state lives in chrome.storage.local. Wave 2 introduces Apollo (contacts) and the Claude API (drafts).

## 2. Module shape contract

Every UI module is a function that takes a parent DOM element (and optionally other args) and returns either:
- a bare unmount function when the module has no external API, or
- an object with unmount and one or more setter methods when callers need to push updates.

Module list with signatures:

- App(parent, state) -> unmount. Mounts Tabs and per-tab content panels. Owned by sidepanel.js boot.
- Tabs(parent, state) -> unmount. Top tab strip. Subscribes to state.activeTab.
- EmptyState(parent, { icon, heading, body }) -> unmount. Centred icon plus optional heading plus optional body. Bare function.
- Tracker(parent, state) -> unmount. Active content for the Tracker tab. Owns the in-memory jobsByKey Map and the chrome.storage.onChanged subscription.
- StageStrip(parent, _state, initialCounts, options) -> { unmount, setCounts, setSelected }. The six stage chips plus the All pill. options.onSelect fires on chip click.
- JobList(parent, state, initialEntries, initialNewIds, options) -> { unmount, setEntries, updateRow }. Container plus rows. Per-row callbacks (onStageChange, onDelete, onOpenOriginal) come in via options.
- JobRow(parent, jobLead, options) -> { unmount, update }. One row. Hosts a StageDropdown and an OverflowMenu.
- JobListEmptyState(parent) -> unmount. Tracker zero-jobs state ("No jobs saved yet"). Wraps EmptyState.
- FilteredEmptyState(parent, stageLabel, onShowAll) -> { unmount }. Tracker filter-active-no-matches state with the Show all link.
- StageDropdown(parent, jobLead, onSelect) -> { unmount, setStage, setBusy, showError }. WAI listbox; trigger lives in parent, listbox is portaled to document.body.
- OverflowMenu(parent, jobLead, options) -> { unmount, triggerEl }. WAI menu. triggerEl is exposed for focus return after the dialog closes.
- ConfirmDialog(parent, options) -> { unmount }. Modal WAI dialog with focus trap.
- Toast(parent, options) -> { unmount, dismissNow }. Singleton replacement, 5s auto-dismiss.
- ErrorState(parent, errMessage, onRetry) -> { unmount }. Replaces the skeleton when the initial storage load fails.
- renderTrackerSkeleton(parent) -> HTMLElement. Internal helper used by Tracker; returns the skeleton root so Tracker can remove it directly. Does not follow the standard signature because Tracker holds a direct reference to the skeleton root and removes it via DOM manipulation when async load completes; no separate lifecycle owner needs the standard unmount-handle convention, so the helper just returns the element.

Convention rationale: bare-fn unmount is enough when nothing else needs to talk to the module. The moment a caller wants to push updates (counts, entries, stage label, error pill), the return type widens to an object so the unmount stays a sibling of the setters.

## 3. Message contract

The full contract is also documented at the top of background.js. Three message types live in production today.

1. rr_set_state. Direction: bg -> sp. Payload: { type, state, error?, notice? }. state is one of 'collapsed' | 'loading' | 'ready' | 'error'. error is a human-readable string when state is 'error'. notice is an i18n key for non-blocking info, currently 'rr_notice_not_a_job_page' or 'rr_notice_already_saved' (panel rendering deferred). No response. Use pushPanelState() or pushPanelEvent('state', ...) at the call site.

2. rr_capture_active_tab. Direction: sp -> bg. Payload: { type, tabId: number }. Response: { accepted: true } sent synchronously. Real result follows later via an rr_set_state broadcast. responseStyle: sync_ack.

3. SAVE_JOB. Direction: cs -> bg. Payload: { type, sourceType: 'lever' | 'indeed', title, rawUrl }. Response: { ok: true, id, deduped?: true } | { ok: false, error: string }. Sent asynchronously via promise chain. responseStyle: async. Sender constraint: requires sender.tab.id. Future flows that need to save from a non-tab context (manual paste, side-panel "add job" button) should introduce a new message type rather than overload SAVE_JOB.

The dispatch in background.js uses a single MESSAGE_HANDLERS table keyed by msg.type. Each entry has { responseStyle, requiresTabSender, handler }. Adding a new type is a one-line append plus an entry in the contract block.

## 4. Storage schema

chrome.storage.local is the only persistent store. All keys carry the rr_ prefix so a future sync layer can mirror this namespace verbatim.

- `rr_job_<id>`: a JobLead record. Fields:
  - id: string. Format `job_<unix-millis>_<7-char base36 random>`.
  - title: string.
  - company: string or null. Nullable; LinkedIn captures land as null today.
  - location: string or null. Nullable.
  - sourceType: 'linkedin' | 'lever' | 'indeed'.
  - sourceUrl: canonical URL string. See section 5 for the per-source rules.
  - salaryText: string or null. Reserved for Wave 2.
  - descriptionHash: string or null. Reserved for Wave 2.
  - fitBand: string or null. Reserved for Wave 2 / 3.
  - stage: 'saved' | 'applied' | 'replied' | 'interviewing' | 'offer' | 'rejected'.
  - createdAt: number (Date.now() at first capture). Preserved across Undo restoration.
  - lastActionAt: number. Bumped on capture, dedupe touch, and stage change. Undo restoration uses the original value verbatim.
  - nextActionAt: number or null. Reserved for follow-up reminders in Wave 2.

- `rr_panel_active_tab`: a string in { 'overview', 'contacts', 'messages', 'tracker', 'insights' }. Defaults to 'tracker' when absent or invalid. Persisted across panel close/reopen; not synced.

- `rr_user_profile`: read at boot in rehydrate() but never written. Reserved for Wave 2 (CV summary, role targets, voice settings).

No other keys are written by current code paths.

## 5. Capture pipeline

LinkedIn (toolbar driven):
1. User clicks the extension toolbar icon on any page.
2. chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }) from Wave 0 task 4 routes the click directly to the panel. chrome.action.onClicked is intentionally not used; if both were wired, setPanelBehavior(true) suppresses onClicked.
3. Panel boots; sidepanel.js boot() calls requestActiveTabCapture() which queries the active tab and posts rr_capture_active_tab.
4. background.js's captureActiveTabIfEligible reads chrome.tabs.get(tabId), then runs canonicalLinkedInJobUrl on tab.url. The helper handles three URL shapes: `/jobs/view/<digits>`, `/jobs/collections/.../?currentJobId=<digits>`, `/jobs/search/.../?currentJobId=<digits>`. All three collapse to `https://www.linkedin.com/jobs/view/<id>/`. Returns null for /feed/, bare /jobs/, malformed URLs.
5. If null, pushPanelState('ready', null, 'rr_notice_not_a_job_page') and exit. If non-null, scan `rr_job_*` keys for a matching sourceUrl. On hit, bump lastActionAt and post rr_notice_already_saved. On miss, write a fresh JobLead with sourceType: 'linkedin' and post 'ready'.

Lever / Indeed (content-script driven):
1. content.js detects the board via hostname. EXTRACTORS[board] reads role, company, location, description, url from DOM selectors.
2. User clicks the floating button. content.js sends SAVE_JOB with { sourceType, title: extracted role, rawUrl: window.location.href }.
3. background.js's handleSaveJob runs synchronously inside the user-gesture window, calls chrome.sidePanel.open({ tabId: sender.tab.id }) before doing async work (the gesture decays during await).
4. saveFromContentScript picks the canonicalizer by sourceType:
   - canonicalLeverUrl strips query and fragment from jobs.lever.co URLs. Returns null if hostname does not match.
   - canonicalIndeedUrl extracts jk from /viewjob, or vjk from /jobs and /m/jobs (covers www, uk, m subdomains via a hostname suffix check), validates alphanumeric, rebuilds as `https://www.indeed.com/viewjob?jk=<id>`.
5. Dedupe scan, then write `rr_job_<id>` or bump lastActionAt.

LinkedIn DOM injection was removed in Wave 0 task 7. The static content_scripts manifest entry no longer matches linkedin.com. The BOARD detector in content.js was also stripped of its linkedin branch as belt-and-braces against any future programmatic registration.

## 6. Reconciliation patterns

Tracker is the source of truth for what's on screen in the Tracker tab.

In-memory state:
- jobsByKey: a Map<string, JobLead>. Mirrors the `rr_job_*` slice of chrome.storage.local.
- listMode: one of 'empty', 'list', 'filtered_empty'. Reflects which list-area handle is currently mounted.
- listHandle: a bare unmount fn (for JobListEmptyState) or { unmount, setEntries } (for JobList) or { unmount } (for FilteredEmptyState). Tracker checks listMode to know which shape to call.
- displayedFilterLabel: the FilteredEmptyState label currently on screen. Tracked separately from listMode so that switching between two empty stages (Saved -> Applied, both with 0 jobs) triggers a remount of FilteredEmptyState with the new label without leaving filtered_empty mode.
- currentFilter: stage id or null. Never silently mutated. When total drops to 0, mode becomes 'empty' (JobListEmptyState renders) but currentFilter stays set; a subsequent matching save brings the row in.
- recentlyRestoredIds: a Set used by Undo to suppress flash for restored rows. One-shot consumption inside onStorageChanged.

Reconciliation algorithm (reconcileList):
1. Compute allEntries (sorted by lastActionAt desc) and filtered (if currentFilter is set).
2. Compute newMode: 'empty' if total is 0; 'filtered_empty' if filter active and matches is 0; 'list' otherwise.
3. If mode changed OR filtered_empty label changed, tear down the current handle and mount the correct one.
4. If mode stays 'list', call listHandle.setEntries(filtered, filteredNewIds) for in-place re-render.

Optimistic stage change (the highest-stakes flow):
1. JobRow's StageDropdown onSelect captures prior via structuredClone(jobLead) so the snapshot is independent of any later mutation.
2. JobRow synchronously updates its own row: dropdown.setStage, paintNonStage, root.dataset.stage.
3. JobRow awaits options.onStageChange(prior, updated), which is Tracker.commitStageChange.
4. commitStageChange synchronously updates jobsByKey and StageStrip.setCounts, then awaits chrome.storage.local.set.
5. On success, do nothing visually. The post-write onStorageChanged fires reconcileList; in 'list' mode it does setEntries (full re-render) which lands on the same content. Idempotent.
6. On failure, commitStageChange reverts jobsByKey and counts and re-throws; JobRow's catch reverts its own row UI and pops the error pill via dropdown.showError.

Critical non-call: the optimistic path does NOT call reconcileList during the in-flight write. Reconciling would unmount the JobRow whose dropdown handle is mid-promise, so the row's revert path would fail silently. The trade-off is that, when a filter is active and the stage change moves the row out of the filter, the row stays visible for ~50ms until the storage event fires. Acceptable for v1.

Delete with Undo:
1. trackerDeleteFlow opens ConfirmDialog. On Cancel, no-op. On Confirm, capture snapshot via structuredClone(jobsByKey.get(key)). Snapshot preserves id, createdAt, lastActionAt verbatim.
2. chrome.storage.local.remove(key). The storage event fires onStorageChanged, which deletes the row from jobsByKey and reconciles the list.
3. showDeleteToast mounts a Toast with Undo. The previous toast (if any) is dismissNow'd.
4. Undo click adds the id to recentlyRestoredIds, then chrome.storage.local.set({ [key]: snapshot }). The storage event fires; onStorageChanged sees the id in recentlyRestoredIds, consumes the entry one-shot, and excludes the id from newlyAddedIds. JobRow renders without the flash class. The restored row sorts back into chronological position because lastActionAt was preserved.
5. Auto-dismiss after 5s makes the deletion permanent (storage was already cleared at confirm time; nothing more to do).

## 7. Lifecycle and teardown

Tracker.unmount cascade, in order:
1. Set local unmounted = true. Any in-flight async work (initial load) checks this flag and bails.
2. Remove the chrome.storage.onChanged listener if it was attached.
3. currentDialogHandle.unmount() if a ConfirmDialog is open.
4. currentToastHandle.dismissNow() if a Toast is up.
5. errorHandle.unmount() if the ErrorState is currently shown.
6. stripHandle.unmount() to remove the chip strip.
7. teardownCurrentListHandle() which checks listMode to choose between calling the handle as a function (empty mode) or .unmount() on it (list / filtered_empty modes).
8. Remove the skeleton if it is still present (initial load was still in flight).

JobRow.unmount in turn calls dropdown.unmount() (which closes the listbox if open) and overflow.unmount() (which closes the menu if open). Open popovers are torn down without leaks.

Toast.dismissNow contract: clears the timer, marks consumed, removes the DOM node, but does NOT fire onAction or onAutoDismiss. This is deliberate. Two callers:
- The replacement path in showDeleteToast. The previous delete is already permanent (storage was cleared at confirm time); we do not want onAutoDismiss to fire because the cleanup paths it might run are about UI state, not storage.
- The Tracker.unmount path. User switched tabs; the deletion stays permanent for the same reason.

The optimistic stage change explicitly avoids reconcileList during the in-flight write. The reasoning is encoded as a comment in commitStageChange: re-rendering would unmount the JobRow whose dropdown handle is mid-promise, so the revert path would fail silently. The post-write storage event provides a natural reconciliation point that is idempotent with the optimistic state.

## 8. Decisions log

Why side panel instead of popup. The strategic decision in the briefing locks the panel as the primary surface. Popups close on focus loss, which makes them unsuitable for the multi-step workflow Wave 1 ships and Wave 2 builds out (capture, tracker, contact unlock, draft generation, Gmail handoff). LinkedIn TOS also rules out heavy on-page UI; a side panel side-steps that constraint by living outside the host page entirely.

Why chrome.storage.local instead of Firebase. Wave 2 will introduce a backend for Apollo, the Claude API, and Gmail OAuth. Until that backend is real, chrome.storage.local is enough and avoids a half-built sync layer. The rr_ prefix and the JobLead schema are designed so a future sync becomes a transport swap, not a rewrite.

Why setPanelBehavior plus panel-driven capture instead of chrome.action.onClicked. setPanelBehavior({ openPanelOnActionClick: true }) makes the toolbar click reliably open the panel on every domain (including LinkedIn where we strip on-page injection). If we wired onClicked instead, the panel would not open on action click; either we lose the "panel opens everywhere" UX or we manually call sidePanel.open on every click, which is fragile. Capture moves into the panel boot path: panel asks the SW to consider the active tab. Same intent, cleaner separation.

Why floating button stays on Lever and Indeed but is stripped on LinkedIn. LinkedIn's terms prohibit DOM injection. Lever and Indeed do not have an equivalent restriction; the floating button is a small, dismissible affordance that does not modify host content. Different policy domains, different defaults.

Why source badges show full names instead of abbreviations. An earlier version used LI / LV / IN. Two-letter codes felt like trading-app jargon rather than consumer affordances. Full names are 5 to 8 characters, fit at 360px panel width, and the screen reader contract stays clean ("From LinkedIn" via aria-label).

Why lingering filter persists when total goes to 0. When the user filters to Saved and then deletes the last Saved row, the panel renders JobListEmptyState (filter-on-empty is meaningless visually) but currentFilter stays set in memory. A subsequent matching save brings the row in; a non-matching save renders FilteredEmptyState. Auto-clearing the filter would surprise users who expected their filter choice to stick. Predictability over visual consistency.

Why structuredClone for priorJobLead and Undo snapshot. JobLead is a flat object today, but the schema is going to grow. Spread copies are shallow; the moment a nested array or object lands in the schema (Wave 2 may add tags or notes), shallow copies start aliasing. structuredClone is the standard deep-copy idiom and is forward-safe.

Why optimistic stage change does not reconcileList during in-flight write. Reconciling triggers a full JobList re-render which unmounts the JobRow whose dropdown is mid-promise. The dropdown's revert path would then write to a detached DOM node and the error pill would never appear. Skipping reconcileList during the write window keeps the JobRow alive; the post-write storage event provides natural reconciliation that is idempotent with the optimistic state.

Why dismissNow does not fire callbacks. Replacement is not cancellation. When showDeleteToast replaces a prior toast, the prior delete is already permanent (storage was cleared at confirm time); firing onAutoDismiss would suggest the prior action got cancelled and lead future readers to wire cleanup logic that conflicts with the permanence guarantee. Same reasoning applies to Tracker.unmount.

## 9. Known deferred work

- Wave 0 task 6: content script restructure to lazy-load on supported domains only. Today the content script is registered statically against Lever and Indeed via the manifest. The task moves to chrome.scripting.registerContentScripts triggered by user grant of optional host permissions.
- chrome.runtime?.id guard on Lever and Indeed. When the extension is reloaded via chrome://extensions while a Lever or Indeed page is already open, the existing content.js loses its runtime context but the floating button stays injected. Clicking it throws "Cannot read properties of undefined (reading sendMessage)" because chrome.runtime has been invalidated. Fix is `if (!chrome.runtime?.id) return;` at the top of the click handler, ideally with a user-facing fallback like "Please reload this page to continue saving."
- popup.html is dead code. Wave 0 task 4 removed default_popup from the manifest; the file is unreferenced. No mojibake (the earlier session's mention was inaccurate); the file does contain one em dash on line 13 that violates the no-em-dash build rule. Cheapest fix: delete the file.
- CLAUDE_CODE_BRIEFING.md is stale relative to what is shipped. Wave 0 numbering and a few strategic decision wordings drifted during execution. Refresh as a separate doc commit.
- Wave 2 design mockup remains substantially unbuilt. Contacts (Apollo unlock), Generate with AI (Claude API drafts), Generate personalized message (draft composer plus Gmail handoff), and Application strategy are all unbuilt. Each has a Wave 2 task in the briefing.
- Task 9 commit 5 partial verification. 92 of 100 acceptance checks verified statically; 3 high-priority manual checks run in browser; 4 secondary manual checks (LinkedIn toolbar regression, console error-free during normal use, reduced-motion runtime) deferred. Statically passing but not browser-confirmed.

## 10. Glossary

- JobLead: the canonical record of a saved job. Lives in chrome.storage.local under `rr_job_<id>`.
- JobRow: the visible row representation of one JobLead in the Tracker tab.
- StageStrip: the seven-chip horizontal strip at the top of the Tracker (All plus six stages).
- listbox: WAI ARIA pattern. Used by StageDropdown. Single-select, role="listbox" with role="option" children, aria-activedescendant for the highlighted option.
- menu: WAI ARIA pattern. Used by OverflowMenu. role="menu" with role="menuitem" children. Focus moves between items rather than via aria-activedescendant.
- dialog: WAI ARIA pattern. Used by ConfirmDialog. role="dialog", aria-modal="true", focus trap, Escape closes, focus returns to the triggering element.
- focus trap: dialog only. Tab from the last focusable wraps to the first; Shift+Tab from the first wraps to the last. Inside the dialog only.
- optimistic update: the pattern where the UI applies a change before storage confirms. On failure, the UI reverts to a captured prior snapshot.
- reconciliation: the pattern in Tracker where an event (storage change, filter change) recomputes the desired UI state and patches the DOM to match.
- dedupe: scan `rr_job_*` keys for an existing record with the same canonical sourceUrl. On hit, bump lastActionAt; do not write a new record.
- canonical URL: the stable identifier form of a source URL. Per-source helpers (canonicalLinkedInJobUrl, canonicalLeverUrl, canonicalIndeedUrl) collapse the many shapes of a job URL into a single string used for dedupe and display.
- lingering filter: the state where currentFilter is set but total entries is 0; mode is 'empty' and JobListEmptyState renders, but the filter is preserved in memory for the next matching save.
- recentlyRestoredIds: a Set in Tracker used by Undo to suppress the flash class on restored rows. One-shot consumption in onStorageChanged.

## 11. Running tests

A static HTML test harness lives in `tests/index.html`. It loads sidepanel.js with a `window.RR_TEST_MODE` flag set so boot() does not run, swaps `window.chrome` for a mock implementation, and runs roughly 50 test cases across 10 suites covering about 30 of the 100 task-9 acceptance checks.

To run:
1. Reload the extension at chrome://extensions.
2. Find the extension ID (visible on the extensions page).
3. Open `chrome-extension://<extension-id>/tests/index.html` in any tab.
4. The page summary shows pass/fail counts; per-test failures include the assertion error.

The document title is set to `[ok] N/M ReplyRate tests` on full pass and `[fail] N/M ...` on any failure, as a placeholder for a future headless integration that reads the title programmatically. Real-Chrome-only checks (visual focus rings, scroll positioning, screen-reader announcement, real chrome.storage event timing) stay manual and are listed in WAVE1_TASK9_SPEC.md's acceptance checklist.
