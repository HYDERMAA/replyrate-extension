# Wave 2 Task 1: Contacts Tab

> **Spec last verified against deployed backend on 2026-04-29 (commits through `d74ec1d`).** Subsequent backend changes may invalidate UI assumptions documented here; cross-reference current `api/*.js` shape before implementing each section.

## Purpose

The first paid surface in the extension. Turns saved jobs into actionable outreach by surfacing the right people to contact at each company. After this ships, a user clicks a job in Tracker, switches to Contacts, and sees up to three relevant people (HR/TA, Hiring Manager, optionally a Director) with name, role, location, and LinkedIn URL. Email is gated behind a per-contact unlock backed by Apollo, with a generous free tier and a Stripe upgrade path.

This is where the extension stops being plumbing and starts being a product users pay for.

## Scope boundaries

**In scope:**
- Contacts tab activates when a row in Tracker is selected. State.selectedJobId carries the selection across tabs.
- Contact lookup via Apollo, proxied through a new Vercel function `/api/apollo-search`.
- Per-contact email unlock with a 5-lifetime-free / $29-mo-unlimited model.
- Firebase Auth via Google Identity Services (`chrome.identity`), shared uid with the replyrate.ai web app.
- 7-day cache of contact lookups under `rr_contacts_<jobId>`, with stale-while-revalidate refresh.
- Five new UI modules: ContactsTab, ContactCard, UnlockPaywall, ContactsEmptyState, AuthGate.
- Four new message types on the SW dispatch table: `rr_apollo_search`, `rr_contact_unlock`, `rr_auth_signin`, `rr_auth_signout`.
- Three new chrome.storage.local schemas: `rr_contacts_<jobId>`, `rr_user_unlocks`, `rr_user_session`.

**Explicitly out of scope (deferred):**
- Generate with AI section (Wave 2 task 2)
- Generate personalized message + Gmail handoff (Wave 2 task 3)
- Application strategy heuristics (Wave 2 task 4)
- Bulk operations: unlock all, export contacts as CSV
- CRM sync (HubSpot, Salesforce, Wave 3)
- Contact notes, tagging, manual re-search
- Editing contacts (rename, mark wrong, flag stale)
- Multi-language UI (single-locale English)

## User flow

The canonical journey:

1. User saves a job from LinkedIn / Lever / Indeed via the Wave 1 capture flow.
2. User opens the side panel; default Tracker tab shows the saved row.
3. User clicks the row body. Two things happen: state.selectedJobId is set to the row's id, and the active tab switches to Contacts.
4. Contacts tab shows up to three contact cards, one per role bucket. Each card shows name, role bucket badge (HR/TA, Hiring Manager, Director), full job title, location, LinkedIn URL, and an "Unlock email" button.
5. User clicks "Unlock email" on the card they want.
   - If unlock count < 5 (free tier) OR the user has a paid subscription: SW calls `/api/contact-unlock`, the email reveals inline with a Copy button.
   - If unlock count >= 5 and no subscription: UnlockPaywall renders above the contact list with an Upgrade button. Stripe checkout opens in a new tab.
6. After unlock, the email persists across panel close/reopen (cached locally and in Firestore). Subsequent visits show the email immediately.
7. User can click "Open in LinkedIn" to view the profile, "Copy email" once unlocked.

If the user opens Contacts without selecting a job (e.g., directly via tab click): "Pick a job from Tracker to see contacts." empty state.

If the user is signed out OR their session has expired and cannot be refreshed: AuthGate renders before any Contacts content. "Sign in with Google to see contacts" button.

## Architectural decisions

### Per-contact unlock, not per-job

Each unlock is an independent action. A user pays one credit per email reveal. Reasoning: per-job unlock front-loads cost (three emails at once feels expensive). Per-contact maps cleanly to a credit model and lets users skip people they don't care about (probably the careers inbox or the Director).

Apollo Basic plan ($49/mo annual) includes 1200 email reveals per month. At 5 free unlocks per user, 240 free users per month exhaust one Apollo seat. Paid users at $29/mo each cover their own usage up to about 700 reveals/mo (see Known constraints).

### Apollo proxied via Vercel function (REFACTOR, not greenfield)

The Apollo API key never touches the client. Chrome extensions cannot keep secrets; any client-side key is harvested within hours. All Apollo calls go through Vercel functions on the existing replyrate.ai infrastructure.

`POST /api/apollo-search` already exists in the web app's repo and ships the role-bucketing + email-reveal pipeline (Anthropic Haiku title classification, Apollo `mixed_people/api_search` then `people/match`, then a generic `firstname.lastname@domain` pattern fallback when Apollo returns a name without an email). The task here is REFACTOR, not CREATE: gate the email field behind the unlock endpoint (today the search response can include emails directly), add Firebase auth, restrict CORS to `chrome-extension://<id>`. Treat the role-bucketing logic as load-bearing and do not rebuild it. The legacy code also calls Hunter.io between Apollo and pattern; see "Two-tier email waterfall" decision for why the spec treats Hunter as removed.

Auth middleware (`api/_lib/verifyAuth.js`) shipped in commit `073a3ba` and is now applied to all 7 internal `/api/*` endpoints (commit `ef81abf`). The middleware verifies Firebase id tokens from the `Authorization` header, attaches `uid` to the request via `auth.uid`, and returns 401 on invalid or expired token. CORS is handled separately by `api/_lib/cors.js` (commit `ef81abf` uses both helpers). The Wave 2 Task 1 backend work in this repo is therefore the apollo-search refactor (commit `d74ec1d`, email-strip + email gating behind `/api/contact-unlock`) plus the extension-side wiring described below.

`POST /api/contact-unlock` is greenfield: takes a contactId and jobId, verifies the user has remaining unlocks via Firestore, returns the email already enriched during search (or refetches if the search response was constructed pre-auth), decrements the unlock counter atomically, returns the email.

All authenticated endpoints require a Firebase id token in the Authorization header. CORS allows the extension origin (`chrome-extension://<id>`) explicitly; not `*`.

### Two-tier email waterfall (Apollo + pattern)

`/api/apollo-search` returns a `confidence: 'verified' | 'pattern'` per contact reflecting which tier produced the email:

1. **Apollo enrichment** (`confidence: 'verified'`). `people/match` returns `email` directly when Apollo has a verified record. Counts against the 1200/mo Apollo email-reveal quota. This is the only tier that yields a real, deliverable email.
2. **Pattern fallback** (`confidence: 'pattern'`). When Apollo returns a name but no email, the backend constructs `firstname.lastname@<company-domain>` as a best-effort guess. Free; no quota. Marked `confidence: 'pattern'` so the UI renders the address with a "we guessed this" caveat.

Note: the legacy `/api/apollo-search` code currently includes a Hunter.io fallback between these two tiers. Hunter runs on a free quota (25/mo) that does not extend capacity in any meaningful way, so the spec treats Hunter as removed for capacity-planning purposes. Whether the Hunter call stays in the code as a quiet dead path or gets cleaned up is a code concern, not a spec concern.

Cost cascade implication: only the Apollo tier consumes the 1200/mo paid quota. Pattern fallback is free but produces guessed-not-verified emails; the UI labels them accordingly so the user can decide whether to use them.

The ContactRecord schema gains a `confidence: 'verified' | 'pattern'` field. Verified emails render normally with a Copy button. Pattern emails render the same address with explicit warning copy ("We guessed this. Verify first.") plus the Copy button. The user gets the email either way; we just don't pretend a guess is a find.

### Firebase Auth shared with the web app

Same Firebase project, same Firestore user document, same uid. Extension uses `chrome.identity.getAuthToken({ interactive: true })` to obtain a Google access token, exchanges it server-side for a Firebase id token, persists session in `rr_user_session`. Refresh logic lives in the SW so the panel never blocks on auth.

A user signed into ReplyRate on the web sees their unlock count and subscription status carry over to the extension automatically. No re-onboarding.

### 7-day contact cache with stale-while-revalidate

Cache key: `rr_contacts_<jobId>` with `{ fetchedAt, contacts }`. On Contacts tab open:

1. Read cache. If present and fresh (< 7 days), render immediately.
2. If present and stale (>= 7 days), render stale data immediately AND kick off background Apollo refetch.
3. If absent, render loading state, fetch, cache, render.
4. If Apollo call fails and cache is present (even stale), serve cache and surface a small "Last refreshed N days ago" hint.

People change roles slowly. 7 days is a reasonable freshness window; instant UX on revisit beats fresh-but-slow.

### Free tier 5 lifetime unlocks, paid tiers unlimited (closed-beta policy)

5 lifetime unlocks lets a user feel the product on 1-2 jobs without paying. Beyond that, paid tiers (Starter £29/mo, Pro £79/mo) get unlimited contact reveals — Apollo per-credit cost is absorbed by us at closed-beta scale.

Implementation: `api/stripe-webhook.js` writes `unlocksLimit: -1` for paid tiers as a sentinel meaning "unlimited"; `api/contact-unlock.js`'s cap check short-circuits for any `subscriptionStatus !== 'free'` (the limit value isn't gating-relevant for paid users, only for free); extension `EntitlementsBar` reads the -1 sentinel and renders "{used} unlocks" without a denominator.

Free tier (`unlocksLimit: 5`) is still enforced server-side. A free user clearing `chrome.storage.local` does NOT reset their counter — the DB is authoritative.

**This policy may change at public launch** based on observed usage patterns. Future task: add a soft monthly safety rail (alerting only, no hard block) at ~500/month per paid user once user count grows enough that outlier monitoring is meaningful. The Apollo Basic plan provides 2,500 credits/month; a single power user >500/month would be worth investigating, but the response would be a conversation rather than a hard cap.

Stripe checkout reuses the existing replyrate.ai checkout flow. Post-purchase, the extension polls `/api/user/entitlements` once on next Contacts render to refresh the local `rr_user_session.subscriptionStatus`.

## Data the UI reads

Source: `chrome.storage.local`, plus the new auth and unlock keys.

JobLead fields used: id, title, company, location, sourceUrl, stage. ContactsTab subscribes to `state.selectedJobId` and fetches the JobLead from `jobsByKey` to pass `{ title, company, location }` to the Apollo search.

ContactRecord schema:

- `id`: string. Apollo person id.
- `name`: string. Display name.
- `role`: 'hr_ta' | 'hiring_manager' | 'director'. **Computed client-side from `contact.title` string** (no backend role field). Lookup table in extension code, ~30 lines: title matches `/recruiter|talent|hr/i` → `hr_ta`; `/manager|lead/i` → `hiring_manager`; `/director|vp|head of/i` → `director`. Backend's `mixed_people/api_search` already returns titles so this is pure string matching. Bucketing is best-effort; contacts whose title doesn't match any bucket are still rendered with their raw `title` and a generic role badge.
- `title`: string. Their actual job title (e.g., "Senior Talent Partner").
- `companyName`: string.
- `location`: string or null. Nullable.
- `linkedinUrl`: string or null. Apollo sometimes returns wrong or missing URLs; null is a real value.
- `relevanceScore`: number 0-100. **Computed client-side**, not emitted by the backend. Uses `contact.title` matched against `rr_user_profile.roleTargets` if present, else flat 50 for all candidates. Used for sort order; not displayed in v1 UI (see Known constraints). Until `rr_user_profile` exists (Wave 2 task 2), all scores are 50 and sort order falls through to backend default ordering.
- `email`: string or null. Null until unlocked.
- `emailUnlockedAt`: number or null. Set on unlock.
- `confidence`: 'verified' | 'pattern'. Reflects which tier of the email waterfall produced the value. UI renders verified emails normally; pattern emails render the same address with a "We guessed this. Verify first." caveat next to the Copy button.

At most one contact per role bucket appears in the response. If Apollo returns multiple candidates per bucket, the backend's relevance pass picks the top one and excludes the rest. Result: 0-3 ContactRecord entries per JobLead. Zero entries triggers the no_results state.

Fields the UI ignores in this task: ContactRoute.routeType, confidence, provenance, verifiedBadge, notes from the briefing's data model. Reserved for Wave 2 tasks 2-3 and Wave 3.

## Tab layout

Two stacked sections inside the Contacts tab.

### Section A: Job header (top)

A compact header showing the selected JobLead: source badge, title, company, location. Same visual treatment as the Tracker JobRow, but full-width and non-interactive. Acts as the "you are here" anchor when the user has multiple Tracker entries.

A "Back to Tracker" link in the top-right switches the active tab to Tracker. state.selectedJobId is left set so a subsequent return to the Contacts tab restores the same contacts list immediately (no re-fetch unless the cache is stale).

### Section B: Contact list

One to three ContactCard components, sorted by relevanceScore descending. One card per populated role bucket, max. Each card:

- Source bar (left): role-bucket badge ("Hiring Manager" / "HR / TA" / "Director") in a per-role accent color.
- Name + title: bold name, smaller muted title underneath.
- Location: location dot + city if present.
- LinkedIn link: small "Open in LinkedIn" button. Opens linkedinUrl in new tab. Disabled if linkedinUrl is null.
- Email row: locked state shows "Unlock email" button. Unlocked state shows the email plus a Copy button (clipboard write). When `confidence === 'pattern'`, the unlocked row also shows a small warning beneath the address: "We guessed this. Verify first." The Copy button still works; the user is making an informed choice.

If `linkedinUrl` is null, the LinkedIn button is disabled with a tooltip explaining the source. Don't hide the button (consistency).

### States

| State | Trigger | Render |
|---|---|---|
| no_selection | state.selectedJobId is null OR points to a deleted job | ContactsEmptyState kind='no_selection' |
| unauthenticated | rr_user_session missing or expired and not refreshable | AuthGate |
| loading | Job selected, auth ok, Apollo fetch in flight (no cache or refreshing stale) | Skeleton: 3 placeholder cards |
| list | Job selected, contacts loaded (fresh or stale) | Job header + ContactCard list |
| no_results | Apollo returned 0 contacts | ContactsEmptyState kind='no_results' |
| error | Apollo failed AND no cached fallback | Inline error + Retry |
| paywall | User has 0 unlocks remaining and clicks Unlock | UnlockPaywall mounted above the contact list |

## Module shape contract additions

Following the existing module shape contract (see `docs/architecture.md` section 2):

- `ContactsTab(parent, state) -> unmount`. Active content for the Contacts tab. Owns selectedJobId subscription, contact-fetch lifecycle, paywall state, and the per-card unlock flow.
- `ContactCard(parent, contact, options) -> { unmount, setUnlocked }`. One contact tile.
  - `options.onUnlock`: `() => Promise<{ ok: boolean, email?, error? }>`. Called when the Unlock button fires.
  - `setUnlocked(email)`: external override of the email field, used after a successful unlock OR when restoring from cache where the email was previously unlocked.
- `UnlockPaywall(parent, options) -> { unmount }`. Inline gate when free tier is exhausted and no subscription.
  - `options.onUpgrade`: `() => void`. Opens Stripe checkout in a new tab.
  - `options.onDismiss`: `() => void`. Hides the paywall but does not unlock; user can still browse the locked card list.
- `ContactsEmptyState(parent, kind) -> unmount`. Wraps the existing EmptyState helper.
  - `kind='no_selection'`: heading "No job selected", body "Pick a job from Tracker to see contacts."
  - `kind='no_results'`: heading "No contacts found", body "We couldn't find anyone at this company yet. Try saving a different role."
- `AuthGate(parent, options) -> { unmount }`. Renders before any Contacts content if user is not signed in.
  - `options.onSignedIn`: `(session) => void`. Fires after a successful sign-in roundtrip.

## Storage schema additions

Following the rr_-prefix-for-sync-readiness convention (see `docs/architecture.md` section 4):

- `rr_contacts_<jobId>`: `{ fetchedAt: number, contacts: ContactRecord[] }`. Per-job cache. ContactRecord shape detailed above. fetchedAt is Date.now() at the response.
- `rr_user_unlocks`: `{ count: number, unlockedContactIds: string[] }`. Tracks free-tier consumption client-side. Backend authoritative copy lives in Firestore. Server returns 'paywall' when count >= 5 and no subscription, regardless of what the client thinks.
- `rr_user_session`: `{ uid, email, displayName, idToken, idTokenExpiresAt, refreshToken? }`. Firebase Auth session for the extension. Refreshed by SW background loop when idTokenExpiresAt is within 5 minutes.

## Message contract additions

Following the dispatch table pattern (see `docs/architecture.md` section 3, and the contract block at the top of background.js):

1. `rr_apollo_search`. Direction: panel -> bg. Payload: `{ type, jobLead: { title, company, location } }`. Background calls `/api/apollo-search` with Firebase id token, returns `{ ok: true, contacts: ContactRecord[] }` or `{ ok: false, error: string }`. responseStyle: async. Sender constraint: panel only (no requiresTabSender; sender.tab is null for panel-origin messages and that's fine).

2. `rr_contact_unlock`. Direction: panel -> bg. Payload: `{ type, contactId, jobId }`. Background calls `/api/contact-unlock`, returns `{ ok: true, email }` or `{ ok: false, error: 'paywall' | 'auth' | 'apollo_failed' | 'network' }`. responseStyle: async.

3. `rr_auth_signin`. Direction: panel -> bg. Payload: `{ type }`. Background runs `chrome.identity.getAuthToken({ interactive: true })`, exchanges with Firebase, returns `{ ok: true, uid, email, displayName }` or `{ ok: false, error }`. responseStyle: async.

4. `rr_auth_signout`. Direction: panel -> bg. Payload: `{ type }`. Background revokes the token, clears `rr_user_session`, returns `{ ok: true }`. responseStyle: async.

All four require a tab sender? No: panel-origin messages have no sender.tab. Set `requiresTabSender: false` in the dispatch table. None of the new types accept content-script senders.

## Backend (Vercel) endpoints required

Out of scope for this commit to implement. Flag the contracts so the build commit knows what to expect:

- **REFACTORED `POST /api/apollo-search`** (DONE, commit `d74ec1d`). Body unchanged: `{ company, position, level?, location?, jd_text? }`. Auth gate applied (commit `ef81abf`). Email field stripped from per-contact response; email reveal moved to `/api/contact-unlock`. Hunter.io overlay removed entirely (Hunter endpoint retained at `/api/hunter-search` for any future use, just not called from apollo-search). Per-contact `confidence: 'verified' | 'pattern'` added — `verified` means Apollo has a deliverable email on file (returned by `/api/contact-unlock`), `pattern` means Apollo has the person but no email (`/api/contact-unlock` will construct `firstname.lastname@<domain>` as a guess). Per-contact `id` field added (Apollo person id, required by `/api/contact-unlock` as `contactId` parameter). Role bucketing is **client-side**, not backend (see line 115). Backend still emits up to 3 verified-tier + 2 pattern-tier contacts (no role-bucket cap); extension applies the cap when rendering.
- **CREATE `POST /api/contact-unlock`** (greenfield). Body: `{ contactId, jobId }`. Auth header required. Backend verifies the user has remaining unlocks (Firestore lookup), if yes returns the previously-enriched email (or refetches via Apollo `people/match` if the search ran pre-auth), decrements the unlock count atomically, returns `{ ok: true, email }`; if no, returns `{ ok: false, error: 'paywall' }`.
- **CREATE `GET /api/user/entitlements`** (greenfield). Auth header required. Returns `{ unlocksUsed, unlocksLimit, subscriptionStatus, subscriptionExpiresAt }`. Polled by panel after Stripe checkout completes.
- **DONE: shared Firebase Admin auth middleware** (`api/_lib/verifyAuth.js`, commit `073a3ba`; applied to all 7 internal endpoints in commit `ef81abf`). Verifies the Firebase id token from the `Authorization` header, attaches `uid` to the request, returns 401 on invalid or expired token. Rate limiting: per-endpoint, currently only on `/api/tts` (30/hour, 10/minute, in-memory closed-beta provisional, commit `f4e20af`). Middleware-wide rate limit deferred to public-launch readiness; the Vercel-KV-or-Upstash migration path is documented in the `api/tts.js` comment block.

**Note on `email_required` error code**: Both `/api/user/entitlements` and `/api/contact-unlock` can return `400 { ok: false, error: 'email_required' }` (commit `745d397`). This fires when `ensureUser` detects a phone-only Firebase identity (no `email` field on the verified token). The extension flow uses `chrome.identity.getAuthToken` which always provides Google accounts with email, so `email_required` shouldn't fire via the extension's normal flow. If it does, treat as a configuration error and prompt the user to sign out and sign back in via the standard Google flow.

## Acceptance checklist before shipping

### A. ContactsTab state machine

- [ ] Renders no_selection state when state.selectedJobId is null
- [ ] Renders unauthenticated state when no rr_user_session
- [ ] Renders loading skeleton during Apollo fetch (no cache)
- [ ] Renders list state on Apollo success
- [ ] Renders no_results state when Apollo returns 0 contacts
- [ ] Renders error state with Retry on Apollo failure with no cache
- [ ] Stale cache: renders list immediately, refreshes in background
- [ ] Background refresh failure: keeps stale list, shows "Last refreshed N days ago" hint
- [ ] Switching to a different job (different selectedJobId) tears down the previous fetch

### B. ContactCard rendering

- [ ] Always shows: name, title, role bucket badge, location (if present), LinkedIn button
- [ ] Email locked: shows "Unlock email" button, no email text
- [ ] Email unlocked, confidence='verified': shows email text, "Copy email" button, no caveat, no Unlock button
- [ ] Email unlocked, confidence='pattern': shows email text, "We guessed this. Verify first." caveat, "Copy email" button, no Unlock button
- [ ] linkedinUrl null: LinkedIn button disabled with tooltip
- [ ] location null: location row hidden, no empty space
- [ ] Copy button writes email to clipboard, shows brief "Copied" confirmation

### C. Unlock flow

- [ ] First unlock from fresh user: succeeds, decrements count to 4, email reveals
- [ ] At free limit (count = 5): clicking Unlock surfaces UnlockPaywall above the list
- [ ] Paywall Upgrade button opens Stripe checkout in new tab
- [ ] After successful Stripe payment, panel polls /api/user/entitlements once on next render
- [ ] Subscription active: Unlock button works regardless of count
- [ ] Server returns 'paywall' but client thought count < 5: paywall renders anyway (server authoritative)
- [ ] Network failure on unlock: inline error pill on the card, count not decremented client-side
- [ ] Same contact re-unlock attempt: uses cached email, no new Apollo call

### D. Apollo integration

- [ ] Loading state: 3 skeleton cards visible during fetch
- [ ] Apollo 200 response with N contacts (1 to 3, one per bucket): list renders all N
- [ ] Apollo 200 with 0 contacts: no_results state
- [ ] Apollo 500: error state with Retry button
- [ ] Apollo timeout (>10s): error state, request cancelled
- [ ] Race: search A in flight, user switches to job B; A's response is discarded

### E. Cache behavior

- [ ] Cache hit (fresh, < 7 days): list renders without Apollo call
- [ ] Cache miss: Apollo called, response cached
- [ ] Cache write includes fetchedAt = Date.now() and full ContactRecord array
- [ ] Stale cache (>= 7 days): list renders from cache, Apollo refetch fires
- [ ] Stale cache + Apollo refetch fails: cache stays, "Last refreshed" hint shows
- [ ] Cache rolloff at exactly 7 days: still considered fresh at 6d23h59m, stale at 7d0h0m
- [ ] Manual cache invalidation: chrome.storage.local.remove('rr_contacts_<id>') triggers re-fetch on next view

### F. Auth flow

- [ ] Signed out, opens Contacts: AuthGate renders
- [ ] Click Sign in: chrome.identity.getAuthToken interactive prompt
- [ ] Successful sign-in: rr_user_session written, AuthGate unmounts, Contacts content renders
- [ ] Sign-in failure (user cancelled prompt): AuthGate stays, no error shown
- [ ] Sign-in failure (network): AuthGate stays, error pill shown
- [ ] Token expires mid-session: SW refreshes silently, panel never sees the gap
- [ ] Refresh fails: panel falls through to AuthGate on next message
- [ ] Sign-out: rr_user_session cleared, all rr_contacts_* caches preserved (re-sign-in restores access)
- [ ] Server-side token revocation: next Apollo or unlock call fails with 'auth', panel surfaces re-login prompt

### G. Paywall flow

- [ ] UnlockPaywall renders only when count >= 5 AND no active subscription
- [ ] Paywall body shows current count: "You've used 5 of 5 free unlocks"
- [ ] Upgrade button opens Stripe checkout in new tab via chrome.tabs.create
- [ ] Stripe checkout URL includes uid as client_reference_id
- [ ] Panel polls entitlements on next Contacts render after returning from Stripe tab
- [ ] User dismisses paywall: hidden until next unlock attempt; cards still rendered

### H. Storage schema

- [ ] rr_contacts_<jobId> written on Apollo success with shape { fetchedAt, contacts }
- [ ] rr_contacts_<jobId> read on Contacts tab open
- [ ] rr_user_unlocks { count, unlockedContactIds } updated on each successful unlock
- [ ] rr_user_session { uid, email, idToken, idTokenExpiresAt } written on sign-in
- [ ] rr_user_session cleared on sign-out
- [ ] All keys carry the rr_ prefix per sync-readiness convention

### I. Message contract

- [ ] rr_apollo_search round-trip: panel sends, SW calls /api/apollo-search, response matches ContactRecord shape
- [ ] rr_contact_unlock round-trip: under-limit success path returns { ok, email }
- [ ] rr_contact_unlock at-limit path returns { ok: false, error: 'paywall' }
- [ ] rr_auth_signin success path returns { ok, uid, email, displayName }
- [ ] rr_auth_signout always returns { ok: true } even if already signed out
- [ ] All four types appear in MESSAGE_HANDLERS with correct responseStyle

### J. Cross-tab integration

- [ ] Click Tracker row sets state.selectedJobId AND switches active tab to Contacts
- [ ] Switching to Contacts tab without prior selection shows no_selection
- [ ] Selecting a job, switching to Insights, switching back to Contacts: same job still selected
- [ ] Click "Back to Tracker" link: switches tab, leaves selectedJobId set; clicking Contacts tab restores the same list
- [ ] Deleting the selected job from Tracker: Contacts switches to no_selection on next open
- [ ] Selecting a different Tracker row while Contacts is open: Contacts re-fetches for the new job
- [ ] state.selectedJobId persists across panel close/reopen (stored under rr_panel_selected_job)

### K. Regressions

- [ ] Tracker tab still loads, filters, and renders rows
- [ ] LinkedIn toolbar capture still writes JobLead via SW
- [ ] Lever/Indeed floating button still saves jobs
- [ ] Optimistic stage change still works in Tracker
- [ ] Delete + Undo still works in Tracker
- [ ] No new console errors on Tracker tab boot
- [ ] No new console errors on Insights/Overview/Messages tabs
- [ ] Existing rr_panel_active_tab persistence unaffected
- [ ] Test harness (tests/index.html) still passes for Wave 1 modules

## Launch-day verification (not part of build acceptance)

Checks that require a real Stripe + Vercel + Firestore roundtrip. Run once during launch readiness; not part of every regression round:

- [ ] After successful Stripe webhook fires server-side, /api/user/entitlements reflects subscriptionStatus='active'
- [ ] Stripe webhook -> Firestore subscription write -> next entitlements poll surfaces the change in the panel within 30s
- [ ] Apollo Basic plan rate-limit headers are surfaced on /api/apollo-search responses for monitoring

These belong in the Vercel deploy notes, not the per-commit acceptance checklist.

## Dependencies and prerequisites

Before this can ship cleanly:

- Wave 1 task 9 verified end-to-end in browser. Tracker row click must reliably set state.selectedJobId and switch tabs.
- Vercel functions for `/api/apollo-search`, `/api/contact-unlock`, `/api/user/entitlements` deployed and live. Auth middleware reused from `/api/claude`.
- Firebase project configured with Google sign-in provider enabled. The Google OAuth client_id added to manifest.json's `oauth2.client_id` field (this requires a separate manifest update; chrome.identity needs the client_id at install time).
- Stripe checkout flow on replyrate.ai web app already exists; reuse the same product price id for the extension.
- User profile (rr_user_profile) is read-only here. Wave 2 task 2 builds the profile editor; relevanceScore falls back to flat-50 until then.

This task does NOT depend on Wave 2 tasks 2-4 to ship. Contacts works standalone without the Generate flow.

## Known constraints and risks

- **Apollo rate limits**: Basic plan ($49/mo annual) caps at 1200 email reveals per month and 60 search queries per minute. At 5 lifetime free unlocks per user, 240 free users per month exhaust the cap. The pattern-fallback tier produces guessed-not-verified emails and does not meaningfully extend capacity (the user can copy the guess but it may not deliver). Closed beta cap (target 100 users) keeps total verified-tier consumption well under the cap; public launch is the binding decision. Mitigations: (a) stricter free tier (3 lifetime), (b) Apollo Pro plan upgrade, or (c) bring-your-own-key for paid users. Decide before public launch; not a launch blocker for closed beta.

- **Closed beta cap**: invitation-only, target 100 users total during beta. At 5 lifetime free unlocks per user, beta total stays under Apollo Basic's 1200/mo cap. Public launch decision deferred until first 30 days of beta data.

- **Unlimited-unlocks pricing risk**: $29/mo unlimited at Apollo's $0.04/reveal cost breaks even around 725 reveals/mo. Power users could exceed 1000 reveals/mo and put us upside down on cost. Two mitigations available without changing the price: soft cap at 500/mo with rate-limit messaging beyond, or split Starter ($29/mo, 200 reveals) and Pro ($49/mo, 1000). Defer the call to first 30 days of revenue data.

- **Free tier enforcement**: 5 lifetime unlocks must be enforced server-side (Firestore atomic decrement on unlock), not client-side (rr_user_unlocks). A user clearing chrome.storage.local must NOT reset their counter. The client-side counter is a UI hint only; server returns 'paywall' regardless.

- **Firebase id token expires after 1 hour**. Refresh logic lives in background.js. SW wakes on alarm or storage event, checks idTokenExpiresAt, refreshes when within 5-minute window. Panel never blocks on auth; if SW hasn't refreshed yet when a panel message fires, the message gets a stale-token error and the panel reissues after a refresh roundtrip.

- **Relevance score depends on rr_user_profile**: which doesn't exist yet (Wave 2 task 2). Until task 2 ships, all relevanceScores fall back to flat 50, so the field is computed but not displayed in v1. Cards still sort by relevanceScore descending so when scoring becomes real, ordering updates without a render change. Reintroduce the visual bar (and the deferred opacity-plus-badge low-relevance treatment for scores < 30) when adding the profile editor.

- **LinkedIn URL accuracy**: Apollo's LinkedIn URLs are sometimes wrong, sometimes outdated, sometimes null. Don't auto-redirect or auto-fetch from LinkedIn (TOS prohibits scraping). When linkedinUrl is null or 404s, show the disabled button with a tooltip; the user can manually search.

- **OAuth manifest config**: `chrome.identity.getAuthToken` requires `"oauth2": { "client_id": "...", "scopes": [...] }` in manifest.json. Adds an installation-time client_id; users see a Google sign-in consent screen on first sign-in. Manifest update is part of this task's first commit.

- **CORS for chrome-extension origin**: `api/_lib/cors.js` reads the `ALLOWED_EXTENSION_ORIGIN` env var and sets `Access-Control-Allow-Origin` accordingly; falls back to `*` with a console.warn when unset. **Currently unset** (production traffic still gets the wildcard). Must be set to `chrome-extension://<id>` in Vercel project settings before Chrome Web Store submission. Stripe webhooks are unaffected (separate endpoint, not under `/api/_lib/cors.js`).

- **Stripe checkout return**: the extension cannot listen for Stripe's redirect (no web tab to land on). User completes purchase in the new Stripe tab; panel polls `/api/user/entitlements` on next render. There may be a 1-2 second window where the user has paid but the panel still shows the paywall. Acceptable; no spec change needed.

## Pre-build cleanup

All three pre-build cleanup items are DONE in the `replyrate` web app repo:

- **DONE: Auth check on `/api/claude`** (commit `073a3ba`). Firebase id token verification gates the endpoint; ANTHROPIC_API_KEY budget no longer drainable by anonymous callers. Wave 2 (commit `ef81abf`) extended the same gate to all 6 other internal endpoints.
- **DONE: `/api/apollo-debug` removed** (commit `8b61afd`). The debug helper that leaked the first 12 chars of `APOLLO_API_KEY` was deleted entirely rather than gated.
- **DONE: `/api/claude` CORS bug fixed** (commit `ef81abf`). The `api/_lib/cors.js` helper applies CORS headers on every response, not just OPTIONS. All 7 internal endpoints route through it.

No further pre-build cleanup needed. Wave 2 task 1 build can proceed directly against the deployed backend.

## Things this spec does NOT decide

- Exact CSS variable names for role-bucket badge colors (HR/TA, Hiring Manager, Director).
- Whether ContactCard is a custom widget or built on existing JobRow primitives. (Suggest custom; the affordance differs enough.)
- Skeleton card visual: 3 placeholders matching the real card's dimensions.
- Whether `state.selectedJobId` lives in the existing AppState (the same shared state the Tabs module subscribes to) or a new ContactsState. Suggest the existing AppState; cross-tab integration is the whole point.
- The exact poll cadence for `/api/user/entitlements`: once on Contacts open, plus once after Stripe-tab return. No background polling; respects rate limits.
- Whether unlocked emails appear visually different from never-locked (some products show a small "Unlocked" badge). Suggest no badge; clean is better than busy.
- Free unlock counter behavior on subscription cancel: does it stay at the value it was when subscribed, reset to 0, or reset to 5 minus prior usage. Deferred to Wave 2 post-launch policy decision.

Claude Code makes these calls and flags decisions when proposing the diff.

## Note on revenue and validation

Contacts is the first paid surface. Two implications:

- This is the first commit where shipping the wrong default costs revenue. Pricing, free tier, and paywall copy are revenue-load-bearing.
- This is also the first commit where the back-of-envelope unit economics matter. The "Known constraints" Apollo math should be revisited with real usage data 30 days post-launch. If the numbers don't work, reconsider: stricter free tier, Pro tier, or BYO Apollo key for power users.

Ship the slice that's true. Adjust pricing on data, not vibes.
