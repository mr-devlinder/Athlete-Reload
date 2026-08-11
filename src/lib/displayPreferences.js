export const displayPreferenceDefaults = {
  defaultView: 'Home',
  density: 'comfortable',
  showNutritionTargets: true,
  startupMotion: 'full',
  unitSystem: 'imperial',
  weekStartsOn: 1,
}

const allowedViews = new Set(['Home', 'Nutrition', 'Recovery', 'Schedule', 'History'])

export function normalizeDisplayPreferences(value = {}, profileUnitSystem = 'imperial') {
  return {
    defaultView: allowedViews.has(value.defaultView) ? value.defaultView : displayPreferenceDefaults.defaultView,
    density: value.density === 'compact' ? 'compact' : 'comfortable',
    showNutritionTargets: value.showNutritionTargets !== false,
    startupMotion: value.startupMotion === 'reduced' ? 'reduced' : 'full',
    unitSystem:
      value.unitSystem === 'metric' || value.unitSystem === 'imperial'
        ? value.unitSystem
        : profileUnitSystem === 'metric'
          ? 'metric'
          : 'imperial',
    weekStartsOn: value.weekStartsOn === 0 ? 0 : 1,
  }
}
