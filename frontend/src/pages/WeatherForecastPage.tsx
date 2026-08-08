import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Calendar, Compass, ShieldAlert, Search, RefreshCw, X, MapPin, Check } from 'lucide-react';
import { weatherService, locationService } from '../services/api';
import { LocationResult } from '../types';

interface WeatherHourly {
  temperature: number;
  rain_probability: number;
  condition: string;
}

interface WeatherDay {
  date: string;
  temp_max: number;
  temp_min: number;
  condition: string;
  rain_probability: number | null;
  precipitation?: number;
  wind_speed?: number;
  morning?: WeatherHourly;
  afternoon?: WeatherHourly;
  evening?: WeatherHourly;
}

interface WeatherData {
  destination_name: string;
  forecast_available: boolean;
  timezone: string;
  weather: WeatherDay[];
  message: string;
}

export const WeatherForecastPage: React.FC = () => {
  const [destination, setDestination] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  // Debounced Open-Meteo Geocoding Search
  useEffect(() => {
    if (!destination || destination.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (selectedLocation && selectedLocation.name.toLowerCase() === destination.trim().toLowerCase()) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const data = await locationService.searchLocations(destination.trim(), 6);
        setSuggestions(data.results || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [destination, selectedLocation]);

  const handleSelectLocation = (loc: LocationResult) => {
    setSelectedLocation(loc);
    setDestination(loc.name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleClearDestination = () => {
    setDestination('');
    setSelectedLocation(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const fetchForecast = async () => {
    if (!destination.trim()) {
      setErrorMsg('Please enter a destination.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg('Please select start and end dates.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const queryDestination = selectedLocation 
        ? `${selectedLocation.name}${selectedLocation.country ? `, ${selectedLocation.country}` : ''}`
        : destination;
      const data = await weatherService.getGeneralForecast(queryDestination, startDate, endDate);
      setWeatherData(data);
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail;
      const msg = typeof errorDetail === 'object' && errorDetail?.message 
        ? errorDetail.message 
        : (typeof errorDetail === 'string' ? errorDetail : 'Weather information is temporarily unavailable.');
      setErrorMsg(msg);
      setWeatherData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchForecast();
  };

  const getWeatherEmoji = (condition: string) => {
    const cond = condition.toLowerCase();
    if (cond.includes('clear') || cond.includes('sunny')) return '☀️';
    if (cond.includes('partly cloudy')) return '🌤️';
    if (cond.includes('cloudy') || cond.includes('overcast') || cond.includes('mainly clear')) return '☁️';
    if (cond.includes('drizzle') || cond.includes('shower')) return '🌦️';
    if (cond.includes('rain')) return '🌧️';
    if (cond.includes('thunderstorm')) return '⛈️';
    if (cond.includes('snow') || cond.includes('hail') || cond.includes('grains')) return '❄️';
    return '☁️';
  };

  const hasForecast = weatherData && weatherData.forecast_available && weatherData.weather.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in text-slate-800">
      <div className="text-left space-y-2">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          <span>🌤️</span> Weather Forecast
        </h1>
        <p className="text-slate-500 font-semibold text-sm">
          Get real-time, dynamic weather reports for any location on Earth.
        </p>
      </div>

      {errorMsg && (
        <Alert variant="error" className="flex items-center justify-between text-left">
          <span>{errorMsg}</span>
          {errorMsg === 'Weather information is temporarily unavailable.' && (
            <Button
              onClick={fetchForecast}
              className="bg-red-100 hover:bg-red-200 text-red-700 text-[10px] px-2.5 py-1 font-bold rounded-lg ml-4 shadow-sm"
            >
              Retry
            </Button>
          )}
        </Alert>
      )}

      {/* Search form */}
      <Card className="glass-card shadow-sm border-slate-200 bg-white">
        <CardContent className="py-6">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
            <div className="space-y-2 text-left relative">
              <label htmlFor="destination" className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>Destination</span>
                {isSearchingLocation && (
                  <span className="text-[10px] text-brand-500 font-semibold flex items-center gap-1">
                    <RefreshCw size={10} className="animate-spin" />
                    <span>Verifying...</span>
                  </span>
                )}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-450" />
                <Input
                  id="destination"
                  type="text"
                  placeholder="e.g. Manali, Goa, Paris, Tokyo"
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    if (selectedLocation && e.target.value !== selectedLocation.name) {
                      setSelectedLocation(null);
                    }
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  className="pl-10 pr-9 h-11"
                  required
                />
                {destination && (
                  <button
                    type="button"
                    onClick={handleClearDestination}
                    className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                    title="Clear"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-[70px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {suggestions.map((loc, idx) => (
                    <button
                      type="button"
                      key={`${loc.name}-${loc.latitude}-${loc.longitude}-${idx}`}
                      onClick={() => handleSelectLocation(loc)}
                      className="w-full px-3.5 py-2 text-left hover:bg-brand-50/50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-brand-500 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-slate-800">{loc.name}</div>
                          <div className="text-[11px] text-slate-500">{[loc.region, loc.country].filter(Boolean).join(', ')}</div>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {loc.latitude.toFixed(1)}°, {loc.longitude.toFixed(1)}°
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Location Badge */}
              {selectedLocation && (
                <div className="mt-1 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-[11px] text-emerald-800">
                  <div className="flex items-center gap-1.5">
                    <Check size={12} className="text-emerald-600" />
                    <span className="font-bold">{selectedLocation.name}, {selectedLocation.country}</span>
                    <span className="font-mono text-[10px] text-emerald-600">({selectedLocation.latitude.toFixed(2)}°, {selectedLocation.longitude.toFixed(2)}°)</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 text-left">
              <label htmlFor="start_date" className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Start Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-slate-450" />
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2 text-left">
              <label htmlFor="end_date" className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                End Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-slate-450" />
                <Input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="md:col-span-3 flex justify-end">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full md:w-auto bg-brand-500 hover:bg-brand-600 text-white font-bold h-11 px-6 shadow-md shadow-brand-500/10 rounded-xl"
              >
                {isLoading ? 'Fetching latest weather forecast...' : 'Get Weather Forecast'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Loading Skeleton */}
      {isLoading && (
        <Card className="glass-card bg-white border-slate-200">
          <CardContent className="py-12 flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
            <p className="text-sm font-semibold text-slate-500 animate-pulse">
              Fetching latest weather forecast...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Weather Results */}
      {!isLoading && weatherData && (
        <Card className="glass-card shadow-sm border-slate-200 bg-white">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-50 border-b border-slate-100 gap-2 text-left">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-1.5 text-slate-800">
                <span>🌦️</span>
                <span>Forecast for {weatherData.destination_name}</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-550 font-semibold mt-0.5">
                Timezone: {weatherData.timezone}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wider ${hasForecast ? 'bg-emerald-55 text-emerald-800 border-emerald-300' : 'bg-amber-55 text-amber-800 border-amber-300'}`}>
                {hasForecast ? 'Forecast Live' : 'Unavailable'}
              </span>
              {hasForecast && (
                <Button
                  onClick={fetchForecast}
                  className="text-[11px] bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-2.5 py-1 h-7 font-bold rounded-lg transition-all duration-200 shadow-sm"
                >
                  Refresh Forecast
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="py-4">
            {!hasForecast ? (
              <div className="py-10 flex flex-col items-center justify-center space-y-2 text-center text-xs text-slate-500 font-semibold">
                <ShieldAlert size={36} className="text-amber-500 mb-2" />
                <p className="text-slate-800 text-sm font-extrabold">Detailed weather forecast is not available yet for these dates.</p>
                <p className="text-slate-500 font-medium">Please check again closer to your travel date.</p>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin">
                {weatherData.weather.map((day) => (
                  <div key={day.date} className="min-w-[195px] p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-center space-y-3.5 flex-1 shrink-0 flex flex-col justify-between hover:border-brand-200 hover:bg-slate-50/80 transition-all duration-200 shadow-inner">
                    <div>
                      <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                        {new Date(day.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-3xl my-2">{getWeatherEmoji(day.condition)}</div>
                      <div className="font-extrabold text-sm text-slate-800">{day.temp_max}°C / {day.temp_min}°C</div>
                      <div className="text-[10px] text-slate-500 font-semibold truncate mt-0.5">{day.condition}</div>
                    </div>

                    {/* Variables */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-650 font-bold bg-white p-2.5 rounded-lg border border-slate-150 mt-1 text-left shadow-sm">
                      <div>
                        <span className="block text-slate-400 uppercase tracking-widest text-[8px]">Rain Prob</span>
                        <span className="text-blue-600 font-extrabold">{day.rain_probability ?? 0}%</span>
                      </div>
                      <div>
                        <span className="block text-slate-400 uppercase tracking-widest text-[8px]">Precip</span>
                        <span className="text-teal-600 font-extrabold">{day.precipitation ?? 0} mm</span>
                      </div>
                      <div className="col-span-2 pt-0.5 border-t border-slate-100 mt-0.5">
                        <span className="inline-block text-slate-400 uppercase tracking-widest text-[8px] mr-1">Wind:</span>
                        <span className="text-emerald-600 font-extrabold">{day.wind_speed ?? 0} km/h</span>
                      </div>
                    </div>

                    {/* Hourly breakdowns */}
                    <div className="pt-2 border-t border-slate-150 space-y-1.5 text-left text-[10px] font-semibold">
                      {day.morning && (
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider font-extrabold">Morning</span>
                          <span className="flex items-center gap-1 font-bold">
                            <span>{getWeatherEmoji(day.morning.condition)}</span>
                            <span className="text-slate-700">{day.morning.temperature}°C</span>
                            <span className="text-slate-450 text-[9px]">({day.morning.rain_probability}%)</span>
                          </span>
                        </div>
                      )}
                      {day.afternoon && (
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider font-extrabold">Afternoon</span>
                          <span className="flex items-center gap-1 font-bold">
                            <span>{getWeatherEmoji(day.afternoon.condition)}</span>
                            <span className="text-slate-700">{day.afternoon.temperature}°C</span>
                            <span className="text-slate-450 text-[9px]">({day.afternoon.rain_probability}%)</span>
                          </span>
                        </div>
                      )}
                      {day.evening && (
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider font-extrabold">Evening</span>
                          <span className="flex items-center gap-1 font-bold">
                            <span>{getWeatherEmoji(day.evening.condition)}</span>
                            <span className="text-slate-700">{day.evening.temperature}°C</span>
                            <span className="text-slate-450 text-[9px]">({day.evening.rain_probability}%)</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-0 pb-3 flex justify-end text-[10px] text-slate-400 font-bold border-t border-slate-50 bg-slate-50/20 px-4 rounded-b-xl">
            <span>Weather data powered by <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">Open-Meteo</a></span>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default WeatherForecastPage;
