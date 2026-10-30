/**
 * utils/weather.ts
 *
 * Utility functions to fetch and normalize weather data from Open-Meteo.
 * Uses the Open-Meteo Geocoding API + Forecast API (no API key required).
 *
 * Returns data formatted for the WeatherWidget component.
 */

import { getLanguage } from '@/i18n'
import type { WeatherWidgetProps } from '../components/weather-widget'

/**
 * Fetch current and forecast weather data for a given city name
 * @param city - City name, e.g. 'Paris, France' or 'Hanoi, Vietnam'
 * @returns WeatherWidgetProps object or null if not found / API error
 */
export async function fetchWeatherByCity(city: string): Promise<WeatherWidgetProps | null> {
  try {
    // Geocode city name → coordinates
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    )
    if (!geoRes.ok) throw new Error('Geocoding API request failed')

    const geoData = await geoRes.json()
    const location = geoData.results?.[0]
    if (!location) throw new Error(`City not found: ${city}`)

    const { latitude, longitude, name, country, timezone } = location

    // Fetch weather forecast
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=${encodeURIComponent(
        timezone ?? 'auto'
      )}`
    )
    if (!weatherRes.ok) throw new Error('Weather API request failed')

    const weatherData = await weatherRes.json()

    // Normalize hourly data: first local day, every 3 hours (00, 03, 06, ..., 21)
    const hourlyTimes: string[] = weatherData.hourly?.time ?? []
    const hourlyTemps: number[] = weatherData.hourly?.temperature_2m ?? []

    const hourly: WeatherWidgetProps['hourly'] = []

    if (hourlyTimes.length > 0) {
      const first = new Date(hourlyTimes[0])
      const firstY = first.getFullYear()
      const firstM = first.getMonth()
      const firstD = first.getDate()

      for (let i = 0; i < hourlyTimes.length; i++) {
        const tStr = hourlyTimes[i]
        const d = new Date(tStr)

        // stop once we move past the first day
        if (
          d.getFullYear() !== firstY ||
          d.getMonth() !== firstM ||
          d.getDate() !== firstD
        ) {
          break
        }

        const h = d.getHours()
        // keep points every 3 hours: 0,3,6,9,12,15,18,21
        if (h % 3 === 0) {
          hourly.push({
            t: tStr, // raw ISO string; widget will format
            temp: hourlyTemps[i],
          })
        }
      }
    }

    const locale = getLanguage() === 'ru' ? 'ru-RU' : 'en-US'

    // Normalize daily data (next 5 days)
    const dailyTimes: string[] = weatherData.daily?.time ?? []
    const dailyMax: number[] = weatherData.daily?.temperature_2m_max ?? []
    const dailyMin: number[] = weatherData.daily?.temperature_2m_min ?? []
    const dailyCodes: number[] = weatherData.daily?.weathercode ?? []

    const daily = dailyTimes.slice(0, 5).map((t: string, i: number) => ({
      dow: new Date(t).toLocaleDateString(locale, { weekday: 'short' }),
      high: dailyMax[i],
      low: dailyMin[i],
      icon: mapWeatherCode(dailyCodes[i]),
    }))

    // Return widget data
    return {
      location: `${name}, ${country}`,
      asOf: new Date().toLocaleString(locale),
      unit: 'C',
      current: {
        temp: weatherData.current_weather?.temperature ?? 0,
        kind: mapWeatherCode(weatherData.current_weather?.weathercode),
        description: describeWeather(weatherData.current_weather?.weathercode),
      },
      hourly,
      daily,
    }
  } catch (err) {
    console.error('Failed to fetch weather:', err)
    return null
  }
}

/**
 * Map Open-Meteo weather codes to widget icon kinds
 */
function mapWeatherCode(code?: number): WeatherWidgetProps['current']['kind'] {
  if (code == null) return 'sunny'
  if ([0].includes(code)) return 'sunny'
  if ([1, 2].includes(code)) return 'partly'
  if ([3].includes(code)) return 'cloudy'
  if ([45, 48].includes(code)) return 'cloudy'
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle'
  if ([61, 63, 65, 80, 81, 82].includes(code)) return 'rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow'
  return 'cloudy'
}

/**
 * Map weather codes to locale keys; the widget resolves them with `t()`.
 */
function describeWeather(code?: number): string {
  const map: Record<number, string> = {
    0: 'widgets.weather.clear_sky',
    1: 'widgets.weather.mainly_clear',
    2: 'widgets.weather.partly_cloudy',
    3: 'widgets.weather.overcast',
    45: 'widgets.weather.fog',
    48: 'widgets.weather.rime_fog',
    51: 'widgets.weather.light_drizzle',
    61: 'widgets.weather.light_rain',
    63: 'widgets.weather.moderate_rain',
    65: 'widgets.weather.heavy_rain',
    71: 'widgets.weather.light_snow',
    73: 'widgets.weather.moderate_snow',
    75: 'widgets.weather.heavy_snow',
    80: 'widgets.weather.rain_showers',
    95: 'widgets.weather.thunderstorm',
  }
  return map[code ?? 0] ?? 'widgets.weather.unknown'
}