import { expect, test } from '@playwright/test'

test('landing page exposes keyboard-accessible account entry points', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Athlete Reload')
  await expect(page.getByRole('button', { name: 'Start free' }).first()).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
})
