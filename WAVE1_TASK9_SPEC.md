# Wave 1 Task 9: Minimum Tracker UI

## Purpose

The first user-visible feature of the side panel. Renders the JobLeads currently in `chrome.storage.local` as a usable tracker. No new data plumbing, no API calls, no Apollo, no Claude API, no Gmail. Just a UI surface for what already exists.

This is a real product slice, not a placeholder. After this ships, a user installs the extension, captures jobs from LinkedIn / Lever / Indeed, opens the side panel, and sees their pipeline. That's the first moment the extension feels like a product instead of plumbing.

## Scope boundaries

**In scope:**
- Tab navigation shell (Overview, Contacts, Messages, Tracker, Insights). Only the Tracker tab has content. The other four show a "Coming soon" empty state with one-line copy.
- Tracker tab with two views stacked vertically: a top stage strip (counts per stage) and a list of saved jobs below.
- Job list rendering from `rr_job_*` keys in chrome.storage.local.
- Stage filter (clicking a stage chip in the top strip filters the list to that stage).
- Per-job actions: change stage, open original URL, delete.
- Empty state when no jobs are saved.
- Storage change subscription so new captures appear in the list without a panel reload.

**Explicitly out of scope (deferred to later tasks):**
- Contacts section (Apollo unlock, Wave 2)
- Generate with AI section (Claude API draft generation, Wave 2)
- Generate personalized message (draft composer + Gmail handoff, Wave 2)
- Application strategy (heuristics not yet defined, Wave 3+)
- Match score on the left side of the original mockup (Wellfound parser + scoring, Wave 2+)
- Manual edit of any JobLead field (deferred to a follow-up task)
- Bulk operations on jobs (multi-select, bulk delete, bulk stage change)
- Search / filter beyond stage chip
- Sort options (default sort is lastActionAt descending)
- Drag-and-drop kanban (the original "Kanban Phase 1" prompt from earlier sessions; still useful but not in task 9)

## Data the UI reads

Source: `chrome.storage.local`, keys matching `rr_job_*`.

JobLead schema fields used by this UI:

| Field | Use |
|---|---|
| id | Element key, delete identifier |
| title | Primary text in each row |
| company | Secondary text. Nullable today; show source badge if null. |
| location | Tertiary text. Nullable; hide if null. |
| sourceType | Badge: 'LinkedIn' / 'Lever' / 'Indeed' |
| sourceUrl | Open in new tab on row click |
| stage | Stage chip in row, also drives column count |
| createdAt | Tooltip on time pill |
| lastActionAt | Relative time pill, default sort key |

Fields the UI ignores in task 9: salaryText, descriptionHash, fitBand, nextActionAt. They're in the schema for later tasks.

## Tab navigation shell

Five tabs across the top of the panel, matching the design mockup. Selected tab has a bottom border accent in the brand purple. Each tab uses an icon + label.

| Tab | Icon | Status in task 9 |
|---|---|---|
| Overview | home | Empty state: "Save a job from LinkedIn, Lever, or Indeed to start." |
| Contacts | user-circle | Empty state: "Contact discovery ships in the next update." |
| Messages | envelope | Empty state: "Message generation ships in the next update." |
| Tracker | clipboard-list | Active content (this task) |
| Insights | chart-line | Empty state: "Reply rate insights ship after you start sending." |

Default tab on panel boot: Tracker. Reasoning: when a user clicks the toolbar after capturing a job, the panel should land on the place that proves capture worked. Once the Overview tab has real per-job content (Wave 2), default flips to Overview if the active tab is a known job page.

Tab state persists in chrome.storage.local under `rr_panel_active_tab` so reopening the panel restores the last view.

Coming-soon empty states use the same component, just with different icon + copy. No tease graphics, no "join waitlist" buttons, no animation. One-line text, centered, muted colour.

## Tracker tab layout

Two sections stacked vertically:

### Section A: Stage strip (top)

Six stage chips in a horizontal row that wraps if needed. Each chip shows the stage name on top and the count below.

Stage list and ordering: Saved, Applied, Replied, Interviewing, Offer, Rejected.

Counts come from a single pass over all `rr_job_*` entries grouped by `stage` field. Always show all six chips, even if count is 0. The strip is the user's mental model of their pipeline, not just their current state.

Selected chip has a coloured border (brand purple). Clicking a chip filters the job list below. Clicking the same chip again clears the filter (back to "all stages"). A small "All (N)" pill on the far left of the strip serves as the explicit "clear filter" affordance and shows total count.

### Section B: Job list (below)

Each job row contains:

- Source badge (left): small coloured pill with sourceType. LinkedIn = LinkedIn blue, Lever = green, Indeed = navy. Two-letter abbreviation if space tight.
- Title (primary): from `title` field. Bold, single line, truncate with ellipsis on overflow.
- Company (secondary): from `company` field if present, else show the source domain extracted from sourceUrl as a fallback. Smaller, muted.
- Location + time (tertiary): location if present, separated from relative time by a middle dot. Time uses lastActionAt: "Just now" (under 60s), "Nm ago" (under 60min), "Nh ago" (under 24h), "Yesterday", "N days ago" (under 7d), "MMM D" (this year), "MMM D, YYYY" (older).
- Stage dropdown (right): button showing current stage, dropdown reveals all six stages on click. Selecting a new stage updates the JobLead in storage and bumps lastActionAt.
- Overflow menu: opens a small menu with two items: "Open original" (opens sourceUrl in new tab) and "Delete" (removes the JobLead, with a confirm).

Clicking anywhere in the row outside the dropdown and overflow menu opens the sourceUrl in a new tab. This is the most common action so it gets the largest hit target.

Hover state: subtle background tint. Mobile/touch: long-press shows the overflow actions.

### Section B: Empty state

When there are zero JobLeads in storage, replace the list with a centered icon, header ("No jobs saved yet"), and two-line description ("Click the ReplyRate icon on a LinkedIn, Lever, or Indeed job page to save it.").

No CTA button: the action is on the user's other tabs, not in the panel. Empty state suppressed when a stage filter is active and the filter has zero matches; instead show "No jobs in [Stage] stage yet." with a small "Show all" link that clears the filter.

## Behaviour: storage subscription

The panel listens to `chrome.storage.onChanged` for keys matching `rr_job_*`. On any change:

1. Re-derive stage counts from the new state.
2. Re-render the visible list (respecting the active filter).
3. If a new JobLead was added (key didn't exist before), briefly highlight that row (background flash, ~1.5s).

This means: a user with the panel open who clicks the floating button on a Lever page sees the new entry land in the panel without any explicit refresh. This matters because it's the first moment the extension feels alive: capture and visibility are connected.

## Behaviour: stage change

When a user picks a new stage from the dropdown:

1. Update the JobLead in storage: set `stage` to the new value, set `lastActionAt = Date.now()`.
2. Optimistic UI: re-render immediately with the new stage; storage write happens in background.
3. On storage write failure, revert and show an inline error pill on that row.

When stage changes to "Rejected", the row stays in the list but visually de-emphasised (lower opacity, muted text). User can still expand and act on it.

## Behaviour: delete

When a user picks Delete from the overflow:

1. Show a confirm: "Delete this job? This can't be undone."
2. On confirm, remove the JobLead from chrome.storage.local.
3. Storage subscription handles the re-render automatically.
4. Brief "Deleted" toast at the bottom of the panel with an "Undo" link for ~5 seconds. Undo restores the JobLead to storage with the same id and timestamps.

## States the panel must handle

| State | Trigger | Render |
|---|---|---|
| Loading | Panel boot, before storage read completes | Skeleton rows (3 placeholder shapes) |
| Empty | Storage read complete, zero rr_job_* entries | Empty state component |
| Populated | Storage read complete, 1 or more rr_job_* entries | Full tracker |
| Filtered empty | Stage filter active, zero matches in that stage | "No jobs in [Stage] stage yet" + Show all link |
| Storage error | Storage read or write fails | Error state with retry button. Surfaces err.message in muted text. |
| Tab not in scope | User on Overview / Contacts / Messages / Insights tab | Coming-soon empty state for that tab |

## Visual tokens

Inherit from the existing sidepanel.css. Confirmed needs:

- Brand purple (already defined): primary actions, active tab accent, brand badge
- Stage colours: Saved (neutral), Applied (blue), Replied (yellow), Interviewing (purple), Offer (green), Rejected (muted/grey)
- Source colours: LinkedIn blue (#0a66c2), Lever green (#2eb88a), Indeed navy (#003a9b)
- Typography: existing system stack, no custom font load
- Spacing: 8px grid, matches current panel
- Density: comfortable on desktop, compact on narrow panel widths (Chrome's side panel is resizable; design must work at 360px and 480px widths)

## Accessibility requirements

- All tabs reachable by keyboard (Tab to focus, Arrow keys to move between tabs, Enter to activate)
- Stage chips reachable by Tab, activatable with Space or Enter
- Job rows reachable by Tab; primary action (open original) on Enter, secondary actions on a key combo or accessible menu
- Stage dropdown is a real `<select>` or a custom widget with `role="listbox"` and proper aria
- Delete confirm follows WAI dialog pattern: focus trap, Escape closes, focus returns to triggering element
- All icons have `aria-label` or are marked `aria-hidden` if decorative
- Time pills have a `title` or `aria-label` with the absolute timestamp
- Source badges have `aria-label` of "From LinkedIn" / "From Lever" / "From Indeed"
- Storage flash animation respects `prefers-reduced-motion`

These are task 9 baseline; full WCAG 2.2 AA audit is Wave 4 task 36.

## File structure

Single-file vanilla JS as per the build rules in the briefing. Update `sidepanel.html` and `sidepanel.js`. Add `tracker.css` only if the existing sidepanel.css gets unwieldy. Judgement call by Claude Code.

No new dependencies. No build step. No React. No bundler.

Module shape inside sidepanel.js (suggested, Claude Code can adjust):

- `Tabs`: top tab navigation
- `Tracker`: the active tab content, owns the storage subscription
- `StageStrip`: the six chips + All pill
- `JobList`: the list of rows + empty state
- `JobRow`: a single row
- `StageDropdown`: the per-row stage picker
- `OverflowMenu`: the per-row menu
- `ConfirmDialog`: used by delete
- `Toast`: used by delete undo
- `EmptyState`: reused across tabs and the filtered-empty variant

Each module is a function that takes a parent element and a state object, returns an unmount handler. No framework.

## Performance

- Initial render must complete under 100ms after storage read returns
- Storage change re-render must complete under 50ms (already-rendered DOM, diff and patch)
- Scrolling the job list must be smooth at 100+ entries (lazy render or virtual list if needed; YAGNI for v1, address when a real user has 50+ entries)
- No layout shift on stage change (optimistic UI handles this)

## What ships at end of task 9

User installs the extension. Captures three jobs from three sources. Opens the side panel. Sees: a five-tab navigation, a default Tracker tab with a six-stage strip showing 3 / 0 / 0 / 0 / 0 / 0, three rows below with title, source badge, and time pill. Can click a row to open the job. Can change a stage from the dropdown. Can delete a job with confirm and undo. Other four tabs show a clean "coming soon" message.

That's the v1. Real, shippable, useful, defensible.

## Acceptance checklist before shipping

- [ ] All five tabs render and switch correctly
- [ ] Tracker default count loaded from storage
- [ ] Stage chips show correct counts
- [ ] Stage filter works (click chip, list filters; click again, clears)
- [ ] Job rows render with title, source badge, time pill
- [ ] Clicking a row opens sourceUrl in new tab
- [ ] Stage dropdown changes stage in storage and bumps lastActionAt
- [ ] Overflow menu has Open original + Delete
- [ ] Delete shows confirm, removes from storage, shows undo toast
- [ ] Undo restores the JobLead within 5s
- [ ] Empty state renders when zero jobs
- [ ] Filtered empty state renders when filter has zero matches
- [ ] New capture from any source page appears in the list without panel reload
- [ ] Last-active tab persists across panel close/reopen
- [ ] Keyboard navigation works for tabs, chips, rows, dropdowns, dialog
- [ ] No em dashes anywhere in copy or comments
- [ ] No console errors or warnings on boot or interaction
- [ ] Works at 360px and 480px panel widths
- [ ] Reduced-motion preference respected on the flash animation

## Dependencies and prerequisites

Before task 9 can ship cleanly, Wave 0 task 5 must be verified working in browser (the chrome.runtime guard issue from the last session). Task 9 doesn't add new message passing, but it relies on the SAVE_JOB and storage write path being reliable.

Task 9 does NOT depend on Wave 0 task 6 (content script restructure). They're independent and can ship in either order.

## Things this spec does NOT decide

These decisions get made when Claude Code starts the task, not now:

- Exact CSS variable names for stage colours and source colours
- Whether the stage dropdown is a native select element or a custom widget
- Whether storage subscription uses chrome.storage.onChanged directly or a small wrapper
- Whether the time pill format uses a tiny library or a hand-rolled function (probably hand-rolled given no-dependencies rule)
- Exact icon set (the briefing already references Phosphor; honour that unless there's a reason to deviate)
- Whether tab persistence uses the same storage namespace (rr_) or a separate UI-state namespace

Claude Code makes these calls and flags decisions when proposing the diff.

## Note on the original design

The full mockup includes Contacts, Generate with AI, Generate personalized message, and Application strategy. All four are deliberately deferred to Wave 2+. The reason is honesty about dependencies:

- Contacts requires Apollo integration in the extension's backend (currently the contact targeting logic lives in the web app's Job Hunter tab). Porting cleanly is its own multi-day project.
- Generate with AI requires the user's profile (CV, role targets, voice settings) to live in the extension's storage and a backend route from the panel to /api/claude. Neither exists yet.
- Generate personalized message adds Gmail OAuth on top of the above.
- Application strategy needs heuristics that don't exist yet and that probably need 50+ real user sessions of data to design well.

Shipping the design before these are real means shipping a UI that lies to the user. Better to ship the slice that's true (Tracker) and earn the rest.
