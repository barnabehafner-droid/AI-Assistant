import { WeatherData } from '../types';
import { fetchWeatherData } from './geminiService';

const MOCK_WEATHER: WeatherData = {
    temperature: 19,
    condition: 'partiellement nuageux',
    location: 'Paris'
};

export const getTodaysWeather = async (locationQuery: string = 'Paris'): Promise<WeatherData> => {
    console.log(`Fetching real weather for ${locationQuery}...`);
    try {
        const weather = await fetchWeatherData(locationQuery);
        return weather;
    } catch (error) {
        console.warn(`Failed to fetch real weather data for ${locationQuery}, falling back to mock data. Error:`, error);
        return {
            ...MOCK_WEATHER,
            location: locationQuery,
        };
    }
};
