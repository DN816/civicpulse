/** Production test accounts — do not commit passwords. */
export const TEST_ACCOUNTS = {
  citizen: {
    email: 'dhruvn0801@gmail.com',
    uid: 'MFN7U37gkEZxZhhspBg51VAOCvJ3',
    role: 'citizen' as const,
    /** Google Sign-In only — save storage state via `npm run test:e2e:setup` */
    signIn: 'google' as const,
  },
  authority: {
    email: 'sudhirgupta001@gmail.com',
    uid: 'KUbuE1BSpkgV7bGu7ACLBQLFIAr2',
    role: 'authority' as const,
    /** Google or email/password — password via E2E_AUTHORITY_PASSWORD env */
    signIn: 'google-or-password' as const,
  },
} as const;
