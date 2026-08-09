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

const locationCache = new Map()

export async function searchLocations(query, { signal } = {}) {
  const name = query?.trim()
  if (!name) return []
  const key = name.toLocaleLowerCase()
  if (locationCache.has(key)) return locationCache.get(key)

  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&format=json&name=${encodeURIComponent(name)}`, { signal })
  if (!response.ok) throw new Error('Location suggestions are temporarily unavailable.')

  const data = await response.json()

  const results = (data.results ?? []).map((result) => ({
    city: result.name,
    country: result.country ?? result.country_code,
    countryCode: result.country_code,
    id: `${result.id ?? `${result.latitude}-${result.longitude}`}`,
    label: formatLocation(result),
    region: result.admin1 ?? '',
  }))
  locationCache.set(key, results)
  return results
}

function formatLocation(result) {
  return [result.name, result.admin1, result.country].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(', ')
}
