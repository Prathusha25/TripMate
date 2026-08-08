import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api, { tripService, weatherService, aiService, requestService } from '../services/api';
import { Trip, Message } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { 
  Calendar, DollarSign, Users, Sparkles, Compass, CheckSquare, 
  Square, Trash2, Plus, MessageSquare, Send, User, ChevronRight, ShieldAlert, CloudRain, Sun 
} from 'lucide-react';

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
  warning: string | null;
}

interface Place {
  name: string;
  description: string;
  why_matches: string;
  suggested_duration: string;
  recommended_visiting_period: string;
  activity_type: string;
}

interface ItineraryDay {
  day: number;
  morning: Array<{ place_name: string; activity: string; duration: string }>;
  afternoon: Array<{ place_name: string; activity: string; duration: string }>;
  evening: Array<{ place_name: string; activity: string; duration: string }>;
}

interface PackingItem {
  item: string;
  checked: boolean;
}

interface AIPlan {
  trip_id: string;
  places: Place[];
  visiting_times_explanation: Record<string, string>;
  itinerary: ItineraryDay[];
  outfit_recommendations: string[];
  packing_checklist: Record<string, PackingItem[]>;
}

export const TripDetails: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [weatherData, setWeatherData] = useState<{ weather: WeatherDay[]; message: string; destination_name: string; forecast_available?: boolean } | null>(null);
  const [weatherError, setWeatherError] = useState<boolean>(false);
  const [plan, setPlan] = useState<AIPlan | null>(null);
  
  // Tabs & Loading states
  const [activeTab, setActiveTab] = useState<'itinerary' | 'packing' | 'chat'>('itinerary');
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // Packing Checklist Custom input state
  const [newItemText, setNewItemText] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('clothing');

  // AI Chat states
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [typedChat, setTypedChat] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<any>(null);

  const fetchTripAndData = async () => {
    if (!tripId) return;
    setLoadingTrip(true);
    setPlanError(null);
    try {
      const tripData = await tripService.getTrip(tripId);
      setTrip(tripData);

      try {
        const wData = await weatherService.getGeneralForecast(tripData.destination, tripData.start_date, tripData.end_date);
        setWeatherData(wData);
      } catch (err) {
        console.error("Weather fetch failed:", err);
        setWeatherError(true);
      }

      try {
        const pData = await aiService.getSavedPlan(tripId);
        setPlan(pData);
      } catch (err: any) {
        if (err.response?.status !== 404) {
          console.error("AI Plan fetch error:", err);
        }
      }

      try {
        const reqData = await requestService.getSentRequests();
        setSentRequests(reqData || []);
      } catch (err) {
        console.error("Sent requests fetch failed:", err);
      }

    } catch (err: any) {
      console.error("Failed to load trip:", err);
      setPlanError("Could not load trip details. Please check your connection.");
    } finally {
      setLoadingTrip(false);
    }
  };

  useEffect(() => {
    fetchTripAndData();
  }, [tripId]);

  const handleGeneratePlan = async () => {
    if (!tripId) return;
    setGeneratingPlan(true);
    setPlanError(null);
    try {
      const generated = await aiService.generatePlan(tripId);
      setPlan(generated);
      toast('AI Itinerary generated successfully!', 'success');
    } catch (err: any) {
      console.error("Failed to generate plan:", err);
      const detail = err.response?.data?.detail || "Failed to generate AI plan. Please try again.";
      setPlanError(detail);
      toast(detail, 'error');
    } finally {
      setGeneratingPlan(false);
    }
  };

  const handleToggleChecklist = async (category: string, item: string, checked: boolean) => {
    if (!plan || !tripId) return;
    const updatedChecklist = { ...plan.packing_checklist };
    if (updatedChecklist[category]) {
      updatedChecklist[category] = updatedChecklist[category].map((it) =>
        it.item === item ? { ...it, checked } : it
      );
      setPlan({ ...plan, packing_checklist: updatedChecklist });
      try {
        await aiService.mutateChecklist(tripId, category, item, checked, 'toggle');
      } catch (err) {
        console.error("Failed to update checklist item:", err);
      }
    }
  };

  const handleAddCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim() || !plan || !tripId) return;

    const text = newItemText.trim();
    const updatedChecklist = { ...plan.packing_checklist };
    if (!updatedChecklist[newItemCategory]) {
      updatedChecklist[newItemCategory] = [];
    }
    updatedChecklist[newItemCategory].push({ item: text, checked: false });
    
    setPlan({ ...plan, packing_checklist: updatedChecklist });
    setNewItemText('');
    
    try {
      await aiService.mutateChecklist(tripId, newItemCategory, text, false, 'add');
      toast("Item added to checklist.", "success");
    } catch (err) {
      console.error(err);
      toast("Failed to add checklist item.", "error");
    }
  };

  const handleRemoveChecklistItem = async (category: string, item: string) => {
    if (!plan || !tripId) return;
    const updatedChecklist = { ...plan.packing_checklist };
    if (updatedChecklist[category]) {
      updatedChecklist[category] = updatedChecklist[category].filter((it) => it.item !== item);
      setPlan({ ...plan, packing_checklist: updatedChecklist });
      try {
        await aiService.mutateChecklist(tripId, category, item, undefined, 'remove');
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleJoinTrip = async () => {
    if (!trip) return;
    try {
      await requestService.sendRequest(trip.id, trip.user_id);
      toast("Join request sent successfully!", "success");
      await fetchTripAndData();
    } catch (error: any) {
      console.error(error);
      toast(error.response?.data?.detail || "Failed to send join request.", "error");
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedChat.trim() || !tripId || sendingChat) return;

    const content = typedChat.trim();
    setTypedChat('');
    setSendingChat(true);

    const userMsg = {
      id: String(Date.now()),
      sender_id: user?.id,
      content,
      is_ai: false,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);

    try {
      const response = await aiService.sendChatMessage(tripId, content);
      const aiMsg = {
        id: String(Date.now() + 1),
        sender_id: 'ai',
        content: response.content || response.reply || 'Here is the requested recommendation.',
        is_ai: true,
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      toast("Failed to get assistant response.", "error");
    } finally {
      setSendingChat(false);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loadingTrip) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 text-left">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-slate-500 text-xs">Loading trip details...</p>
      </div>
    );
  }

  if (planError && !trip) {
    return <Alert variant="error" className="max-w-xl mx-auto mt-6">{planError}</Alert>;
  }

  if (!trip) return null;

  const categoriesFriendly: Record<string, string> = {
    clothing: 'Clothing',
    weather: 'Weather Items',
    personal_care: 'Personal Care',
    electronics: 'Electronics',
    documents: 'Documents',
    activity_specific: 'Activity Items',
    emergency_essentials: 'Emergency Essentials',
  };

  const getWeatherEmoji = (condition: string) => {
    const cond = (condition || '').toLowerCase();
    if (cond.includes('clear') || cond.includes('sunny')) return '☀️';
    if (cond.includes('partly cloudy')) return '🌤️';
    if (cond.includes('cloudy') || cond.includes('overcast') || cond.includes('mainly clear')) return '☁️';
    if (cond.includes('drizzle') || cond.includes('shower')) return '🌦️';
    if (cond.includes('rain')) return '🌧️';
    if (cond.includes('thunderstorm')) return '⛈️';
    return '☁️';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-left w-full min-w-0">
      
      {/* Back button */}
      <Link to="/trips" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors">
        <ChevronRight className="rotate-180" size={13} />
        <span>Back to My Trips</span>
      </Link>

      {/* Clean Trip Header Card */}
      <div className="bg-white border border-slate-200/80 p-5 sm:p-6 rounded-xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Compass className="text-brand-600 shrink-0" size={22} />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display truncate">{trip.destination}</h1>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm flex items-center gap-1.5 font-normal">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <span>{new Date(trip.start_date).toLocaleDateString()} — {new Date(trip.end_date).toLocaleDateString()}</span>
          </p>

          {/* Organizer Mini Card */}
          <div className="flex items-center gap-2.5 mt-3 pt-3 border-t border-slate-100 max-w-md">
            {trip.owner_profile_photo ? (
              <img
                src={trip.owner_profile_photo}
                alt={trip.owner_name || 'Organizer'}
                className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                <User size={13} />
              </div>
            )}
            <div className="text-xs">
              <span className="font-semibold text-slate-800">{trip.owner_name || 'Organizer'}</span>
              <span className="text-[10px] text-slate-400 font-normal ml-1.5 uppercase tracking-wider">(Trip Creator)</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 text-xs">
          <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-left space-y-0.5">
            <div className="text-slate-500 text-[11px]">Budget & Spots</div>
            <div className="font-semibold text-slate-900">
              ₹{trip.approximate_budget.toLocaleString()} · {trip.members ? trip.members.length : 1} of {Math.max(2, trip.number_of_travelers)} travelers
            </div>
          </div>

          <div>
            {trip.user_id === user?.id ? (
              <span className="px-3 py-1.5 bg-brand-50 text-brand-700 font-medium rounded-lg text-xs border border-brand-200 inline-block text-center w-full">
                Your Trip
              </span>
            ) : (() => {
              const tripRequest = sentRequests.find(r => r.trip_id === trip.id);
              const requestStatus = tripRequest ? tripRequest.status : null;
              if (requestStatus === 'pending') {
                return (
                  <Button variant="outline" className="w-full text-xs" disabled>
                    Request Pending
                  </Button>
                );
              } else if (requestStatus === 'accepted') {
                return (
                  <Button variant="outline" className="w-full text-xs text-teal-700 border-teal-200 bg-teal-50" disabled>
                    Joined
                  </Button>
                );
              } else {
                return (
                  <Button onClick={handleJoinTrip} size="sm" className="w-full font-medium">
                    I'd Like to Join
                  </Button>
                );
              }
            })()}
          </div>
        </div>
      </div>

      {planError && <Alert variant="error">{planError}</Alert>}

      {/* Weather Forecast Row */}
      {weatherData && (
        <Card className="glass-card">
          <CardHeader className="p-4 py-3 bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="text-left">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Weather Forecast · {weatherData.destination_name}
              </CardTitle>
            </div>
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Live Forecast
            </span>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {(weatherData.weather || []).map((day) => (
                <div key={day.date} className="min-w-[110px] p-2.5 rounded-lg border border-slate-200 bg-slate-50/40 text-center space-y-1 flex-1 shrink-0 text-[11px]">
                  <div className="text-slate-500 font-medium text-[10px]">
                    {new Date(day.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-xl">{getWeatherEmoji(day.condition)}</div>
                  <div className="font-semibold text-slate-800 text-xs">{day.temp_max}° / {day.temp_min}°C</div>
                  <div className="text-slate-500 text-[10px] truncate">{day.condition}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Workspace Layout */}
      {!plan ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-8 sm:p-10 text-center flex flex-col items-center justify-center space-y-3 shadow-sm max-w-xl mx-auto">
          <div className="w-11 h-11 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
            <Sparkles size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900 font-display">Generate Weather-Aware Itinerary</h3>
            <p className="text-xs text-slate-500 font-normal leading-relaxed">
              Based on destination, dates, budget, and live weather forecast, AI will generate day blocks, recommended spots, and a packing checklist.
            </p>
          </div>
          <Button 
            onClick={handleGeneratePlan} 
            isLoading={generatingPlan}
            size="md"
            className="gap-1.5 px-5 font-medium mt-1"
          >
            <Sparkles size={14} />
            <span>Generate Itinerary</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Tab Switcher */}
          <div className="flex border-b border-slate-200 gap-4 text-xs font-medium">
            {(['itinerary', 'packing', 'chat'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2.5 border-b-2 transition-colors -mb-[1px] ${
                  activeTab === tab
                    ? 'border-brand-600 text-brand-700 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab === 'packing' ? 'Packing Checklist' : tab === 'chat' ? 'AI Travel Assistant' : 'Itinerary & Places'}
              </button>
            ))}
          </div>

          {/* TAB 1: Itinerary & Places */}
          {activeTab === 'itinerary' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Day-by-Day Itinerary (Left 2/3) */}
              <div className="lg:col-span-2 space-y-4">
                {plan.itinerary.map((day) => (
                  <Card key={day.day} className="glass-card">
                    <CardHeader className="p-3.5 px-4 bg-slate-50/60 border-b border-slate-100 flex justify-between">
                      <CardTitle className="text-xs font-semibold text-brand-700 uppercase tracking-wider">
                        Day {day.day}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {/* Morning */}
                      {day.morning?.length > 0 && (
                        <div className="space-y-1 text-xs">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Morning</span>
                          {day.morning.map((act, i) => (
                            <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-150">
                              <div className="font-semibold text-slate-850">{act.place_name} <span className="font-normal text-slate-400">({act.duration})</span></div>
                              <p className="text-[11px] text-slate-500 font-normal mt-0.5 leading-normal">{act.activity}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Afternoon */}
                      {day.afternoon?.length > 0 && (
                        <div className="space-y-1 text-xs">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Afternoon</span>
                          {day.afternoon.map((act, i) => (
                            <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-150">
                              <div className="font-semibold text-slate-850">{act.place_name} <span className="font-normal text-slate-400">({act.duration})</span></div>
                              <p className="text-[11px] text-slate-500 font-normal mt-0.5 leading-normal">{act.activity}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Evening */}
                      {day.evening?.length > 0 && (
                        <div className="space-y-1 text-xs">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Evening</span>
                          {day.evening.map((act, i) => (
                            <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-150">
                              <div className="font-semibold text-slate-850">{act.place_name} <span className="font-normal text-slate-400">({act.duration})</span></div>
                              <p className="text-[11px] text-slate-500 font-normal mt-0.5 leading-normal">{act.activity}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Recommended Places & Outfits (Right 1/3) */}
              <div className="space-y-5">
                <Card className="glass-card">
                  <CardHeader className="p-3.5 px-4 bg-slate-50/60 border-b border-slate-100">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-700">Weather-Based Outfits</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ul className="space-y-1.5 text-xs text-slate-600 list-disc list-inside font-normal leading-relaxed">
                      {plan.outfit_recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">Recommended Places</h3>
                  {plan.places.map((place, idx) => (
                    <div key={idx} className="bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-1 text-xs shadow-sm">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-semibold text-slate-900">{place.name}</h4>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[9px] font-medium text-slate-600">
                          {place.activity_type}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-normal">{place.description}</p>
                      <div className="text-[10px] text-brand-700 font-medium pt-1">
                        {place.why_matches}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Packing Checklist */}
          {activeTab === 'packing' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                {Object.entries(plan.packing_checklist).map(([cat, items]) => {
                  const friendlyName = categoriesFriendly[cat] || cat;
                  if (items.length === 0) return null;

                  return (
                    <Card key={cat} className="glass-card">
                      <CardHeader className="p-3 px-4 bg-slate-50/60 border-b border-slate-100">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                          {friendlyName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {items.map((it) => (
                            <div 
                              key={it.item} 
                              className="flex justify-between items-center p-2 rounded-lg bg-slate-50/60 border border-slate-200/60"
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleChecklist(cat, it.item, !it.checked)}
                                className="flex items-center gap-2 text-xs text-left text-slate-700"
                              >
                                {it.checked ? (
                                  <CheckSquare size={14} className="text-teal-600 shrink-0" />
                                ) : (
                                  <Square size={14} className="text-slate-400 shrink-0" />
                                )}
                                <span className={it.checked ? 'line-through text-slate-400' : 'font-medium'}>
                                  {it.item}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveChecklistItem(cat, it.item)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Add Custom Item */}
              <div className="space-y-4">
                <Card className="glass-card">
                  <CardHeader className="p-3.5 px-4 bg-slate-50/60 border-b border-slate-100">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-700">Add Item</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <form onSubmit={handleAddCustomItem} className="space-y-3">
                      <div className="text-left">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Category
                        </label>
                        <select
                          value={newItemCategory}
                          onChange={(e) => setNewItemCategory(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-250 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-brand-600"
                        >
                          {Object.keys(categoriesFriendly).map((cat) => (
                            <option key={cat} value={cat}>
                              {categoriesFriendly[cat]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Input
                        label="Item Name"
                        placeholder="e.g. Hiking boots"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        className="text-xs h-9"
                        required
                      />

                      <Button type="submit" size="sm" className="w-full gap-1 text-xs">
                        <Plus size={13} />
                        <span>Add to List</span>
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 3: AI Chat Assistant */}
          {activeTab === 'chat' && (
            <Card className="h-[480px] flex flex-col glass-card">
              <CardHeader className="p-3 px-4 bg-slate-50/60 border-b border-slate-100 flex flex-row items-center gap-2">
                <MessageSquare size={15} className="text-brand-600" />
                <CardTitle className="text-xs font-semibold text-slate-800">AI Travel Assistant</CardTitle>
              </CardHeader>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/30">
                {chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs space-y-1">
                    <MessageSquare size={20} className="opacity-30" />
                    <span>Ask about your itinerary, packing, or travel adjustments.</span>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.is_ai ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[75%] rounded-xl px-3.5 py-2 text-xs text-left ${
                        !msg.is_ai
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'bg-white text-slate-800 border border-slate-200 shadow-sm'
                      }`}>
                        <p className="leading-relaxed break-words font-medium">{msg.content}</p>
                        <span className={`block text-[9px] text-right mt-0.5 opacity-70 ${!msg.is_ai ? 'text-brand-100' : 'text-slate-400'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendChatMessage} className="p-3 border-t border-slate-200 bg-white flex gap-2">
                <Input
                  placeholder="Ask a question..."
                  value={typedChat}
                  onChange={(e) => setTypedChat(e.target.value)}
                  className="flex-1 text-xs h-9"
                  disabled={sendingChat}
                />
                <Button type="submit" size="sm" className="h-9 px-3 shrink-0" disabled={!typedChat.trim() || sendingChat}>
                  <Send size={14} />
                </Button>
              </form>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
export default TripDetails;
