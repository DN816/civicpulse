# Phase 2 — CF1: Report Submission Pipeline (Backend Only)

## What to read before starting
- TRD Section 4 CF1 (`onReportSubmitted`) — read entirely, follow step order exactly
- TRD Section 5 (Gemini Model Usage) — read the CF1 row and the Layer 1 JS code block
- TRD Section 6 (Clustering Implementation) — read entirely, use the Haversine code exactly
- PRD F2 (Clustering rule) — read for the 3-condition matching rule
- PRD F3 Layer 1 (trust score point values table) — use exact values

## What NOT to build in this phase
- No frontend screens
- No UI changes
- No other Cloud Functions (CF2–CF8 are built in later phases)

## Goal
CF1 is fully working. When a report document is created in Firestore,
CF1 classifies it, clusters it, calculates trust score, and updates the document.
Test this phase entirely via a test script — no UI needed yet.

---

## Step 1 — Haversine utility

File: `functions/src/utils/haversine.ts`

Implement the Haversine formula exactly as written in TRD Section 6.
Export it as a named function `haversineMeters(lat1, lng1, lat2, lng2): number`.
Do not modify the formula.

---

## Step 2 — Layer 1 trust score utility

File: `functions/src/utils/trustScore.ts`

Implement `computeLayer1` exactly as written in TRD Section 5.
The function signature:

```typescript
export function computeLayer1(params: {
  classifier_confidence: number;
  geo_accuracy_meters: number;
  photo_count: number;
  device_timestamp: number;   // Unix ms
  server_timestamp: number;   // Unix ms
  photo_timestamp: number | null; // Unix ms, null if no EXIF
}): number
```

Returns a number in range [0, 70]. Clamp the result — never return below 0 or above 70.

---

## Step 3 — Gemini Vision helper

File: `functions/src/utils/gemini.ts`

Set up the Vertex AI SDK client. Export a single function `classifyReportPhoto`.

```typescript
import { VertexAI } from '@google-cloud/vertexai';

const vertexAI = new VertexAI({
  project: process.env.VERTEX_AI_PROJECT_ID!,
  location: process.env.VERTEX_AI_LOCATION!,
});

const proModel = vertexAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

export interface ClassificationResult {
  is_civic_issue: boolean;
  category: string;
  severity: 'Low' | 'Medium' | 'High';
  classifier_confidence: number;
  needs_clarification: boolean;
  clarification_question: string | null;
}

export async function classifyReportPhoto(
  photoUrl: string,
  description: string | null
): Promise<ClassificationResult> {
  const prompt = `
You are a civic issue classifier. Look at this photo and return a JSON object only.
No preamble. No markdown. No explanation. Only the JSON object.

The JSON must have exactly these fields:
- is_civic_issue: boolean — true only if the photo clearly shows a real civic infrastructure problem
- category: string — one of exactly: "Pothole / road damage", "Water leakage / pipeline issue", "Damaged streetlight", "Waste management", "Drainage / waterlogging", "Public property damage", "Illegal construction / encroachment", "Other"
- severity: string — one of exactly: "Low", "Medium", "High"
- classifier_confidence: number — your confidence from 0.0 to 1.0
- needs_clarification: boolean — true only if confidence is below 0.7 and a single question would help
- clarification_question: string or null — if needs_clarification is true, write one short question with two or three answer options separated by " / ". Null if needs_clarification is false.

${description ? `The citizen also wrote: "${description}"` : ''}
`;

  const result = await proModel.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: await fetchImageAsBase64(photoUrl) } },
          { text: prompt },
        ],
      },
    ],
  });

  const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as ClassificationResult;
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(url);
  const buffer = await response.buffer();
  return buffer.toString('base64');
}
```

---

## Step 4 — Clustering logic

File: `functions/src/utils/clustering.ts`

Export a function `findMatchingCluster` that implements the three-condition rule from TRD Section 6 exactly.

```typescript
import * as admin from 'firebase-admin';
import { haversineMeters } from './haversine';

export async function findMatchingCluster(
  category: string,
  lat: number,
  lng: number,
  submittedAt: Date
): Promise<{ clusterId: string; centroid_lat: number; centroid_lng: number } | null> {
  const sevenDaysAgo = new Date(submittedAt.getTime() - 7 * 24 * 60 * 60 * 1000);

  const snapshot = await admin.firestore()
    .collection('clusters')
    .where('category', '==', category)
    .where('status', '==', 'active')
    .where('created_at', '>=', sevenDaysAgo)
    .get();

  if (snapshot.empty) return null;

  let closest: { clusterId: string; centroid_lat: number; centroid_lng: number; distance: number } | null = null;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const distance = haversineMeters(lat, lng, data.centroid_lat, data.centroid_lng);
    if (distance <= 50) {
      if (!closest || distance < closest.distance) {
        closest = { clusterId: doc.id, centroid_lat: data.centroid_lat, centroid_lng: data.centroid_lng, distance };
      }
    }
  }

  return closest ? { clusterId: closest.clusterId, centroid_lat: closest.centroid_lat, centroid_lng: closest.centroid_lng } : null;
}
```

---

## Step 5 — CF1 main function

File: `functions/src/cf1_onReportSubmitted.ts`

Implement CF1 exactly as described in TRD Section 4 CF1.
Follow the step order exactly — do not reorder or skip steps.

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { classifyReportPhoto } from './utils/gemini';
import { findMatchingCluster } from './utils/clustering';
import { computeLayer1 } from './utils/trustScore';

export const onReportSubmitted = functions.firestore
  .document('reports/{reportId}')
  .onCreate(async (snap, context) => {
    const report = snap.data();
    const reportId = context.params.reportId;
    const db = admin.firestore();
    const serverTimestamp = Date.now();

    // STEP 1 — Gemini Vision classification
    const classification = await classifyReportPhoto(report.photo_url, report.description ?? null);

    if (!classification.is_civic_issue) {
      await snap.ref.update({ status: 'REJECTED' });
      return;
    }

    if (classification.needs_clarification && classification.classifier_confidence < 0.7) {
      await snap.ref.update({
        status: 'AWAITING_CLARIFICATION',
        clarification_question: classification.clarification_question,
      });
      return;
    }

    // Update report with classification results
    await snap.ref.update({
      category: classification.category,
      severity: classification.severity,
      classifier_confidence: classification.classifier_confidence,
    });

    // STEP 2 — Clustering check
    const match = await findMatchingCluster(
      classification.category,
      report.lat,
      report.lng,
      report.device_timestamp.toDate()
    );

    if (match) {
      // Add to existing cluster
      const clusterRef = db.collection('clusters').doc(match.clusterId);
      await clusterRef.update({
        affected_citizen_ids: admin.firestore.FieldValue.arrayUnion(report.citizen_id),
        affected_count: admin.firestore.FieldValue.increment(1),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      // Compute Layer 1 here too so we can determine trust category for status routing
      const trust_layer1_cluster = computeLayer1({
        classifier_confidence: classification.classifier_confidence,
        geo_accuracy_meters: report.geo_accuracy_meters,
        photo_count: 1,
        device_timestamp: report.device_timestamp.toMillis(),
        server_timestamp: serverTimestamp,
        photo_timestamp: report.photo_timestamp ? report.photo_timestamp.toMillis() : null,
      });
      const postClusterStatus = trust_layer1_cluster < 20 ? 'IN_REVIEW' : 'ASSIGNED';
      await snap.ref.update({ cluster_id: match.clusterId, status: postClusterStatus, trust_layer1: trust_layer1_cluster, trust_score: trust_layer1_cluster });

      // Get updated affected_count for FCM message
      const clusterSnap = await clusterRef.get();
      const affectedCount = clusterSnap.data()?.affected_count ?? 1;
      await sendCitizenFCM(report.citizen_id, affectedCount);
      return;
    }

    // STEP 3 — Layer 1 trust score
    const trust_layer1 = computeLayer1({
      classifier_confidence: classification.classifier_confidence,
      geo_accuracy_meters: report.geo_accuracy_meters,
      photo_count: 1,
      device_timestamp: report.device_timestamp.toMillis(),
      server_timestamp: serverTimestamp,
      photo_timestamp: report.photo_timestamp ? report.photo_timestamp.toMillis() : null,
    });

    await snap.ref.update({ trust_layer1, trust_score: trust_layer1 });

    // STEP 4 — Create new cluster
    const clusterRef = db.collection('clusters').doc();
    await clusterRef.set({
      id: clusterRef.id,
      category: classification.category,
      severity: classification.severity,
      status: 'active',
      centroid_lat: report.lat,
      centroid_lng: report.lng,
      affected_count: 1,
      affected_citizen_ids: [report.citizen_id],
      priority_score: 0,
      trust_score: trust_layer1,
      zone_id: null,
      sla_deadline: null,
      escalation_sent: false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Determine post-classification status from trust category
    // HighTrust (>=80) and MediumTrust (50-79) and LowTrust (20-49) → ASSIGNED (auto-assign to authority)
    // Untrusted (<20) → IN_REVIEW (requires moderator approval before assignment)
    const postClassificationStatus = trust_layer1 < 20 ? 'IN_REVIEW' : 'ASSIGNED';

    await snap.ref.update({ cluster_id: clusterRef.id, status: postClassificationStatus });

    // STEP 5 — FCM
    await sendCitizenFCM(report.citizen_id, 1);
  });

async function sendCitizenFCM(citizenId: string, affectedCount: number) {
  const userSnap = await admin.firestore().collection('users').doc(citizenId).get();
  const fcmToken = userSnap.data()?.fcm_token;
  if (!fcmToken) return;

  const message = affectedCount === 1
    ? "Your report has been received. We'll notify you when it's resolved."
    : `You've been added to an existing report. ${affectedCount - 1} other citizen(s) have also reported this.`;

  await admin.messaging().send({
    token: fcmToken,
    notification: { title: 'CivicPulse', body: message },
  });
}
```

Export `onReportSubmitted` from `functions/src/index.ts`.

---

## Step 6 — Test script

File: `functions/src/test/testCF1.ts`

Write a script that:
1. Creates a test report document in Firestore manually (simulate a citizen submission).
2. Waits for CF1 to run (poll for status change, timeout after 30 seconds).
3. Logs the resulting status, category, severity, cluster_id, and trust_layer1.
4. Run this script with `ts-node functions/src/test/testCF1.ts`.

Test these cases:
- A clear photo of a pothole → expect status = APPROVED, category = "Pothole / road damage"
- A blurry/irrelevant photo → expect status = REJECTED
- A second pothole photo within 50m of the first → expect status = APPROVED, cluster_id matches first report's cluster

---

## Completion check — do not proceed to Phase 3 until all of these pass

- [ ] Clear civic issue photo, trust_layer1 >= 20 → status = ASSIGNED, category and severity populated
- [ ] Clear civic issue photo, trust_layer1 < 20 → status = IN_REVIEW (Untrusted report held for moderator)
- [ ] Non-civic photo → status = REJECTED
- [ ] Low confidence photo → status = AWAITING_CLARIFICATION, clarification_question populated
- [ ] Second report within 50m, same category, within 7 days → clusters to existing cluster, affected_count = 2
- [ ] Second report >50m away, same category → new cluster created
- [ ] Layer 1 trust score calculated and stored on report document
- [ ] FCM notification sent to citizen (check Firebase Console → Cloud Messaging)
- [ ] No hardcoded API keys in any function file
