"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
// Load env vars
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
        }
    });
}
// Initialize Firebase Admin with service account
const serviceAccount = require('../../../serviceAccount.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();
const potholeImageUrl = 'https://firebasestorage.googleapis.com/v0/b/civicpulse-2e523.firebasestorage.app/o/test-pothole.jpg?alt=media'; // Or use any valid image URL
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function runTest() {
    console.log('Starting CF3, CF4, CF5 Test Pipeline...');
    // 1. Find or create a valid report
    const reportsSnap = await db.collection('reports').limit(1).get();
    if (reportsSnap.empty) {
        console.error('No reports found in Firestore. Please create one first.');
        return;
    }
    const reportDoc = reportsSnap.docs[0];
    const reportId = reportDoc.id;
    console.log(`Using report ID: ${reportId}`);
    // Reset report state for testing
    await reportDoc.ref.update({
        status: 'NEW',
        resolution_attempt: 0,
        photo_url: potholeImageUrl,
    });
    console.log('Report state reset to NEW');
    // 2. Mock CF3 Trigger (Authority Action)
    console.log('\n--- Triggering CF3 (Authority Action) ---');
    const eventRef = db.collection('report_events').doc();
    await eventRef.set({
        report_id: reportId,
        event_type: 'work_completed',
        after_photo_url: potholeImageUrl, // using same photo for test
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Created report_event: ${eventRef.id}`);
    // 3. Wait 120s for CF3
    console.log('Waiting 120 seconds for CF3 to process and call Gemini...');
    for (let i = 0; i < 12; i++) {
        await sleep(10000);
        process.stdout.write('.');
    }
    console.log();
    // 4. Log status after CF3
    let updatedReport = (await reportDoc.ref.get()).data();
    console.log(`Status after CF3: ${updatedReport?.status}`);
    console.log(`Resolution Attempt: ${updatedReport?.resolution_attempt}`);
    console.log(`Gemini Validation:`, updatedReport?.resolution_validation);
    if (updatedReport?.status !== 'AWAITING_CONFIRMATION') {
        console.log('CF3 did not set status to AWAITING_CONFIRMATION. Exiting test.');
        return;
    }
    // 5. Mock CF4 Trigger (Citizen Votes)
    console.log('\n--- Triggering CF4 (Dispute Votes) ---');
    const attempt = updatedReport.resolution_attempt;
    const voters = ['citizen_A', 'citizen_B', 'citizen_C'];
    for (const citizenId of voters) {
        const voteId = `${reportId}_${attempt}_${citizenId}`;
        await db.collection('dispute_votes').doc(voteId).set({
            report_id: reportId,
            resolution_attempt: attempt,
            citizen_id: citizenId,
            vote: 'no',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Citizen ${citizenId} voted NO.`);
    }
    // 6. Wait 30s for CF4
    console.log('Waiting 30 seconds for CF4 to process votes...');
    for (let i = 0; i < 3; i++) {
        await sleep(10000);
        process.stdout.write('.');
    }
    console.log();
    // 7. Log final status
    const finalReport = (await reportDoc.ref.get()).data();
    console.log(`\nFinal Status after CF4: ${finalReport?.status}`);
    if (finalReport?.status === 'REOPENED') {
        console.log('SUCCESS! Report was immediately reopened after 3 NO votes.');
    }
    else {
        console.log('FAILED. Report status is not REOPENED.');
    }
}
runTest().then(() => {
    console.log('\nTest Script Completed.');
    process.exit(0);
}).catch(err => {
    console.error('\nTest Script Failed:', err);
    process.exit(1);
});
//# sourceMappingURL=testCF3_CF4_CF5.js.map