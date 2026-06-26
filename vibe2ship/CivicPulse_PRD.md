# PRD — CivicPulse

> Note: This document uses simple, explicit language on purpose. Every rule is written so it can be followed exactly, with no guessing and no filling in gaps. If something is not specified here, it is listed under "Do-Later" and should not be invented.

## Problem
People report local problems (potholes, broken streetlights, water leaks, etc.) in many different ways, with no central tracking. Authorities receive scattered, repeated complaints and cannot easily tell which problems are urgent or how many people are affected. There is no automatic way to follow up if a problem stays unresolved.

## Target Users
- **Citizen** — reports a problem, gets notified about its status, earns points/badges.
- **Authority** — sees problems on a dashboard, marks problems as resolved.
- **Moderator** — reviews unclear or disputed cases that the system cannot resolve automatically.

## Core Idea (one sentence)
The app uses AI (Gemini) to classify, group, score, and follow up on civic problems automatically, so that no person has to manually track or escalate a complaint.

---

## Features

### F1 — Reporting a Problem
**Required input from citizen:**
- One photo (required).
- Device GPS location (required).
- Text description (optional).

**What the AI does:**
1. Looks at the photo (and description, if given).
2. Decides which category the problem belongs to (see "Issue Categories" below).
3. Estimates severity: Low, Medium, or High.
4. If confidence is low (the photo is unclear, or there is no description to confirm), the AI asks the citizen one short multiple-choice question instead of guessing. Example: "Is this a leak or an overflow?" with two tap-able options.

**What happens if the photo does not show a real, recognizable civic problem:**
- The AI rejects the report at submission time and shows a message: "We couldn't identify a civic issue in this photo — try again with a clearer shot."
- The report is NOT created. No trust score penalty is given for a rejected submission, because the citizen has not created a problem in the database yet.

---

### F2 — Grouping Reports of the Same Problem (Clustering)
**Goal:** If many people report the same real-world problem, the system should treat it as ONE problem, not many separate problems.

**Exact matching rule:**
- Two reports are considered "the same problem" if ALL THREE of these are true:
  1. They have the same category (exact string match — example: both are "Pothole / road damage").
  2. The distance between their GPS coordinates is 50 meters or less. (This threshold absorbs GPS noise — two reports of the same real pothole will rarely be more than 50 metres apart even with imprecise GPS.) Distance is calculated using the Haversine formula in server-side logic — do not use PostGIS `ST_DWithin`, which requires PostgreSQL and is not available in the Firestore stack.
  3. Their submission timestamps are within 7 days of each other. (This prevents a new pothole from being silently grouped with a long-resolved old one at the same location.)

**What happens when a new report matches an existing problem:**
- The new report is NOT created as a separate problem.
- The citizen who submitted it is added to the list of "affected citizens" on the EXISTING problem.
- The "affected citizen count" for that problem increases by 1.

**What message the citizen sees — exact rule, no exceptions:**
- If affected citizen count (after adding them) = 1 (meaning: they are the only person attached to this problem so far): show "Your report has been received. We'll notify you when it's resolved." Do NOT mention other citizens, because there are none.
- If affected citizen count (after adding them) is 2 or more: show "You've been added to an existing report. [N-1] other citizen(s) have also reported this." (N = the total affected count, so N-1 is "others besides you.")
- This rule prevents the system from ever showing a false crowd size.

**What the authority sees:**
- One problem entry, with a number showing how many citizens are affected. NOT one entry per citizen.

---

### F3 — Trust Score (two layers — do not skip either layer)

**Purpose:** Rank reports by how reliable they appear, WITHOUT blocking or hiding any report. A low trust score changes ORDER ONLY, never visibility or access. A report with a low trust score must still appear on the map and in the authority dashboard — it is just not placed at the top.

**Layer 1 — Content Score (always calculated, works even for a brand-new user with zero history):**
Calculated fresh for every single report, based only on that report's own content:
- Is the photo clear and in focus? (clearer = higher score)
- Is the GPS location precise, or vague/manually placed? (precise = higher score)
- If a description was given, does it match what the photo shows? (matching = higher score; mismatched = lower score)
- Is a description present at all? (present = higher score than no description, but no description is not penalized harshly — F1 already makes description optional)

**Layer 1 exact point values (range 0–70, clamped after summing):**

| Signal | Rule | Points |
|---|---|---|
| Classifier confidence | `round(classifier_confidence × 50)` | 0–50 |
| GPS accuracy | `geo_accuracy_meters <= 10` | +10 |
| GPS accuracy | `10 < geo_accuracy_meters <= 50` | +5 |
| GPS accuracy | `geo_accuracy_meters > 50` | +0 |
| Photo present | `photo_count >= 1` | +5 |
| Device time match | `abs(device_timestamp - server_timestamp) <= 300s` | +5 |
| Stale photo | `photo_timestamp` older than 30 days | -10 |

After summing: `trust_layer1 = CLAMP(sum, 0, 70)`

**Layer 2 — Behavior Score (only applies after a citizen has a history; contributes 0 if not enough history exists):**
- Definition of "enough history": the citizen has at least 5 past reports with a known outcome (confirmed real, or disputed/rejected).
- If a citizen has fewer than 5 past reports with known outcomes: Layer 2 contributes exactly 0 to their score. Final score = Layer 1 score only.
- If a citizen has 5 or more past reports with known outcomes: Layer 2 is calculated using the exact signals and point values below.

**Layer 2 exact point values (range -20 to +30, clamped after summing):**

| Signal | Rule | Points |
|---|---|---|
| Verified account | `verified_account = true` | +10 |
| Prior accepted reports (last 180 days) | +2 per report | capped at +6 total |
| Report upvotes (citizen confirmations) | +1 per upvote | capped at +10 total |
| Report downvotes (citizen rejections) | -2 per downvote | capped at -20 total |
| Moderator approve override | single non-stackable action | +20 |
| Moderator reject override | single non-stackable action | -30 |
| Authority closes report within SLA | applied once per report | +10 |

After summing all signals: `trust_layer2 = CLAMP(sum, -20, 30)`

**Final formula:**
`trust_score = CLAMP(trust_layer1 + trust_layer2, 0, 100)`
(Layer_2 = 0 if history requirement is not met)

**Trust Categories:**

| Category | Range |
|---|---|
| HighTrust | trust_score >= 80 |
| MediumTrust | 50 <= trust_score <= 79 |
| LowTrust | 20 <= trust_score <= 49 |
| Untrusted | trust_score < 20 |

**Hard rule — never violate this:** Disputing a resolution (F5) or flagging a Safety Concern (see Do-Later) must NEVER lower a citizen's trust score, no matter the outcome of the dispute. This rule exists so citizens are never afraid to speak up.

---

### F4 — Auto-Escalation
**Rule:** Each report has a maximum time allowed to stay open before escalation (the "SLA deadline"). The deadline is set at the moment a report is assigned to an authority, based on the report's severity and trust category.

**SLA Matrix (time from assignment to first authority action):**

| Severity | Trust Category | SLA |
|---|---|---|
| High | HighTrust (score ≥ 80) | 24 hours |
| High | MediumTrust (score 50–79) | 72 hours |
| High | LowTrust / Untrusted (score < 50) | 7 days — requires moderator approval before assignment |
| Medium | HighTrust | 72 hours |
| Medium | MediumTrust | 7 days |
| Low | Any | 14 days |

"First authority action" means any logged action with type: `acknowledge`, `inspect_scheduled`, `work_started`, or `work_completed`.

**What happens when a problem passes its SLA deadline without a first authority action:**
1. The AI automatically writes an email (it is not written by a human).
2. The email is sent via the Gmail API to the next authority contact.
3. The email must include: category, photo, number of affected citizens, number of days it has been open, and the fact that the SLA was missed.
4. Every citizen attached to the problem is notified that escalation happened.

---

### F5 — Marking a Problem Resolved (with Anti-Corruption Safeguards)

**Step-by-step resolution flow:**
1. Authority marks the problem "resolved" and uploads one "after" photo.
2. The AI compares the "before" photo (from F1) and the "after" photo to check if the fix looks real.
3. Every citizen attached to this problem is notified and asked: "Is this actually fixed?" with two buttons: "Yes, fixed" / "No, not fixed."
4. Citizens have 48 hours to respond. No response within 48 hours = does not count as a vote either way.

**Exact rule for what happens after 48 hours — follow this exactly, in this order:**
1. Count how many citizens tapped "No, not fixed." Call this number D.
2. Count how many citizens responded at all (Yes + No). Call this number R.
3. IF D >= 3: the problem automatically reopens (status = REOPENED).
4. ELSE IF D >= R AND R > 0: the problem automatically reopens. (This rule exists for small groups where fewer than 3 people are attached, so the normal 3-person rule could never be reached.)
5. ELSE IF D > 0 but neither rule above is true: the problem is sent to a Moderator for manual review (status = IN_REVIEW). It does NOT auto-reopen and does NOT auto-close.
6. ELSE (D = 0): the resolution stands as confirmed (status = RESOLVED, final).

**Identity protection rules — follow exactly:**
- The authority must NEVER see which specific citizen disputed a resolution. The authority only ever sees a total count (example: "3 citizens disputed this").
- The authority must NEVER see the name or identity of who originally reported a problem. The authority dashboard shows only: category, photo, location, severity, affected citizen count. It never shows citizen names, at any stage, not just during disputes.
- Trust score and points are visible only to the citizen who earned them. They are never shown to the authority.

---

### F6 — Gamification
- Citizens earn points for: submitting an accepted report (not a rejected one — see F1), being added as an affected citizen, confirming or disputing a resolution.
- Badges: first report in an area, multiple reports in a row over time ("streak"), high trust score, a report that led to a confirmed resolution.
- A leaderboard is shown, grouped by city zone.

---

### F7 — Live Map
- Shows all problems as pins on a Google Map.
- Pin size/color reflects: how many citizens are affected + severity + how many days it has been open.
- A heatmap layer shows areas with many problems clustered together.
- Citizens can filter the map by category, status (open/resolved), and severity.

---

### F8 — Authority Dashboard
**Priority score formula — use exactly this formula, do not substitute a different one:**

`PriorityScore = Severity × ln(AffectedCount + 1) × DaysOpen × TrustFactor`

(`ln` = natural logarithm. Used on purpose so that one extremely popular problem does not completely bury all others — the logarithm makes the effect of a very high affected count grow slowly instead of linearly.)

| Variable | Value |
|---|---|
| `Severity` | Low = 1, Medium = 2, High = 3 |
| `AffectedCount` | Number of citizens attached to this report or cluster |
| `DaysOpen` | `(NOW() - reports.created_at)` in fractional days |
| `TrustFactor` | `0.5 + 0.5 × (trust_score / 100)` — range [0.5, 1.0] |

TrustFactor floor is 0.5, never 0. A low-trust report is de-prioritised but never invisible.

- Problems are listed in order from highest PriorityScore to lowest.
- Each problem entry shows: a countdown to its SLA deadline, its escalation history (if escalated), and current resolution status.
- A separate metrics view shows resolution rate per city zone.

---

### F9 — Weekly City Health Report (autonomous, no human involved)
- Once per week, on a fixed schedule (every Monday 08:00), the AI generates a public report automatically. No person presses a button to create it.
- The report must include: top unresolved problems, worst-performing zones, total affected citizens, how many SLA deadlines were missed, and resolution rate per authority/zone.
- The report is public — anyone can view it, including citizens and the press.

---

## Issue Categories

**Required for MVP (the hackathon build must support all of these):**
1. Pothole / road damage
2. Water leakage / pipeline issue
3. Damaged streetlight
4. Waste management (overflowing bins, illegal dumping)
5. Drainage / waterlogging
6. Public property damage (benches, playground equipment, signage)
7. Illegal construction / encroachment

**Always available, separate handling:**
- **Custom/Other** — citizen can pick this if no category fits. AI still tries to classify the photo but is allowed to leave it as "Other" if nothing matches. Do not force a wrong category onto it.
- **Safety Concern** — see Do-Later. This category does NOT go through F4 (SLA/escalation) or the normal authority dashboard. It is handled completely separately.

**Do-Later (not required for the 7-day MVP — do not build unless specifically asked):**
- Stray animal concerns
- Traffic signal malfunction
- Tree / fallen branch hazards

---

## Do-Later — Designed But Not Built for the Hackathon Demo
These items are intentionally NOT part of the MVP build. They are documented here so the design is not forgotten, but they should not be implemented unless explicitly requested later.

1. **Safety Concern reporting flow** — a category where a citizen can report intimidation or retaliation (example: "someone threatened me after I reported a problem"). This bypasses the normal authority chain and routes to a separate oversight contact instead. The AI should be able to detect this intent even inside a normal report's description text and suggest filing it separately. For the hackathon demo, if built at all, route it to a simplified generic inbox rather than a real oversight body.
2. **Random delay before a reopened problem becomes visible** — instead of instantly flipping status back to "open" after a dispute, wait a random few hours first. This makes it harder for an authority to guess which specific action (or person) caused the reopening.
3. **Per-category SLA overrides** — the current SLA matrix is based on severity × trust category. Per-category overrides (e.g. a shorter SLA specifically for broken streetlights) are a post-hackathon refinement.
4. **Stray animal concerns, traffic signal malfunction, tree/branch hazard categories.**
5. **Real-world routing for escalation emails into an actual municipal work-order system** (such as Cityworks or Lucity) — out of scope for the hackathon.

---

## AI Touchpoints Summary (for "Google Technologies Used" / "Agentic Depth" sections of submission)
- **Gemini Vision:** classifies photo into category, estimates severity, compares before/after photos for resolution validation, checks if a photo shows a real civic issue at all.
- **Gemini function calling:** provides inputs used in priority ranking (F8). Note: clustering (F2) is deterministic logic using the Haversine formula — not an AI call. Trust score Layer 1 (F3) is pure arithmetic on known fields — not an AI call. Trust score Layer 2 (F3) is also deterministic rule-based logic — not an AI call.
- **Gemini text generation:** writes escalation emails (F4), writes the Weekly City Health Report (F9).
- **Gemini scheduled/autonomous runs:** SLA monitoring and escalation trigger (F4), Weekly City Health Report generation (F9) — both run without a human pressing a button.
- **Gemini intent detection:** asks a clarifying question when classification confidence is low (F1).

---

## Success Metrics
- Average time to resolve a problem, tracked over weeks (should decrease).
- Percentage of escalation emails that lead to action.
- Distribution of citizen trust scores.
- Ratio of clustered reports to brand-new reports (higher ratio = clustering is working).
- Percentage of problems resolved within their SLA deadline.

## Known Limitations (state these honestly, do not hide them)
- A small group of citizens could repeatedly dispute resolutions to delay a specific authority. This is partly limited by the rule in F5 (a small number of disputes that doesn't meet the auto-reopen threshold goes to a moderator, not an automatic reopen), but it is not completely solved.
- Trust score Layer 2 (behavior history) provides no value until citizens have built up a report history. In a brand-new system (such as a 7-day hackathon demo), Layer 2 will almost always contribute 0, and Layer 1 (content-only scoring) will do all the work. This is expected and acceptable, not a bug.
