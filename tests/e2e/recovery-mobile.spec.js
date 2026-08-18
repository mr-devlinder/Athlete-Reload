import { expect, test } from '@playwright/test'

for (const width of [320, 390, 430]) {
  test(`Recovery and Mobility fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.addInitScript(() => {
      const today = new Date().toISOString().slice(0, 10)
      localStorage.setItem('athlete-reload-state', JSON.stringify({
        athleteProfile: { age: 20, dateOfBirth: '2000-01-01', displayName: 'Demo Athlete', onboardingCompleted: true, sport: 'Soccer', unitSystem: 'imperial' },
        checkouts: [{
          id: 'checkout-mobile-qa', date: today, createdAt: `${today}T18:00:00.000Z`, title: 'Training', eventTitle: 'Training', eventId: 'event-mobile-qa', actualMinutes: 60, difficulty: 7, postFatigue: 3, postSoreness: 2, painMap: {},
          recommendation: {
            label: 'Restore after a demanding session',
            summary: 'Refuel, rehydrate, and protect tonight’s sleep window.',
            priorities: ['Replace fluids gradually.', 'Eat a balanced recovery meal.', 'Keep the rest of the evening easy.'],
            contextFactors: ['60 minute training session', '7/10 effort', '2/5 soreness'],
            reportSections: [
              { id: 'recovery-priorities', title: 'Priorities', items: [] },
              { id: 'next-few-hours', title: 'Next few hours', summary: 'Keep the basics simple.', items: ['Sip fluids.', 'Eat when comfortable.'] },
              { id: 'sleep', title: 'Sleep', summary: 'Protect a consistent bedtime.', items: [] },
            ],
          },
        }],
        history: [],
        privacyPreferences: { display: { defaultView: 'Recovery', density: 'comfortable', startupMotion: 'reduced', unitSystem: 'imperial', weekStartsOn: 1 } },
        recoveryCompletions: [],
        recoveryPlans: [],
        savedRoutines: [],
        schedule: [{ id: 'event-mobile-qa', date: today, time: '17:00', title: 'Training', type: 'Practice' }],
      }))
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Start free' }).first().click()
    await page.getByLabel('Email').fill('demo@athletereload.local')
    await page.getByRole('checkbox').check()
    await page.locator('form').getByRole('button', { name: 'Create account', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Recover with context. Move with purpose.' })).toBeVisible({ timeout: 15_000 })

    await assertNoPageOverflow(page)
    await expect(page.getByText('Recovery plan ready')).toBeVisible()
    await expect(page.getByRole('button', { name: /Refresh Plan/i })).toHaveCount(0)
    await expect(page.getByText('Replace fluids gradually.')).toBeVisible()
    await page.getByRole('tab', { name: 'Plan details' }).click()
    await expect(page.getByText('Next few hours')).toBeVisible()
    const sleepCard = page.locator('.recovery-detail-static').filter({ hasText: 'Sleep' })
    await expect(sleepCard).toBeVisible()
    await expect(sleepCard.locator('summary')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Session context' }).click()
    await expect(page.getByText('60', { exact: true })).toBeVisible()
    await assertNoPageOverflow(page)
    await page.getByRole('tab', { name: 'Mobility' }).click()
    await expect(page.getByRole('heading', { name: 'Build a routine that fits the moment.' })).toBeVisible()
    await assertNoPageOverflow(page)

    await page.getByRole('button', { name: /Full Body Mobility/ }).click()
    await page.getByRole('button', { name: /Generate Mobility Routine/ }).click()
    await expect(page.getByRole('heading', { name: /Minute Full Body Mobility/ })).toBeVisible({ timeout: 15_000 })
    await assertNoPageOverflow(page)
  })
}

async function assertNoPageOverflow(page) {
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client)
}
