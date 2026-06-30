import { test, expect } from '@playwright/test';

test.describe('Welcome & auth screens', () => {
  test('welcome screen loads and navigates to sign in', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('CivicPulse')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Welcome Back')).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('sign in shows validation error for empty submit', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText(/please fill in all fields/i)).toBeVisible();
  });

  test('create account screen loads from welcome', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText('Join CivicPulse')).toBeVisible();
    await expect(page.getByLabel(/display name/i)).toBeVisible();
  });

  test('create account validates password mismatch', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /create account/i }).click();
    await page.getByLabel(/display name/i).fill('Test User');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.locator('input[type="password"]').first().fill('password123');
    await page.getByLabel(/confirm password/i).fill('different');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('sign in with bad credentials shows error', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.getByLabel(/email/i).fill('nonexistent-user@civicpulse-test.invalid');
    await page.locator('input[type="password"]').fill('wrongpassword123');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText(/incorrect email or password|error occurred/i)).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Citizen UI (unauthenticated redirect)', () => {
  test('stays on welcome when not signed in', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Full signup flow', () => {
  test('email signup redirects to verify-email screen', async ({ page }) => {
    const unique = `e2e-${Date.now()}@civicpulse-e2e.invalid`;
    await page.goto('/');
    await page.getByRole('button', { name: /create account/i }).click();
    await page.getByLabel(/display name/i).fill('E2E Tester');
    await page.getByLabel(/email/i).fill(unique);
    await page.locator('input[type="password"]').first().fill('TestPass123!');
    await page.getByLabel(/confirm password/i).fill('TestPass123!');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(unique)).toBeVisible();
  });
});
