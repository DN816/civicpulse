# CivicPulse

A civic issue reporting platform where citizens can report local problems (potholes, water leakages, damaged streetlights, etc.), track their resolution, and earn XP and badges for participation. Authorities review, assign, and resolve reports.

## Live Demo

**URL:** https://civicpulse-2e523.web.app

### Test Accounts

| Role      | Email                        | Password  |
|-----------|------------------------------|-----------|
| Citizen   | citizen@civicpulse.demo      | Demo@123  |
| Authority | authority@civicpulse.demo    | Demo@123  |

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Vite
- **Backend:** Firebase Cloud Functions (2nd gen, Node.js 22)
- **Database:** Firestore (NoSQL)
- **Auth:** Firebase Authentication (email/password, Google)
- **Storage:** Firebase Cloud Storage
- **AI:** Google Gemini 2.5 Flash (photo classification, before/after validation)
- **Maps:** Leaflet + OpenStreetMap
- **Deployment:** Firebase Hosting, Cloud Functions, Firestore, Storage

## Features

### Citizen
- Submit reports with photos, description, and location
- Real-time tracking of report status (submitted → in review → assigned → in progress → resolved)
- Community map showing open issues with severity-colored markers
- XP system with 6 levels and badges
- Report history with filters (all / active / resolved)

### Authority
- Dashboard with all open clusters grouped by category
- Review reports, acknowledge, start work, mark resolved
- Before/after photo comparison via AI validation
- Metrics dashboard with resolution stats
- Zone-based filtering

### Gamification
- **XP rewards:** 50 XP per submitted report, 100 XP first-report bonus, 375 XP per resolved report
- **6 levels:** Newcomer (0), Active Citizen (500), Neighborhood Watch (1500), Civic Contributor (3500), Community Pillar (7500), Civic Champion (15000)
- **Badges:** First Steps, Problem Solver, Eagle Eye, Streaker, Zone Hero

### Report Clustering
Reports within 100m of each other, of the same category, and submitted within 7 days are automatically grouped into clusters for efficient authority handling.

### Report Categories
- Pothole / road damage
- Water leakage / pipeline issue
- Damaged streetlight
- Waste management
- Drainage / waterlogging
- Public property damage
- Illegal construction / encroachment
- Other

## Project Structure

```
├── src/                          # Frontend source
│   ├── App.tsx                   # Root app with screen routing
│   ├── components/
│   │   ├── citizen/              # Citizen header, bottom nav
│   │   ├── shared/               # AuthLayout (responsive desktop/mobile)
│   │   └── ui/                   # Button, Card, FormInput, Toast, etc.
│   ├── config/
│   │   ├── firebase.ts           # Firebase client init
│   │   └── theme.ts              # Design tokens
│   ├── navigation/
│   │   └── RoleRouter.tsx        # Role-based routing (citizen/authority)
│   ├── screens/
│   │   ├── citizen/              # CitizenHome, Report, Map, Profile, etc.
│   │   ├── authority/            # AuthorityDashboard, IssueDetail, MarkResolved, etc.
│   │   └── shared/               # Welcome, SignIn, CreateAccount, etc.
│   ├── utils/                    # Auth helpers, cluster status, theme helpers
│   └── types/                    # TypeScript types
├── functions/                    # Cloud Functions source
│   └── src/
│       ├── index.ts              # Function exports
│       ├── cf0_assignRole.ts     # Auth trigger — assigns role on signup
│       ├── cf1_onReportSubmitted.ts  # Report submission — classify, cluster, award XP
│       ├── cf2_onClusterUpdated.ts   # Priority scoring on cluster changes
│       ├── cf3_onAuthorityAction.ts  # Resolution — AI validation, award XP
│       ├── cf6_slaMonitor.ts     # Scheduled SLA escalation
│       ├── cf7_escalationEmailSender.ts  # Escalation notifications
│       ├── cf8_weeklyHealthReport.ts     # Weekly email digest
│       └── utils/
│           ├── gamification.ts   # XP, levels, badges
│           ├── clustering.ts     # Haversine-based report clustering
│           ├── gemini.ts         # AI photo classification
│           ├── geminiCompare.ts  # AI before/after validation
│           └── trustScore.ts     # Trust scoring
├── scripts/                      # Admin scripts (create accounts, diagnose, etc.)
├── firestore.rules               # Firestore security rules
├── storage.rules                 # Storage security rules
├── firebase.json                 # Firebase project config
└── vite.config.ts                # Vite build config
```

## Cloud Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `assignDefaultRole` | Auth user created | Sets custom claim role (citizen) |
| `onReportSubmitted` | Firestore `reports` created | Classifies photo, clusters report, awards XP |
| `onClusterUpdated` | Firestore `clusters` updated | Recomputes priority score |
| `onAuthorityAction` | Firestore `report_events` created | AI validates fix, awards resolution XP |
| `slaMonitor` | Scheduled (every 5 min) | Escalates overdue reports |
| `weeklyHealthReport` | Scheduled (weekly) | Sends email digest |

## XP & Levels

| Level | Title | XP Required |
|-------|-------|-------------|
| 1 | Newcomer | 0 |
| 2 | Active Citizen | 500 |
| 3 | Neighborhood Watch | 1,500 |
| 4 | Civic Contributor | 3,500 |
| 5 | Community Pillar | 7,500 |
| 6 | Civic Champion | 15,000 |

## Local Development

```bash
# Frontend
npm install
npm run dev        # http://localhost:3000

# Functions
cd functions
npm install
npm run build      # Compile TypeScript
npm run deploy     # Deploy to Firebase

# Full deploy (from root)
npm run build                    # Build frontend
npx firebase deploy              # Deploy everything
```

## Environment

Copy `.env.example` to `.env` and configure:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Functions require `functions/.env` with `GEMINI_API_KEY` for AI features.
