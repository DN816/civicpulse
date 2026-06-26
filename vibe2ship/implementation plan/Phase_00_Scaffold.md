# Phase 0 — Project Scaffold + Firebase Setup

## What to read before starting
- TRD Section 1 (System Architecture)
- TRD Section 2 (Full Tech Stack)
- TRD Section 12 (Environment Variables)

## What NOT to build in this phase
- No screens beyond a placeholder home screen
- No Gemini calls
- No Cloud Functions
- No auth logic

## Goal
A working Expo project connected to Firebase with the correct folder structure. The app must launch on both web (`expo export:web`) and mobile (`expo start`) without errors.

---

## Step 1 — Create the Expo project

```bash
npx create-expo-app civicpulse --template blank-typescript
cd civicpulse
```

---

## Step 2 — Install all dependencies

Install these packages exactly. Do not add or remove any package without being told to.

```bash
# Firebase
npx expo install firebase

# Navigation
npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack
npx expo install react-native-screens react-native-safe-area-context

# Maps
npx expo install react-native-maps
npm install @react-google-maps/api

# UI
npx expo install expo-image-picker expo-location expo-camera expo-notifications

# Platform detection (already in React Native — no install needed)
# Maps platform switch uses Platform.OS from 'react-native'
```

---

## Step 3 — Firebase project setup

1. Create a Firebase project at console.firebase.google.com.
2. Enable the following services: Authentication, Firestore (Native mode), Cloud Storage, Cloud Functions, Cloud Messaging, Hosting.
3. Add a Web app to the Firebase project. Copy the config object.
4. Create the file `src/config/firebase.ts` with the Firebase config. Use environment variables for all values — do not hardcode them.

```typescript
// src/config/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);
```

5. Create `.env` in the project root with all `EXPO_PUBLIC_` prefixed values filled in.
6. Add `.env` to `.gitignore`. Never commit it.

---

## Step 4 — Folder structure

Create this exact folder structure. Do not deviate from it.

```
civicpulse/
├── src/
│   ├── config/
│   │   └── firebase.ts
│   ├── navigation/
│   │   └── RoleRouter.tsx        ← built in Phase 1
│   ├── screens/
│   │   ├── citizen/              ← built in Phases 3, 9
│   │   ├── authority/            ← built in Phase 7
│   │   ├── moderator/            ← built in Phase 8
│   │   └── shared/               ← built in Phase 1
│   ├── components/               ← shared UI components
│   ├── hooks/                    ← custom React hooks
│   ├── utils/
│   │   └── haversine.ts          ← built in Phase 2
│   └── types/
│       └── index.ts              ← type definitions
├── functions/                    ← Firebase Cloud Functions
│   ├── src/
│   │   ├── cf1_onReportSubmitted.ts
│   │   ├── cf2_onClusterUpdated.ts
│   │   ├── cf3_onAuthorityAction.ts
│   │   ├── cf4_onDisputeVote.ts
│   │   ├── cf5_evaluateDisputeWindow.ts
│   │   ├── cf6_slaMonitor.ts
│   │   ├── cf7_escalationEmailSender.ts
│   │   ├── cf8_weeklyHealthReport.ts
│   │   └── index.ts              ← exports all functions
│   ├── package.json
│   └── tsconfig.json
├── app.json
├── .env
└── .gitignore
```

---

## Step 5 — Create type definitions

Create `src/types/index.ts` with these types. Every Cloud Function and screen uses these — define them once here.

```typescript
export type UserRole = 'citizen' | 'authority' | 'moderator';

export type Severity = 'Low' | 'Medium' | 'High';

export type ReportStatus =
  | 'NEW'
  | 'AWAITING_CLARIFICATION'
  | 'REJECTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'AWAITING_CONFIRMATION'
  | 'RESOLVED'
  | 'REOPENED'
  | 'ESCALATED'
  | 'CLOSED'
  | 'APPEAL';

export type ClusterStatus = 'active' | 'resolved' | 'closed';

export type TrustCategory = 'HighTrust' | 'MediumTrust' | 'LowTrust' | 'Untrusted';

export interface Report {
  id: string;
  citizen_id: string;
  cluster_id: string | null;
  category: string;
  severity: Severity;
  status: ReportStatus;
  photo_url: string;
  after_photo_url: string | null;
  lat: number;
  lng: number;
  geo_accuracy_meters: number;
  description: string | null;
  classifier_confidence: number;
  trust_layer1: number;
  trust_layer2: number;
  trust_score: number;
  sla_deadline: Date | null;
  escalation_sent: boolean;
  dispute_window_closes_at: Date | null;
  resolution_attempt: number;
  pii_flag: boolean;
  pii_handled: boolean;
  moderator_id: string | null;
  locked_until: Date | null;
  appeal_text: string | null;
  photo_timestamp: Date | null;
  device_timestamp: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Cluster {
  id: string;
  category: string;
  severity: Severity;
  status: ClusterStatus;
  centroid_lat: number;
  centroid_lng: number;
  affected_count: number;
  affected_citizen_ids: string[];
  priority_score: number;
  trust_score: number;
  zone_id: string | null;
  sla_deadline: Date | null;
  escalation_sent: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: string;
  role: UserRole;
  display_name: string;
  email: string;
  verified_account: boolean;
  trust_score: number;
  trust_layer1: number;
  trust_layer2: number;
  total_points: number;
  fcm_token: string | null;
  zone_id: string | null;
  created_at: Date;
}
```

---

## Step 6 — Initialize Cloud Functions

```bash
cd functions
npm init -y
npm install firebase-admin firebase-functions @google-cloud/vertexai
npm install -D typescript @types/node
```

Create `functions/src/index.ts` as an empty barrel file that will export all functions as they are built:

```typescript
// functions/src/index.ts
// Cloud Functions are added here as each phase is completed.
// Do not add placeholder exports — only export functions that are fully implemented.
```

---

## Step 7 — Placeholder home screen

Create `src/screens/shared/PlaceholderScreen.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function PlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>CivicPulse — Phase 0 complete</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18 },
});
```

Set this as the root screen in `App.tsx` for now. It will be replaced in Phase 1.

---

## Completion check — do not proceed to Phase 1 until all of these pass

- [ ] `expo start` launches without errors
- [ ] `expo export:web` completes without errors
- [ ] Firebase config loads from `.env` without hardcoded values
- [ ] Folder structure matches Step 4 exactly
- [ ] All types in `src/types/index.ts` compile without TypeScript errors
- [ ] `.env` is in `.gitignore` and not committed
