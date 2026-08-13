import { chromium } from 'playwright'
import { createServer } from 'vite'

process.env.VITE_SUPABASE_URL = ''
process.env.VITE_SUPABASE_ANON_KEY = ''

const now = new Date()
const date = now.toISOString().slice(0, 10)
const eventTime = new Date(now.getTime() + 90 * 60_000).toTimeString().slice(0, 5)
const priorDate = new Date(now.getTime() - 24 * 60 * 60_000).toISOString().slice(0, 10)
const state = {
  athleteProfile: {
    age: 24,
    dateOfBirth: '2002-05-14',
    displayName: 'Jordan',
    dominantSide: 'Right',
    onboardingCompleted: true,
    position: 'Midfielder',
    sport: 'Soccer',
    trainingStyle: 'Team and individual',
    unitSystem: 'imperial',
  },
  associations: [{ id: 'association-team', name: 'Varsity' }],
  privacyPreferences: { aiPersonalizationEnabled: true, display: { defaultView: 'Home', density: 'comfortable', startupMotion: 'reduced', weekStartsOn: 1 } },
  schedule: [
    { id: 'event-today', date, time: eventTime, title: 'Varsity Training', type: 'Team practice', association: 'Varsity', activityKind: 'training', expectedDuration: 90, expectedIntensity: 'high', importance: 'important', load: 'High', location: 'Seattle, WA', surface: 'Grass' },
    { id: 'event-next', date: priorDate, time: '17:30', title: 'League Match', type: 'Game', association: 'Varsity', activityKind: 'competition', expectedDuration: 90, expectedIntensity: 'maximal', importance: 'priority', load: 'High' },
  ],
  history: [
    { id: 'ci-1', date: priorDate, eventId: 'event-next', eventTitle: 'League Match', session: 'Game', score: 72, sleep: 7.1, sleepQuality: 3, fatigue: 3, soreness: 2, energy: 3, stress: 2 },
  ],
  checkouts: [
    { id: 'co-1', eventId: 'event-next', date: priorDate, title: 'League Match', actualMinutes: 82, difficulty: 8, postFatigue: 4, postSoreness: 3, completionLevel: 'Full', participation: 'Full', sessionLoad: 656, recommendation: { label: 'Recover deliberately', summary: 'A hard match and elevated fatigue make tonight’s recovery fundamentals the priority.', score: 66, tone: 'caution', reasons: [{ label: 'high session load' }, { label: 'high post-event fatigue' }], actions: [{ instruction: 'Eat a familiar recovery meal and restore normal fluids.' }], warnings: [], primaryAction: { instruction: 'Eat a familiar recovery meal and restore normal fluids.' }, reportSections: [] } },
  ],
  dailyWellness: { date, hydrationMl: 1450, nutritionEntries: [{ id: 'food-1', name: 'Greek yogurt and berries', calories: 280, protein: 22, carbs: 34, fat: 6 }] },
  nutritionHistory: [],
  painReports: [],
  painIssues: [],
  savedRoutines: [],
  recoveryCompletions: [],
  shareAuditLogs: [],
  tournaments: [],
}

const server = await createServer({ envDir: false, server: { host: '127.0.0.1', port: 4190 } })
await server.listen()
const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
await page.addInitScript((savedState) => localStorage.setItem('athlete-reload-state', JSON.stringify(savedState)), state)
await page.goto('http://127.0.0.1:4190', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Sign in' }).first().click()
await page.waitForTimeout(500)
await page.getByLabel('Email').fill('visual@athletereload.local')
await page.getByLabel('Password').fill('VisualAudit123!')
await page.locator('.auth-panel').getByRole('button', { name: 'Sign in', exact: true }).click()
try {
  await page.waitForSelector('.dashboard-shell', { timeout: 14_000 })
  await page.locator('.startup-loader').waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {})
} catch (error) {
  console.error((await page.locator('body').innerText()).slice(0, 1800))
  throw error
}

async function capture(name) {
  await page.waitForTimeout(450)
  const audit = await page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const overflow = document.documentElement.scrollWidth - width
    const contrastRisks = [...document.querySelectorAll('body *')].filter((element) => {
      if (!(element instanceof HTMLElement) || !element.innerText.trim() || element.children.length) return false
      const style = getComputedStyle(element)
      const color = style.color.match(/\d+/g)?.slice(0, 3).map(Number)
      let parent = element
      let background
      while (parent && !background) {
        const candidate = getComputedStyle(parent).backgroundColor.match(/\d+/g)?.slice(0, 4).map(Number)
        if (candidate && (candidate[3] ?? 1) > .05) background = candidate.slice(0, 3)
        parent = parent.parentElement
      }
      if (!color || !background) return false
      const distance = color.reduce((sum, value, index) => sum + Math.abs(value - background[index]), 0)
      return distance < 60
    }).slice(0, 12).map((element) => ({ className: element.className, text: element.innerText.slice(0, 60) }))
    return { overflow, contrastRisks }
  })
  await page.screenshot({ path: `artifacts/visual-audit/${name}.png`, fullPage: true })
  console.log(name, JSON.stringify(audit))
}

for (const tab of ['Home', 'Nutrition', 'Recovery', 'Schedule', 'History']) {
  await page.locator(`[data-view="${tab}"]`).click()
  await capture(tab.toLowerCase())
}

await page.setViewportSize({ width: 390, height: 844 })
for (const tab of ['Home', 'Nutrition', 'Recovery', 'Schedule', 'History']) {
  await page.locator(`[data-view="${tab}"]`).click()
  await capture(`mobile-${tab.toLowerCase()}`)
}

await browser.close()
await server.close()
