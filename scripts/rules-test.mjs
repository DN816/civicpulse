/**
 * Firestore security rules integration tests — run via:
 *   npx firebase emulators:exec --only firestore "node scripts/rules-test.mjs"
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');
const PROJECT_ID = 'civicpulse-rules-test';

const citizenUid = 'citizen_test_001';
const authorityUid = 'authority_test_001';
const moderatorUid = 'moderator_test_001';
const otherCitizenUid = 'citizen_other_002';
const reportId = 'report_test_001';
const clusterId = 'cluster_test_001';

let passed = 0;
let failed = 0;

function check(label, result) {
  if (result) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { rules, host: '127.0.0.1', port: 8080 },
});

await testEnv.clearFirestore();

// Seed base documents (admin)
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'users', citizenUid), {
    id: citizenUid,
    role: 'citizen',
    display_name: 'Citizen',
    email: 'citizen@test.com',
    verified_account: false,
    trust_score: 50,
    trust_layer1: 50,
    trust_layer2: 0,
    total_points: 0,
    created_at: Timestamp.now(),
  });
  await setDoc(doc(db, 'users', authorityUid), {
    id: authorityUid,
    role: 'authority',
    display_name: 'Authority',
    email: 'auth@test.com',
    verified_account: true,
    trust_score: 0,
    trust_layer1: 0,
    trust_layer2: 0,
    total_points: 0,
    zone_id: 'A1',
    created_at: Timestamp.now(),
  });
  await setDoc(doc(db, 'clusters', clusterId), {
    id: clusterId,
    category: 'Pothole',
    severity: 'Medium',
    status: 'active',
    centroid_lat: 30.1,
    centroid_lng: 76.1,
    affected_count: 1,
    affected_citizen_ids: [citizenUid],
    priority_score: 10,
    trust_score: 50,
    zone_id: 'A1',
    dispute_vote_count: 0,
    escalation_sent: false,
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  });
  await setDoc(doc(db, 'reports', reportId), {
    id: reportId,
    citizen_id: citizenUid,
    cluster_id: clusterId,
    category: 'Pothole',
    severity: 'Medium',
    status: 'ASSIGNED',
    photo_url: 'https://firebasestorage.googleapis.com/v0/b/test/o/before.jpg',
    lat: 30.1,
    lng: 76.1,
    device_timestamp: Timestamp.now(),
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
    authority_id: authorityUid,
    affected_citizen_ids: [citizenUid],
  });
  await setDoc(doc(db, 'reports', 'report_in_review'), {
    id: 'report_in_review',
    citizen_id: citizenUid,
    cluster_id: clusterId,
    category: 'Pothole',
    severity: 'Medium',
    status: 'IN_REVIEW',
    photo_url: 'https://example.com/photo.jpg',
    lat: 30.1,
    lng: 76.1,
    device_timestamp: Timestamp.now(),
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
    moderator_id: moderatorUid,
    locked_until: Timestamp.fromMillis(Date.now() + 900000),
    affected_citizen_ids: [citizenUid],
  });
  await setDoc(doc(db, 'reports', 'report_clarify'), {
    id: 'report_clarify',
    citizen_id: citizenUid,
    category: '',
    severity: 'Low',
    status: 'AWAITING_CLARIFICATION',
    photo_url: 'https://example.com/photo.jpg',
    lat: 30.1,
    lng: 76.1,
    device_timestamp: Timestamp.now(),
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
    description: 'test',
    affected_citizen_ids: [citizenUid],
  });
});

console.log('\n=== Citizen rules ===');
{
  const db = testEnv.authenticatedContext(citizenUid, { role: 'citizen' }).firestore();
  const newReportId = 'new_report_001';
  check(
    'citizen can create valid report',
    await assertSucceeds(
      setDoc(doc(db, 'reports', newReportId), {
        id: newReportId,
        citizen_id: citizenUid,
        category: '',
        severity: 'Low',
        status: 'NEW',
        photo_url: 'https://firebasestorage.googleapis.com/v0/b/test/o/before.jpg',
        lat: 30.1,
        lng: 76.1,
        device_timestamp: Timestamp.now(),
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
        affected_citizen_ids: [citizenUid],
      })
    ).then(() => true).catch(() => false)
  );
  check(
    'citizen can submit clarification',
    await assertSucceeds(
      updateDoc(doc(db, 'reports', 'report_clarify'), {
        clarification_answer: 'Yes',
        description: 'test\n[Clarification: Yes]',
        status: 'NEW',
      })
    ).then(() => true).catch(() => false)
  );
  check(
    'citizen can cast dispute vote when affected',
    await assertSucceeds(
      setDoc(doc(db, 'dispute_votes', `${reportId}_1_${citizenUid}`), {
        id: `${reportId}_1_${citizenUid}`,
        citizen_id: citizenUid,
        report_id: reportId,
        cluster_id: clusterId,
        resolution_attempt: 1,
        vote: 'yes',
        created_at: Timestamp.now(),
      })
    ).then(() => true).catch(() => false)
  );
  const otherDb = testEnv.authenticatedContext(otherCitizenUid, { role: 'citizen' }).firestore();
  check(
    'non-affected citizen cannot vote',
    await assertFails(
      setDoc(doc(otherDb, 'dispute_votes', `${reportId}_1_${otherCitizenUid}`), {
        id: `${reportId}_1_${otherCitizenUid}`,
        citizen_id: otherCitizenUid,
        report_id: reportId,
        cluster_id: clusterId,
        resolution_attempt: 1,
        vote: 'no',
        created_at: Timestamp.now(),
      })
    ).then(() => true).catch(() => false)
  );
}

console.log('\n=== Authority rules ===');
{
  const db = testEnv.authenticatedContext(authorityUid, { role: 'authority' }).firestore();
  check(
    'authority can acknowledge cluster',
    await assertSucceeds(
      updateDoc(doc(db, 'clusters', clusterId), {
        status: 'assigned',
        updated_at: Timestamp.now(),
        authority_id: authorityUid,
      })
    ).then(() => true).catch(() => false)
  );
  check(
    'authority can update report status with updated_at',
    await assertSucceeds(
      updateDoc(doc(db, 'reports', reportId), {
        status: 'IN_PROGRESS',
        updated_at: Timestamp.now(),
        authority_id: authorityUid,
      })
    ).then(() => true).catch(() => false)
  );
  check(
    'authority can create work_completed event',
    await assertSucceeds(
      addDoc(collection(db, 'report_events'), {
        event_type: 'work_completed',
        report_id: reportId,
        cluster_id: clusterId,
        authority_id: authorityUid,
        after_photo_url: 'https://firebasestorage.googleapis.com/v0/b/test/o/after.jpg',
        created_at: Timestamp.now(),
      })
    ).then(() => true).catch(() => false)
  );
  check(
    'authority report update fails without updated_at',
    await assertFails(
      updateDoc(doc(db, 'reports', reportId), {
        status: 'ASSIGNED',
        authority_id: authorityUid,
      })
    ).then(() => true).catch(() => false)
  );
}

console.log('\n=== Moderator rules ===');
{
  const db = testEnv.authenticatedContext(moderatorUid, { role: 'moderator' }).firestore();
  check(
    'moderator can claim lock on IN_REVIEW report',
    await assertSucceeds(
      updateDoc(doc(db, 'reports', 'report_in_review'), {
        moderator_id: moderatorUid,
        locked_until: Timestamp.fromMillis(Date.now() + 900000),
      })
    ).then(() => true).catch(() => false)
  );
  check(
    'moderator can approve locked report',
    await assertSucceeds(
      updateDoc(doc(db, 'reports', 'report_in_review'), {
        status: 'APPROVED',
        locked_until: null,
        moderator_id: null,
      })
    ).then(() => true).catch(() => false)
  );
  check(
    'moderator can update cluster status',
    await assertSucceeds(
      updateDoc(doc(db, 'clusters', clusterId), {
        status: 'assigned',
        updated_at: Timestamp.now(),
      })
    ).then(() => true).catch(() => false)
  );
  check(
    'moderator can write audit log',
    await assertSucceeds(
      addDoc(collection(db, 'moderator_audits'), {
        report_id: 'report_in_review',
        moderator_id: moderatorUid,
        action: 'approve_report',
        reason: 'Low confidence appeal approved after review.',
        created_at: Timestamp.now(),
      })
    ).then(() => true).catch(() => false)
  );
}

console.log(`\n=== Rules test results: ${passed} passed, ${failed} failed ===\n`);
await testEnv.cleanup();
process.exit(failed > 0 ? 1 : 0);
