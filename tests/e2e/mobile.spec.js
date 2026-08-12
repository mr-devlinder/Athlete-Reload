import { expect, test } from '@playwright/test'

for (const [width, height] of [[320, 568], [375, 812], [390, 844], [393, 852], [430, 932], [768, 1024]]) {
  test(`landing has no page overflow at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client)
    await expect(page.getByRole('button', { name: 'Create your account' })).toBeVisible()
  })
}
