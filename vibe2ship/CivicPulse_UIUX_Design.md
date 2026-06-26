# UI/UX Design — CivicPulse

> This document defines the complete visual design system and screen-by-screen UI specification for CivicPulse.
> It is written for an AI code generator. Every design decision is explicit. Do not invent components, colors, or layouts not listed here.
> This document is used alongside the App Flow document — the App Flow defines WHAT each screen contains, this document defines HOW it looks.

---

## 1. Design Philosophy

CivicPulse is a civic accountability tool. The visual language must communicate two things simultaneously: **trustworthiness** (this is a serious system that handles real complaints) and **accessibility** (any citizen, regardless of technical literacy, can use it without confusion).

The design is not playful. It is not corporate. It is clean, direct, and purposeful — closer to a well-designed government service than a consumer app. Every decorative element must earn its place.

**Three guiding principles:**
1. **Clarity over cleverness.** Labels say exactly what the thing does. Icons always have text labels. No mystery meat navigation.
2. **Status is always visible.** A citizen should never wonder what is happening with their report. Status badges, timers, and progress indicators are prominent.
3. **Trust through transparency.** Show the citizen what the AI decided and why (category, severity, confidence). Don't hide the system.

---

## 2. Color System

### Primary Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#1A56DB` | Primary buttons, active tab indicators, links |
| `--color-primary-dark` | `#1042B0` | Primary button pressed state |
| `--color-primary-light` | `#E8EFFF` | Primary button backgrounds on dark text, selected filter chips |
| `--color-surface` | `#FFFFFF` | Card backgrounds, sheet backgrounds |
| `--color-background` | `#F4F6F9` | App background (light grey, not pure white) |
| `--color-border` | `#E2E6EA` | Card borders, dividers, input borders |
| `--color-text-primary` | `#111827` | Headings, body text |
| `--color-text-secondary` | `#6B7280` | Captions, metadata, placeholder text |
| `--color-text-inverse` | `#FFFFFF` | Text on dark/primary backgrounds |

### Severity Colors

These are used on pins, badges, and status indicators throughout the app. They must be consistent across every screen.

| Token | Hex | Usage |
|---|---|---|
| `--color-severity-high` | `#DC2626` | High severity badge, map pin |
| `--color-severity-high-bg` | `#FEF2F2` | High severity badge background |
| `--color-severity-medium` | `#D97706` | Medium severity badge, map pin |
| `--color-severity-medium-bg` | `#FFFBEB` | Medium severity badge background |
| `--color-severity-low` | `#16A34A` | Low severity badge, map pin |
| `--color-severity-low-bg` | `#F0FDF4` | Low severity badge background |

### Status Colors

| Token | Hex | Usage |
|---|---|---|
| `--color-status-new` | `#6B7280` | NEW, AWAITING_CLARIFICATION |
| `--color-status-active` | `#1A56DB` | ASSIGNED, IN_PROGRESS, APPROVED |
| `--color-status-warning` | `#D97706` | AWAITING_CONFIRMATION, IN_REVIEW, ESCALATED |
| `--color-status-success` | `#16A34A` | RESOLVED |
| `--color-status-danger` | `#DC2626` | REOPENED, REJECTED |

> Note on `APPROVED`: this status is only reachable via a moderator action. It will only appear in the Moderator Review Screen's status timeline — never on citizen or authority screens in normal flow. Render it with `--color-status-active` if it appears in a timeline, but do not add it to any authority or citizen UI as a visible state.

### Accent

| Token | Hex | Usage |
|---|---|---|
| `--color-accent` | `#0E9F6E` | Gamification points, badge earned, trust score HighTrust |

---

## 3. Typography

### Typefaces

- **Display / Headings:** `Inter` — weights 600 (semibold) and 700 (bold). Used for screen titles, card headings, and numeric data.
- **Body:** `Inter` — weight 400 (regular) and 500 (medium). Used for all body text, labels, and descriptions.
- **Monospace (data only):** `JetBrains Mono` — weight 400. Used exclusively for report IDs, trust scores, and priority scores where precision matters.

Use Inter from Google Fonts. JetBrains Mono from Google Fonts.

### Type Scale

| Role | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `screen-title` | 22px | 700 | 28px | Screen headers |
| `section-title` | 18px | 600 | 24px | Card headers, section headings |
| `body-lg` | 16px | 400 | 24px | Primary body text |
| `body-md` | 14px | 400 | 20px | Secondary body, descriptions |
| `label` | 14px | 500 | 20px | Button labels, form labels, tab labels |
| `caption` | 12px | 400 | 16px | Timestamps, metadata, helper text |
| `data` | 14px | 400 | 20px | Monospace data values (JetBrains Mono) |
| `data-lg` | 24px | 700 | 30px | Large numeric displays (trust score, points) |

---

## 4. Spacing System

Use an 8px base grid. All spacing values are multiples of 4px.

| Token | Value | Usage |
|---|---|---|
| `--space-xs` | 4px | Icon-to-label gaps, tight inline spacing |
| `--space-sm` | 8px | Internal card padding (tight), badge padding |
| `--space-md` | 16px | Standard card padding, form field spacing |
| `--space-lg` | 24px | Section spacing, screen padding |
| `--space-xl` | 32px | Between major sections |
| `--space-xxl` | 48px | Bottom nav clearance, hero spacing |

Screen horizontal padding: **16px** on both sides. Apply to all content except full-bleed maps and photos.

---

## 5. Component Library

### 5.1 Buttons

**Primary Button**
- Background: `--color-primary`
- Text: `--color-text-inverse`, `label` size
- Border radius: 8px
- Height: 48px
- Padding: 0 24px
- Pressed state: `--color-primary-dark`
- Disabled state: background `#D1D5DB`, text `#9CA3AF`
- Full width on mobile unless explicitly inline

**Secondary Button**
- Background: transparent
- Border: 1.5px solid `--color-primary`
- Text: `--color-primary`, `label` size
- Border radius: 8px
- Height: 48px

**Destructive Button**
- Background: `--color-severity-high`
- Text: white
- Same dimensions as Primary Button
- Used for: "Reopen Issue," "Confirm Redact"

**Text Button / Link**
- No background, no border
- Text: `--color-primary`, underline on press
- Used for: "Forgot password?", "Maybe Later", secondary actions

**Icon Button**
- 40×40px tap target
- Icon centered, no label
- Used only in navigation bars and map overlays where space is severely constrained — always add a `accessibilityLabel`

### 5.2 Cards

**Standard Card**
- Background: `--color-surface`
- Border: 1px solid `--color-border`
- Border radius: 12px
- Padding: 16px
- Shadow: `0 1px 3px rgba(0,0,0,0.08)`
- Used for: report list items, cluster summaries, leaderboard entries

**Elevated Card**
- Same as Standard Card but shadow: `0 4px 12px rgba(0,0,0,0.12)`
- Used for: bottom sheets, modal content

### 5.3 Badges

Badges are inline pill-shaped labels. Always include both a background color and text color — never rely on color alone to convey meaning (add text).

**Severity Badge**
```
[High]   background: --color-severity-high-bg,   text: --color-severity-high,   font: label 12px
[Medium] background: --color-severity-medium-bg,  text: --color-severity-medium, font: label 12px
[Low]    background: --color-severity-low-bg,     text: --color-severity-low,    font: label 12px
```
Padding: 2px 8px. Border radius: 100px (pill).

**Status Badge**
Same pill shape. Color maps to Status Colors section above.

```
[NEW]                 color-status-new
[ASSIGNED]            color-status-active
[IN_PROGRESS]         color-status-active
[AWAITING_CONFIRM]    color-status-warning  — label text: "Awaiting Confirmation"
[IN_REVIEW]           color-status-warning
[ESCALATED]           color-status-warning
[RESOLVED]            color-status-success
[REOPENED]            color-status-danger
[REJECTED]            color-status-danger
```

**Trust Category Badge**
```
[HighTrust]   background: #ECFDF5, text: #065F46
[MediumTrust] background: #EFF6FF, text: #1E40AF
[LowTrust]    background: #FFFBEB, text: #92400E
[Untrusted]   background: #FEF2F2, text: #991B1B
```

### 5.4 Form Inputs

**Text Input**
- Height: 48px
- Border: 1.5px solid `--color-border`
- Border radius: 8px
- Padding: 0 16px
- Font: `body-lg`
- Focus border: `--color-primary`, 2px
- Error border: `--color-severity-high`, 2px
- Error message: `caption` size, `--color-severity-high` color, appears below the field

**Text Area**
- Same styling as Text Input
- Min height: 96px
- Used for: description field, moderator reason field

**Photo Upload Area**
- Dashed border: 2px dashed `--color-border`
- Border radius: 12px
- Background: `--color-background`
- Center content: camera icon (32px) + label "Take Photo" or thumbnail if photo selected
- When photo selected: show thumbnail at full width, rounded 12px, with an "×" remove button top-right

### 5.5 Bottom Navigation Bar

Four tabs: Home, Map, Report, Profile.
- Background: `--color-surface`
- Top border: 1px solid `--color-border`
- Tab width: equal distribution
- Active tab: icon + label in `--color-primary`
- Inactive tab: icon + label in `--color-text-secondary`
- Report tab: distinct — use a floating action button style (circular, `--color-primary` background, white icon, 56px diameter, slightly elevated above the bar)
- Icon size: 24px
- Label size: `caption` (10px), shown below icon

### 5.6 Bottom Sheet

Used for map pin summaries and confirmation dialogs.
- Background: `--color-surface`
- Top border radius: 16px
- Handle bar: 4px × 32px, `--color-border`, centered, 8px below top edge
- Padding: 24px
- Backdrop: semi-transparent black `rgba(0,0,0,0.4)`
- Animation: slides up from bottom, 250ms ease-out

### 5.7 Status Timeline

Used on Report Detail Screen to show the history of a report.
- Vertical list of events
- Each event: colored dot (left) + action label (bold) + timestamp (caption, right-aligned)
- Connector line between dots: `--color-border`, 1px, dashed
- Most recent event at top
- Dot color maps to Status Colors

### 5.8 SLA Countdown Timer

Used on Authority Dashboard items and Issue Detail Screen.
- Format: `Xd Xh remaining` or `Overdue by Xd Xh`
- Color: `--color-status-warning` when < 25% of SLA time remaining
- Color: `--color-severity-high` when overdue
- Color: `--color-text-secondary` when plenty of time remains
- Font: `caption`, monospace

### 5.9 Toast / Inline Notification

**Success toast:** green left border (4px), `--color-status-success` icon, body text
**Error toast:** red left border, `--color-severity-high` icon, body text
**Info toast:** blue left border, `--color-primary` icon, body text

- Appears at the top of the screen, below the status bar
- Auto-dismisses after 4 seconds
- Slides in from top, slides out upward

### 5.10 Loading States

**Spinner:** Standard activity indicator in `--color-primary`. Used for: Submission Pending Screen, role router loading.

**Skeleton Loader:** Used for list screens (dashboard, queue) while data loads. Show 3 grey placeholder cards with animated shimmer. Do not show an empty state until data has had a chance to load.

**Progress Indicator:** Used during photo upload. Linear bar below the photo thumbnail, `--color-primary` fill, animates from 0 to 100%.

---

## 6. Screen-by-Screen UI Specification

### 6.1 Splash Screen
- Full-screen `--color-primary` background
- App logo: white, centered, 120px wide
- No text
- Duration: 1.5 seconds, then fades out

### 6.2 Welcome Screen
- Background: `--color-background`
- Top half: illustration or large app logo (centered, 160px), app name in `screen-title`, tagline in `body-md` `--color-text-secondary`
- Tagline: "Report local problems. Track them to resolution."
- Bottom half: two buttons, full width, stacked with 12px gap
  - "Sign In" — Primary Button
  - "Create Account" — Secondary Button
- Bottom padding: 48px (safe area)

### 6.3 Sign In Screen
- Header: back arrow (top left) + title "Sign In" (`screen-title`)
- "Continue with Google" button: Secondary Button style, Google logo icon (left), full width, at top of form
- Divider: horizontal line with "or" centered in `caption` text
- Email field, Password field (with show/hide toggle)
- "Forgot password?" — Text Button, right-aligned below password field
- "Sign In" — Primary Button, full width, below fields
- Inline error: appears between password field and Sign In button

### 6.4 Create Account Screen
- Header: back arrow + "Create Account"
- "Continue with Google" button at top
- Divider "or"
- Fields: Display Name, Email, Password, Confirm Password
- All fields stacked with 12px gap
- "Create Account" — Primary Button, full width
- Inline field errors appear directly below each invalid field

### 6.5 Citizen Home Screen
- Bottom navigation bar (fixed)
- **Home tab content:**
  - Section title "Your Activity" + activity feed
  - Feed items are Standard Cards: status badge (left) + category (bold) + address (caption) + time ago (caption, right-aligned)
  - Empty state: illustration + "No activity yet. Submit your first report."
  - Leaderboard teaser: small card at bottom showing "You are #X in [Zone Name]"
- FAB (Report tab button) is always visible regardless of active tab

### 6.6 Report Screen
- Full-screen layout, no bottom nav on this screen
- Header: "×" close button (top left) + title "Report a Problem"
- **Photo section (top half):**
  - Photo Upload Area (full width, 200px tall when empty)
  - When photo taken: full-width thumbnail, 220px tall, with "Retake" text button overlay (bottom right of photo)
- **Details section (bottom half):**
  - Location row: pin icon + address text + small map thumbnail (60×60px, tappable)
    - If GPS loading: "Detecting location…" with spinner
    - If GPS unavailable: warning text in `--color-severity-high`, no map thumbnail
  - Description field (optional), placeholder "Describe the issue (optional)"
  - Privacy note: `caption` size, `--color-text-secondary`: "Your photo and location will be shared with city authorities. Photos stored up to 90 days."
- Footer: "Submit Report" Primary Button (full width, pinned to bottom, above safe area)
  - Disabled state if photo or location missing

### 6.7 Submission Pending Screen
- Centered layout, no navigation
- Large spinner (48px, `--color-primary`)
- "Analysing your photo…" in `body-lg`
- Caption: "This usually takes a few seconds."
- No buttons — citizen waits

### 6.8 Rejection Screen
- Centered layout
- Large icon: camera with ×, in `--color-severity-high` (48px)
- Heading: "Photo not recognised" (`section-title`)
- Body: "We couldn't identify a civic issue in this photo — try again with a clearer shot." (`body-md`, `--color-text-secondary`)
- Two buttons, stacked: "Try Again" (Primary), "Go Home" (Secondary)

### 6.9 Clarification Screen
- Header: "×" close button (top left) + title "One quick question"
- Body text: the AI-generated clarification question, `body-lg`
- Answer options: each rendered as a full-width Secondary Button, stacked with 8px gap
- No free-text field — only the provided option buttons
- No skip button. If the citizen wants to abandon, tapping "×" returns to the Report Screen. The report document remains in AWAITING_CLARIFICATION in Firestore until the citizen answers or the document is cleaned up. Do not add any other exit path.

### 6.10 Clustered Confirmation Screen
- Centered layout
- Icon: checkmark in circle, `--color-accent` (48px)
- Heading: "Report Received" (`section-title`)
- Body: the exact N-1 message from PRD F2 (`body-md`)
- Two buttons: "View Report" (Primary), "Go Home" (Secondary)

### 6.11 New Report Confirmation Screen
- Same layout as Clustered Confirmation Screen
- Additional info row below body text: category label + severity badge + address in `caption`
- Two buttons: "View Report" (Primary), "Go Home" (Secondary)

### 6.12 Report Detail Screen (Citizen)
- Header: back arrow + "Report Detail"
- **Photo section:** before photo, full width, 220px tall, rounded 12px
  - If status = RESOLVED: show before + after side by side (equal width, 8px gap)
- **Info section (card):**
  - Row 1: category (bold, `body-lg`) + severity badge (right-aligned)
  - Row 2: status badge
  - Row 3: location pin icon + address (`body-md`)
  - Row 4: affected count icon + "X citizens affected" + days open (right-aligned, `caption`)
  - Row 5 (if resolved): AI validation result — "Fix appears genuine" or "Fix may be incomplete" in appropriate color
- **Dispute inline section** (only if status = AWAITING_CONFIRMATION and citizen is affected):
  - Card with amber left border (4px)
  - "Is this actually fixed?" heading
  - Countdown timer
  - Two buttons side by side: "Yes, fixed" (Primary) and "No, not fixed" (Destructive)
- **Status timeline:** below info card, scrollable
- No citizen names anywhere

### 6.13 Dispute Screen
- Header: "Is this fixed?" + countdown timer (right-aligned)
- **Photos section:** two photos side by side — "Before" label (caption) above left, "After" label above right
- **AI assessment card:** amber border, "AI Assessment: [fix_appears_genuine text]" with confidence percentage
- Divider
- Question: "Is this issue actually fixed?" (`section-title`, centered)
- Two full-width buttons stacked: "Yes, fixed" (Primary), "No, not fixed" (Destructive)

### 6.14 Vote Confirmed Screen
- Centered layout
- Checkmark icon (48px, `--color-accent`)
- Message text (one of two exact strings from App Flow FLOW 1B)
- "Back to Home" — Primary Button

### 6.15 Map Screen
- Full-screen Google Map (no padding)
- **Filter bar (top, overlaid on map):** horizontal scroll row of filter chips
  - Filter chips: pill shape, 32px tall, `--color-surface` background with `--color-border` border when inactive, `--color-primary-light` background with `--color-primary` border when active
  - Chips: "All Categories", "All Severities", "Open", "Resolved"
- **Heatmap toggle (top right):** icon button, `--color-surface` background, shadow
- **Map pins:** circular, 16px default diameter, scales up to 28px at max affected_count
  - Color: `--color-severity-high/medium/low` based on severity
  - Number inside pin showing affected_count (hidden if count = 1)
- **Bottom sheet (on pin tap):**
  - Handle bar at top
  - Category bold + severity badge
  - Affected count + days open
  - Address
  - "View Full Report" — Primary Button, full width

### 6.16 Profile Screen
- Header: display name (`screen-title`) + "Zone: [zone name]" (`caption`)
- **Trust score card:** large display of trust score number (monospace, 48px bold) + trust category badge beside it
  - Subtext: "Your report reliability score" (`caption`)
- **Points card:** total points in large mono + "pts" label, badge icons row below (greyed out if not earned)
- **Leaderboard card:** "Your Zone Ranking" — citizen's rank + top 5 list
  - Each entry: rank number + display name initials avatar + points
  - Current citizen row highlighted with `--color-primary-light` background
- **Settings section:** notification toggle (weekly report) + sign out text button

### 6.17 Authority Dashboard Screen
- Header: "Dashboard" + zone name (`caption`)
- Filter bar: horizontal chips (Category, Severity, Status)
- "Metrics" tab — top right text button
- **List items (Standard Cards):**
  - Row 1: category icon (20px) + category name (bold) + severity badge (right-aligned)
  - Row 2: X citizens affected + SLA countdown (right-aligned, color-coded)
  - Row 3: status badge + days open (`caption`, right-aligned)
  - No citizen names or UIDs anywhere
- Sorted by PriorityScore descending — no sort UI needed (this is the only sort order)
- Empty state: "No issues assigned to your zone."

### 6.18 Issue Detail Screen (Authority)
- Header: back arrow + category name
- **Before photo:** full width, 220px tall
- **Info card:**
  - Severity badge + status badge (row)
  - Affected count, days open, SLA countdown (prominent, color-coded)
  - Location address
  - Priority score (monospace, `caption`, `--color-text-secondary`)
  - Escalation history if applicable (amber info card)
- **Action button section (pinned to bottom):**
  - One button shown at a time based on status (see App Flow FLOW 2A)
  - APPROVED → "Acknowledge" (Primary)
  - ASSIGNED → "Start Work" (Primary)
  - IN_PROGRESS → "Mark Resolved" (Primary)
  - AWAITING_CONFIRMATION → info text only: "X citizens disputed — awaiting window close"
  - REOPENED → "Mark Resolved" (Primary)
  - RESOLVED → no button, show "Resolved [date]" label
  - ESCALATED → "Mark Resolved" (Primary) + escalation info card above
- No citizen names or UIDs on this screen

### 6.19 Mark Resolved Screen
- Header: back arrow + "Mark as Resolved"
- Instruction text: "Upload a photo showing the issue has been fixed." (`body-md`)
- Before photo (small reference thumbnail, 80×80px, labelled "Before")
- Photo upload area (full width, 200px) for after photo
- "Submit Resolution" — Primary Button, full width, pinned to bottom
  - Disabled until after photo uploaded
  - Shows upload progress bar during upload

### 6.20 Resolution Submitted Screen
- Centered layout
- Checkmark icon (48px, `--color-accent`)
- "Resolution Submitted" (`section-title`)
- "Citizens have 48 hours to confirm. You'll be notified of the outcome." (`body-md`, `--color-text-secondary`)
- "Back to Dashboard" — Primary Button

### 6.21 Metrics Screen
- Header: "Metrics" + zone name
- **Stats row (top):** 4 stat tiles in 2×2 grid
  - Total Assigned, Total Resolved, SLA Compliance %, Avg Resolution Days
  - Each tile: Standard Card, large mono number + label (`caption`)
- **Resolution rate chart:** simple horizontal bar chart per sub-zone (use a basic SVG or React Native chart library)
- **Link:** "View City Health Report" — Text Button at bottom

### 6.22 Moderator Queue Screen
- Header: "Review Queue" + item count badge
- List of IN_REVIEW reports, oldest first
- **List items (Standard Cards):**
  - Row 1: category + severity badge
  - Row 2: reason tag (pill) — "Dispute", "PII Flag", or "Low Confidence"
  - Row 3: days open + "Claimed" badge if locked by another moderator
- Locked items shown at reduced opacity (0.5) with "In Review" overlay label

### 6.23 Moderator Review Screen
- Header: back arrow + "Review Case" + lock timer (right-aligned, `--color-status-warning`)
- Before photo + after photo (side by side if resolution was attempted, or before only)
- **Case info card:** category, severity, affected count, location, full status timeline
- **AI assessment (if resolution attempted):** amber card with `fix_appears_genuine` result + confidence
- **Dispute counts (if dispute):** "D = X disputes / R = X total responses" — aggregate only, no names
- **Action section (pinned to bottom):**
  - Buttons shown based on case type (see App Flow FLOW 3A)
  - All actions require a reason field (minimum 10 characters) — inline below the button, appears when button is tapped, must be filled before confirm is enabled
  - Confirm button appears only after reason is entered

### 6.24 Action Confirmed Screen
- Centered layout
- Checkmark icon (48px, `--color-accent`)
- "Action recorded." (`section-title`)
- "Back to Queue" — Primary Button

### 6.25 Health Report Screen
- Publicly accessible, no auth required
- Header: "City Health Report" + week date range (`caption`)
- Report text in `body-md`, full width, scrollable
- Section dividers between stats sections
- "Previous Reports" — text button at bottom, opens a list of past reports

### 6.26 Notification Permission Screen
- Centered layout, shown once
- Bell icon (64px, `--color-primary`)
- "Stay updated on your reports" (`section-title`)
- "Enable notifications to get updates when your report status changes or issues are resolved." (`body-md`, `--color-text-secondary`)
- "Enable Notifications" — Primary Button
- "Maybe Later" — Text Button below

---

## 7. Map Pin Design

Pins must be visually distinct at a glance. Use this exact visual system:

```
Small pin (1 citizen):    Circle, 16px, solid severity color, no number
Medium pin (2–9):         Circle, 20px, solid severity color, white number inside
Large pin (10–49):        Circle, 24px, solid severity color, white number inside
XL pin (50+):             Circle, 28px, solid severity color, white number inside, subtle pulse animation
```

Resolved clusters: show with `--color-border` grey color regardless of severity (grey = done).
Heatmap weight: use `priority_score` as the weight value for Google Maps Heatmap Layer.

---

## 8. Iconography

Use **Lucide React Native** for all icons. Do not mix icon libraries. Below are the specific icons assigned to each concept — do not substitute:

| Concept | Lucide Icon |
|---|---|
| Home tab | `Home` |
| Map tab | `Map` |
| Report tab | `Plus` (inside FAB circle) |
| Profile tab | `User` |
| Location / address | `MapPin` |
| Affected citizens | `Users` |
| Calendar / days open | `Clock` |
| Severity | `AlertTriangle` |
| Category — Pothole | `Construction` |
| Category — Water | `Droplets` |
| Category — Streetlight | `Lightbulb` |
| Category — Waste | `Trash2` |
| Category — Drainage | `Waves` |
| Category — Property | `Building2` |
| Category — Construction | `HardHat` |
| Category — Other | `HelpCircle` |
| Resolved / success | `CheckCircle2` |
| Rejected / error | `XCircle` |
| In review | `Clock` |
| Escalated | `AlertOctagon` |
| Reopened | `RotateCcw` |
| Trust score | `Shield` |
| Points | `Star` |
| Badge earned | `Award` |
| Notification | `Bell` |
| Filter | `SlidersHorizontal` |
| Heatmap toggle | `Layers` |
| Back arrow | `ChevronLeft` |
| Close (×) | `X` |

---

## 9. Interaction Patterns

### Confirmation Modals
Required for destructive or irreversible actions: "Confirm Redact," authority "Mark Resolved," moderator "Reopen Issue."
- Modal title + description of what will happen
- Two buttons: confirm (Primary or Destructive) + "Cancel" (Secondary)
- Backdrop tap dismisses only for non-destructive actions. Destructive actions (Redact Photo) require explicit "Cancel" tap.

### Pull to Refresh
Available on: Authority Dashboard, Moderator Queue, Citizen Home activity feed.
Standard React Native RefreshControl using `--color-primary` tint color.

### Empty States
Every list screen has an empty state. Format: centered icon (48px, `--color-text-secondary`) + heading + subtext. Never show a blank screen.

| Screen | Empty state text |
|---|---|
| Citizen Home feed | "No activity yet. Submit your first report." |
| Authority Dashboard | "No issues assigned to your zone." |
| Moderator Queue | "Queue is clear. No cases to review." |
| Map (filtered) | "No issues match your filters. Try adjusting them." |

### Error States
Network errors show a non-blocking top banner (see Toast component). Submission errors are inline. Permission errors show a generic message — never expose technical details to the user.

### Haptic Feedback
On: successful vote submission, report accepted confirmation, badge earned. Use React Native's `Vibration` or Expo Haptics for light impact feedback on these three moments only.

---

## 10. Accessibility

- Minimum tap target: 44×44px for all interactive elements
- Color contrast: all text meets WCAG AA (4.5:1 for body text, 3:1 for large text)
- All icons have `accessibilityLabel` props
- Status badges convey meaning through text, not color alone
- Form inputs have `accessibilityHint` describing what is expected
- `reduceMotion` check before any animation — disable or simplify if user has set reduce motion preference

---

## 11. Notes for Code Generation

- All colors are defined as constants in `src/config/theme.ts`. Import from there — never hardcode hex values in component files.
- Use `StyleSheet.create()` for all React Native styles. No inline style objects.
- The bottom navigation bar is implemented with `@react-navigation/bottom-tabs`. The Report tab uses a custom `tabBarButton` to render the FAB style.
- Bottom sheets use `@gorhom/bottom-sheet` library. Add it to dependencies in Phase 9.
- All photo displays use `expo-image` (not the built-in `Image`) for better caching and loading states.
- Severity and status badge colors are computed from a helper function `getSeverityColor(severity)` and `getStatusColor(status)` defined in `src/utils/theme.ts`. Do not repeat color logic in individual components.
- The map platform switch (`react-native-maps` on mobile, `@react-google-maps/api` on web) is handled by two separate components: `src/components/map/NativeMap.tsx` and `src/components/map/WebMap.tsx`, both exported through a single `src/components/map/Map.tsx` that uses `Platform.OS` to choose.
