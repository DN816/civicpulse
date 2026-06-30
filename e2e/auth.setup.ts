import { test as setup, expect } from '@playwright/test';
import { TEST_ACCOUNTS } from './test-accounts';

/**
 * One-time headed setup: log in manually (Google or password), then press Resume in Inspector.
 * Saves session for authenticated E2E runs.
 *
 *   npm run test:e2e:setup
 */
const roles = ['citizen', 'authority'] as const;

for (const role of roles) {
  setup(`save ${role} auth state`, async ({ page }) => {
    const account = TEST_ACCOUNTS[role];
    setup.info().annotations.push({
      type: 'note',
      description: `Sign in as ${account.email} (${account.signIn}), then resume when dashboard loads.`,
    });

    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Welcome Back')).toBeVisible();

    // Pause for manual Google/password sign-in
    await page.pause();

    await expect(page.getByText(/dashboard|review queue|my reports|report issue/i).first()).toBeVisible({
      timeout: 120000,
    });
    await page.context().storageState({ path: `e2e/.auth/${role}.json` });
  });
}
