# ⚠️ SUPERSEDED — DO NOT IMPLEMENT FROM THIS DOCUMENT

> **This document has been superseded by `CivicPulse_TRD_Fixed.md`.**
>
> The Supabase + PostgreSQL + PostGIS + Edge Functions stack described here was an earlier design iteration. The authoritative stack decision is **Firebase + Firestore + Cloud Functions**, as specified in the TRD.
>
> This file is kept for reference only. The following content from this document has been reviewed and ported into Section 13 of the TRD where still relevant:
> - Photo retention policy → TRD §13.1
> - Notification rate limiting → TRD §13.2
> - Moderator claim locking → TRD §13.3
> - PII flagging → TRD §13.4
> - Citizen appeal flow → TRD §13.5
> - Complete status enum → TRD §13.6
> - Weekly cluster re-evaluation job → TRD §13.7
>
> **Do not use the Supabase stack, PostgreSQL schema, PostGIS queries, or Edge Functions defined below. Treat everything below this banner as historical context only.**

---

# CivicPulse — Backend Schema Reference (SUPERSEDED)

> This document defines the complete backend data model for CivicPulse. It is written for an AI code generator. Every table, column, type, constraint, index, and relationship is specified explicitly. Do not invent fields or relationships that are not listed here. If something is marked TODO, leave a placeholder comment in the generated code.

---

## Stack

| Layer | Technology |
|---|---|
| Database | Supabase (PostgreSQL 15 + PostGIS) |
| File Storage | Supabase Storage |
| Auth | Supabase Auth (Google OAuth + Phone OTP) |
| Backend Logic | Supabase Edge Functions (Deno / TypeScript) |
| AI | Google Gemini 1.5 Flash via REST API |
| Frontend | React Native (Expo) |

---

## Design Decisions

1. **Single `users` table** — Supabase Auth manages the auth layer (`auth.users`). The `users` table here is the public profile layer. Role-based access is enforced via Supabase Row Level Security (RLS) policies, not separate tables.
2. **Separate `zones` table** — Authorities can own multiple geographic zones. Zones store PostGIS `geometry` polygons. Reassigning a zone to a different authority does not touch the `users` table.
3. **Separate `photos` table** — A `photo_type` column handles all photo contexts: before report, after resolution, authority upload, and appeal. Storage paths point to Supabase Storage buckets; signed URLs are generated at read time, never stored raw.
4. **Append-only `report_events` table** — Full audit trail. Never delete from this table. `payload` is JSONB so each event type can carry different fields without schema changes.
5. **`sla_deadline` stored on `reports`** — Computed and stored at assignment time. SLA breach detection is a simple query: `WHERE sla_deadline < NOW() AND status NOT IN ('RESOLVED', 'CLOSED')`. No runtime math.
6. **Cluster bounding box stored as four floats** — Simpler than a PostGIS geometry for the hackathon. Can be upgraded to a PostGIS polygon later without breaking the API.
7. **TrustScore stored as three integers** — `trust_score` (final, 0–100), `trust_layer1` (0–70), `trust_layer2` (-20 to +30). Stored separately for debugging and for the authority dashboard display.

---

## Tables

### `users`

Public profile layer on top of Supabase Auth.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY | Matches `auth.users.id` |
| `role` | `text` | NOT NULL | Enum: `citizen`, `authority`, `moderator`, `head_moderator` |
| `name` | `text` | NOT NULL | Display name |
| `email` | `text` | NULLABLE | From auth provider |
| `email_opt_in` | `boolean` | NOT NULL, DEFAULT false | Controls email notifications |
| `app_token` | `text` | NULLABLE | Push notification token |
| `verified_account` | `boolean` | NOT NULL, DEFAULT false | Affects TrustScore Layer 2 (+10 if true) |
| `auth_provider` | `text` | NOT NULL | Enum: `google`, `phone` |
| `phone_number` | `text` | NULLABLE | Only set if auth_provider = phone |
| `trust_score_aggregate` | `integer` | NOT NULL, DEFAULT 0 | Cached mean TrustScore across citizen's reports |
| `profile_points` | `integer` | NOT NULL, DEFAULT 0 | Gamification points |
| `webhook_url` | `text` | NULLABLE | Authority only. HTTP endpoint for report webhooks |
| `notification_preferences` | `jsonb` | NOT NULL, DEFAULT '{"in_app": true, "email": false}' | Per-channel opt-in |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `last_active_at` | `timestamptz` | NULLABLE | Updated on each API request |

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `role`

**RLS Rules:**
- Citizens can read and update only their own row.
- Authorities can read citizen rows (name, trust_score_aggregate) but not write them.
- Moderators can read all rows.
- `webhook_url` and `notification_preferences` are readable only by the owning user and head_moderators.

---

### `zones`

Geographic jurisdictions owned by authority users.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | |
| `name` | `text` | NOT NULL | Human-readable zone name (e.g. "Zone 3 - North Chandigarh") |
| `polygon` | `geometry(Polygon, 4326)` | NOT NULL | PostGIS polygon, WGS84 |
| `authority_id` | `uuid` | NOT NULL, REFERENCES users(id) | Owning authority user |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

**Indexes:**
- PRIMARY KEY on `id`
- GIST index on `polygon` (required for PostGIS spatial queries)
- INDEX on `authority_id`

**Key Query — find authority for a report location:**
```sql
SELECT authority_id FROM zones
WHERE ST_Within(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), polygon);
```

---

### `reports`

Central entity. Every civic problem submitted by a citizen.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | |
| `reporter_id` | `uuid` | NOT NULL, REFERENCES users(id) | Submitting citizen |
| `status` | `text` | NOT NULL, DEFAULT 'NEW' | See Status Enum below |
| `category` | `text` | NOT NULL | Must match canonical Issue Categories list |
| `severity` | `text` | NOT NULL | Enum: `Low`, `Medium`, `High` |
| `classifier_confidence` | `float4` | NOT NULL | Range 0.0–1.0. Output from Gemini classifier |
| `trust_score` | `integer` | NOT NULL, DEFAULT 0 | Final score 0–100 |
| `trust_layer1` | `integer` | NOT NULL, DEFAULT 0 | Content score 0–70 |
| `trust_layer2` | `integer` | NOT NULL, DEFAULT 0 | Behavior score -20 to +30 |
| `moderator_override` | `text` | NULLABLE | Enum: `approve`, `reject`. NULL if no override |
| `location` | `geometry(Point, 4326)` | NOT NULL | PostGIS point, WGS84 |
| `geo_accuracy_meters` | `integer` | NOT NULL | GPS accuracy from device |
| `address` | `text` | NULLABLE | Reverse-geocoded human-readable address |
| `description` | `text` | NULLABLE | Optional text from citizen |
| `upvotes` | `integer` | NOT NULL, DEFAULT 0 | Citizen confirmations |
| `downvotes` | `integer` | NOT NULL, DEFAULT 0 | Citizen rejections |
| `cluster_id` | `uuid` | NULLABLE, REFERENCES clusters(id) | NULL if not clustered |
| `assigned_authority_ids` | `uuid[]` | NOT NULL, DEFAULT '{}' | Array of authority user IDs with jurisdiction |
| `assigned_to` | `uuid` | NULLABLE, REFERENCES users(id) | Specific authority staff who claimed this report |
| `assigned_at` | `timestamptz` | NULLABLE | When assigned_to was set |
| `moderator_id` | `uuid` | NULLABLE, REFERENCES users(id) | Moderator currently holding the claim |
| `locked_until` | `timestamptz` | NULLABLE | Moderator claim lock expiry |
| `sla_deadline` | `timestamptz` | NULLABLE | Computed at assignment. NULL until assigned |
| `resolution_note` | `text` | NULLABLE | Required when status = RESOLVED |
| `pii_flag` | `boolean` | NOT NULL, DEFAULT false | Triggers moderator-only handling |
| `pii_handled` | `boolean` | NOT NULL, DEFAULT false | Set true after moderator redacts PII |
| `appeal_text` | `text` | NULLABLE | Citizen's appeal reason (if status = APPEAL) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | Updated via trigger on any row change |

**Status Enum** (valid values for `status` column):

| Status | Meaning |
|---|---|
| `NEW` | Just submitted, not yet assigned |
| `IN_REVIEW` | Held for moderator review |
| `APPROVED` | Moderator approved, pending assignment |
| `REJECTED` | Moderator rejected, not visible on map |
| `ASSIGNED` | Assigned to an authority |
| `IN_PROGRESS` | Authority started work |
| `RESOLVED` | Authority marked resolved |
| `REOPENED` | Resolution disputed and reopened |
| `NEEDS_INFO` | Moderator requested more info from citizen |
| `ESCALATED` | Escalated to higher authority |
| `CLOSED` | Closed without resolution (e.g. no citizen response) |
| `FLAGGED` | Flagged for urgent moderator attention |
| `APPEAL` | Citizen appealed a moderator rejection |

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `status`
- INDEX on `trust_score`
- INDEX on `created_at`
- GIST index on `location` (PostGIS spatial queries)
- INDEX on `cluster_id`
- INDEX on `reporter_id`
- INDEX on `assigned_to`

**RLS Rules:**
- Citizens can read their own reports only.
- Authorities can read reports where their `id` is in `assigned_authority_ids`.
- Moderators can read all reports with status IN_REVIEW, FLAGGED, NEEDS_INFO, APPEAL, or trust_score < 50.
- Head moderators can read all reports.
- `pii_flag = true` reports: photos are hidden from all non-moderator reads.

---

### `photos`

All photos associated with reports or clusters.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | |
| `report_id` | `uuid` | NULLABLE, REFERENCES reports(id) | NULL only for cluster cover photos |
| `cluster_id` | `uuid` | NULLABLE, REFERENCES clusters(id) | Set for cluster cover photo |
| `storage_path` | `text` | NOT NULL | Path in Supabase Storage bucket. Generate signed URL at read time. |
| `photo_type` | `text` | NOT NULL | Enum: `before`, `after`, `authority`, `appeal` |
| `photo_timestamp` | `timestamptz` | NULLABLE | EXIF timestamp from device if available |
| `file_size_kb` | `integer` | NULLABLE | Validated at upload: must be >= 50 KB |
| `mime_type` | `text` | NOT NULL | Must be `image/jpeg` or `image/png` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `report_id`
- INDEX on `cluster_id`

**Retention Rules:**
- Default retention: 90 days from `created_at`.
- If `pii_handled = true` on the parent report: 30 days from redaction date.
- Implement via a scheduled Edge Function that deletes from Supabase Storage and sets `storage_path = NULL`.

---

### `clusters`

Groups of reports describing the same real-world problem.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | |
| `category` | `text` | NOT NULL | Must match the shared category of all member reports |
| `cluster_count` | `integer` | NOT NULL, DEFAULT 0 | Number of reports in cluster. Updated on join/leave |
| `status` | `text` | NOT NULL, DEFAULT 'active' | Enum: `active`, `resolved`, `closed`. Mirrors aggregate status of member reports. Set to `resolved` when ALL member reports are RESOLVED. Set to `closed` when ALL member reports are CLOSED or REJECTED. Reverts to `active` if any member report is reopened. Updated by the `on-authority-action` Edge Function whenever a member report's status changes. |
| `min_lat` | `float8` | NOT NULL | Bounding box south edge |
| `min_lon` | `float8` | NOT NULL | Bounding box west edge |
| `max_lat` | `float8` | NOT NULL | Bounding box north edge |
| `max_lon` | `float8` | NOT NULL | Bounding box east edge |
| `aggregate_trust_score` | `integer` | NOT NULL, DEFAULT 0 | Mean TrustScore of member reports, rounded to integer |
| `first_reported_at` | `timestamptz` | NOT NULL | Earliest `created_at` among member reports |
| `last_reported_at` | `timestamptz` | NOT NULL | Latest `created_at` among member reports |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

**Clustering Rules (enforce in Edge Function, not just application code):**
- Two reports belong in the same cluster if: (1) same `category` exact string match, AND (2) distance between coordinates <= 50 meters, AND (3) their `created_at` timestamps are within 7 days of each other.
- Use PostGIS `ST_DWithin` for the 50-meter check:
  ```sql
  ST_DWithin(r1.location::geography, r2.location::geography, 50)
  ```
- A report may belong to at most one cluster (`cluster_id` is a single UUID, not an array).
- Clustering runs immediately after a new report is created.
- Clusters are re-evaluated weekly to merge clusters whose bounding boxes come within 30 meters.

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `category`
- INDEX on `(min_lat, min_lon, max_lat, max_lon)` composite

---

### `authority_actions`

Append-only log of every action an authority takes on a report.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | |
| `report_id` | `uuid` | NOT NULL, REFERENCES reports(id) | |
| `authority_id` | `uuid` | NOT NULL, REFERENCES users(id) | |
| `action_type` | `text` | NOT NULL | Enum: `acknowledge`, `inspect_scheduled`, `work_started`, `work_completed`, `reopen`, `add_note`, `upload_photo` |
| `notes` | `text` | NULLABLE | Required for `work_completed` and `reopen` action types |
| `photo_url` | `text` | NULLABLE | Signed URL to after-photo in Supabase Storage |
| `scheduled_at` | `timestamptz` | NULLABLE | Used for `inspect_scheduled` action type |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `report_id`
- INDEX on `authority_id`

**Validation Rules:**
- `notes` is required (NOT NULL, non-empty string) when `action_type` IN (`work_completed`, `reopen`).
- `photo_url` is required when `action_type` = `work_completed` (after-photo for resolution validation).
- Enforce these in the Edge Function before inserting, not only at the API layer.

---

### `report_events`

Immutable audit trail for every state change on every report.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | |
| `report_id` | `uuid` | NOT NULL, REFERENCES reports(id) | |
| `actor_role` | `text` | NOT NULL | Enum: `citizen`, `authority`, `moderator`, `head_moderator`, `system` |
| `actor_id` | `uuid` | NULLABLE | NULL when actor_role = system |
| `action_type` | `text` | NOT NULL | Free-text describing the event (e.g. `status_changed`, `clustered`, `sla_breached`, `escalated`) |
| `payload` | `jsonb` | NOT NULL, DEFAULT '{}' | Event-specific data. See Payload Schemas below |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `report_id`
- INDEX on `created_at`

**Rules:**
- Never UPDATE or DELETE rows in this table. It is append-only.
- Retain for 2 years from `created_at`.

**Payload Schemas by `action_type`:**

| action_type | payload fields |
|---|---|
| `status_changed` | `{ from: string, to: string, reason?: string }` |
| `clustered` | `{ cluster_id: string, cluster_count: number }` |
| `trust_score_updated` | `{ old_score: number, new_score: number, layer1: number, layer2: number }` |
| `sla_breached` | `{ sla_deadline: string, days_overdue: number }` |
| `escalated` | `{ to_authority_id: string, reason: string }` |
| `moderator_action` | `{ moderator_id: string, action: string, reason: string }` |
| `resolution_disputed` | `{ dispute_count: number, response_count: number, outcome: string }` |

---

### `moderator_audits`

Log of every moderator action on a report.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | |
| `report_id` | `uuid` | NOT NULL, REFERENCES reports(id) | |
| `moderator_id` | `uuid` | NOT NULL, REFERENCES users(id) | |
| `action_type` | `text` | NOT NULL | Enum: `claim`, `approve`, `reject`, `request_more_info`, `escalate_to_authority`, `redact_pii` |
| `moderator_reason` | `text` | NOT NULL | Required for all action types |
| `locked_until` | `timestamptz` | NULLABLE | Set on `claim`. Expires after 30 minutes |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `report_id`
- INDEX on `moderator_id`

**Retain for 2 years.**

---

### `notification_logs`

Log of every notification sent or attempted.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | |
| `recipient_id` | `uuid` | NOT NULL, REFERENCES users(id) | |
| `report_id` | `uuid` | NULLABLE, REFERENCES reports(id) | NULL for system-wide notifications |
| `channel` | `text` | NOT NULL | Enum: `in_app`, `email`, `webhook` |
| `event_type` | `text` | NOT NULL | Matches notification event names from PRD |
| `payload` | `jsonb` | NOT NULL | Full rendered message content |
| `status` | `text` | NOT NULL, DEFAULT 'queued' | Enum: `queued`, `sent`, `failed` |
| `failure_count` | `integer` | NOT NULL, DEFAULT 0 | Incremented on each failed send attempt |
| `sent_at` | `timestamptz` | NULLABLE | Set when status = sent |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT now() | |

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `recipient_id`
- INDEX on `status`
- INDEX on `created_at`

**Rate Limit Rule:** Before inserting a new notification, check:
```sql
SELECT COUNT(*) FROM notification_logs
WHERE recipient_id = :recipient_id
AND created_at > NOW() - INTERVAL '1 hour'
AND status IN ('queued', 'sent');
```
If count >= 5, set status = `queued` and schedule for the next hour boundary. Do not drop the notification.

**Retain for 1 year.**

---

### `dispute_votes`

Tracks individual citizen votes on whether a resolution is genuine (F5). One row per citizen per resolution attempt. Never expose individual rows to authorities.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT gen_random_uuid() | |
| `report_id` | `uuid` | NOT NULL, REFERENCES reports(id) | |
| `citizen_id` | `uuid` | NOT NULL, REFERENCES users(id) | Voting citizen |
| `resolution_attempt` | `integer` | NOT NULL, DEFAULT 1 | Incremented each time a report is re-resolved after reopening. Allows multiple resolution cycles on the same report without polluting earlier votes |
| `vote` | `text` | NOT NULL | Enum: `yes_fixed`, `no_not_fixed` |
| `voted_at` | `timestamptz` | NOT NULL, DEFAULT now() | |
| `window_closes_at` | `timestamptz` | NOT NULL | Set to `resolution_timestamp + INTERVAL '48 hours'`. All votes for this resolution attempt must be cast before this timestamp |

**Unique constraint:** `UNIQUE(report_id, citizen_id, resolution_attempt)` — a citizen may vote exactly once per resolution attempt. Reject duplicate votes with HTTP 409.

**Indexes:**
- PRIMARY KEY on `id`
- INDEX on `report_id`
- INDEX on `(report_id, resolution_attempt)`
- INDEX on `window_closes_at` — used by the cron that evaluates outcomes after the 48-hour window

**Dispute Outcome Logic (run by `evaluate-dispute-window` Edge Function):**

```sql
SELECT
  COUNT(*) FILTER (WHERE vote = 'no_not_fixed') AS D,
  COUNT(*) AS R
FROM dispute_votes
WHERE report_id = :report_id
  AND resolution_attempt = :attempt;
```

Apply F5 rules in this exact order:
1. IF D >= 3 → set report status = `REOPENED`, increment `resolution_attempt`
2. ELSE IF D >= R AND R > 0 → set report status = `REOPENED`, increment `resolution_attempt`
3. ELSE IF D > 0 → set report status = `IN_REVIEW` (send to moderator, do not auto-reopen)
4. ELSE (D = 0) → confirm resolution, status stays `RESOLVED`

**Identity protection:** `dispute_votes` rows must never be returned by any API endpoint accessible to authorities. Authorities may only receive the aggregate count D, never citizen_id or individual votes.

**Hard rule:** Recording a dispute vote must NEVER trigger a reduction in the voting citizen's `trust_score`. This is enforced in the Edge Function — do not add any trust score deduction logic to the dispute vote flow.

**Retain for 2 years.**

---

## Relationships Summary

```
users ──< reports            (one citizen submits many reports)
users ──< authority_actions  (one authority logs many actions)
users ──< moderator_audits   (one moderator reviews many reports)
users ──< dispute_votes      (one citizen casts many votes across reports)
users >─< zones              (many authorities own many zones, via authority_id on zones)
reports >─── clusters        (many reports belong to one cluster)
reports ──< report_events    (one report has many audit events)
reports ──< photos           (one report has many photos)
reports ──< authority_actions
reports ──< moderator_audits
reports ──< notification_logs
reports ──< dispute_votes    (one report has many citizen votes per resolution attempt)
clusters ──< photos          (cluster cover photo)
```

---

## TrustScore Calculation Reference

Stored on each `reports` row as `trust_score`, `trust_layer1`, `trust_layer2`.

### Layer 1 — Content Score (range 0–70)

Calculated fresh for every report on submission. No history required.

| Signal | Rule | Points |
|---|---|---|
| Classifier confidence | `round(classifier_confidence * 50)` | 0–50 |
| GPS accuracy | `geo_accuracy_meters <= 10` | +10 |
| GPS accuracy | `10 < geo_accuracy_meters <= 50` | +5 |
| GPS accuracy | `geo_accuracy_meters > 50` | +0 |
| Photo present | `photo_count >= 1` | +5 |
| Device time match | `abs(device_timestamp - server_timestamp) <= 300s` | +5 |
| Stale photo | `photo_timestamp` older than 30 days | -10 |

After summing: `trust_layer1 = CLAMP(sum, 0, 70)`

### Layer 2 — Behavior Score (range -20 to +30)

Only meaningful after a citizen has history. Contributes 0 if reporter has fewer than 5 past reports with known outcomes.

| Signal | Rule | Points |
|---|---|---|
| Verified account | `verified_account = true` | +10 |
| Prior accepted reports (180 days) | +2 per report | capped at +6 |
| Report upvotes | +1 per upvote | capped at +10 |
| Report downvotes | -2 per downvote | capped at -20 |
| Moderator approve override | single action | +20 (non-stackable) |
| Moderator reject override | single action | -30 (non-stackable) |
| Authority close-within-SLA | applied once per report | +10 |

After summing: `trust_layer2 = CLAMP(sum, -20, 30)`

### Final Score

```
trust_score = CLAMP(trust_layer1 + trust_layer2, 0, 100)
```

### Trust Categories

| Category | Range |
|---|---|
| HighTrust | trust_score >= 80 |
| MediumTrust | 50 <= trust_score <= 79 |
| LowTrust | 20 <= trust_score <= 49 |
| Untrusted | trust_score < 20 |

---

## Priority Score Formula

Used to rank reports on the authority dashboard.

```
PriorityScore = Severity × ln(AffectedCount + 1) × DaysOpen × TrustFactor
```

| Variable | Value |
|---|---|
| `Severity` | Low = 1, Medium = 2, High = 3 |
| `AffectedCount` | Number of citizens attached to this report (or cluster) |
| `DaysOpen` | `(NOW() - reports.created_at)` in fractional days |
| `TrustFactor` | `0.5 + 0.5 * (trust_score / 100)` — range [0.5, 1.0] |
| `ln` | Natural logarithm |

TrustFactor floor is 0.5, never 0. A low-trust report is de-prioritised but never invisible.

---

## SLA Deadline Computation

Stored as `reports.sla_deadline`. Set when `assigned_at` is recorded.

| Severity | Trust Category | SLA Hours |
|---|---|---|
| High | HighTrust | 24 hours |
| High | MediumTrust | 72 hours |
| High | LowTrust / Untrusted | 168 hours (7 days) — requires moderator approval first |
| Medium | HighTrust | 72 hours |
| Medium | MediumTrust | 168 hours (7 days) |
| Low | Any | 336 hours (14 days) |

```
sla_deadline = assigned_at + INTERVAL '<hours> hours'
```

---

## Issue Categories (Canonical List)

The `category` column on `reports` and `clusters` must be one of these exact strings:

```
Pothole / road damage
Water leakage / pipeline issue
Damaged streetlight
Waste management
Drainage / waterlogging
Public property damage
Illegal construction / encroachment
Custom/Other
```

The AI classifier outputs one of these strings. If confidence is too low to pick a category, output `Custom/Other`.

---

## Supabase Storage Buckets

| Bucket Name | Access | Contents |
|---|---|---|
| `report-photos` | Private (signed URLs only) | Before photos submitted by citizens |
| `resolution-photos` | Private (signed URLs only) | After photos uploaded by authorities |
| `appeal-photos` | Private (signed URLs only) | Photos submitted with citizen appeals |

All signed URLs expire after 1 hour. Regenerate on each read request.

---

## Edge Functions Required

The following Edge Functions must be implemented. Each one is triggered by a Supabase database webhook or a cron schedule.

| Function Name | Trigger | Responsibility |
|---|---|---|
| `on-report-created` | DB webhook: INSERT on reports | Run Gemini classifier, compute TrustScore Layer 1, attempt clustering, assign to authority zones, set sla_deadline, send Report Submitted notification |
| `on-authority-action` | DB webhook: INSERT on authority_actions | Update report status, compute new TrustScore if action = work_completed, send notifications |
| `on-moderator-action` | DB webhook: INSERT on moderator_audits | Apply moderator_override to TrustScore, update report status, send notifications, handle 30-min claim lock |
| `check-sla-breaches` | Cron: every 1 hour | Query reports where sla_deadline < NOW() and status NOT IN (RESOLVED, CLOSED). Trigger escalation email via Gmail API. Append sla_breached event to report_events |
| `evaluate-dispute-window` | Cron: every 15 minutes | Query `dispute_votes` where `window_closes_at < NOW()` and outcome not yet evaluated. Apply F5 dispute logic in order (D≥3 → reopen, D≥R → reopen, D>0 → moderator, D=0 → confirm). Update report status and send notifications. **Intentional lag:** evaluation may occur up to 15 minutes after `window_closes_at`. This is acceptable given the 48-hour window. Do not attempt to reduce this lag with real-time triggers. |
| `on-cluster-status-sync` | DB webhook: UPDATE on reports (status field) | When a report's status changes to RESOLVED or CLOSED, recompute the parent cluster's `status` field. Set cluster status = `resolved` if ALL member reports are RESOLVED. Set cluster status = `closed` if ALL member reports are CLOSED or REJECTED. Revert cluster status to `active` if any member is REOPENED. |
| `weekly-city-health-report` | Cron: every Monday 08:00 IST | Aggregate stats across all reports. Generate report via Gemini text generation. Publish to public URL |
| `cluster-merge-weekly` | Cron: every Sunday 02:00 IST | Re-evaluate clusters within 30 meters of each other and merge. Update cluster `status` after merge |

---

## Required PostgreSQL Extensions

Enable these in Supabase before running migrations:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for text search on category/address
```

---

## Notes for Code Generation

- All timestamps are `timestamptz` (UTC). Never use `timestamp without time zone`.
- All IDs are `uuid`. Never use integer auto-increment IDs.
- `updated_at` on `reports` and `clusters` must be maintained by a trigger, not application code.
- Never expose raw storage paths to the client. Always return signed URLs from the Edge Function.
- The `history` of a report is reconstructed by querying `report_events WHERE report_id = :id ORDER BY created_at ASC`. There is no separate `history` column on reports.
- `assigned_authority_ids` on reports is a `uuid[]` array. A report can be assigned to multiple authorities if their zone polygons overlap.
- Disputing a resolution (citizen taps "No, not fixed") must NEVER lower the citizen's trust_score. This is a hard rule from the PRD.
