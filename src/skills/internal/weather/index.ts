import fs from 'fs';
import path from 'path';
import { ISkill } from '../../../types';

// 动态读取同目录下的 skill.md 作为 prompt
const promptPath = path.join(__dirname, 'skill.md');
const promptContent = fs.existsSync(promptPath) 
    ? fs.readFileSync(promptPath, 'utf8') 
    : undefined;

// WMO 天气代码转换表
const weatherCodes: { [key: number]: string } = {
    0: '晴朗',
    1: '主要晴朗',
    2: '部分多云',
    3: '阴天',
    45: '大雾',
    48: '沉积性雾',
    51: '轻微毛毛雨',
    53: '中度毛毛雨',
    55: '浓密毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '雪粒',
    80: '阵型小雨',
    81: '阵型中雨',
    82: '阵型大雨',
    95: '雷阵雨',
    96: '带小冰雹的雷阵雨',
    99: '带大冰雹的雷阵雨'
};

/**
 * 备选方案：从 wttr.in 获取天气 (极高稳定性)
 */
async function fetchFromWttrIn(city: string, days: number = 1) {
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`wttr.in API 错误: ${res.status}`);
    
    const data: any = await res.json();
    const current = data.current_condition[0];
    const location = data.nearest_area[0];

    const result: any = {
        location: `${location.areaName[0].value}, ${location.region[0].value}, ${location.country[0].value}`,
        source: 'wttr.in (Fallback)',
        type: days > 1 ? 'forecast' : 'current'
    };

    if (days > 1) {
        result.forecasts = data.weather.slice(0, days).map((w: any) => ({
            date: w.date,
            max_temp: `${w.maxtempC}°C`,
            min_temp: `${w.mintempC}°C`,
            condition: w.hourly[4].weatherDesc[0].value // 取中午时段
        }));
    } else {
        result.current = {
            temperature: `${current.temp_C}°C`,
            condition: current.lang_zh ? current.lang_zh[0].value : current.weatherDesc[0].value,
            humidity: `${current.humidity}%`,
            wind_speed: `${current.windspeedKmph} km/h`,
            time: current.localObsDateTime
        };
    }
    return result;
}

export const WeatherSkill: ISkill = {
    id: 'weather-skill',
    name: '天气查询',
    description: '查询全球各城市的实时天气及未来 7 天的预报。',
    category: 'internal',
    prompt: promptContent,
    definition: {
        type: 'function',
        function: {
            name: 'get_weather',
            description: 'Get real-time weather or up to 7-day forecast for any city.',
            parameters: {
                type: 'object',
                properties: {
                    city: {
                        type: 'string',
                        description: 'The name of the city, e.g. Beijing, Shanghai'
                    },
                    days: {
                        type: 'integer',
                        description: 'Number of forecast days (1-7). 1 means current weather, 2 includes tomorrow, etc.',
                        minimum: 1,
                        maximum: 7,
                        default: 1
                    }
                },
                required: ['city']
            }
        }
    },
    handler: async (args: { city: string; days?: number }) => {
        const forecastDays = args.days || 1;
        console.log(`📡 [Skill: Weather] API Request: ${args.city}, Days: ${forecastDays}`);

        try {
            // STEP 1: 第一选择 - Open-Meteo
            try {
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(args.city)}&count=1&language=zh&format=json`);
                if (!geoRes.ok) throw new Error('Geocoding Failed');
                const geoData: any = await geoRes.json();

                if (geoData.results && geoData.results.length > 0) {
                    const { latitude, longitude, name, country, admin1 } = geoData.results[0];
                    const locationInfo = `${name} (${admin1 ? admin1 + ', ' : ''}${country})`;

                    let weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&timezone=auto`;
                    if (forecastDays > 1) {
                        weatherUrl += `&daily=weathercode,temperature_2m_max,temperature_2m_min&forecast_days=${forecastDays}`;
                    } else {
                        weatherUrl += `&current_weather=true&relative_humidity_2m=true`;
                    }

                    const weatherRes = await fetch(weatherUrl);
                    if (weatherRes.ok) {
                        const weatherData: any = await weatherRes.json();
                        if (forecastDays > 1 && weatherData.daily) {
                            return {
                                location: locationInfo,
                                source: 'Open-Meteo',
                                type: 'forecast',
                                forecasts: weatherData.daily.time.map((date: any, i: number) => ({
                                    date,
                                    max_temp: `${weatherData.daily.temperature_2m_max[i]}°C`,
                                    min_temp: `${weatherData.daily.temperature_2m_min[i]}°C`,
                                    condition: weatherCodes[weatherData.daily.weathercode[i]] || '未知'
                                }))
                            };
                        } else if (weatherData.current_weather) {
                            const cw = weatherData.current_weather;
                            return {
                                location: locationInfo,
                                source: 'Open-Meteo',
                                type: 'current',
                                current: {
                                    temperature: `${cw.temperature}°C`,
                                    condition: weatherCodes[cw.weathercode] || '未知',
                                    wind_speed: `${cw.windspeed} km/h`,
                                    time: cw.time
                                }
                            };
                        }
                    }
                }
            } catch (openMeteoErr) {
                console.warn('⚠️ Open-Meteo failed, switching to wttr.in fallback...');
            }

            // STEP 2: 如果第一选择失败，立刻切换到 wttr.in
            return await fetchFromWttrIn(args.city, forecastDays);

        } catch (error: any) {
            console.error('❌ [Weather Skill Error]:', error.message);
            throw new Error(`天气查询最终失败: ${error.message}`);
        }
    }
};
