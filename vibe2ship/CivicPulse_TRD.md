# TRD — CivicPulse

> This document is written for implementation. Every decision is final. Do not substitute alternatives, do not invent missing details, and do not add features not listed here. If something is marked "Do-Later" in the PRD, it is not built.

> **Stack authority note:** A separate backend schema document exists that describes a Supabase + PostGIS + Supabase Edge Functions architecture. That document was an earlier design iteration and has been superseded. This TRD is the authoritative stack decision. The implementation uses Firebase + Firestore + Cloud Functions throughout. Do not use Supabase, PostgreSQL, PostGIS, or Supabase Edge Functions anywhere in the codebase.

---

## 1. System Architecture

CivicPulse is a three-tier system:

- **Client** — React Native (Expo SDK 51) app, compiled to web via `expo export:web`, deployed on Firebase Hosting. This single codebase serves both mobile and web.
- **Backend** — Firebase Cloud Functions (Node.js 20, 2nd gen), triggered by Firestore document events, HTTP calls, and Cloud Scheduler.
- **AI layer** — Gemini 1.5 Pro (vision tasks) and Gemini 1.5 Flash (all other tasks), called exclusively via the Vertex AI SDK from Cloud Functions. The client never calls Gemini directly.

**Hard rule:** All Gemini API calls are made server-side from Cloud Functions only. API keys are never exposed to the client.

---

## 2. Full Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React Native via Expo SDK 51 | Single codebase for mobile + web |
| Web deployment | `expo export:web` → Firebase Hosting | Public URL for submission |
| Auth | Firebase Auth | Google Sign-In + email/password |
| Database | Firestore | Native mode |
| File storage | Cloud Storage for Firebase | Images only |
| Backend logic | Firebase Cloud Functions | Node.js 20, 2nd gen |
| AI — vision tasks | Gemini 1.5 Pro | Via Vertex AI SDK |
| AI — all other tasks | Gemini 1.5 Flash | Via Vertex AI SDK |
| Maps — mobile | `react-native-maps` with `PROVIDER_GOOGLE` | Google Maps API key in `app.json` |
| Maps — web | `@react-google-maps/api` | Loaded via `Platform.OS === 'web'` check |
| Push notifications | Firebase Cloud Messaging | FCM v1 API |
| Email escalation | Gmail API | Via Google service account |
| Scheduling | Firebase Cloud Scheduler | Cron triggers for SLA monitor + weekly report |
| Role enforcement | Firebase Custom Claims | Embedded in JWT, enforced in Firestore rules |
| Dev environment | Google AI Studio | Prototyping and prompt engineering |

---

## 3. Authentication and Role Management

### Login methods
- Google Sign-In via Firebase Auth
- Email/password via Firebase Auth
- Both methods available to all user types

### Roles
Three roles exist: `citizen`, `authority`, `moderator`

Roles are stored as Firebase Custom Claims on the user's JWT token — not in Firestore. This means Firestore security rules can check `request.auth.token.role` without an extra database read.

### Role assignment rules
- Every new user created via Firebase Auth is assigned role `citizen` automatically by an `onCreate` Cloud Function trigger.
- Roles `authority` and `moderator` are assigned manually by a superadmin using the Firebase Admin SDK.
- No user can self-assign or request a role upgrade. There is no UI for role assignment — it is done directly via Admin SDK scripts.

### Identity protection
- The authority role never sees citizen names or UIDs at any point in the app.
- All Firestore queries scoped to the authority client return only: category, photo URL, location, severity, affected citizen count.
- Citizen UID is never included in any query result returned to an authority.
- Trust scores and points are readable only by the citizen who owns them. Firestore security rules enforce this.

---

## 4. Cloud Functions — Complete List

Eight functions handle all backend logic. Each function's trigger, inputs, and responsibilities are defined exactly below. Do not add extra functions. Do not merge functions.

---

### CF1 — `onReportSubmitted`
**Trigger:** Firestore `onCreate` on `reports/{reportId}`

**Responsibilities — execute in this exact order:**

1. Call Gemini 1.5 Pro (Vision) with the uploaded photo and optional description text.
   - Prompt instructs Gemini to return a JSON object with fields: `is_civic_issue` (boolean), `category` (string), `severity` (Low / Medium / High), `classifier_confidence` (float 0–1), `needs_clarification` (boolean), `clarification_question` (string or null).
   - If `is_civic_issue = false`: update the report document with `status = REJECTED`, return. Do not proceed further.
   - If `needs_clarification = true` AND `classifier_confidence < 0.7`: update the report document with `status = AWAITING_CLARIFICATION` and store the `clarification_question`. Return the question to the client. Do not proceed further until the citizen answers.
   - If `is_civic_issue = true` AND `classifier_confidence >= 0.7`: continue to step 2.

2. Run the clustering check (see Section 6 — Clustering). 
   - If a matching cluster is found: add the citizen to the existing cluster's `affected_citizen_ids` array, increment `affected_count` by 1, update the report document with `cluster_id` referencing the existing cluster. Skip steps 3 and 4. Go to step 5.
   - If no matching cluster is found: continue to step 3.

3. Calculate Layer 1 trust score using the exact formula in the PRD F3. Store result in the report document as `trust_layer1`.

4. Create a new cluster document in the `clusters` collection. Link the report to it via `cluster_id`.

5. Send FCM push notification to the citizen:
   - If `affected_count = 1`: "Your report has been received. We'll notify you when it's resolved."
   - If `affected_count >= 2`: "You've been added to an existing report. [N-1] other citizen(s) have also reported this." where N = affected_count.

---

### CF2 — `onClusterUpdated`
**Trigger:** Firestore `onUpdate` on `clusters/{clusterId}`

**Responsibilities:**
1. Recalculate `priority_score` using the exact formula from PRD F8: `PriorityScore = Severity × ln(AffectedCount + 1) × DaysOpen × TrustFactor`
   - `Severity`: Low = 1, Medium = 2, High = 3
   - `AffectedCount`: current `affected_count` field on the cluster
   - `DaysOpen`: `(NOW() - cluster.created_at)` in fractional days
   - `TrustFactor`: `0.5 + 0.5 × (trust_score / 100)`, range [0.5, 1.0]
2. Update `cluster.priority_score` with the new value.
3. Update `cluster.status` using the following rule:
   - If all linked reports have `status = RESOLVED`: set `cluster.status = resolved`
   - If all linked reports have `status = CLOSED`: set `cluster.status = closed`
   - Otherwise: set `cluster.status = active`

---

### CF3 — `onAuthorityAction`
**Trigger:** Firestore `onCreate` on `report_events/{eventId}` where `event_type = work_completed`

**Responsibilities — execute in this exact order:**
1. Retrieve the `before` photo URL from the original report document.
2. Retrieve the `after` photo URL from the event document.
3. Call Gemini 1.5 Pro (Vision) with both photos.
   - Prompt instructs Gemini to return a JSON object with fields: `fix_appears_genuine` (boolean), `confidence` (float 0–1), `reasoning` (string, max 100 words).
   - Store the Gemini response in the report document under `resolution_validation`.
4. Open the 48-hour dispute window:
   - Set `report.status = AWAITING_CONFIRMATION`
   - Set `report.dispute_window_closes_at = NOW() + 48 hours`
   - Set `report.resolution_attempt` = current attempt number (increment from previous, start at 1)
5. Send FCM push notification to every citizen in `cluster.affected_citizen_ids`:
   - Message: "The authority has marked this issue as resolved. Is it actually fixed?" with two action buttons: "Yes, fixed" / "No, not fixed."

---

### CF4 — `onDisputeVote`
**Trigger:** Firestore `onCreate` on `dispute_votes/{voteId}`

**Responsibilities:**
1. Verify the vote is within the open dispute window (`NOW() < report.dispute_window_closes_at`). If window is closed, discard the vote and return.
2. Verify the citizen has not already voted on this `(report_id, resolution_attempt)` combination. If duplicate, discard and return.
3. Count total `No` votes (D) for this `(report_id, resolution_attempt)`.
4. If `D >= 3`: immediately reopen the report without waiting for the window to close.
   - Set `report.status = REOPENED`
   - Notify all affected citizens via FCM: "This issue has been reopened after citizen disputes."
   - Return.
5. If `D < 3`: do nothing further. The window close is handled by CF5.

---

### CF5 — `evaluateDisputeWindow`
**Trigger:** Firebase Cloud Scheduler — every 15 minutes

**Responsibilities:**
1. Query Firestore for all reports where `status = AWAITING_CONFIRMATION` AND `dispute_window_closes_at <= NOW()`.
2. For each such report, apply the following logic in exact order:
   - Count `No` votes: D
   - Count total responses (Yes + No): R
   - IF `D >= 3`: set `status = REOPENED`
   - ELSE IF `D >= R AND R > 0`: set `status = REOPENED`
   - ELSE IF `D > 0` (and neither above is true): set `status = IN_REVIEW` (send to Moderator queue)
   - ELSE (`D = 0`): set `status = RESOLVED` (final)
3. Send FCM notifications to all affected citizens with the outcome.
4. The 15-minute scheduling lag is intentional. A report may sit in `AWAITING_CONFIRMATION` for up to 15 minutes past `dispute_window_closes_at` before being evaluated. This is acceptable and expected — do not attempt to eliminate this lag.

---

### CF6 — `slaMonitor`
**Trigger:** Firebase Cloud Scheduler — every 60 minutes

**Responsibilities:**
1. Query Firestore for all reports where:
   - `status` is not `RESOLVED`, `CLOSED`, or `REJECTED`
   - `sla_deadline <= NOW()`
   - `escalation_sent = false`
2. For each such report, call CF7 (`escalationEmailSender`) with the report data.
3. Set `report.escalation_sent = true` after CF7 completes successfully.

---

### CF7 — `escalationEmailSender`
**Trigger:** Called directly by CF6 (not a Firestore or Scheduler trigger)

**Responsibilities:**
1. Call Gemini 1.5 Flash with the report data (category, photo URL, affected count, days open, SLA deadline, days overdue).
   - Prompt instructs Gemini to write a formal escalation email in plain English. The email must include: issue category, photo reference, number of affected citizens, number of days open, number of days past SLA deadline.
   - Gemini returns the email subject and body as a JSON object with fields `subject` (string) and `body` (string).
2. Send the email via Gmail API to the authority's escalation contact email address stored in the `authorities` Firestore collection.
3. Send FCM push notification to every citizen in `cluster.affected_citizen_ids`: "Your reported issue has been escalated to a higher authority."
4. Write a record to the `escalation_log` Firestore collection with: `report_id`, `cluster_id`, `sent_at`, `email_subject`, `recipient_email`.

---

### CF8 — `weeklyHealthReport`
**Trigger:** Firebase Cloud Scheduler — every Monday at 08:00 (UTC)

**Responsibilities:**
1. Query Firestore for the past 7 days of data:
   - Total new reports created
   - Total reports resolved
   - Total reports escalated
   - Total SLA breaches
   - Resolution rate per city zone (group by `zone_id`)
   - Top 5 unresolved clusters by priority score
   - Worst-performing zones by resolution rate
2. Pass the aggregated data to Gemini 1.5 Flash.
   - Prompt instructs Gemini to write a public-facing City Health Report as a readable narrative. Not a list of numbers — a written report a citizen or journalist could read. Max 600 words.
   - Gemini returns the report as plain text.
3. Write the report to the `health_reports` Firestore collection with fields: `generated_at`, `report_text`, `week_start`, `week_end`.
4. The `health_reports` collection is publicly readable. No authentication required to read it.

---

## 5. Gemini Model Usage — Decision Table

| Task | Model | Reason |
|---|---|---|
| Photo classification + severity estimation | Gemini 1.5 Pro | Vision accuracy is critical — wrong category breaks clustering and SLA |
| Before/after resolution photo comparison | Gemini 1.5 Pro | Requires nuanced visual difference detection |
| Low-confidence clarifying question generation | Gemini 1.5 Flash | Simple structured output, no vision needed |
| Escalation email generation | Gemini 1.5 Flash | Structured text, well-defined format |
| Weekly City Health Report generation | Gemini 1.5 Flash | Long-form narrative, no vision needed |

**Layer 1 trust score is NOT a Gemini task.** It is pure arithmetic computed in plain JavaScript inside CF1. No AI call is made for Layer 1. See the exact formula below — every signal is a deterministic calculation on known fields:

```javascript
function computeLayer1(report) {
  const { classifier_confidence, geo_accuracy_meters, photo_count,
          device_timestamp, server_timestamp, photo_timestamp } = report;

  let score = 0;

  // Classifier confidence (0–50)
  score += Math.round(classifier_confidence * 50);

  // GPS accuracy
  if (geo_accuracy_meters <= 10) score += 10;
  else if (geo_accuracy_meters <= 50) score += 5;

  // Photo present
  if (photo_count >= 1) score += 5;

  // Device time vs server time (within 5 minutes)
  if (Math.abs(device_timestamp - server_timestamp) <= 300000) score += 5;

  // Stale photo penalty (photo older than 30 days)
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (photo_timestamp && (server_timestamp - photo_timestamp) > thirtyDaysMs) score -= 10;

  // Clamp to [0, 70]
  return Math.max(0, Math.min(70, score));
}
```

All Gemini calls use the Vertex AI SDK. The `@google-cloud/vertexai` npm package is used in all Cloud Functions. Do not use the `@google/generative-ai` package (direct Gemini API) — use Vertex AI SDK exclusively.

---

## 6. Clustering Implementation

Firestore does not support native geospatial queries. The clustering check inside CF1 uses the following approach — do not substitute a different approach.

**Step-by-step:**
1. Query Firestore for all clusters where:
   - `category` exactly matches the new report's category (string equality)
   - `status = active`
   - `created_at >= NOW() - 7 days`
2. For each returned cluster, calculate the distance between the cluster's `centroid_lat`/`centroid_lng` and the new report's `lat`/`lng` using the Haversine formula.
3. Keep only clusters where the Haversine distance is ≤ 50 meters.
4. If one or more clusters remain after the distance filter: the new report belongs to the closest one (lowest Haversine distance).
5. If no clusters remain: create a new cluster.

**Haversine formula (implement exactly):**
```javascript
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in metres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

**Note:** The PRD references PostGIS `ST_DWithin`. Since the database is Firestore (not PostgreSQL), `ST_DWithin` is not available. The Haversine in-function approach above is the correct replacement. It produces identical results for distances ≤ 50 meters. Do not attempt to install PostGIS or switch databases.

---

## 7. Maps Implementation

### Mobile (React Native)
- Use `react-native-maps` with `provider={PROVIDER_GOOGLE}`
- Google Maps API key stored in `app.json` under `android.config.googleMaps.apiKey` and `ios.config.googleMapsApiKey`
- Issue pins: color-coded by severity (red = High, amber = Medium, green = Low), size scaled by `affected_count`
- Heatmap: use Google Maps Heatmap Layer, weight each point by `priority_score`
- Filter controls (category, status, severity): implemented as Firestore queries with `where` clauses, not client-side filtering of a full dataset

### Web (Expo web build)
- `react-native-maps` does not render on web
- Use `Platform.OS === 'web'` check to conditionally import `@react-google-maps/api` on web
- Mobile and web map components share the same props interface — only the underlying library differs
- The Google Maps API key is the same key for both platforms

---

## 8. Notification Strategy

| Event | Channel | Recipient |
|---|---|---|
| Report received (first report on a new cluster) | FCM push | Reporting citizen |
| Report clustered (citizen joins existing cluster) | FCM push | Reporting citizen |
| Dispute window opened (authority marks resolved) | FCM push | All affected citizens |
| Dispute window result | FCM push | All affected citizens |
| Escalation email sent | FCM push | All affected citizens |
| Escalation email | Gmail API | Authority escalation contact |
| Weekly health report published | FCM push (opt-in only) | Citizens who opted in |

FCM token management:
- FCM token stored in `users/{userId}` Firestore document under field `fcm_token`
- Token refreshed on every app open via the `onTokenRefresh` Firebase Messaging listener
- Before sending any FCM notification, check that `fcm_token` is not null

---

## 9. Firestore Security Rules — Complete Specification

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users — citizen reads/writes own document only
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    // Reports — citizen can create, anyone authenticated can read
    // No user can update or delete a report directly (Cloud Functions only)
    match /reports/{reportId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.auth.token.role == 'citizen';
      allow update, delete: if false; // Cloud Functions only
    }

    // Clusters — publicly readable, Cloud Functions write only
    match /clusters/{clusterId} {
      allow read: if true; // Public — needed for map display
      allow write: if false; // Cloud Functions only
    }

    // Dispute votes — citizen can create one vote per (report, attempt)
    // Document path enforces uniqueness: dispute_votes/{reportId}_{attempt}_{userId}
    // IDENTITY PROTECTION: authorities have zero read access to this collection.
    // Authorities may only receive the aggregate dispute count D, never individual rows.
    // Cloud Functions read this collection server-side using Admin SDK (bypasses these rules).
    match /dispute_votes/{voteId} {
      allow read: if request.auth.token.role == 'moderator';
      allow create: if request.auth != null
        && request.auth.token.role == 'citizen'
        && request.resource.data.citizen_id == request.auth.uid;
      allow update, delete: if false;
    }

    // Report events — authority can create, moderator can read
    match /report_events/{eventId} {
      allow read: if request.auth.token.role in ['authority', 'moderator'];
      allow create: if request.auth.token.role == 'authority';
      allow update, delete: if false;
    }

    // Health reports — publicly readable, Cloud Functions write only
    match /health_reports/{reportId} {
      allow read: if true;
      allow write: if false; // Cloud Functions only
    }

    // Escalation log — moderator and authority read only
    match /escalation_log/{logId} {
      allow read: if request.auth.token.role in ['authority', 'moderator'];
      allow write: if false; // Cloud Functions only
    }

    // Authorities — authority reads own record only
    match /authorities/{authorityId} {
      allow read: if request.auth.uid == authorityId
        || request.auth.token.role == 'moderator';
      allow write: if false; // Admin SDK only
    }
  }
}
```

---

## 10. Cloud Storage Security Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Before photos — authenticated citizen uploads to their own path
    match /reports/{userId}/{reportId}/before.{ext} {
      allow read: if true; // Public — needed for map display
      allow write: if request.auth.uid == userId
        && request.auth.token.role == 'citizen';
    }

    // After photos — authority uploads only
    match /reports/{reportId}/after.{ext} {
      allow read: if true;
      allow write: if request.auth.token.role == 'authority';
    }
  }
}
```

---

## 11. Google Technologies Checklist

Every item below is actively used in the implementation. This list is for the "Google Technologies Utilized" section of the submission Google Doc.

| Technology | How it is used |
|---|---|
| Google AI Studio | Development environment, prompt engineering, prototyping |
| Vertex AI SDK | All Gemini 1.5 Pro and Flash API calls from Cloud Functions |
| Gemini 1.5 Pro | Photo classification, severity estimation, before/after resolution validation |
| Gemini 1.5 Flash | Clarification questions, escalation emails, weekly health report | Trust score is pure arithmetic in CF1 — no Gemini call is made for it (see Section 5) |
| Firebase Auth | User authentication — Google Sign-In and email/password |
| Firestore | Primary database — all reports, clusters, users, votes, logs |
| Cloud Storage for Firebase | Issue photo storage (before and after) |
| Firebase Cloud Functions | All backend logic — 8 functions |
| Firebase Hosting | Web app deployment — public URL for submission |
| Firebase Cloud Messaging | Push notifications to citizens |
| Firebase Cloud Scheduler | SLA monitor (every 60 min), dispute window evaluator (every 15 min), weekly report (Monday 08:00) |
| Google Maps API | Map display, heatmap layer, geocoding |
| Gmail API | Escalation emails to authority contacts |

---

## 12. Environment Variables

The following environment variables must be set in Firebase Cloud Functions configuration. They are never hardcoded and never sent to the client.

```
VERTEX_AI_PROJECT_ID=<google-cloud-project-id>
VERTEX_AI_LOCATION=us-central1
GMAIL_SERVICE_ACCOUNT_KEY=<base64-encoded-service-account-json>
GMAIL_ESCALATION_SENDER=civicpulse-alerts@<domain>
GOOGLE_MAPS_SERVER_API_KEY=<server-side-maps-key>
```

Client-side keys (Maps API key for web/mobile) are stored in `app.json` and `.env` with the `EXPO_PUBLIC_` prefix. They are intentionally public — restrict them by HTTP referrer and app bundle ID in the Google Cloud Console.

---

## 13. Additional Implementation Details (Ported from Earlier Schema Design)

> The following decisions were made during the Supabase schema design phase and remain valid regardless of the stack switch to Firebase. They must be implemented in the Firestore data model and Cloud Functions.

---

### 13.1 Photo Retention Policy

- **Default retention:** 90 days from upload date.
- **PII-flagged reports:** 30 days from the date a moderator marks `pii_handled = true`.
- Implementation: a scheduled Cloud Function (add to CF6's hourly run or create a separate weekly job) deletes expired photos from Cloud Storage and nulls the `photo_url` field on the affected report document.
- Photo fields to track per report document: `photo_url` (before), `after_photo_url`, `photo_timestamp` (EXIF timestamp from device, if available), `file_size_kb`, `mime_type` (must be `image/jpeg` or `image/png`), `created_at`.

---

### 13.2 Notification Rate Limiting

To prevent notification spam, enforce a per-citizen rate limit before sending any FCM push:

- **Limit:** no more than 5 notifications per citizen per hour.
- Implementation: maintain a `notification_logs` sub-collection (or top-level collection) in Firestore. Before sending, query:
  ```
  notification_logs
    WHERE recipient_id = <uid>
    AND created_at > NOW() - 1 hour
    AND status IN ['queued', 'sent']
  ```
  If count >= 5: write the notification as `status = queued` and process it at the next hour boundary. Do not drop it.
- Log every notification attempt with: `recipient_id`, `report_id` (nullable), `channel` (`push` / `email`), `event_type`, `payload`, `status` (`queued` / `sent` / `failed`), `failure_count`, `sent_at`, `created_at`.
- Retain notification logs for 1 year.

---

### 13.3 Moderator Claim Locking

When a moderator opens a report for review, they claim it for 30 minutes. This prevents two moderators from acting on the same report simultaneously.

- Fields to store on the report document: `moderator_id` (UID of the claiming moderator, nullable), `locked_until` (timestamp, nullable).
- On moderator claim: set `moderator_id` and `locked_until = NOW() + 30 minutes`.
- On any subsequent moderator attempt to claim the same report: check `locked_until > NOW()` and reject with an appropriate error if another moderator holds the lock.
- Lock expires automatically — no explicit release needed. After `locked_until` passes, the report is claimable again.
- Log every moderator action (`claim`, `approve`, `reject`, `request_more_info`, `escalate_to_authority`, `redact_pii`) with a mandatory `reason` field to a `moderator_audits` Firestore collection. Retain for 2 years.

---

### 13.4 PII Flagging

- Reports may contain personally identifiable information (e.g. a photo that inadvertently captures a face or licence plate).
- Fields on the report document: `pii_flag` (boolean, default false), `pii_handled` (boolean, default false).
- If `pii_flag = true`: the photo URL must be hidden from all non-moderator reads. Firestore security rules must enforce this — the `photo_url` field must not be returned in queries accessible to citizens or authorities until `pii_handled = true`.
- Moderator action `redact_pii`: replaces the photo with a redacted placeholder in Cloud Storage, sets `pii_handled = true`, and triggers the 30-day retention clock (see 13.1).

---

### 13.5 Citizen Appeal Flow

Citizens may appeal a moderator rejection. This is a Do-Later feature per the PRD, but the data model must accommodate it from day one to avoid a breaking schema migration later.

- Add `appeal_text` (string, nullable) to the report document.
- Add `APPEAL` as a valid status value alongside the statuses already defined in CF5.
- Appeal flow (post-hackathon): citizen submits appeal text → report status = `APPEAL` → routed back to moderator queue → moderator reviews and either reverses rejection (`APPROVED`) or confirms it (`REJECTED`).
- For the MVP: if a citizen tries to appeal, store `appeal_text` and set `status = APPEAL`, but do not build the moderator-side appeal review UI. A placeholder is sufficient.

---

### 13.6 Report Status — Complete Enum

The TRD's CF functions reference these statuses. This is the full canonical list — do not use any other string values:

| Status | Set by | Meaning |
|---|---|---|
| `NEW` | CF1 | Submitted, not yet processed |
| `AWAITING_CLARIFICATION` | CF1 | AI asked a follow-up question; waiting for citizen answer |
| `REJECTED` | CF1 | AI found no real civic issue in the photo |
| `IN_REVIEW` | CF5 / moderator | Held for moderator review |
| `APPROVED` | Moderator | Moderator approved; pending authority assignment |
| `ASSIGNED` | System | Assigned to an authority |
| `IN_PROGRESS` | Authority action | Authority started work |
| `AWAITING_CONFIRMATION` | CF3 | Authority marked resolved; 48-hour citizen dispute window open |
| `RESOLVED` | CF5 | Resolution confirmed (final) |
| `REOPENED` | CF4 / CF5 | Resolution disputed and reopened |
| `ESCALATED` | CF6 | SLA breached; escalation email sent |
| `CLOSED` | System | Closed without resolution |
| `APPEAL` | Citizen | Citizen appealed a moderator rejection (Do-Later) |

---

### 13.7 Weekly Cluster Re-evaluation

Once per week (recommend Sunday 02:00 UTC, add to Firebase Cloud Scheduler), re-evaluate clusters whose geographic bounding boxes come within 30 metres of each other and merge them if all three clustering conditions are still met (same category, distance ≤ 50 m between centroids, created within 7 days). After merge, update the surviving cluster's `affected_count` and `priority_score`. This job is separate from the Monday 08:00 health report and should not be combined with it.
