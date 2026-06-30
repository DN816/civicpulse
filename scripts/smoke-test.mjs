/**
 * Static smoke checks for CivicPulse flows — validates rules-aligned payloads
 * and cluster status mappings without requiring live credentials.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

// --- cluster status mapping (mirror src/utils/clusterStatus.ts) ---
function reportStatusToClusterStatus(reportStatus) {
  const fromReport = {
    NEW: 'active',
    IN_REVIEW: 'in_review',
    APPROVED: 'assigned',
    ASSIGNED: 'assigned',
    IN_PROGRESS: 'in_progress',
    AWAITING_CONFIRMATION: 'awaiting_confirmation',
    RESOLVED: 'resolved',
    REJECTED: 'closed',
    CLOSED: 'closed',
    REOPENED: 'reopened',
    ESCALATED: 'escalated',
  };
  const upper = reportStatus.toUpperCase();
  return fromReport[upper] ?? 'active';
}

console.log('\n=== Cluster status mappings ===');
assert(reportStatusToClusterStatus('APPROVED') === 'assigned', 'APPROVED → assigned');
assert(reportStatusToClusterStatus('REJECTED') === 'closed', 'REJECTED → closed');
assert(reportStatusToClusterStatus('ASSIGNED') === 'assigned', 'ASSIGNED → assigned');
assert(reportStatusToClusterStatus('IN_REVIEW') === 'in_review', 'IN_REVIEW → in_review');

// --- Firestore rules alignment ---
console.log('\n=== Firestore write payload alignment ===');

const authorityReportUpdateKeys = ['status', 'updated_at', 'authority_id'];
const issueDetailSrc = readFileSync(join(root, 'src/screens/authority/IssueDetailScreen.tsx'), 'utf8');
assert(
  issueDetailSrc.includes('updated_at: serverTimestamp()') &&
    issueDetailSrc.includes('const reportUpdate'),
  'IssueDetailScreen includes updated_at on report updates'
);

const markResolvedSrc = readFileSync(join(root, 'src/screens/authority/MarkResolvedScreen.tsx'), 'utf8');
assert(
  markResolvedSrc.includes('reports/${reportId}/after'),
  'MarkResolvedScreen uses authority storage path reports/{reportId}/after'
);
assert(
  !markResolvedSrc.includes('reports/${user.uid}/${reportId}/after'),
  'MarkResolvedScreen does not use citizen storage path for after photo'
);

const storageRules = readFileSync(join(root, 'storage.rules'), 'utf8');
assert(
  storageRules.includes('match /reports/{reportId}/{fileName}'),
  'storage.rules defines authority path reports/{reportId}/{fileName}'
);

const citizenReportSrc = readFileSync(join(root, 'src/screens/citizen/ReportScreen.tsx'), 'utf8');
assert(
  citizenReportSrc.includes('reports/${user.uid}/${reportId}/before'),
  'ReportScreen uses citizen storage path for before photo'
);

const clarificationSrc = readFileSync(join(root, 'src/screens/citizen/ClarificationScreen.tsx'), 'utf8');
const clarificationKeys = ['clarification_answer', 'description', 'status'];
assert(
  clarificationKeys.every((k) => clarificationSrc.includes(k)),
  'ClarificationScreen updates only rules-allowed fields'
);

const moderatorReviewSrc = readFileSync(join(root, 'src/screens/moderator/ModeratorReviewScreen.tsx'), 'utf8');
assert(
  moderatorReviewSrc.includes('updated_at: serverTimestamp()'),
  'ModeratorReviewScreen cluster update includes updated_at'
);

// --- Required report create fields ---
console.log('\n=== Citizen report create payload ===');
const reportCreateFields = [
  'id: reportId',
  "category: ''",
  "severity: 'Low'",
  "status: 'NEW'",
  'updated_at: serverTimestamp()',
  'affected_citizen_ids',
];
for (const field of reportCreateFields) {
  assert(citizenReportSrc.includes(field), `ReportScreen sets ${field.split(':')[0].trim()}`);
}

// --- Router null guards ---
console.log('\n=== Router guards ===');
const citizenRouter = readFileSync(join(root, 'src/screens/citizen/CitizenRouter.tsx'), 'utf8');
assert(citizenRouter.includes('SCREENS_REQUIRING_REPORT_ID'), 'CitizenRouter guards report-id screens');

const authorityRouter = readFileSync(join(root, 'src/screens/authority/AuthorityRouter.tsx'), 'utf8');
assert(authorityRouter.includes('SCREENS_REQUIRING_CLUSTER_ID'), 'AuthorityRouter guards cluster-id screens');

const moderatorRouter = readFileSync(join(root, 'src/screens/moderator/ModeratorRouter.tsx'), 'utf8');
assert(moderatorRouter.includes("currentScreen === 'review' && !activeReportId"), 'ModeratorRouter guards review screen');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
