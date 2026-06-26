# Implementation Plan — CivicPulse — Master Index

> This is the master index. It is NOT given to AI Studio directly.
> It tells YOU (the developer) which phase file to hand to AI Studio next,
> what the testable output of each phase is, and what must be confirmed
> working before moving to the next phase.
>
> Hand AI Studio exactly ONE phase file at a time.
> Do not give AI Studio this index file.
> Do not give AI Studio future phase files.
> Do not give AI Studio all the .md reference documents at once —
> each phase file tells AI Studio exactly which documents to read.

---

## Phase Order

| Phase | File | Focus | Must work before proceeding |
|---|---|---|---|
| 0 | `Phase_00_Scaffold.md` | Project setup, Firebase config, folder structure | App launches on web and mobile without errors |
| 1 | `Phase_01_Auth.md` | Firebase Auth, role routing, all 3 login flows | All 3 roles log in and land on correct screen |
| 2 | `Phase_02_CF1_ReportPipeline.md` | Cloud Function 1 — full report submission backend | Photo → Gemini → cluster logic → Firestore update working via test script |
| 3 | `Phase_03_CitizenReportUI.md` | Citizen report screens — all FLOW 1A branches | All 5 CF1 outcome paths render correctly on screen |
| 4 | `Phase_04_ResolutionPipeline.md` | CF3 + CF4 + CF5 — dispute window backend | Dispute votes recorded, auto-reopen fires, CF5 evaluates correctly |
| 5 | `Phase_05_EscalationPipeline.md` | CF6 + CF7 — SLA monitor + Gmail escalation | Escalation email sent when SLA breached, FCM fires to citizens |
| 6 | `Phase_06_PriorityAndHealthReport.md` | CF2 + CF8 — priority scoring + weekly report | Priority score recalculates on cluster update, weekly report writes to Firestore |
| 7 | `Phase_07_AuthorityFrontend.md` | Authority dashboard + issue detail + resolve flow | Full FLOW 2A–2D working end to end |
| 8 | `Phase_08_ModeratorFrontend.md` | Moderator queue + review + all actions | Full FLOW 3A–3D working, lock expiry handled |
| 9 | `Phase_09_MapsAndGamification.md` | Live map, heatmap, leaderboard, badges, profile | Map renders with pins + heatmap, leaderboard shows correct rankings |
| 10 | `Phase_10_PolishAndDeploy.md` | Security rules, env vars, Firebase Hosting deploy | Public URL live, all security rules enforced, no API keys in client |

---

## Reference Documents (do not give all of these to AI Studio at once)

| File | What it contains |
|---|---|
| `CivicPulse_PRD_Fixed.md` | Product requirements — features, rules, formulas |
| `CivicPulse_TRD_Fixed.md` | Tech stack, all 8 Cloud Functions, security rules, env vars |
| `CivicPulse_AppFlow.md` | All screens, all flows, all decision points, all edge cases |
| `CivicPulse_Backend_Schema_Superseded.md` | SUPERSEDED — do not give this to AI Studio |

Each phase file specifies exactly which sections of which documents AI Studio needs.
