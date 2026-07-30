export async function getEventWeather(city) {
  if (!city?.trim()) return null

  const place = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&countryCode=US&name=${encodeURIComponent(city.trim())}`).then((response) => response.json())
  const result = place.results?.[0]
  if (!result) throw new Error('Enter a valid U.S. city.')

  const forecast = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&temperature_unit=fahrenheit&current=temperature_2m,apparent_temperature,precipitation,weather_code`).then((response) => response.json())
  const current = forecast.current
  if (!current) return null

  return { city: `${result.name}, ${result.admin1 ?? result.country_code}`, feelsLike: Math.round(current.apparent_temperature), temperature: Math.round(current.temperature_2m), wet: Number(current.precipitation) > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(Number(current.weather_code)) }
}

export async function searchUsCities(query) {
  const name = query?.trim()
  if (!name || name.length < 2) return []

  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=6&countryCode=US&name=${encodeURIComponent(name)}`)
  if (!response.ok) throw new Error('City search is temporarily unavailable.')

  const data = await response.json()

  return (data.results ?? []).map((result) => ({
    id: `${result.id ?? `${result.latitude}-${result.longitude}`}`,
    label: `${result.name}, ${result.admin1 ?? result.country_code}`,
  }))
}
