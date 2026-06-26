# App Flow — CivicPulse

> This document defines every user flow for all three roles: Citizen, Authority, and Moderator.
> Each flow lists every screen, every decision point, every branch, and every outcome.
> There are no gaps. If a screen or state is not listed here, it does not exist.
> Implement exactly what is written. Do not invent screens, steps, or shortcuts.

---

## How to Read This Document

- **Screen:** a distinct UI view the user sees.
- **Action:** something the user does (tap, upload, type).
- **Decision:** a branch point. The system or AI checks something and takes different paths.
- **Outcome:** a terminal state for that flow branch (success, error, or hand-off to another flow).
- **→** means "leads to."
- **[CF1], [CF3]** etc. refer to Cloud Functions defined in the TRD.

---

## PART 1 — ONBOARDING FLOW (All Roles)

This flow is identical for all roles at the start. Role divergence happens after login.

---

### FLOW 0 — First Launch

**Screen: Splash Screen**
- App logo displayed for 1.5 seconds.
- System checks: is a Firebase Auth session already active?
  - YES → skip to FLOW 0C (Role Router).
  - NO → → Screen: Welcome Screen.

---

### FLOW 0A — Welcome Screen

**Screen: Welcome Screen**
- Displays app name, tagline, and two buttons: "Sign In" and "Create Account."
- Action: tap "Sign In" → → Screen: Sign In Screen.
- Action: tap "Create Account" → → Screen: Create Account Screen.

---

### FLOW 0B — Sign In / Create Account

**Screen: Sign In Screen**
- Two options: "Continue with Google" button, and email/password fields with a "Sign In" button.
- Action: tap "Continue with Google" → Firebase Auth Google Sign-In flow → on success → FLOW 0C.
- Action: fill email + password → tap "Sign In":
  - Decision: credentials valid?
    - YES → FLOW 0C.
    - NO → inline error: "Incorrect email or password." Stay on Sign In Screen.
- Link: "Forgot password?" → Firebase Auth password reset email → show confirmation message on screen.

**Screen: Create Account Screen**
- Fields: display name, email, password, confirm password.
- Button: "Create Account."
- Option: "Continue with Google."
- Action: fill fields → tap "Create Account":
  - Decision: all fields valid, passwords match, email not already registered?
    - YES → Firebase Auth creates account → [CF1's onCreate trigger assigns role = citizen] → FLOW 0C.
    - NO → inline field errors. Stay on screen.
- Action: tap "Continue with Google" → same as Sign In Google flow → FLOW 0C.

---

### FLOW 0C — Role Router (runs after every successful login)

- System reads Firebase Custom Claim `role` from the user's JWT.
- Decision:
  - `role = citizen` → → Citizen Home Screen (FLOW 1 begins).
  - `role = authority` → → Authority Dashboard Screen (FLOW 2 begins).
  - `role = moderator` → → Moderator Queue Screen (FLOW 3 begins).
  - No role claim found (edge case — claim not yet propagated) → show loading spinner for 3 seconds → retry → if still missing, sign out and show error: "Account setup incomplete. Please contact support."

---

## PART 2 — CITIZEN FLOWS

---

### FLOW 1 — Citizen Home Screen

**Screen: Citizen Home Screen**
- Bottom navigation bar with four tabs: Home, Map, Report, Profile.
- Home tab shows: recent activity feed (status updates on reports the citizen is attached to), leaderboard teaser (top 3 citizens in their zone), and a "Report a Problem" shortcut button.
- Action: tap "Report a Problem" or tap Report tab → FLOW 1A.
- Action: tap Map tab → FLOW 1D.
- Action: tap Profile tab → FLOW 1E.
- Action: tap any activity item in the feed → → Screen: Report Detail Screen (FLOW 1F).

---

### FLOW 1A — Reporting a Problem

**Screen: Report Screen**
- Camera viewfinder open by default.
- Instruction text: "Take a photo of the civic issue."
- Button: "Take Photo."
- Link: "Upload from gallery" (secondary option).
- Action: take or upload photo → photo thumbnail shown on screen.
- Field: text description (optional). Placeholder: "Describe the issue (optional)."
- GPS location auto-detected and shown as a small map thumbnail with address label.
  - If GPS unavailable: show warning "Location not detected — please enable location access." Block submission until location is available. Do not allow manual pin placement.
- Button: "Submit Report" (enabled only when photo and location are both present).
- Action: tap "Submit Report" → execute in this exact order:
  1. Upload photo to Cloud Storage at path `reports/{userId}/{reportId}/before.{ext}`.
     - If upload fails: show error "Photo upload failed. Please try again." Stay on Report Screen. Do NOT create the Firestore document.
  2. On successful upload: retrieve the photo URL from Cloud Storage.
  3. Create report document in Firestore with status = NEW, photo URL, GPS coordinates, description, and device timestamp.
  4. [CF1 triggered by Firestore onCreate] → → Screen: Submission Pending Screen.

---

### FLOW 1A-i — Submission Pending Screen

**Screen: Submission Pending Screen**
- Spinner with message: "Analysing your photo…"
- No user action available. Wait for CF1 to update the report document.
- System polls the report document for status change (or listens via Firestore real-time listener).
- Decision on status received from CF1:
  - `status = REJECTED` → FLOW 1A-ii.
  - `status = AWAITING_CLARIFICATION` → FLOW 1A-iii.
  - `status = NEW` with cluster found → FLOW 1A-iv (clustered into existing report).
  - `status = NEW` with new cluster created → FLOW 1A-v (new report accepted).

---

### FLOW 1A-ii — Report Rejected

**Screen: Rejection Screen**
- Message: "We couldn't identify a civic issue in this photo — try again with a clearer shot."
- Button: "Try Again" → back to FLOW 1A (Report Screen). Photo field is cleared.
- Button: "Go Home" → back to FLOW 1 (Citizen Home Screen).
- No trust score penalty is applied. No report document remains in Firestore.

---

### FLOW 1A-iii — Clarification Required

**Screen: Clarification Screen**
- AI-generated question displayed (example: "Is this a leak or an overflow?").
- Two or three tap-able answer buttons (options generated by CF1 and stored on the report document).
- No free-text field. Only the provided options are selectable.
- Action: tap an answer → answer stored on report document → CF1 resumes classification with the answer → → Screen: Submission Pending Screen again (FLOW 1A-i).
  - Decision on second CF1 result:
    - `status = REJECTED` → FLOW 1A-ii.
    - `status = NEW` with cluster or new cluster → FLOW 1A-iv or FLOW 1A-v.
    - Do not ask a second clarification question. If confidence is still low after the citizen's answer, CF1 must make a best-guess classification and proceed.

---

### FLOW 1A-iv — Clustered Into Existing Report

**Screen: Clustered Confirmation Screen**
- Message (exact wording from PRD F2):
  - If affected_count = 1: "Your report has been received. We'll notify you when it's resolved." (This case means the citizen is the only person on this cluster — do not mention others.)
  - If affected_count >= 2: "You've been added to an existing report. [N-1] other citizen(s) have also reported this."
- Button: "View Report" → → Screen: Report Detail Screen (FLOW 1F) for the existing cluster.
- Button: "Go Home" → FLOW 1.

---

### FLOW 1A-v — New Report Accepted

**Screen: New Report Confirmation Screen**
- Message: "Your report has been received. We'll notify you when it's resolved."
- Shows: category label, severity badge, location address.
- Button: "View Report" → → Screen: Report Detail Screen (FLOW 1F).
- Button: "Go Home" → FLOW 1.

---

### FLOW 1B — Receiving a Dispute Notification

This flow is triggered by an FCM push notification, not a user action.

**Notification received:** "The authority has marked this issue as resolved. Is it actually fixed?"
- Action: citizen taps the notification → app opens → → Screen: Dispute Screen.

**Screen: Dispute Screen**
- Shows: before photo (top), after photo (bottom), AI validation result ("The fix appears genuine" or "The fix may be incomplete"), issue category, location.
- Message: "Is this issue actually fixed?"
- Two buttons: "Yes, fixed" and "No, not fixed."
- Timer shown: "You have [X hours] to respond."
- Action: tap "Yes, fixed" → vote recorded in `dispute_votes` → → Screen: Vote Confirmed Screen.
  - Message: "Thanks for confirming. The resolution will be marked final once the review window closes."
- Action: tap "No, not fixed" → vote recorded in `dispute_votes` → → Screen: Vote Confirmed Screen.
  - Message: "Thanks for your feedback. We'll review the situation."
- If citizen does not respond within 48 hours: no vote recorded. CF5 handles the outcome without their input.

---

### FLOW 1C — Receiving Status Update Notifications

All FCM notifications for a citizen on a report:

| Notification event | Message shown | On tap |
|---|---|---|
| Report clustered (first) | "Your report has been received." | Opens Report Detail Screen |
| Report clustered (joining) | "You've been added to an existing report. [N-1] others reported this." | Opens Report Detail Screen |
| Escalation sent | "Your reported issue has been escalated to a higher authority." | Opens Report Detail Screen |
| Dispute window result — resolved | "Your reported issue has been confirmed as resolved." | Opens Report Detail Screen |
| Dispute window result — reopened | "This issue has been reopened after citizen disputes." | Opens Report Detail Screen |
| Dispute window result — in review | "This issue has been sent to a moderator for review." | Opens Report Detail Screen |
| Weekly health report published (opt-in) | "This week's City Health Report is available." | Opens Health Report Screen |

---

### FLOW 1D — Live Map

**Screen: Map Screen**
- Full-screen Google Map.
- Issue pins displayed for all open clusters. Pin color: red = High severity, amber = Medium, green = Low. Pin size scaled by affected_count.
- Heatmap layer toggle button (top right).
- Filter bar (top): dropdowns for Category, Status (Open / Resolved / All), Severity (High / Medium / Low / All).
- Action: apply filter → Firestore query re-run with new constraints → map pins update.
- Action: tap a pin → → Bottom sheet slides up showing cluster summary: category, affected count, days open, severity, status.
  - Button in bottom sheet: "View Full Report" → → Screen: Report Detail Screen (FLOW 1F).
- Action: tap heatmap toggle → heatmap layer shown/hidden. Pins remain visible underneath.

---

### FLOW 1E — Profile Screen

**Screen: Profile Screen**
- Shows: display name, trust score (numerical + category label: HighTrust / MediumTrust / LowTrust / Untrusted), total points, badges earned.
- Leaderboard section: citizen's rank in their zone, top 5 citizens in zone.
- Settings section: notification preferences (toggle for weekly health report opt-in), sign out button.
- Action: tap "Sign Out" → Firebase Auth sign out → → Welcome Screen (FLOW 0A).

---

### FLOW 1F — Report Detail Screen

**Screen: Report Detail Screen**
- Shows: before photo, category, severity badge, location (address + small map), affected citizen count, days open, current status, status history timeline.
- If status = AWAITING_CONFIRMATION and citizen is in affected_citizen_ids: shows Dispute buttons ("Yes, fixed" / "No, not fixed") inline — citizen does not need to open the notification to vote.
- If status = RESOLVED: shows after photo alongside before photo, AI validation result, resolution date.
- If status = REOPENED or ESCALATED: shows status badge and brief explanation.
- No citizen names shown anywhere on this screen.

---

## PART 3 — AUTHORITY FLOWS

---

### FLOW 2 — Authority Dashboard Screen

**Screen: Authority Dashboard Screen**
- List of all open clusters assigned to this authority, sorted by PriorityScore (highest first).
- Each list item shows: category icon, severity badge, affected citizen count, days open, SLA countdown timer, current status.
- No citizen names or UIDs shown anywhere.
- Filter bar: Category, Severity, Status.
- Tab: "Metrics" → → Screen: Metrics Screen (FLOW 2D).
- Action: tap a list item → → Screen: Issue Detail Screen (FLOW 2A).

---

### FLOW 2A — Issue Detail Screen (Authority)

**Screen: Issue Detail Screen**
- Shows: before photo, category, severity, affected citizen count, location map, days open, SLA countdown, status timeline, escalation history (if any).
- No citizen names or UIDs shown.
- Action buttons depend on current status:
  - If status = APPROVED: show "Acknowledge" button → → FLOW 2B-i.
  - If status = ASSIGNED: show "Start Work" button → → FLOW 2B-i.5.
  - If status = IN_PROGRESS: show "Mark Resolved" button → → FLOW 2B-ii.
  - If status = AWAITING_CONFIRMATION: show read-only dispute count ("X citizens disputed") — no other action available until dispute window closes.
  - If status = REOPENED: show "Mark Resolved" button again → → FLOW 2B-ii (new resolution attempt).
  - If status = RESOLVED: read-only view. Show after photo, AI validation result, resolution date.
  - If status = ESCALATED: show escalation badge and date sent. "Mark Resolved" still available.

---

### FLOW 2B-i — Acknowledging an Issue

**Action:** tap "Acknowledge"
- Report event created in Firestore: `event_type = acknowledge`.
- Report status updates to ASSIGNED.
- SLA countdown continues running.
- Authority returns to Issue Detail Screen. Status now shows ASSIGNED with action button "Start Work."

---

### FLOW 2B-i.5 — Starting Work on an Issue

**Action:** tap "Start Work"
- Report event created in Firestore: `event_type = work_started`.
- Report status updates to IN_PROGRESS.
- SLA countdown continues running.
- Authority returns to Issue Detail Screen. Status now shows IN_PROGRESS with action button "Mark Resolved."

---

### FLOW 2B-ii — Marking an Issue Resolved

**Screen: Mark Resolved Screen**
- Instruction: "Upload a photo showing the issue has been fixed."
- Camera/gallery upload for after photo (required).
- Button: "Submit Resolution" (disabled until after photo is uploaded).
- Action: upload photo → tap "Submit Resolution":
  - Report event created: `event_type = work_completed`, after photo URL stored.
  - [CF3 triggered] → Gemini Pro compares before/after photos → dispute window opens → FCM sent to all affected citizens.
  - → Screen: Resolution Submitted Screen.

**Screen: Resolution Submitted Screen**
- Message: "Resolution submitted. Citizens have 48 hours to confirm. You'll be notified of the outcome."
- Button: "Back to Dashboard" → FLOW 2.

---

### FLOW 2C — Receiving Dispute Outcome Notification

FCM notification received by authority after CF5 evaluates the dispute window:

| Outcome | Notification message | On tap |
|---|---|---|
| RESOLVED (D=0) | "Resolution confirmed. Issue closed." | Opens Issue Detail Screen |
| REOPENED (D≥3 or D≥R) | "Resolution disputed. Issue has been reopened." | Opens Issue Detail Screen |
| IN_REVIEW (0<D<3) | "Resolution sent to moderator review." | Opens Issue Detail Screen |

- Authority can see the total dispute count (D) on the Issue Detail Screen.
- Authority cannot see which citizens disputed.

---

### FLOW 2D — Metrics Screen

**Screen: Metrics Screen**
- Charts/stats showing: total issues assigned, total resolved, resolution rate, average resolution time, SLA compliance rate — all for this authority's zone.
- Zone breakdown: resolution rate per sub-zone if applicable.
- Link: "View City Health Report" → → Screen: Health Report Screen (public, same as citizen view).

---

## PART 4 — MODERATOR FLOWS

---

### FLOW 3 — Moderator Queue Screen

**Screen: Moderator Queue Screen**
- List of all reports/clusters currently assigned to moderation (status = IN_REVIEW).
- Each item shows: category, severity, affected count, days open, reason for moderation (dispute count, AI uncertainty, PII flag).
- Sorted by: days open (oldest first).
- Action: tap an item → check if item is already claimed by another moderator:
  - If `locked_until > NOW()` and `moderator_id ≠ current moderator`: show message "This case is being reviewed by another moderator. Try again later." Stay on Queue Screen.
  - If not locked: claim the report (`moderator_id = current uid`, `locked_until = NOW() + 30 minutes`) → → Screen: Moderator Review Screen (FLOW 3A).

---

### FLOW 3A — Moderator Review Screen

**Screen: Moderator Review Screen**
- Shows: before photo, after photo (if resolution was attempted), category, severity, affected count, location, full status timeline, AI validation result (if resolution was attempted), dispute vote count D and total responses R (never individual voter identities).
- Lock timer shown: "You have [X minutes] to complete this review."
- Action buttons:

**If reviewing a dispute (report came from CF5 with status = IN_REVIEW after partial dispute):**
- "Confirm Resolved" → FLOW 3B-i.
- "Reopen Issue" → FLOW 3B-ii.
- "Request More Info" → FLOW 3B-iii.

**If reviewing a PII-flagged report:**
- "Redact Photo" → FLOW 3C.
- "Clear PII Flag" (if flag was raised in error) → sets `pii_flag = false`, returns to Queue.

**If reviewing an AI-rejected report that was appealed (Do-Later — placeholder only for MVP):**
- "Approve Report" → sets status = APPROVED, report enters normal flow.
- "Confirm Rejection" → status remains REJECTED.

---

### FLOW 3B-i — Moderator Confirms Resolution

**Action:** tap "Confirm Resolved"
- Required: moderator must enter a reason (free-text, minimum 10 characters).
- Action: type reason → tap "Confirm":
  - Report status set to RESOLVED (final).
  - Moderator action logged to `moderator_audits` with `action = approve`, `reason` text, timestamp.
  - FCM sent to all affected citizens: "Your reported issue has been confirmed as resolved by a moderator."
  - FCM sent to authority: "Resolution confirmed by moderator."
  - → Screen: Action Confirmed Screen → "Back to Queue."

---

### FLOW 3B-ii — Moderator Reopens Issue

**Action:** tap "Reopen Issue"
- Required: moderator must enter a reason (free-text, minimum 10 characters).
- Action: type reason → tap "Confirm Reopen":
  - Report status set to REOPENED.
  - Moderator action logged to `moderator_audits` with `action = reject`, `reason` text, timestamp.
  - FCM sent to all affected citizens: "This issue has been reopened after moderator review."
  - FCM sent to authority: "Resolution rejected by moderator. Issue reopened."
  - → Screen: Action Confirmed Screen → "Back to Queue."

---

### FLOW 3B-iii — Moderator Requests More Information

**Action:** tap "Request More Info"
- Required: moderator must enter what information is needed (free-text).
- Action: type note → tap "Send Request":
  - Report status set back to IN_REVIEW (stays in queue but with a note).
  - Moderator action logged with `action = request_more_info`.
  - FCM sent to authority: "A moderator has requested additional information on this issue." Note text included.
  - Moderator's lock is released immediately.
  - → Back to Queue Screen.

---

### FLOW 3C — Moderator Redacts PII

**Action:** tap "Redact Photo"
- Confirmation dialog: "This will permanently replace the photo with a redacted placeholder. This cannot be undone."
- Button: "Confirm Redact" / "Cancel."
- Action: tap "Confirm Redact":
  - Cloud Function replaces the photo in Cloud Storage with a redacted placeholder image.
  - `pii_handled = true` set on report document.
  - 30-day retention clock starts (see TRD §13.1).
  - Moderator action logged with `action = redact_pii`.
  - → Screen: Action Confirmed Screen → "Back to Queue."

---

### FLOW 3D — Lock Expiry During Review

If the moderator's 30-minute claim lock expires while they are on the Moderator Review Screen:
- Show a non-dismissible modal: "Your review session has expired. Another moderator may now claim this case."
- Single button: "Back to Queue."
- Any action the moderator tries to take after lock expiry must fail gracefully with an error: "Your session expired before this action could be saved."
- No partial saves. If the lock is expired, the action is discarded entirely.

---

## PART 5 — SHARED FLOWS

---

### FLOW 4 — Health Report Screen (Public — No Login Required)

**Screen: Health Report Screen**
- Accessible to all users including unauthenticated visitors.
- Shows the most recent weekly report generated by CF8.
- Content: narrative text report, week date range, top unresolved issues, worst zones, SLA breach count, resolution rate.
- Link: "View Previous Reports" → list of past weekly reports from `health_reports` Firestore collection, sorted by date descending.
- No actions available. Read-only.

---

### FLOW 5 — Notification Permission Request

Triggered on first app launch after account creation (citizen role only).

**Screen: Notification Permission Screen**
- Message: "Enable notifications to get updates on your reports and community issues."
- Button: "Enable Notifications" → triggers OS-level permission dialog.
  - If granted: FCM token stored in `users/{userId}.fcm_token`. → Citizen Home Screen.
  - If denied: FCM token not stored. Citizen will not receive push notifications. → Citizen Home Screen. App functions normally without notifications.
- Button: "Maybe Later" → skip. → Citizen Home Screen. Permission can be enabled later from Profile Screen settings.

---

## PART 6 — EDGE CASES AND ERROR STATES

### E1 — No Internet Connection
- On any screen requiring a network call: show a non-blocking banner at the top: "No internet connection. Some features may be unavailable."
- Submission (FLOW 1A): block submission if offline. Show: "You need an internet connection to submit a report."
- Map (FLOW 1D): show last cached tile if available. Show offline banner.

### E2 — GPS Unavailable During Report Submission
- Block submission. Show: "Location not detected — please enable location access in your device settings."
- Do not allow manual pin placement (per TRD decision — GPS is required).

### E3 — CF1 Takes Too Long (Timeout)
- If CF1 does not update the report status within 30 seconds of submission: show error on Submission Pending Screen: "Analysis is taking longer than expected. We'll notify you when it's ready."
- Citizen can leave the screen. The report remains in Firestore with status = NEW. CF1 will complete and send an FCM notification with the result.

### E4 — Dispute Window Already Closed
- If citizen taps a dispute notification after the 48-hour window has closed: show message: "The review window for this issue has closed. No further votes are being accepted."
- Do not record the vote. CF5 has already evaluated or will evaluate the outcome.

### E5 — Duplicate Vote Attempt
- If citizen tries to vote twice on the same resolution attempt: show message: "You've already submitted your response for this resolution."
- Discard the second vote silently (CF4 handles this). Show the message client-side before even making the Firestore write.

### E6 — Authority Tries to Access Citizen Identity
- Firestore security rules block the query server-side. Client receives a permission error.
- Show generic error: "You don't have permission to view this information."
- Do not reveal why the permission was denied.

### E7 — Moderator Lock Conflict
- If two moderators attempt to claim the same report simultaneously: first write wins (Firestore transaction). Second moderator sees: "This case is being reviewed by another moderator. Try again later."

---

## SCREEN INVENTORY — COMPLETE LIST

This is every screen in the app. No screen should be built that is not on this list.

**Citizen screens:**
1. Splash Screen
2. Welcome Screen
3. Sign In Screen
4. Create Account Screen
5. Citizen Home Screen
6. Report Screen
7. Submission Pending Screen
8. Rejection Screen
9. Clarification Screen
10. Clustered Confirmation Screen
11. New Report Confirmation Screen
12. Dispute Screen
13. Vote Confirmed Screen
14. Map Screen
15. Profile Screen
16. Report Detail Screen (Citizen view)
17. Notification Permission Screen
18. Health Report Screen (shared)

**Authority screens:**
19. Authority Dashboard Screen
20. Issue Detail Screen (Authority view)
21. Mark Resolved Screen
22. Resolution Submitted Screen
23. Metrics Screen

**Moderator screens:**
24. Moderator Queue Screen
25. Moderator Review Screen
26. Action Confirmed Screen

**Total: 26 screens.**
