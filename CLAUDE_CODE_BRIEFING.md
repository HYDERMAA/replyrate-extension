# ReplyRate Extension Rebuild: Claude Code Briefing

## Context

Working directory: `C:\Users\anash\replyrate-extension`
Repo: HYDERMAA/replyrate-extension
Run command: `claude --model claude-opus-4-6 --dangerously-skip-permissions`
Stack: Manifest V3, vanilla JS, Vercel functions backend (`/api/claude`, `/api/tts`)
Sister repo: HYDERMAA/replyrate (the web app at replyrate.ai)

## Strategic decisions (locked, do not re-litigate)

1. **Side panel is the primary UI surface.** Migrating from on-page floating button to `chrome.sidePanel`. The toolbar icon opens the panel everywhere including LinkedIn.
2. **Extension owns the full workflow.** Capture, tracker, contact unlock, draft generation, Gmail handoff, follow-ups all live in the side panel. The web app is a separate surface for now.
3. **chrome.storage.local only for v1.** No Firebase in the extension. Schema must be designed sync-ready so a future backend sync layer is a transport swap, not a rewrite.
4. **LinkedIn is toolbar-action capture only.** No DOM injection on linkedin.com whatsoever. The existing floating button on LinkedIn must be removed in Wave 0. This is non-negotiable per LinkedIn TOS.
5. **Apollo reuse.** Contact unlock calls Apollo via the paid Basic plan key, reusing the targeting logic from the web app's Job Hunter tab.

## Data model (chrome.storage.local schema)

Design every key sync-ready. Use `rr_<entity>_<id>` keying so a future backend sync writes the same shapes.

```
UserProfile     { id, name, roleTargets, locations, cvSummary, voiceSettings, permissionFlags }
JobLead         { id, title, company, location, sourceType, sourceUrl, salaryText, descriptionHash, fitBand, stage, createdAt, lastActionAt, nextActionAt }
ContactRoute    { id, jobId, name, role, email, linkedinUrl, routeType, confidence, provenance, verifiedBadge, notes }
MessageDraft    { id, jobId, contactId, subject, body, version, tone, status, createdAt }
SequenceTask    { id, jobId, contactId, type, dueAt, completedAt, snoozeCount }
EventLog        { id, userId, entityType, entityId, action, metadata, timestamp }
IntegrationGrant{ id, provider, scopes, grantedAt, revokedAt, status }
```

`routeType` enum: recruiter | hiring_manager | careers_inbox | referral | manual
`stage` enum: saved | applied | replied | interviewing | offer | rejected
`confidence` enum: high | low | none

## Build sequence

### Wave 0: Foundation rebuild

1. Skip Firebase in extension. Design `chrome.storage.local` schema for all 7 models above.
2. Manifest V3 rewrite:
   - Add `sidePanel`, `storage`, `identity` permissions
   - Switch host permissions to `optional_host_permissions` for ATS domains (Lever, Greenhouse, Workday, Indeed)
   - Remove `<all_urls>` if present
3. Service worker scaffold (orchestration, auth, message routing). Replace existing background.js.
4. Side panel HTML/JS shell. Use `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` so the toolbar icon opens the panel.
5. Message passing: content script → service worker → side panel via `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`.
6. Restructure content script: lazy-loaded, supported domains only (Lever, Greenhouse, Workday, Indeed, company sites).
7. **Remove on-page UI injection from LinkedIn entirely.** LinkedIn capture is toolbar-icon-click only. The click reads tab URL and title, saves to storage, opens the side panel.
8. Migrate existing save flow to write the new schema. Add descriptionHash and canonical URL dedupe on save.

### Wave 1: Side panel core (tracker workflow)

9. `SidePanelShell` component: collapsed | loading | ready | error states. Persists across tab navigation.
10. `TrackerBoard` with stage columns. Filter by stage, company, follow-up due date.
11. `JobSummaryCard` with inline manual edit on every parsed field.
12. Confidence/provenance badges throughout: "Parsed" vs "Quick save only".
13. `PermissionPrompt` component with feature-tied requests in plain English.
14. Permission centre: runtime grant/revoke per domain and per Gmail scope via `chrome.permissions.request` and `chrome.permissions.remove`.
15. Empty states with action prompts ("Start from any job page").
16. Backend endpoints to add to Vercel functions:
    - `POST /api/jobs/capture`
    - `PATCH /api/jobs/:id`
    - `GET /api/jobs`
    - `POST /api/events/log`

### Wave 2: Outreach loop

17. `ContactCard` states: none-found | low-confidence | high-confidence | manual. Confidence badge plus source attribution on every route.
18. Backend `POST /api/contacts/unlock` calling Apollo with the paid Basic plan key. Reuse the targeting logic from the web app's Job Hunter.
19. Route ranking hierarchy: named recruiter/HM on page → company careers alias → team page → manual add. Never invent a person.
20. `DraftComposer` with prompt chips: Shorter | More formal | Use my voice. Default length 80 to 140 words. Ban unverifiable claims.
21. Backend `POST /api/drafts/generate` via existing `/api/claude` route with user profile, job context, and selected route injected into the prompt.
22. Voice settings stored in UserProfile. Version every draft into MessageDraft.
23. Gmail OAuth via `chrome.identity.getAuthToken`. Scope: `gmail.compose` only. No modify or readonly scopes yet.
24. Backend `POST /api/gmail/draft` creates a draft via Gmail API. UI opens the Gmail draft URL; user clicks send in Gmail.
25. SequenceTask model and `ReminderDrawer` component. Business-day cadence (default 5 days). One-click snooze.
26. Reminder suppression when status flips to replied, interviewing, or rejected. Hook off EventLog.
27. Backend `POST /api/tasks/followup` and status reconciliation logic.

### Wave 3: Phase 2 enrichers

28. Greenhouse Job Board API adapter. Replaces DOM scraping on Greenhouse careers pages.
29. Lever postings API adapter. Same pattern for Lever careers pages.
30. Wellfound public-page parser for founder/team-aware outreach context.
31. HubSpot OAuth + contacts/companies/notes sync. `POST /api/integrations/hubspot/sync`. Association-first writes to avoid duplicate object explosion.
32. Sent/reply sync via Gmail History API. Requires `gmail.metadata` scope upgrade. Reconciles sent drafts and replies into EventLog.
33. Template library and voice presets in UserProfile.
34. Ghost-job heuristics: stale dates, broken apply flows, duplication. Warn before draft generation.
35. IntegrationGrant model with revoke flow per integration.

### Wave 4: Compliance, polish, ship

36. WCAG 2.2 AA audit. axe-core in CI. Manual keyboard nav. Focus return after modals. WAI dialog pattern for confirms. Contrast on every badge state.
37. Native HTML controls everywhere possible.
38. Performance: sub-200ms interactions, near-zero CLS, lazy content scripts, on-demand parsing. Long logic in service worker.
39. Privacy policy mapping data categories to features. Each chrome.storage key listed. Each backend endpoint documented.
40. Export and delete controls in side panel settings (UK GDPR).
41. Sync layer planning doc for chrome.storage.local → backend migration.
42. Chrome Web Store listing assets: screenshots, demo video, permission justifications.
43. Real LinkedIn end-to-end test (toolbar-action capture path).
44. Submit to Chrome Web Store.

## Build rules

- No em dashes in any code comments, copy, or docs.
- Vanilla JS only. No React, no build step in the extension itself.
- Every UI string editable in one place (i18n-ready even if not localised yet).
- Every permission request tied to a feature activation, never on install.
- Confidence and provenance must surface on every parsed or generated artefact.
- Generated copy is always editable before any send.
- No auto-send, ever. User clicks send inside Gmail.
- Schema keys prefixed `rr_` for sync-readiness.
- Use `chrome.storage.local` for state, not localStorage.
- Service worker holds no long-lived state; rehydrate from storage on every wake.

## Start here

Wave 0 task 2: manifest rewrite. Then task 4: side panel shell. Then task 7: strip LinkedIn DOM injection.

Run `git status` first to confirm a clean tree before starting Wave 0.
