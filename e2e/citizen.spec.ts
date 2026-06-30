import { existsSync } from 'fs';
import { test, expect } from '@playwright/test';
import { TEST_ACCOUNTS } from './test-accounts';

const citizenAuthFile = 'e2e/.auth/citizen.json';
const hasCitizenSession = existsSync(citizenAuthFile);

test.describe('Citizen account (saved Google session)', () => {
  test.skip(!hasCitizenSession, 'Run npm run test:e2e:setup to save citizen session');
  test.use({ storageState: citizenAuthFile });

  test('loads citizen home', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/my reports|report issue|home/i).first()).toBeVisible({ timeout: 30000 });
  });

  test('report screen loads with location section', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /report/i }).first().click();
    await expect(page.getByText(/location|detecting location|photo/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('can open report detail from home if reports exist', async ({ page }) => {
    await page.goto('/');
    const reportCard = page.locator('[class*="cursor-pointer"]').filter({ hasText: /./ }).first();
    if ((await reportCard.count()) === 0) {
      test.skip(true, 'No reports on citizen home — submit one first');
    }
    await reportCard.click();
    await expect(page.getByText(/report details|before/i).first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Citizen account metadata', () => {
  test('test account is configured', async () => {
    expect(TEST_ACCOUNTS.citizen.email).toBe('dhruvn0801@gmail.com');
    expect(TEST_ACCOUNTS.citizen.role).toBe('citizen');
  });
});
