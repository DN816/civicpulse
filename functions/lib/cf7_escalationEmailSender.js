"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escalationEmailSender = escalationEmailSender;
const admin = require("firebase-admin");
const genai_1 = require("@google/genai");
const googleapis_1 = require("googleapis");
async function escalationEmailSender(reportId, reportData) {
    const db = admin.firestore();
    // 1. Get cluster data
    const clusterId = reportData.cluster_id;
    let clusterData = {};
    if (clusterId) {
        const clusterSnap = await db.collection('clusters').doc(clusterId).get();
        clusterData = clusterSnap.data() || {};
    }
    // 2. Get authority email
    let recipientEmail = process.env.ESCALATION_FALLBACK_EMAIL || 'fallback@example.com';
    const authorityId = clusterData.authority_id || reportData.authority_id;
    if (authorityId) {
        const userSnap = await db.collection('users').doc(authorityId).get();
        const userData = userSnap.data();
        if (userData && userData.email) {
            recipientEmail = userData.email;
        }
    }
    // 3. Calculate days open and days overdue
    const now = Date.now();
    const createdMs = reportData.created_at ? reportData.created_at.toMillis() : now;
    const daysOpen = Math.floor((now - createdMs) / (1000 * 60 * 60 * 24));
    const slaMs = reportData.sla_deadline ? reportData.sla_deadline.toMillis() : now;
    const daysOverdue = Math.max(0, Math.floor((now - slaMs) / (1000 * 60 * 60 * 24)));
    // 4. Generate email with Gemini Flash
    const ai = new genai_1.GoogleGenAI({});
    const prompt = `
You are an automated escalation system for CivicPulse.
Write a formal escalation email in plain English.
Report Category: ${reportData.category}
Photo URL: ${reportData.photo_url || 'N/A'}
Affected Citizens: ${clusterData.affected_count || 1}
Days Open: ${daysOpen}
Days Overdue (past SLA): ${daysOverdue}

Return a JSON object with strictly these two fields:
- "subject": The email subject line.
- "body": The email body text.
`;
    let emailContent = { subject: 'Issue Escalated', body: 'The issue has breached its SLA.' };
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [prompt]
        });
        const text = response.text ?? '{}';
        const clean = text.replace(/```json|```/g, '').trim();
        emailContent = JSON.parse(clean);
    }
    catch (err) {
        console.error('Error calling Gemini for escalation email:', err);
    }
    // 5. Send Email via Gmail API
    const encodedKey = process.env.GMAIL_SERVICE_ACCOUNT_KEY;
    if (encodedKey) {
        try {
            const serviceAccount = JSON.parse(Buffer.from(encodedKey, 'base64').toString('utf8'));
            const auth = new googleapis_1.google.auth.JWT({
                email: serviceAccount.client_email,
                key: serviceAccount.private_key,
                scopes: ['https://www.googleapis.com/auth/gmail.send'],
                subject: process.env.GMAIL_ESCALATION_SENDER
            });
            const gmail = googleapis_1.google.gmail({ version: 'v1', auth });
            const emailLines = [
                `To: ${recipientEmail}`,
                `Subject: ${emailContent.subject}`,
                `Content-Type: text/plain; charset="UTF-8"`,
                '',
                emailContent.body
            ];
            const rawEmail = Buffer.from(emailLines.join('\r\n'))
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
            await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: rawEmail
                }
            });
            console.log(`Escalation email sent to ${recipientEmail}`);
        }
        catch (err) {
            console.error('Error sending email via Gmail API:', err);
        }
    }
    else {
        console.warn('GMAIL_SERVICE_ACCOUNT_KEY is missing, skipping actual email send.');
    }
    // 6. Write to escalation_log
    await db.collection('escalation_log').add({
        report_id: reportId,
        cluster_id: clusterId || null,
        sent_at: admin.firestore.FieldValue.serverTimestamp(),
        email_subject: emailContent.subject,
        recipient_email: recipientEmail
    });
    // 7. Send FCM to affected citizens
    const affectedCitizenIds = clusterData.affected_citizen_ids || [reportData.citizen_id];
    for (const citizenId of affectedCitizenIds) {
        try {
            const userSnap = await db.collection('users').doc(citizenId).get();
            const fcmToken = userSnap.data()?.fcm_token;
            if (fcmToken) {
                await admin.messaging().send({
                    token: fcmToken,
                    notification: {
                        title: 'Issue Escalated',
                        body: 'Your reported issue has been escalated to a higher authority.'
                    }
                });
            }
        }
        catch (e) {
            console.error(`Failed to send FCM to ${citizenId}`, e);
        }
    }
}
//# sourceMappingURL=cf7_escalationEmailSender.js.map