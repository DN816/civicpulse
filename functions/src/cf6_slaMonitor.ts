import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { escalationEmailSender } from './cf7_escalationEmailSender';
import { reportStatusToClusterStatus } from './utils/clusterStatus';

export const slaMonitor = onSchedule(
  {
    schedule: 'every 60 minutes',
    region: 'asia-south1',
  },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    const snapshot = await db
      .collection('reports')
      .where('escalation_sent', '==', false)
      .where('sla_deadline', '<=', now)
      .get();

    if (snapshot.empty) {
      console.log('No overdue reports found.');
      return;
    }

    const excludeStatuses = ['RESOLVED', 'CLOSED', 'REJECTED'];
    let count = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();

      if (excludeStatuses.includes(data.status)) {
        continue;
      }

      console.log(`Escalating report ${doc.id}...`);

      try {
        const emailResult = await escalationEmailSender(doc.id, data);

        if (!emailResult.emailSent) {
          await doc.ref.update({
            escalation_email_failed: true,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.error(`CF6: Email failed for report ${doc.id} — not marking as escalated.`);
          continue;
        }

        await doc.ref.update({
          escalation_sent: true,
          escalation_email_failed: false,
          status: 'ESCALATED',
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (data.cluster_id) {
          const clusterRef = db.collection('clusters').doc(data.cluster_id);
          const clusterSnap = await clusterRef.get();
          const clusterData = clusterSnap.data();
          const terminalCluster = ['resolved', 'closed', 'RESOLVED', 'CLOSED'];
          if (clusterData && !terminalCluster.includes(clusterData.status)) {
            await clusterRef.update({
              escalation_sent: true,
              status: reportStatusToClusterStatus('ESCALATED'),
              updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }

        count++;
      } catch (err) {
        console.error(`Failed to escalate report ${doc.id}:`, err);
        await doc.ref.update({
          escalation_email_failed: true,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    console.log(`Escalated ${count} reports.`);
  }
);
