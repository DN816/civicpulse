import * as admin from 'firebase-admin';
import { GoogleGenAI } from '@google/genai';
import { google } from 'googleapis';

export interface EscalationEmailResult {
  emailSent: boolean;
  recipientEmail?: string;
}

export async function escalationEmailSender(
  reportId: string,
  reportData: FirebaseFirestore.DocumentData
): Promise<EscalationEmailResult> {
  const db = admin.firestore();

  const clusterId = reportData.cluster_id as string | undefined;
  let clusterData: FirebaseFirestore.DocumentData = {};
  if (clusterId) {
    const clusterSnap = await db.collection('clusters').doc(clusterId).get();
    clusterData = clusterSnap.data() || {};
  }

  const authorityId = (clusterData.authority_id || reportData.authority_id) as string | undefined;
  if (!authorityId) {
    throw new Error(`CF7: Missing authority_id for report ${reportId} — cannot send escalation email`);
  }

  const userSnap = await db.collection('users').doc(authorityId).get();
  const recipientEmail = userSnap.data()?.email as string | undefined;
  if (!recipientEmail) {
    throw new Error(`CF7: No email found for authority ${authorityId} on report ${reportId}`);
  }

  const now = Date.now();
  const createdMs = reportData.created_at ? reportData.created_at.toMillis() : now;
  const daysOpen = Math.floor((now - createdMs) / (1000 * 60 * 60 * 24));
  const slaMs = reportData.sla_deadline ? reportData.sla_deadline.toMillis() : now;
  const daysOverdue = Math.max(0, Math.floor((now - slaMs) / (1000 * 60 * 60 * 24)));

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `
You are an automated escalation system for CivicPulse.
Write a formal escalation email in plain English.
Report Category: ${reportData.category}
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
      contents: [prompt],
    });
    const text = response.text ?? '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    emailContent = JSON.parse(clean);
  } catch (err) {
    console.error('Error calling Gemini for escalation email:', err);
  }

  let emailSent = false;
  const encodedKey = process.env.GMAIL_SERVICE_ACCOUNT_KEY;

  if (!encodedKey) {
    throw new Error('GMAIL_SERVICE_ACCOUNT_KEY is missing — cannot send escalation email');
  }

  try {
    const serviceAccount = JSON.parse(Buffer.from(encodedKey, 'base64').toString('utf8'));

    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      subject: process.env.GMAIL_ESCALATION_SENDER,
    });

    const gmail = google.gmail({ version: 'v1', auth });

    const emailLines = [
      `To: ${recipientEmail}`,
      `Subject: ${emailContent.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      emailContent.body,
    ];

    const rawEmail = Buffer.from(emailLines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawEmail },
    });
    emailSent = true;
    console.log(`Escalation email sent to ${recipientEmail}`);
  } catch (err) {
    console.error('Error sending email via Gmail API:', err);
    throw err;
  }

  await db.collection('escalation_log').add({
    report_id: reportId,
    cluster_id: clusterId || null,
    sent_at: admin.firestore.FieldValue.serverTimestamp(),
    email_subject: emailContent.subject,
    recipient_email: recipientEmail,
  });

  const affectedCitizenIds = (clusterData.affected_citizen_ids as string[]) || [reportData.citizen_id];
  for (const citizenId of affectedCitizenIds) {
    try {
      const citizenSnap = await db.collection('users').doc(citizenId).get();
      const fcmToken = citizenSnap.data()?.fcm_token;
      if (fcmToken) {
        await admin.messaging().send({
          token: fcmToken,
          notification: {
            title: 'Issue Escalated',
            body: 'Your reported issue has been escalated to a higher authority.',
          },
        });
      }
    } catch (e) {
      console.error(`Failed to send FCM to ${citizenId}`, e);
    }
  }

  return { emailSent, recipientEmail };
}
