// server/services/weather.service.ts
// Weather service using Open-Meteo API (free, no API key required)

interface WeatherData {
  temperature: number;
  weatherCode: number;
  description: string;
  isRaining: boolean;
  isCold: boolean;
  isHot: boolean;
}

export class WeatherService {
  private static readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private static cache: Map<string, { data: WeatherData; timestamp: number }> = new Map();

  /**
   * Get weather data for a location (lat, lon)
   * Falls back to default location if coordinates not provided
   */
  static async getWeather(lat: number = 40.7128, lon: number = -74.0060): Promise<WeatherData | null> {
    const cacheKey = `${lat},${lon}`;
    const cached = this.cache.get(cacheKey);

    // Return cached data if still fresh
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Open-Meteo API - free and no API key required
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;

      const response = await fetch(url);
      if (!response.ok) {
        console.error("[WeatherService] API request failed:", response.status);
        return null;
      }

      const data = await response.json();
      const temperature = data.current?.temperature_2m || 70;
      const weatherCode = data.current?.weather_code || 0;

      const weatherData: WeatherData = {
        temperature,
        weatherCode,
        description: this.getWeatherDescription(weatherCode),
        isRaining: this.isRainingCode(weatherCode),
        isCold: temperature < 50,
        isHot: temperature > 80,
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: weatherData,
        timestamp: Date.now(),
      });

      return weatherData;
    } catch (error) {
      console.error("[WeatherService] Failed to fetch weather:", error);
      return null;
    }
  }

  /**
   * Map WMO weather codes to descriptions
   * https://open-meteo.com/en/docs
   */
  private static getWeatherDescription(code: number): string {
    if (code === 0) return "clear";
    if (code <= 3) return "partly cloudy";
    if (code <= 48) return "foggy";
    if (code <= 57) return "drizzle";
    if (code <= 67) return "rain";
    if (code <= 77) return "snow";
    if (code <= 82) return "rain showers";
    if (code <= 86) return "snow showers";
    if (code <= 99) return "thunderstorm";
    return "unknown";
  }

  private static isRainingCode(code: number): boolean {
    // Drizzle, rain, rain showers, thunderstorm
    return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99);
  }

  /**
   * Get drink recommendations based on weather
   */
  static getDrinkRecommendations(weather: WeatherData): {
    categories: string[];
    tags: string[];
    description: string;
  } {
    if (weather.isHot) {
      return {
        categories: ["smoothie", "juice", "iced"],
        tags: ["refreshing", "hydrating", "cold"],
        description: `It's ${weather.temperature}°F and hot! Perfect weather for something cold and refreshing`,
      };
    }

    if (weather.isCold || weather.isRaining) {
      return {
        categories: ["coffee", "tea", "hot chocolate", "warm"],
        tags: ["warming", "cozy", "comforting"],
        description: `It's ${weather.temperature}°F${weather.isRaining ? " and rainy" : ""}! Time for something warm and cozy`,
      };
    }

    // Moderate weather
    return {
      categories: ["smoothie", "juice", "protein shake"],
      tags: ["energizing", "balanced"],
      description: `Perfect ${weather.temperature}°F weather! Great for any drink you're craving`,
    };
  }
}
