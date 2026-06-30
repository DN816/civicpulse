import { existsSync } from 'fs';
import { test, expect } from '@playwright/test';
import { TEST_ACCOUNTS } from './test-accounts';

const authorityAuthFile = 'e2e/.auth/authority.json';
const hasAuthoritySession = existsSync(authorityAuthFile);
const password = process.env.E2E_AUTHORITY_PASSWORD;

test.describe('Authority account (email/password)', () => {
  test.skip(!password, 'Set E2E_AUTHORITY_PASSWORD in .env to run authority password sign-in tests');

  test('signs in and loads authority dashboard', async ({ page }) => {
    const { email } = TEST_ACCOUNTS.authority;

    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByLabel(/email/i).fill(email);
    await page.locator('input[type="password"]').fill(password!);
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/zone/i)).toBeVisible();
  });

  test('dashboard shows issue list or empty state', async ({ page }) => {
    const { email } = TEST_ACCOUNTS.authority;

    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByLabel(/email/i).fill(email);
    await page.locator('input[type="password"]').fill(password!);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 30000 });

    const empty = page.getByText(/all clear|no issues assigned/i);
    const issueCard = page.getByText(/citizens affected|days open/i).first();
    await expect(empty.or(issueCard)).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Authority account (saved Google session)', () => {
  test.skip(!hasAuthoritySession, 'Run npm run test:e2e:setup to save authority session');
  test.use({ storageState: authorityAuthFile });

  test('loads dashboard from saved session', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 30000 });
  });

  test('metrics screen loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: /metrics/i }).click();
    await expect(page.getByText(/sla|resolved|assigned/i).first()).toBeVisible({ timeout: 15000 });
  });
});
