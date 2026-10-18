import { expect, test } from '@playwright/test';

/**
 * Staff ACL E2E — требует запущенные API (:3001) и Admin (:3010), seed с moderator@jcos.local.
 *
 *   npm run dev:api
 *   npm run dev:admin
 *   cd Admin && npm run test:e2e
 *
 * Env: E2E_MODERATOR_EMAIL, E2E_MODERATOR_PASSWORD
 */
const moderatorEmail =
  process.env.E2E_MODERATOR_EMAIL ?? 'moderator@jcos.local';
const moderatorPassword =
  process.env.E2E_MODERATOR_PASSWORD ?? 'change-me-moderator';

async function loginModerator(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(moderatorEmail);
  await page.getByLabel('Пароль').fill(moderatorPassword);
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.waitForURL(/\/admin(\/)?(\?.*)?$/, { timeout: 15_000 });
}

test.describe('Staff ACL — moderator', () => {
  test('login → staff CRUD denied → profile allowed', async ({ page }) => {
    await loginModerator(page);

    await page.goto('/admin/settings/staff');
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(page.getByRole('heading', { name: 'Сотрудники' })).toHaveCount(0);

    await page.goto('/admin/settings');
    await expect(page).toHaveURL(/\/admin\/?$/);

    await page.goto('/admin/settings/staff/me');
    await expect(page.getByRole('heading', { name: 'Мой профиль' })).toBeVisible();
  });
});
