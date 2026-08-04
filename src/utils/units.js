const KG_PER_LB = 0.45359237
const CM_PER_INCH = 2.54
const ML_PER_FL_OZ = 29.5735295625
const METERS_PER_MILE = 1609.344
const METERS_PER_YARD = 0.9144

export function toFiniteNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function roundMeasurement(value, decimals = 1) {
  const number = toFiniteNumber(value)
  if (number === null) return null
  const factor = 10 ** decimals
  return Math.round(number * factor) / factor
}

export const poundsToKilograms = (value) => convert(value, KG_PER_LB)
export const kilogramsToPounds = (value) => convert(value, 1 / KG_PER_LB)
export const inchesToCentimeters = (value) => convert(value, CM_PER_INCH)
export const centimetersToInches = (value) => convert(value, 1 / CM_PER_INCH)
export const fluidOuncesToMilliliters = (value) => convert(value, ML_PER_FL_OZ)
export const millilitersToFluidOunces = (value) => convert(value, 1 / ML_PER_FL_OZ)
export const milesToMeters = (value) => convert(value, METERS_PER_MILE)
export const metersToMiles = (value) => convert(value, 1 / METERS_PER_MILE)
export const kilometersToMeters = (value) => convert(value, 1000)
export const metersToKilometers = (value) => convert(value, 0.001)
export const yardsToMeters = (value) => convert(value, METERS_PER_YARD)

export function celsiusToFahrenheit(value) {
  const number = toFiniteNumber(value)
  return number === null ? null : (number * 9) / 5 + 32
}

export function getHeightInputs(heightCm, unitSystem = 'imperial') {
  const centimeters = toFiniteNumber(heightCm)
  if (centimeters === null) return unitSystem === 'metric' ? { centimeters: '' } : { feet: '', inches: '' }
  if (unitSystem === 'metric') return { centimeters: roundMeasurement(centimeters, 1) }
  const totalInches = centimetersToInches(centimeters)
  const feet = Math.floor(totalInches / 12)
  return { feet, inches: roundMeasurement(totalInches - feet * 12, 1) }
}

export function heightInputsToCentimeters({ centimeters, feet, inches }, unitSystem = 'imperial') {
  if (unitSystem === 'metric') return toFiniteNumber(centimeters)
  const feetValue = toFiniteNumber(feet)
  const inchesValue = toFiniteNumber(inches)
  if (feetValue === null && inchesValue === null) return null
  return inchesToCentimeters((feetValue ?? 0) * 12 + (inchesValue ?? 0))
}

export function displayWeight(weightKg, unitSystem = 'imperial') {
  const value = unitSystem === 'metric' ? toFiniteNumber(weightKg) : kilogramsToPounds(weightKg)
  return value === null ? '' : roundMeasurement(value, 1)
}

export function inputWeightToKilograms(value, unitSystem = 'imperial') {
  return unitSystem === 'metric' ? toFiniteNumber(value) : poundsToKilograms(value)
}

export function formatHydration(hydrationMl, unitSystem = 'imperial') {
  const value = unitSystem === 'metric' ? toFiniteNumber(hydrationMl) : millilitersToFluidOunces(hydrationMl)
  if (value === null) return '—'
  return unitSystem === 'metric' && value >= 1000
    ? `${roundMeasurement(value / 1000, 2)} L`
    : `${Math.round(value)} ${unitSystem === 'metric' ? 'mL' : 'fl oz'}`
}

export function getWorkloadFieldDisplay(field, canonicalValue, unitSystem = 'imperial') {
  if (field.measurement === 'distance') {
    const value = unitSystem === 'metric' ? metersToKilometers(canonicalValue) : metersToMiles(canonicalValue)
    return { label: unitSystem === 'metric' ? 'km' : 'miles', step: '0.1', value: value === null ? '' : roundMeasurement(value, 2) }
  }
  if (field.measurement === 'load') {
    const value = unitSystem === 'metric' ? toFiniteNumber(canonicalValue) : kilogramsToPounds(canonicalValue)
    return { label: unitSystem === 'metric' ? 'kg' : 'lb', step: '0.5', value: value === null ? '' : roundMeasurement(value, 1) }
  }
  return { label: field.unit ?? '', step: '1', value: canonicalValue ?? '' }
}

export function workloadInputToCanonical(field, value, unitSystem = 'imperial') {
  if (field.measurement === 'distance') return unitSystem === 'metric' ? kilometersToMeters(value) : milesToMeters(value)
  if (field.measurement === 'load') return unitSystem === 'metric' ? toFiniteNumber(value) : poundsToKilograms(value)
  return value
}

function convert(value, multiplier) {
  const number = toFiniteNumber(value)
  return number === null ? null : number * multiplier
}
