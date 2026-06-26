# Phase 1 — Authentication + Role Routing

## What to read before starting
- TRD Section 3 (Authentication and Role Management) — read entirely
- AppFlow FLOW 0, FLOW 0A, FLOW 0B, FLOW 0C — read entirely

## What NOT to build in this phase
- No report submission
- No map
- No Cloud Functions except the role-assignment onCreate trigger
- No dashboard screens — placeholder screens for each role are sufficient

## Goal
All three roles can sign in and be routed to their correct home screen.
The role is stored as a Firebase Custom Claim, not in Firestore.

---

## Step 1 — Role assignment Cloud Function (onCreate trigger)

File: `functions/src/cf0_assignRole.ts`

This function fires every time a new user is created via Firebase Auth.
It assigns the `citizen` role as a Custom Claim automatically.

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const assignDefaultRole = functions.auth.user().onCreate(async (user) => {
  await admin.auth().setCustomUserClaims(user.uid, { role: 'citizen' });

  // Create the user document in Firestore
  await admin.firestore().collection('users').doc(user.uid).set({
    id: user.uid,
    role: 'citizen',
    display_name: user.displayName || '',
    email: user.email || '',
    verified_account: false,
    trust_score: 0,
    trust_layer1: 0,
    trust_layer2: 0,
    total_points: 0,
    fcm_token: null,
    zone_id: null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
});
```

Export this from `functions/src/index.ts`.
Deploy this function before testing auth in the app.

---

## Step 2 — Sign In screen

File: `src/screens/shared/SignInScreen.tsx`

Implement exactly as described in AppFlow FLOW 0B.

- Google Sign-In button using `GoogleAuthProvider` from Firebase Auth.
- Email + password fields with a Sign In button.
- "Forgot password?" link triggers `sendPasswordResetEmail`.
- On success: navigate to RoleRouter (Step 4).
- On failure: show inline error message. Do not navigate.

---

## Step 3 — Create Account screen

File: `src/screens/shared/CreateAccountScreen.tsx`

Implement exactly as described in AppFlow FLOW 0B.

- Fields: display name, email, password, confirm password.
- Validation: all fields required, passwords must match, email format valid.
- On success: Firebase Auth `createUserWithEmailAndPassword` → `updateProfile` with display name → navigate to RoleRouter.
- Google Sign-In option (same as Sign In screen).

---

## Step 4 — Role Router

File: `src/navigation/RoleRouter.tsx`

This component runs after every successful login. It reads the Firebase Custom Claim `role` from the user's ID token and navigates accordingly.

```typescript
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { auth } from '../config/firebase';
import { UserRole } from '../types';

// Import placeholder screens — replace in later phases
import CitizenHomeScreen from '../screens/citizen/CitizenHomeScreen';
import AuthorityDashboardScreen from '../screens/authority/AuthorityDashboardScreen';
import ModeratorQueueScreen from '../screens/moderator/ModeratorQueueScreen';
import ErrorScreen from '../screens/shared/ErrorScreen';

export default function RoleRouter() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const getRole = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // Force token refresh to get latest Custom Claims
      const tokenResult = await user.getIdTokenResult(true);
      const claimedRole = tokenResult.claims.role as UserRole | undefined;

      if (claimedRole) {
        setRole(claimedRole);
      } else {
        // Claim not yet propagated — retry once after 3 seconds
        setTimeout(async () => {
          const retryToken = await user.getIdTokenResult(true);
          const retryRole = retryToken.claims.role as UserRole | undefined;
          if (retryRole) {
            setRole(retryRole);
          } else {
            setError(true);
          }
        }, 3000);
      }
    };

    getRole();
  }, []);

  if (error) return <ErrorScreen message="Account setup incomplete. Please contact support." />;
  if (!role) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;

  if (role === 'citizen') return <CitizenHomeScreen />;
  if (role === 'authority') return <AuthorityDashboardScreen />;
  if (role === 'moderator') return <ModeratorQueueScreen />;

  return <ErrorScreen message="Unknown role. Please contact support." />;
}
```

---

## Step 5 — Placeholder screens for each role

Create these three files. They are placeholders only — they will be fully built in Phases 3, 7, and 8.

`src/screens/citizen/CitizenHomeScreen.tsx` — shows text "Citizen Home — Phase 3" and a Sign Out button.
`src/screens/authority/AuthorityDashboardScreen.tsx` — shows text "Authority Dashboard — Phase 7" and a Sign Out button.
`src/screens/moderator/ModeratorQueueScreen.tsx` — shows text "Moderator Queue — Phase 8" and a Sign Out button.

Sign Out button on each screen: calls `auth.signOut()` → navigates back to Welcome Screen.

---

## Step 6 — Welcome Screen and navigation root

File: `src/screens/shared/WelcomeScreen.tsx`

- App name and tagline.
- "Sign In" button → SignInScreen.
- "Create Account" button → CreateAccountScreen.

Update `App.tsx` to:
1. On mount, check if a Firebase Auth session is already active (`onAuthStateChanged`).
2. If session active: render RoleRouter directly.
3. If no session: render WelcomeScreen.
4. While checking: render a splash/loading screen for 1.5 seconds.

---

## Step 7 — Error Screen

File: `src/screens/shared/ErrorScreen.tsx`

A simple screen that accepts a `message` prop and displays it with a "Sign Out" button.
Used by RoleRouter when role claim is missing after retry.

---

## Completion check — do not proceed to Phase 2 until all of these pass

- [ ] New account created via email/password → role = citizen → CitizenHomeScreen shown
- [ ] New account created via Google → role = citizen → CitizenHomeScreen shown
- [ ] Sign out → WelcomeScreen shown
- [ ] Sign back in → same role screen shown (session persisted)
- [ ] Authority role manually assigned via Admin SDK script → AuthorityDashboardScreen shown on next login
- [ ] Moderator role manually assigned via Admin SDK script → ModeratorQueueScreen shown on next login
- [ ] Wrong credentials → inline error, no navigation
- [ ] Role claim missing after retry → ErrorScreen shown, not a crash
