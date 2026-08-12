import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('landing has no automatically detectable serious accessibility violations', async ({ page }) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact))).toEqual([])
})
