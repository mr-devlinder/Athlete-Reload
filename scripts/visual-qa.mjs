import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const baseURL = process.env.VISUAL_QA_URL || 'http://127.0.0.1:4174'
const outputDir = path.resolve('artifacts/visual-qa')
const viewports = [
  [360, 800], [390, 844], [430, 932], [768, 1024], [1024, 900], [1280, 900], [1440, 1000], [1920, 1080],
]

await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'chrome' : undefined, headless: true })

try {
  if (process.env.VISUAL_QA_INTERACTIVE_ONLY !== 'true') for (const [width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height } })
    const page = await context.newPage()
    await enterDemo(page)
    for (const view of ['Home', 'Nutrition', 'Recovery', 'Schedule', 'History']) {
      await page.locator(`button[data-view="${view}"]`).click()
      await page.waitForSelector(`.${view.toLowerCase()}-view`, { timeout: 10_000 })
      await assertNoOverflow(page, `${view} ${width}x${height}`)
      await page.screenshot({ path: path.join(outputDir, `${width}-${view.toLowerCase()}.png`), fullPage: true })
    }
    await context.close()
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await enterDemo(page)
  await page.locator('button[data-view="Schedule"]').click()
  await page.waitForSelector('.schedule-view')
  const eventCountBefore = await page.locator('.day-detail .event-card').count()
  await page.getByRole('button', { name: 'Add Event', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Create event', exact: true }).click()
  await page.waitForSelector('[role="dialog"]', { state: 'detached' })
  const eventCountAfter = await page.locator('.day-detail .event-card').count()
  if (eventCountAfter !== eventCountBefore + 1) throw new Error(`Event creation did not update the calendar (${eventCountBefore} -> ${eventCountAfter})`)
  await page.screenshot({ path: path.join(outputDir, '390-event-created.png'), fullPage: true })
  await page.locator('button[data-view="Nutrition"]').click()
  await page.getByRole('button', { name: 'Log', exact: true }).first().click()
  await page.getByRole('button', { name: /Manual Add/i }).click()
  await page.getByLabel('Food name').fill('Tab-away draft bowl')
  const referenceTab = await context.newPage()
  await referenceTab.setContent('<title>Reference</title><p>Nutrition reference</p>')
  await referenceTab.close()
  await page.bringToFront()
  if (await page.getByLabel('Food name').inputValue() !== 'Tab-away draft bowl') throw new Error('Manual nutrition draft was lost after tab-away')
  await page.screenshot({ path: path.join(outputDir, '390-manual-nutrition-draft.png'), fullPage: true })
  await page.getByRole('button', { name: 'Close', exact: true }).click()

  await page.locator('button[data-view="Home"]').click()
  const checkoutAction = page.getByRole('button', { name: /Checkout ready/i })
  if (await checkoutAction.count()) {
    await checkoutAction.click()
    await page.screenshot({ path: path.join(outputDir, '390-checkout-normal.png'), fullPage: true })
    await page.locator('.checkout-step').filter({ hasText: 'Any new or worse pain?' }).getByRole('button', { name: 'Yes' }).click()
    await page.screenshot({ path: path.join(outputDir, '390-checkout-pain.png'), fullPage: true })
    await page.locator('.checkout-step').filter({ hasText: 'Any new or worse pain?' }).getByRole('button', { name: 'No' }).click()
    await page.getByLabel('Participation').selectOption('Full')
    await page.getByLabel('Actual duration').fill('45')
    await page.getByLabel('Session effort (RPE)').selectOption('6')
    await page.locator('.checkout-step').filter({ hasText: 'Any unusual or concerning symptoms?' }).getByRole('button', { name: 'No' }).click()
    await page.getByRole('group', { name: 'Performance compared with normal' }).getByRole('button', { name: 'Normal', exact: true }).click()
    await page.getByRole('button', { name: 'Save checkout', exact: true }).click()
    await page.waitForSelector('.recommendation-modal', { timeout: 10_000 })
    await page.getByRole('button', { name: 'Close', exact: true }).click()
  }
  const checkInAction = page.getByRole('button', { name: /Check-in available/i })
  if (await checkInAction.count()) {
    await checkInAction.click()
    await page.waitForSelector('.checkin-experience', { timeout: 10_000 })
    await page.screenshot({ path: path.join(outputDir, '390-checkin-normal.png'), fullPage: true })
    const painBranchAction = page.getByRole('button', { name: 'Yes', exact: true }).first()
    if (await painBranchAction.count()) {
      await painBranchAction.click()
      await page.screenshot({ path: path.join(outputDir, '390-checkin-pain.png'), fullPage: true })
      await page.locator('.safety-question').first().getByRole('button', { name: 'No', exact: true }).click()
    }
    await page.getByRole('group', { name: 'Energy', exact: true }).getByRole('button', { name: /Energy: 4 of 5/i }).click()
    await page.getByRole('group', { name: 'Fatigue', exact: true }).getByRole('button', { name: /Fatigue: 2 of 5/i }).click()
    await page.getByRole('group', { name: 'Soreness', exact: true }).getByRole('button', { name: /Soreness: 2 of 5/i }).click()
    const saveCheckIn = page.getByRole('button', { name: 'Save check-in', exact: true })
    if (await saveCheckIn.isDisabled()) throw new Error(`Check-in save remained disabled: ${await page.locator('.questionnaire-submit-bar').innerText()}`)
    await saveCheckIn.click()
    await page.waitForSelector('.recommendation-modal', { timeout: 15_000 })
    await page.waitForTimeout(650)
    await page.screenshot({ path: path.join(outputDir, '390-checkin-recommendation.png'), fullPage: true })
    await page.getByRole('button', { name: 'Close', exact: true }).click()
    await assertNoOverflow(page, 'check-in progressive flow')
  }

  await page.locator('button[data-view="Recovery"]').click()
  await page.waitForSelector('.recovery-view')
  await page.getByRole('radio', { name: /Quick reset/i }).click()
  await page.getByRole('button', { name: /Generate recovery plan/i }).click()
  await page.waitForSelector('.recovery-routine-panel', { timeout: 30_000 }).catch(async (error) => {
    await page.screenshot({ path: path.join(outputDir, '390-recovery-generation-failure.png'), fullPage: true })
    throw new Error(`${error.message}\nRecovery page: ${(await page.locator('body').innerText()).slice(-1200)}`)
  })
  await assertReadableRecoveryColors(page)
  await page.screenshot({ path: path.join(outputDir, '390-recovery-generated.png'), fullPage: true })

  await assertNoOverflow(page, 'interactive mobile flow')
  await context.close()
} finally {
  await browser.close()
}

async function enterDemo(page) {
  const browserErrors = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()) })
  await page.goto(baseURL)
  const state = makeDemoState()
  await page.addInitScript((saved) => localStorage.setItem('athlete-reload-state', JSON.stringify(saved)), state)
  await page.reload()
  await page.waitForTimeout(1500)
  let signInFormOpen = false
  if (!await page.getByRole('button', { name: 'Sign in', exact: true }).count()) {
    await page.getByRole('button', { name: 'Start free', exact: true }).first().click()
    await page.getByRole('button', { name: 'Use an existing account', exact: true }).click()
    signInFormOpen = true
  }
  if (!await page.getByRole('button', { name: 'Sign in', exact: true }).count()) {
    throw new Error(`Demo entry unavailable. Body: ${(await page.locator('body').innerText()).slice(0, 800)} Errors: ${browserErrors.join(' | ')}`)
  }
  if (!signInFormOpen) await page.getByRole('button', { name: 'Sign in', exact: true }).first().click()
  await page.waitForTimeout(800)
  if (!await page.getByRole('button', { name: 'Sign in', exact: true }).count()) throw new Error(`Sign-in form unavailable: ${(await page.locator('body').innerText()).slice(0, 800)}`)
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click()
  try {
    await page.waitForSelector('.dashboard-shell', { timeout: 15_000 })
  } catch {
    throw new Error(`Dashboard did not load. Body: ${(await page.locator('body').innerText()).slice(0, 1200)} Errors: ${browserErrors.join(' | ')}`)
  }
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => ({ body: document.body.scrollWidth - window.innerWidth, root: document.documentElement.scrollWidth - window.innerWidth }))
  if (overflow.body > 1 || overflow.root > 1) throw new Error(`${label} has horizontal overflow: ${JSON.stringify(overflow)}`)
}

async function assertReadableRecoveryColors(page) {
  const failures = await page.locator('.recovery-routine-panel :is(h1,h2,h3,p,small,strong,span,button)').evaluateAll((nodes) => {
    function luminance(rgb) {
      const values = rgb.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0]
      const linear = values.map((value) => { const channel = value / 255; return channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4 })
      return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2]
    }
    return nodes.filter((node) => {
      if (!node.textContent?.trim() || node.getClientRects().length === 0) return false
      const style = getComputedStyle(node)
      let parent = node
      let background = 'rgb(255, 255, 255)'
      while (parent) {
        const candidate = getComputedStyle(parent).backgroundColor
        if (candidate && candidate !== 'rgba(0, 0, 0, 0)' && candidate !== 'transparent') { background = candidate; break }
        parent = parent.parentElement
      }
      const first = luminance(style.color); const second = luminance(background)
      return (Math.max(first, second) + .05) / (Math.min(first, second) + .05) < 3
    }).map((node) => node.textContent.trim().slice(0, 80))
  })
  if (failures.length) throw new Error(`Unreadable recovery colors: ${failures.join(' | ')}`)
}

function makeDemoState() {
  const now = new Date()
  const today = isoDate(now)
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1)
  const future = new Date(now.getTime() + 60 * 60 * 1000)
  const earlier = new Date(now.getTime() - 90 * 60 * 1000)
  const schedule = [
    { id: 'event-future', date: today, time: timeValue(future), title: 'Team training', type: 'Team practice', load: 'Medium', association: 'Personal', expectedDuration: 75, plannedMinutes: 75 },
    { id: 'event-earlier', date: today, time: timeValue(earlier), title: 'Gym session', type: 'Gym session', load: 'High', association: 'Personal', expectedDuration: 60, plannedMinutes: 60 },
    { id: 'event-game', date: isoDate(tomorrow), time: '19:15', title: 'League match', type: 'Game', load: 'High', association: 'Personal', expectedDuration: 90, plannedMinutes: 90 },
  ]
  const nutritionEntries = [{ id: 'food-1', meal: 'Breakfast', name: 'Oats and yogurt', calories: 430, carbohydrates: 62, protein: 25, fats: 10, loggedAt: now.toISOString() }]
  return {
    athleteProfile: { displayName: 'Demo Athlete', sport: 'Soccer', position: 'Midfielder', dateOfBirth: '2000-01-01', onboardingCompleted: true, unitSystem: 'imperial', weightKg: 70, heightCm: 175 },
    checkIn: {}, associations: [], checkouts: [], history: [{ id: 'check-earlier', eventId: 'event-earlier', date: today, eventTime: timeValue(earlier), eventTitle: 'Gym session', session: 'Gym session', energy: 4, fatigue: 2, soreness: 2, sleep: 7.5, sleepQuality: 4, stress: 2, illnessSymptoms: 0, pain: 0, score: 82 }],
    painReports: [], painIssues: [], savedRoutines: [], recoveryCompletions: [], shareAuditLogs: [], tournaments: [], schedule,
    dailyWellness: { date: today, hydrationMl: 850, nutritionEntries }, nutritionHistory: [{ date: today, hydrationMl: 850, nutritionEntries }],
    privacyPreferences: { aiPersonalizationEnabled: true, remindersEnabled: false, display: { defaultView: 'Home', density: 'comfortable', showNutritionTargets: true, startupMotion: 'reduced', unitSystem: 'imperial', weekStartsOn: 0 } },
  }
}

function isoDate(date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') }
function timeValue(date) { return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` }
