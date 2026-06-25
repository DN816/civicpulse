import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { escalationEmailSender } from './cf7_escalationEmailSender';

export const slaMonitor = onSchedule(
  {
    schedule: 'every 60 minutes',
    region: 'asia-south1'
  },
  async (event) => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    // Query Firestore for reports where:
    // escalation_sent = false
    // sla_deadline <= NOW()
    // Due to Firestore index limitations on inequality queries, we filter by these two
    // and then filter out RESOLVED, CLOSED, REJECTED statuses in memory.
    const snapshot = await db.collection('reports')
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
        await escalationEmailSender(doc.id, data);
        
        await doc.ref.update({ 
          escalation_sent: true,
          status: 'ESCALATED' 
        });

        // Also update the cluster status to ESCALATED if it's not already resolved
        if (data.cluster_id) {
          const clusterRef = db.collection('clusters').doc(data.cluster_id);
          const clusterSnap = await clusterRef.get();
          const clusterData = clusterSnap.data();
          if (clusterData && !excludeStatuses.includes(clusterData.status)) {
             await clusterRef.update({
               escalation_sent: true,
               status: 'ESCALATED'
             });
          }
        }
        
        count++;
      } catch (err) {
        console.error(`Failed to escalate report ${doc.id}:`, err);
      }
    }

    console.log(`Escalated ${count} reports.`);
  }
);
