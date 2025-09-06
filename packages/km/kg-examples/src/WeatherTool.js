/**
 * Example tool class for weather information
 */
export class WeatherTool {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async getCurrentWeather(location, units = 'metric') {
    // Mock implementation
    return {
      location,
      temperature: 22,
      conditions: 'sunny',
      humidity: 45,
      units
    };
  }

  async getForecast(location, days = 5) {
    // Mock implementation
    return {
      location,
      days,
      forecast: Array(days).fill(null).map((_, i) => ({
        day: i + 1,
        temperature: 20 + Math.random() * 10,
        conditions: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)]
      }))
    };
  }
}
