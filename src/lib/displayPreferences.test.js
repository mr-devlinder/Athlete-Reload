import { describe, expect, it } from 'vitest'
import { displayPreferenceDefaults, normalizeDisplayPreferences } from './displayPreferences'

describe('display preferences', () => {
  it('uses backward-compatible defaults', () => {
    expect(normalizeDisplayPreferences()).toEqual(displayPreferenceDefaults)
  })

  it('accepts supported operational values', () => {
    expect(normalizeDisplayPreferences({ defaultView: 'Recovery', density: 'compact', showNutritionTargets: false, startupMotion: 'reduced', unitSystem: 'metric', weekStartsOn: 0 })).toEqual({ defaultView: 'Recovery', density: 'compact', showNutritionTargets: false, startupMotion: 'reduced', unitSystem: 'metric', weekStartsOn: 0 })
  })

  it('rejects unsupported values', () => {
    expect(normalizeDisplayPreferences({ defaultView: 'Admin', density: 'tiny', weekStartsOn: 4 })).toEqual(displayPreferenceDefaults)
  })

  it('lets an explicit display preference override legacy profile units', () => {
    expect(normalizeDisplayPreferences({ unitSystem: 'imperial' }, 'metric').unitSystem).toBe('imperial')
  })
})
