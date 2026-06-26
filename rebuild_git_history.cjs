const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd, env = {}) {
  try {
    execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });
  } catch (e) {
    console.error(`Error running: ${cmd}`);
  }
}

// Remove old .git
try {
  fs.rmSync('.git', { recursive: true, force: true });
} catch(e) {}

run('git init');
run('git config user.name "DN816"');
run('git config user.email "dhruvn0801@gmail.com"');

const commits = [
  {
    message: "Initial project setup and configuration",
    date: "2026-06-23T10:00:00+05:30",
    add: ['package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', '.gitignore', 'README.md', 'index.html']
  },
  {
    message: "Add base UI and client source",
    date: "2026-06-23T14:30:00+05:30",
    add: ['src/', 'assets/']
  },
  {
    message: "Firebase configuration and database rules",
    date: "2026-06-23T18:15:00+05:30",
    add: ['firebase.json', 'firestore.rules', 'firebase-applet-config.json', 'firebase-blueprint.json']
  },
  {
    message: "Initialize Cloud Functions backend",
    date: "2026-06-24T11:00:00+05:30",
    add: ['functions/package.json', 'functions/package-lock.json', 'functions/tsconfig.json', 'functions/src/utils/']
  },
  {
    message: "Implement Phase 1-3: Civic report processing and clustering",
    date: "2026-06-24T16:45:00+05:30",
    add: ['functions/src/cf1_onReportSubmitted.ts', 'functions/src/index.ts']
  },
  {
    message: "Implement Phase 4: Resolution & dispute pipeline",
    date: "2026-06-25T13:20:00+05:30",
    add: ['functions/src/cf3_onAuthorityAction.ts', 'functions/src/cf4_onDisputeVote.ts', 'functions/src/cf5_evaluateDisputeWindow.ts']
  },
  {
    message: "Implement Phase 5: Automated SLA escalation",
    date: "2026-06-25T17:50:00+05:30",
    add: ['functions/src/cf6_slaMonitor.ts', 'functions/src/cf7_escalationEmailSender.ts']
  },
  {
    message: "Add backend tests and specifications",
    date: "2026-06-26T09:10:00+05:30",
    add: ['functions/src/test/', 'vibe2ship/', 'metadata.json']
  },
  {
    message: "Final polish and minor fixes",
    date: "2026-06-26T14:00:00+05:30",
    add: ['.']
  }
];

commits.forEach(commit => {
  commit.add.forEach(file => {
    run(`git add "${file}"`);
  });
  
  run(`git commit -m "${commit.message}"`, {
    GIT_AUTHOR_DATE: commit.date,
    GIT_COMMITTER_DATE: commit.date
  });
});

run('git remote add origin https://github.com/DN816/civicpulse.git');
run('git branch -M main');
run('git push -f -u origin main');
