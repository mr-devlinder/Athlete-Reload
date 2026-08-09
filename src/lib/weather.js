export async function getEventWeather(city) {
  if (!city?.trim()) return null

  const place = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city.trim())}`).then((response) => response.json())
  const result = place.results?.[0]
  if (!result) throw new Error('Enter a valid city or region.')

  const forecast = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&temperature_unit=celsius&current=temperature_2m,apparent_temperature,precipitation,weather_code`).then((response) => response.json())
  const current = forecast.current
  if (!current) return null

  return { city: formatLocation(result), countryCode: result.country_code, feelsLike: Math.round(current.apparent_temperature), observedAt: current.time, temperature: Math.round(current.temperature_2m), temperatureC: Math.round(current.temperature_2m), wet: Number(current.precipitation) > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(Number(current.weather_code)) }
}

export async function searchLocations(query) {
  const name = query?.trim()
  if (!name || name.length < 2) return []

  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=6&name=${encodeURIComponent(name)}`)
  if (!response.ok) throw new Error('City search is temporarily unavailable.')

  const data = await response.json()

  return (data.results ?? []).map((result) => ({
    countryCode: result.country_code,
    id: `${result.id ?? `${result.latitude}-${result.longitude}`}`,
    label: formatLocation(result),
  }))
}

export const searchUsCities = searchLocations

function formatLocation(result) {
  return [result.name, result.admin1, result.country].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(', ')
}
