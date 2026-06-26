# Phase 3 — Citizen Report UI

## What to read before starting
- AppFlow FLOW 1A, FLOW 1A-i, FLOW 1A-ii, FLOW 1A-iii, FLOW 1A-iv, FLOW 1A-v — read entirely
- AppFlow FLOW 1 (Citizen Home Screen) — read entirely
- AppFlow Edge Cases E1, E2, E3, E4 — read entirely
- PRD F2 (exact citizen-facing messages) — read the "What message the citizen sees" section

## What NOT to build in this phase
- No map screen (Phase 9)
- No profile screen (Phase 9)
- No dispute screen (Phase 4)
- No authority or moderator screens

## Goal
The full citizen report submission flow works end to end on screen.
All 5 CF1 outcome branches render the correct screen with the correct message.

---

## Screens to build (in this order)

### 1. Citizen Home Screen
File: `src/screens/citizen/CitizenHomeScreen.tsx`
Replace the Phase 1 placeholder entirely.
- Bottom navigation bar: Home, Map (placeholder), Report, Profile (placeholder).
- Home tab: activity feed (Firestore real-time listener on reports where citizen_id = current user), "Report a Problem" shortcut button.
- Map tab: render placeholder text "Map — Phase 9" for now.
- Profile tab: render placeholder text "Profile — Phase 9" for now.
- "Report a Problem" button and Report tab both navigate to Report Screen.

### 2. Report Screen
File: `src/screens/citizen/ReportScreen.tsx`
Implement exactly as described in AppFlow FLOW 1A.
- Camera via `expo-camera`. Gallery via `expo-image-picker`.
- GPS via `expo-location`. Auto-detect on screen open. Show address label using reverse geocoding (Google Maps Geocoding API).
- If GPS unavailable: show warning, block Submit button.
- Submit button disabled until photo + location both present.
- On tap Submit: follow the 4-step order from AppFlow FLOW 1A exactly:
  1. Upload photo to Cloud Storage at `reports/{userId}/{reportId}/before.jpg`
  2. On upload success: get download URL
  3. Create Firestore report document
  4. Navigate to Submission Pending Screen
- On upload failure: show error inline, do not create Firestore document.

### 3. Submission Pending Screen
File: `src/screens/citizen/SubmissionPendingScreen.tsx`
Implement exactly as described in AppFlow FLOW 1A-i.
- Spinner + "Analysing your photo…"
- Firestore real-time listener on the report document.
- On status change, navigate to the correct screen:
  - REJECTED → Rejection Screen
  - AWAITING_CLARIFICATION → Clarification Screen
  - APPROVED (clustered) → check if affected_count > 1 → Clustered Confirmation Screen
  - APPROVED (new cluster) → New Report Confirmation Screen
- Timeout after 30 seconds: show message from AppFlow E4. Allow citizen to leave.

### 4. Rejection Screen
File: `src/screens/citizen/RejectionScreen.tsx`
Implement exactly as described in AppFlow FLOW 1A-ii.

### 5. Clarification Screen
File: `src/screens/citizen/ClarificationScreen.tsx`
Implement exactly as described in AppFlow FLOW 1A-iii.
- Show the clarification_question text from the report document.
- Parse the question to extract the answer options (split on " / ").
- Render each option as a tap-able button.
- On tap: update the report document with the citizen's answer, then navigate back to Submission Pending Screen.
- Do not allow a second clarification question. If CF1 returns AWAITING_CLARIFICATION again after the answer, treat it as APPROVED and navigate to the appropriate confirmation screen.

### 6. Clustered Confirmation Screen
File: `src/screens/citizen/ClusteredConfirmationScreen.tsx`
Implement exactly as described in AppFlow FLOW 1A-iv.
- Show the exact message from PRD F2 (N-1 wording).
- "View Report" → Report Detail Screen. "Go Home" → Citizen Home Screen.

### 7. New Report Confirmation Screen
File: `src/screens/citizen/NewReportConfirmationScreen.tsx`
Implement exactly as described in AppFlow FLOW 1A-v.

### 8. Report Detail Screen (Citizen view)
File: `src/screens/citizen/ReportDetailScreen.tsx`
Implement exactly as described in AppFlow FLOW 1F.
- Real-time Firestore listener on the report/cluster document.
- Show before photo, category, severity, location, affected count, days open, status, status history.
- If status = AWAITING_CONFIRMATION and citizen is in affected_citizen_ids: show dispute buttons inline.

---

## Completion check — do not proceed to Phase 4 until all of these pass

- [ ] Submit report → photo uploads to Cloud Storage first → Firestore document created after
- [ ] Upload failure → error shown, no Firestore document created
- [ ] CF1 returns REJECTED → Rejection Screen shown
- [ ] CF1 returns AWAITING_CLARIFICATION → Clarification Screen shown, answer updates document
- [ ] CF1 clusters report → Clustered Confirmation Screen with correct N-1 message
- [ ] CF1 creates new cluster → New Report Confirmation Screen shown
- [ ] GPS unavailable → submit button blocked
- [ ] CF1 takes >30s → timeout message shown, citizen can navigate away
- [ ] Report Detail Screen shows correct status and data from Firestore

---
---

# Phase 4 — Resolution Pipeline: CF3 + CF4 + CF5

## What to read before starting
- TRD Section 4 CF3, CF4, CF5 — read entirely, follow step order exactly
- AppFlow FLOW 1B (citizen dispute screen) — read entirely
- AppFlow FLOW 2B-ii (authority mark resolved) — read entirely
- AppFlow Edge Cases E5, E6 — read entirely
- PRD F5 (exact dispute logic — D≥3, D≥R, D>0, D=0) — follow exactly

## What NOT to build in this phase
- No authority frontend (Phase 7)
- No moderator frontend (Phase 8)
- Test CF3 and CF5 via Admin SDK test scripts

## Goal
The full dispute pipeline works: authority marks resolved → CF3 fires → dispute window opens →
citizens vote → CF4 detects early reopen → CF5 evaluates window close → correct outcome set.

---

## Functions to build

### CF3 — `onAuthorityAction`
File: `functions/src/cf3_onAuthorityAction.ts`
Implement exactly as described in TRD Section 4 CF3.
- Trigger: `report_events/{eventId}` onCreate where event_type = `work_completed`
- Gemini Pro before/after comparison prompt must return JSON: `{ fix_appears_genuine, confidence, reasoning }`
- Opens 48-hour dispute window, sends FCM to all affected citizens.

### CF4 — `onDisputeVote`
File: `functions/src/cf4_onDisputeVote.ts`
Implement exactly as described in TRD Section 4 CF4.

**Critical implementation note — use a Firestore transaction for the duplicate check, not just a path naming convention.**
The document path `dispute_votes/{reportId}_{attempt}_{userId}` is used as the canonical vote ID, but the duplicate check must be done inside a `db.runTransaction()` block. This prevents two near-simultaneous network retries from the same citizen both passing the duplicate check before either write completes.

The transaction must:
1. Read the vote document at path `dispute_votes/{reportId}_{attempt}_{userId}`.
2. If it already exists: abort the transaction silently (not an error — just a no-op).
3. If it does not exist: write the vote document inside the transaction.
4. After the transaction succeeds: outside the transaction, count total No votes (D) for this `(report_id, resolution_attempt)` and check if D >= 3 for immediate reopen.

```typescript
const voteDocPath = `dispute_votes/${reportId}_${attempt}_${citizenId}`;
const voteRef = db.doc(voteDocPath);

await db.runTransaction(async (tx) => {
  const existing = await tx.get(voteRef);
  if (existing.exists) return; // duplicate — no-op
  tx.set(voteRef, {
    report_id: reportId,
    citizen_id: citizenId,
    resolution_attempt: attempt,
    vote: voteValue, // 'yes' or 'no'
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
});

// After transaction: check for immediate reopen (D >= 3)
const noVotes = await db.collection('dispute_votes')
  .where('report_id', '==', reportId)
  .where('resolution_attempt', '==', attempt)
  .where('vote', '==', 'no')
  .get();

if (noVotes.size >= 3) {
  await db.collection('reports').doc(reportId).update({ status: 'REOPENED' });
  // Send FCM to all affected citizens
}
```

### CF5 — `evaluateDisputeWindow`
File: `functions/src/cf5_evaluateDisputeWindow.ts`
Implement exactly as described in TRD Section 4 CF5.
- Runs every 15 minutes via Cloud Scheduler.
- Applies the D/R logic in exact order from PRD F5.
- 15-minute lag is intentional — do not try to eliminate it.

### Dispute Screen (Citizen)
File: `src/screens/citizen/DisputeScreen.tsx`
Implement exactly as described in AppFlow FLOW 1B.
- Triggered by FCM notification tap.
- Shows before + after photo, AI validation result, timer.
- "Yes, fixed" / "No, not fixed" buttons.
- On vote: write to `dispute_votes/{reportId}_{attempt}_{userId}`.
- After vote: navigate to Vote Confirmed Screen.
- Edge case E5: if window already closed, show message, do not record vote.
- Edge case E6: check client-side if citizen already voted before writing.

### Vote Confirmed Screen
File: `src/screens/citizen/VoteConfirmedScreen.tsx`

---

## Completion check — do not proceed to Phase 5 until all of these pass

- [ ] CF3 fires on work_completed event, opens dispute window, FCM sent to all affected citizens
- [ ] Gemini Pro before/after comparison result stored on report document
- [ ] Citizen votes "No" 3 times (3 different users) → CF4 immediately sets status = REOPENED
- [ ] Citizen votes after window closed → E5 message shown, vote not recorded
- [ ] Duplicate vote attempt → E6 message shown, second vote discarded
- [ ] CF5 runs, D=0 → status = RESOLVED
- [ ] CF5 runs, 0<D<3 → status = IN_REVIEW
- [ ] CF5 runs, D≥R and R>0 → status = REOPENED

---
---

# Phase 5 — Escalation Pipeline: CF6 + CF7

## What to read before starting
- TRD Section 4 CF6, CF7 — read entirely
- PRD F4 (SLA matrix table) — use exact values
- TRD Section 12 (Environment Variables) — Gmail service account setup

## What NOT to build in this phase
- No UI changes
- No new screens

## Goal
When a report breaches its SLA, CF6 detects it and CF7 sends a real escalation email
via Gmail API and FCM notification to all affected citizens.

---

## Functions to build

### CF6 — `slaMonitor`
File: `functions/src/cf6_slaMonitor.ts`
Implement exactly as described in TRD Section 4 CF6.
- Runs every 60 minutes via Cloud Scheduler.
- Queries for reports where sla_deadline <= NOW() and escalation_sent = false and status not in [RESOLVED, CLOSED, REJECTED].
- Calls CF7 for each matching report.

### CF7 — `escalationEmailSender`
File: `functions/src/cf7_escalationEmailSender.ts`
Implement exactly as described in TRD Section 4 CF7.
- Gemini Flash generates email subject + body as JSON.
- Send via Gmail API using the service account from environment variables.
- Send FCM to all affected citizens.
- Write to escalation_log collection.

### SLA assignment
When a cluster is created in CF1 (Phase 2), the sla_deadline is currently null.
Update CF1 to set sla_deadline on cluster creation using the SLA matrix from PRD F4:
- Look up severity + trust_category combination → get SLA hours → set sla_deadline = created_at + SLA hours.

---

## Completion check — do not proceed to Phase 6 until all of these pass

- [ ] Report with past sla_deadline and escalation_sent = false → CF6 detects it within 60 minutes
- [ ] CF7 generates email via Gemini Flash (check content is coherent)
- [ ] Email sent via Gmail API (check Gmail sent folder of the service account)
- [ ] escalation_log document created with correct fields
- [ ] FCM notification sent to all affected citizens
- [ ] escalation_sent set to true after email sent (CF6 does not re-escalate the same report)

---
---

# Phase 6 — Priority Scoring + Weekly Health Report: CF2 + CF8

## What to read before starting
- TRD Section 4 CF2, CF8 — read entirely
- PRD F8 (PriorityScore formula and variable table) — use exactly
- PRD F9 (weekly report requirements) — read entirely

## What NOT to build in this phase
- No frontend changes

## Goal
CF2 keeps priority scores current on every cluster update.
CF8 generates a readable weekly City Health Report autonomously every Monday at 08:00.

---

## Functions to build

### CF2 — `onClusterUpdated`
File: `functions/src/cf2_onClusterUpdated.ts`
Implement exactly as described in TRD Section 4 CF2.
- Trigger: clusters/{clusterId} onUpdate.
- Recalculate priority_score using exact formula from PRD F8.
- Update cluster.status based on linked report statuses.

### CF8 — `weeklyHealthReport`
File: `functions/src/cf8_weeklyHealthReport.ts`
Implement exactly as described in TRD Section 4 CF8.
- Cloud Scheduler: every Monday 08:00 UTC.
- Aggregate Firestore data for past 7 days.
- Gemini Flash generates narrative report (max 600 words, readable prose).
- Write to health_reports collection.

---

## Completion check — do not proceed to Phase 7 until all of these pass

- [ ] Update cluster affected_count → CF2 fires, priority_score recalculated correctly
- [ ] All reports in cluster resolved → cluster.status = resolved
- [ ] Trigger CF8 manually (test invocation) → health_reports document created
- [ ] Health report text is readable prose, not a list of numbers
- [ ] health_reports collection is publicly readable (verify with unauthenticated Firestore read)

---
---

# Phase 7 — Authority Frontend

## What to read before starting
- AppFlow FLOW 2, FLOW 2A, FLOW 2B-i, FLOW 2B-i.5, FLOW 2B-ii, FLOW 2C, FLOW 2D — read entirely
- TRD Section 3 (Identity protection rules) — follow exactly
- PRD F8 (PriorityScore — used for dashboard sort order)

## What NOT to build in this phase
- No citizen screens
- No moderator screens

## Goal
Full authority workflow from dashboard to resolution works end to end.
Identity protection rules are enforced — citizen names and UIDs never appear anywhere.

---

## Screens to build (in this order)

### 1. Authority Dashboard Screen
File: `src/screens/authority/AuthorityDashboardScreen.tsx`
Replace Phase 1 placeholder.
- Real-time Firestore query: clusters where status = active, sorted by priority_score descending.
- Each item: category icon, severity badge, affected count, days open, SLA countdown, status.
- No citizen names or UIDs anywhere.
- Filter bar, Metrics tab.

### 2. Issue Detail Screen (Authority view)
File: `src/screens/authority/IssueDetailScreen.tsx`
Implement exactly as described in AppFlow FLOW 2A.
- Status-conditional action buttons per the exact mapping in FLOW 2A.
- APPROVED → "Acknowledge" button
- ASSIGNED → "Start Work" button
- IN_PROGRESS → "Mark Resolved" button
- AWAITING_CONFIRMATION → read-only dispute count only
- REOPENED → "Mark Resolved" button
- RESOLVED → read-only
- ESCALATED → "Mark Resolved" still available

### 3. Mark Resolved Screen
File: `src/screens/authority/MarkResolvedScreen.tsx`
Implement exactly as described in AppFlow FLOW 2B-ii.
- After photo upload to Cloud Storage at `reports/{reportId}/after.jpg`.
- Creates report_event with event_type = work_completed.
- Navigates to Resolution Submitted Screen.

### 4. Resolution Submitted Screen
File: `src/screens/authority/ResolutionSubmittedScreen.tsx`

### 5. Metrics Screen
File: `src/screens/authority/MetricsScreen.tsx`
Implement exactly as described in AppFlow FLOW 2D.
- Aggregate stats for this authority's zone from Firestore.
- Link to Health Report Screen.

---

## Completion check — do not proceed to Phase 8 until all of these pass

- [ ] Authority dashboard shows clusters sorted by priority_score
- [ ] No citizen name or UID appears on any authority screen
- [ ] Acknowledge → status = ASSIGNED, "Start Work" button appears
- [ ] Start Work → status = IN_PROGRESS, "Mark Resolved" button appears
- [ ] Mark Resolved → after photo uploaded, CF3 fires, dispute window opens
- [ ] Dispute count shown as a number only — no individual voter identities
- [ ] RESOLVED status → read-only view with after photo and AI validation result

---
---

# Phase 8 — Moderator Frontend

## What to read before starting
- AppFlow FLOW 3, FLOW 3A, FLOW 3B-i, FLOW 3B-ii, FLOW 3B-iii, FLOW 3C, FLOW 3D — read entirely
- TRD Section 13.3 (Moderator Claim Locking) — implement exactly
- TRD Section 13.4 (PII Flagging) — implement exactly

## What NOT to build in this phase
- No citizen or authority screens

## Goal
Full moderator workflow works. Claim locking prevents two moderators acting on the same case.
All moderator actions are logged to moderator_audits with a reason field.

---

## Screens to build

### 1. Moderator Queue Screen
File: `src/screens/moderator/ModeratorQueueScreen.tsx`
Replace Phase 1 placeholder.
- Real-time query: reports where status = IN_REVIEW, sorted by days open descending.
- On tap: check lock. If locked by another moderator: show message. If not locked: claim and open review.

### 2. Moderator Review Screen
File: `src/screens/moderator/ModeratorReviewScreen.tsx`
Implement exactly as described in AppFlow FLOW 3A.
- Shows lock timer countdown.
- Action buttons vary by reason for review (dispute vs PII vs appeal placeholder).
- Confirm Resolved, Reopen Issue, Request More Info — all require a reason field (minimum 10 characters).
- Redact Photo for PII cases.

### 3. Action Confirmed Screen
File: `src/screens/moderator/ActionConfirmedScreen.tsx`

### Lock expiry handling (FLOW 3D)
Implement exactly as described in AppFlow FLOW 3D.
- Non-dismissible modal when lock expires mid-review.
- Any action attempt after expiry fails gracefully with an error message.
- No partial saves.

---

## Completion check — do not proceed to Phase 9 until all of these pass

- [ ] Queue shows only IN_REVIEW reports
- [ ] Tapping a claimed report shows "being reviewed by another moderator" message
- [ ] Moderator claims report → locked_until set to NOW() + 30 minutes
- [ ] Confirm Resolved → status = RESOLVED, moderator_audits document written
- [ ] Reopen Issue → status = REOPENED, moderator_audits document written
- [ ] Request More Info → status stays IN_REVIEW, note sent to authority via FCM
- [ ] Redact Photo → Cloud Storage photo replaced, pii_handled = true
- [ ] Lock expires mid-review → non-dismissible modal, action discarded if attempted

---
---

# Phase 9 — Maps + Gamification + Profile

## What to read before starting
- AppFlow FLOW 1D (Map Screen) — read entirely
- AppFlow FLOW 1E (Profile Screen) — read entirely
- AppFlow FLOW 4 (Health Report Screen) — read entirely
- AppFlow FLOW 5 (Notification Permission) — read entirely
- TRD Section 7 (Maps Implementation — mobile vs web platform switch) — read entirely
- PRD F6 (Gamification — points and badges) — read entirely

## What NOT to build in this phase
- No backend changes
- No new Cloud Functions

## Goal
Live map renders with issue pins and heatmap.
Profile shows trust score, points, badges, leaderboard.
Notification permission is requested on first launch.

---

## Components to build

### 1. Map Screen
File: `src/screens/citizen/MapScreen.tsx`
Replace the Phase 3 placeholder.
- Use Platform.OS === 'web' to switch between react-native-maps (mobile) and @react-google-maps/api (web).
- Both implementations must accept the same props interface.
- Pins: color by severity (red/amber/green), size by affected_count.
- Heatmap layer: weighted by priority_score, toggle button.
- Filter bar: category, status, severity — implemented as Firestore where queries.
- Tap pin → bottom sheet with cluster summary and "View Full Report" button.

### 2. Profile Screen
File: `src/screens/citizen/ProfileScreen.tsx`
Replace the Phase 3 placeholder.
- Trust score display: numerical value + category label (HighTrust / MediumTrust / LowTrust / Untrusted).
- Total points and badge list.
- Zone leaderboard: citizen's rank + top 5 in zone.
- Notification preferences toggle (weekly health report opt-in).
- Sign Out button.

### 3. Health Report Screen
File: `src/screens/shared/HealthReportScreen.tsx`
Implement exactly as described in AppFlow FLOW 4.
- Publicly accessible — no auth required.
- Read from health_reports collection, most recent first.
- "View Previous Reports" link.

### 4. Notification Permission Screen
File: `src/screens/citizen/NotificationPermissionScreen.tsx`
Implement exactly as described in AppFlow FLOW 5.
- Shown once after first account creation.
- On grant: store FCM token in users/{userId}.fcm_token.
- On deny or "Maybe Later": proceed to Citizen Home Screen. App works without notifications.

### 5. Points and badges logic
Points are stored on the users/{userId} document under total_points.

**Canonical point values — use these exact numbers, do not invent alternatives:**

| Event | Points |
|---|---|
| New report accepted (citizen creates a new cluster) | +10 |
| Citizen added to existing cluster | +5 |
| Citizen votes on a dispute (yes or no) | +2 |

Update points in Cloud Functions when these events occur:
- CF1: report accepted, new cluster created → +10 points to citizen
- CF1: citizen added to existing cluster → +5 points to citizen
- CF4/CF5: citizen voted on dispute → +2 points to citizen

These values are authoritative. The PRD F6 did not specify amounts — these are the pinned values for this implementation. Do not use any other values.

---

## Completion check — do not proceed to Phase 10 until all of these pass

- [ ] Map renders on both mobile and web with correct provider
- [ ] Pins are color-coded by severity and sized by affected_count
- [ ] Heatmap layer toggles on and off
- [ ] Filter by category/status/severity updates pins correctly
- [ ] Bottom sheet appears on pin tap, "View Full Report" navigates correctly
- [ ] Profile shows correct trust score, points, and badges
- [ ] Leaderboard shows top 5 in zone
- [ ] Health Report Screen accessible without login
- [ ] Notification permission screen shown once on first launch
- [ ] FCM token stored in Firestore after permission granted

---
---

# Phase 10 — Polish + Deploy

## What to read before starting
- TRD Section 9 (Firestore Security Rules) — paste in exactly
- TRD Section 10 (Cloud Storage Security Rules) — paste in exactly
- TRD Section 12 (Environment Variables) — verify all are set
- AppFlow Part 6 (Edge Cases E1–E7) — verify all are handled

## What NOT to build in this phase
- No new features
- No new screens
- No new Cloud Functions

## Goal
App is deployed on Firebase Hosting with a public URL.
All security rules are live. No API keys are in client code. All edge cases are handled.

---

## Steps

### 1. Apply Firestore security rules
Copy the rules from TRD Section 9 exactly into the Firebase Console → Firestore → Rules.
Do not modify the rules. Deploy them.

### 2. Apply Cloud Storage security rules
Copy the rules from TRD Section 10 exactly into the Firebase Console → Storage → Rules.
Deploy them.

### 3. Verify environment variables
Check that every variable in TRD Section 12 is set in Firebase Cloud Functions config.
Run `firebase functions:config:get` and verify all keys are present.
Verify no environment variable value appears hardcoded in any source file.

### 4. Verify edge cases
Walk through AppFlow Edge Cases E1–E7 manually:
- E1: turn off network → offline banner appears, submission blocked
- E2: disable location → submit button blocked, correct message shown
- E3: simulate upload failure → error shown, no Firestore document created
- E4: simulate CF1 slow response → timeout message shown after 30s, citizen can navigate away
- E5: vote after window closed → message shown, vote not recorded
- E6: vote twice → second attempt blocked client-side
- E7: authority attempts to access citizen identity → permission error shown generically

### 5. Build and deploy web app

```bash
npx expo export:web
firebase deploy --only hosting
```

Verify the public URL opens correctly in a browser.
Verify the app works on mobile browser (not just desktop).

### 6. Deploy all Cloud Functions

```bash
firebase deploy --only functions
```

Verify all 8 functions appear in Firebase Console → Functions.
Verify all Cloud Scheduler triggers are active.

### 7. Final submission checklist
- [ ] Public Firebase Hosting URL is live and accessible
- [ ] GitHub repository is public
- [ ] Google Doc with problem statement, solution overview, key features, technologies used, Google technologies utilized is complete and publicly accessible
- [ ] All 8 Cloud Functions deployed and showing as healthy in Firebase Console
- [ ] All Cloud Scheduler jobs active (CF5 every 15min, CF6 every 60min, CF8 Monday 08:00, weekly cluster re-evaluation Sunday 02:00)
- [ ] No API keys hardcoded in client or functions source
- [ ] .env not committed to GitHub
- [ ] Firestore and Storage security rules deployed
- [ ] App tested end to end as citizen, authority, and moderator roles
