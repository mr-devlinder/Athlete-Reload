export const MINIMUM_ATHLETE_AGE = 16

export function calculateAge(dateOfBirth, today = new Date()) {
  if (!dateOfBirth) return null
  const birthDate = new Date(`${dateOfBirth}T12:00:00`)
  if (Number.isNaN(birthDate.getTime()) || birthDate > today) return null
  let age = today.getFullYear() - birthDate.getFullYear()
  const birthdayHasPassed = today.getMonth() > birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate())
  if (!birthdayHasPassed) age -= 1
  return age
}

export function getAgeAccess(profile, today = new Date()) {
  const exactAge = calculateAge(profile?.dateOfBirth, today)
  const legacyAge = Number(profile?.age)
  if (exactAge != null) return exactAge < MINIMUM_ATHLETE_AGE
    ? { status: 'restricted', age: exactAge }
    : { status: 'allowed', age: exactAge }
  if (Number.isFinite(legacyAge) && legacyAge > 0 && legacyAge < MINIMUM_ATHLETE_AGE) {
    return { status: 'restricted', age: legacyAge }
  }
  return { status: 'confirmation_required', age: null }
}
