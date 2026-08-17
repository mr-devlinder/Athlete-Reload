import { expect, test } from '@playwright/test'

test('dense app sections use progressive disclosure on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    const today = new Date().toISOString().slice(0, 10)
    localStorage.setItem('athlete-reload-state', JSON.stringify({
      athleteProfile: { age: 20, dateOfBirth: '2000-01-01', displayName: 'Demo Athlete', onboardingCompleted: true, sport: 'Soccer', unitSystem: 'imperial' },
      checkouts: [{ id: 'checkout-progressive', date: today, createdAt: `${today}T18:00:00.000Z`, title: 'Training', eventId: 'event-progressive', actualMinutes: 60, difficulty: 7, postFatigue: 3, postSoreness: 2, painMap: {} }],
      dailyWellness: { date: today, hydrationMl: 946, nutritionEntries: [{ id: 'food-1', meal: 'Breakfast', name: 'Oatmeal', calories: 320, carbohydrates: 52, fats: 8, protein: 14 }] },
      history: [{ id: 'checkin-progressive', date: today, createdAt: `${today}T15:00:00.000Z`, eventId: 'event-progressive', fatigue: 2, soreness: 1, sleep: 8, score: 82 }],
      nutritionHistory: [],
      privacyPreferences: { display: { defaultView: 'Home', density: 'comfortable', startupMotion: 'reduced', unitSystem: 'imperial', weekStartsOn: 1 } },
      recoveryCompletions: [],
      recoveryPlans: [],
      savedRoutines: [],
      schedule: [{ id: 'event-progressive', date: today, time: '17:00', title: 'Training', type: 'Practice' }],
    }))
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Start free' }).first().click()
  await page.getByLabel('Email').fill('demo@athletereload.local')
  await page.getByRole('checkbox').check()
  await page.locator('form').getByRole('button', { name: 'Create account', exact: true }).click()

  await expect(page.getByRole('tab', { name: /Today/ })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('tab', { name: /Signals/ }).click()
  await expect(page.getByRole('heading', { name: 'Signals that change today' })).toBeVisible()
  await page.getByRole('tab', { name: /Recovery/ }).click()
  await expect(page.getByText('Recovery plan', { exact: true })).toBeVisible()
  await assertNoPageOverflow(page)

  await page.getByRole('button', { name: 'Nutrition', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Fuel for the day.' })).toBeVisible()
  await page.getByRole('tab', { name: /Fueling plan/ }).click()
  await expect(page.getByText("Today's fueling context")).toBeVisible()
  await page.getByRole('tab', { name: /Meals/ }).click()
  await expect(page.getByRole('heading', { name: 'Meals' })).toBeVisible()
  await assertNoPageOverflow(page)

  await page.getByRole('button', { name: 'History', exact: true }).click()
  await expect(page.getByRole('tab', { name: /Overview/ })).toBeVisible()
  await page.getByRole('tab', { name: /Trends/ }).click()
  await expect(page.getByRole('heading', { name: 'Patterns worth watching' })).toBeVisible()
  await page.getByRole('tab', { name: /Records/ }).click()
  await expect(page.getByRole('heading', { name: 'Your Athlete Reload archive' })).toBeVisible()
  await assertNoPageOverflow(page)
})

async function assertNoPageOverflow(page) {
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client)
}
