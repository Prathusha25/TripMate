import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { tripService, aiService, weatherService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Trip } from '../types';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import {
  Sparkles,
  Calendar,
  DollarSign,
  Users,
  MapPin,
  ArrowLeft,
  CloudRain,
  Sun,
  CloudSun,
  Shirt,
  Briefcase,
  Check,
  Plus,
  Trash2,
  Send,
  MessageSquare,
  RefreshCw,
  Compass,
  AlertTriangle
} from 'lucide-react';

export const AIPlanner: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [weather, setWeather] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  
  // Loading states
  const [tripLoading, setTripLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  
  // Error states
  const [error, setError] = useState<string | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'itinerary' | 'places' | 'outfits' | 'packing' | 'chat'>('itinerary');
  const [activeDay, setActiveDay] = useState<number>(1);

  // Custom Packing Item Form
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Clothing');

  // AI Chat State
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tripId) {
      fetchTripAndSavedPlan();
    }
  }, [tripId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [plan?.chat_history, chatLoading]);

  const fetchTripAndSavedPlan = async () => {
    setTripLoading(true);
    setError(null);
    try {
      // 1. Fetch Trip details
      const tripData = await tripService.getTrip(tripId!);
      setTrip(tripData);

      // 2. Fetch Weather
      setWeatherLoading(true);
      try {
        const weatherData = await weatherService.getForecast(tripId!, tripData.destination);
        setWeather(weatherData);
      } catch (wErr) {
        console.error(wErr);
        setWeatherError('Weather forecast is currently offline.');
      } finally {
        setWeatherLoading(false);
      }

      // 3. Fetch Saved Plan if already exists
      try {
        const savedPlan = await aiService.getSavedPlan(tripId!);
        setPlan(savedPlan);
      } catch (pErr) {
        // Plan doesn't exist yet, this is expected for empty state
        console.log('No saved AI plan found for this trip.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to load trip coordinates. Please try again.');
    } finally {
      setTripLoading(false);
    }
  };

  const handleGeneratePlan = async (regenerate = false) => {
    if (!tripId) return;
    setPlanLoading(true);
    setError(null);
    try {
      const newPlan = await aiService.generatePlan(tripId, regenerate);
      setPlan(newPlan);
      toast(regenerate ? 'Plan regenerated!' : 'AI Travel plan generated successfully!', 'success');
      setActiveTab('itinerary');
      setActiveDay(1);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'AI planning services are temporarily unavailable. Please try again.');
      toast('Failed to generate plan.', 'error');
    } finally {
      setPlanLoading(false);
    }
  };

  // Packing checklist functions
  const handleTogglePack = async (itemId: string, currentStatus: boolean) => {
    if (!tripId || !plan) return;
    try {
      const updatedPlan = await aiService.updatePackingItem(tripId, itemId, { is_packed: !currentStatus });
      setPlan(updatedPlan);
    } catch (err) {
      console.error(err);
      toast('Failed to update packing status.', 'error');
    }
  };

  const handleAddPackingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !tripId || !plan) return;
    try {
      const updatedPlan = await aiService.addPackingItem(tripId, newItemName.trim(), newItemCategory);
      setPlan(updatedPlan);
      setNewItemName('');
      toast('Custom item added to packing list.', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to add packing item.', 'error');
    }
  };

  const handleDeletePackingItem = async (itemId: string) => {
    if (!tripId || !plan) return;
    try {
      const updatedPlan = await aiService.deletePackingItem(tripId, itemId);
      setPlan(updatedPlan);
      toast('Item removed from packing list.', 'info');
    } catch (err) {
      console.error(err);
      toast('Failed to delete packing item.', 'error');
    }
  };

  // AI Chat functions
  const handleSendChatMessage = async (messageText?: string) => {
    const textToSend = messageText || chatInput;
    if (!textToSend.trim() || !tripId || chatLoading) return;

    setChatLoading(true);
    if (!messageText) setChatInput('');

    // Pre-insert user message in local state for speed
    setPlan((prev: any) => {
      const history = prev.chat_history || [];
      return {
        ...prev,
        chat_history: [...history, { role: 'user', content: textToSend }]
      };
    });

    try {
      const res = await aiService.chatWithAssistant(tripId, textToSend);
      setPlan((prev: any) => {
        // Overwrite history with verified response from API
        const history = prev.chat_history.filter((m: any) => m.content !== textToSend);
        return {
          ...prev,
          chat_history: [...history, { role: 'user', content: textToSend }, { role: 'assistant', content: res.reply }]
        };
      });
    } catch (err) {
      console.error(err);
      toast('Assistant encountered an error replying.', 'error');
    } finally {
      setChatLoading(false);
    }
  };

  if (tripLoading) {
    return (
      <div className="max-w-5xl mx-auto py-12 space-y-6 animate-pulse text-left">
        <div className="h-8 w-1/3 bg-slate-200 rounded-xl" />
        <div className="h-4 w-1/2 bg-slate-200 rounded" />
        <div className="h-64 bg-slate-200 rounded-3xl" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center space-y-4">
        <Alert variant="error" title="Error">Trip details could not be found.</Alert>
        <Link to="/trips">
          <Button>Back to My Trips</Button>
        </Link>
      </div>
    );
  }

  // Calculate packed statistics
  const packingList = plan?.packing_checklist || [];
  const packedCount = packingList.filter((item: any) => item.is_packed).length;
  const totalCount = packingList.length;
  const packedPercent = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto text-left py-4 space-y-6">
      
      {/* Back button */}
      <button 
        onClick={() => navigate(`/trips/${trip.id}`)} 
        className="flex items-center gap-1 text-slate-500 hover:text-slate-700 transition-colors text-sm font-semibold"
      >
        <ArrowLeft size={16} />
        <span>Back to Trip Details</span>
      </button>

      {/* Header Summary */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-brand-950">Plan Your Trip with AI</h1>
            <span className="bg-brand-50 border border-brand-200 text-brand-600 font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              GenAI Mode
            </span>
          </div>
          <p className="text-slate-500 text-xs font-semibold">
            Personalized itineraries, weather-aware slots, packing suggestions, and outfit coordinates tailored to your profile.
          </p>

          {/* Details Row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-550 font-bold text-[11px] pt-3">
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-brand-500" />
              <span>{trip.destination}</span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar size={12} className="text-brand-500" />
              <span>{new Date(trip.start_date).toLocaleDateString()} — {new Date(trip.end_date).toLocaleDateString()}</span>
            </span>
            <span className="flex items-center gap-1">
              <DollarSign size={12} className="text-emerald-600" />
              <span>${trip.approximate_budget.toLocaleString()}</span>
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} className="text-brand-500" />
              <span>{trip.number_of_travelers} Travelers</span>
            </span>
          </div>
        </div>

        {plan && (
          <Button 
            onClick={() => handleGeneratePlan(true)}
            variant="outline"
            disabled={planLoading}
            className="gap-1.5 shrink-0 bg-white border-slate-300 font-semibold py-2.5"
          >
            <RefreshCw size={14} className={planLoading ? 'animate-spin' : ''} />
            <span>Regenerate Itinerary</span>
          </Button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {planLoading ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center space-y-4 shadow-sm flex flex-col items-center justify-center min-h-[40vh]">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            <Sparkles size={24} className="text-accent-500 absolute inset-0 m-auto animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-800">Planning your trip...</h3>
            <p className="text-slate-500 text-xs max-w-sm">
              Finding places and scheduling outdoor blocks based on your interests ({trip.travel_interests?.join(', ')}) and the destination weather forecast.
            </p>
          </div>
        </div>
      ) : !plan ? (
        /* Empty State */
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center flex flex-col items-center justify-center space-y-4 shadow-sm min-h-[40vh]">
          <div className="bg-slate-100 p-4 rounded-full text-slate-400">
            <Compass size={36} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-700">No AI plan generated yet</h3>
            <p className="text-slate-500 text-sm max-w-sm">
              Generate a personalized travel plan built around your style tags, scheduled duration, and verified weather details.
            </p>
          </div>
          <Button onClick={() => handleGeneratePlan(false)} className="gap-2 pt-2">
            <Sparkles size={16} />
            <span>Generate My Plan</span>
          </Button>
        </div>
      ) : (
        /* Main Plan Dashboard Layout */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Left Column: Plan Content Tabs & Itinerary */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Tabs Selector Navigation */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 select-none overflow-x-auto gap-0.5">
              {(['itinerary', 'places', 'outfits', 'packing', 'chat'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${
                    activeTab === tab
                      ? 'bg-white text-brand-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-750'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Itinerary Tab */}
            {activeTab === 'itinerary' && (
              <div className="space-y-4">
                
                {/* Day selector tabs */}
                <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
                  {plan.days.map((day: any) => (
                    <button
                      key={day.day_number}
                      onClick={() => setActiveDay(day.day_number)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        activeDay === day.day_number
                          ? 'bg-brand-500 border-brand-500 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350'
                      }`}
                    >
                      Day {day.day_number}
                    </button>
                  ))}
                </div>

                {/* Day Slots */}
                {plan.days
                  .filter((day: any) => day.day_number === activeDay)
                  .map((day: any) => (
                    <div key={day.day_number} className="space-y-4">
                      
                      {/* Morning Slot */}
                      <Card className="border-slate-200 hover:border-slate-300 transition-all shadow-sm">
                        <CardContent className="p-5 flex gap-4 items-start text-left text-xs">
                          <div className="bg-amber-50 border border-amber-200 text-amber-600 p-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] w-16 text-center">
                            Morning
                          </div>
                          <div className="space-y-1.5 flex-1">
                            <div className="flex justify-between items-start">
                              <h4 className="font-extrabold text-brand-950 text-sm">{day.morning.activity_name}</h4>
                              <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-550 px-2 py-0.5 rounded-full font-bold">
                                {day.morning.suggested_duration}
                              </span>
                            </div>
                            <p className="text-slate-650 leading-relaxed">{day.morning.description}</p>
                            <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-bold text-slate-400">
                              <span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded uppercase border border-brand-100">
                                {day.morning.activity_type}
                              </span>
                              <span>💡 {day.morning.why_matches}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Afternoon Slot */}
                      <Card className="border-slate-200 hover:border-slate-300 transition-all shadow-sm">
                        <CardContent className="p-5 flex gap-4 items-start text-left text-xs">
                          <div className="bg-sky-50 border border-sky-200 text-sky-600 p-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] w-16 text-center">
                            Afternoon
                          </div>
                          <div className="space-y-1.5 flex-1">
                            <div className="flex justify-between items-start">
                              <h4 className="font-extrabold text-brand-950 text-sm">{day.afternoon.activity_name}</h4>
                              <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-550 px-2 py-0.5 rounded-full font-bold">
                                {day.afternoon.suggested_duration}
                              </span>
                            </div>
                            <p className="text-slate-650 leading-relaxed">{day.afternoon.description}</p>
                            <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-bold text-slate-400">
                              <span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded uppercase border border-brand-100">
                                {day.afternoon.activity_type}
                              </span>
                              <span>💡 {day.afternoon.why_matches}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Evening Slot */}
                      <Card className="border-slate-200 hover:border-slate-300 transition-all shadow-sm">
                        <CardContent className="p-5 flex gap-4 items-start text-left text-xs">
                          <div className="bg-indigo-50 border border-indigo-200 text-indigo-600 p-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] w-16 text-center">
                            Evening
                          </div>
                          <div className="space-y-1.5 flex-1">
                            <div className="flex justify-between items-start">
                              <h4 className="font-extrabold text-brand-950 text-sm">{day.evening.activity_name}</h4>
                              <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-550 px-2 py-0.5 rounded-full font-bold">
                                {day.evening.suggested_duration}
                              </span>
                            </div>
                            <p className="text-slate-650 leading-relaxed">{day.evening.description}</p>
                            <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-bold text-slate-400">
                              <span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded uppercase border border-brand-100">
                                {day.evening.activity_type}
                              </span>
                              <span>💡 {day.evening.why_matches}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
              </div>
            )}

            {/* Places Tab */}
            {activeTab === 'places' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plan.recommendations?.map((place: any, idx: number) => (
                  <Card key={idx} className="border-slate-200 hover:shadow-sm overflow-hidden flex flex-col h-full text-left">
                    <CardHeader className="pb-2 border-b border-slate-100 bg-slate-50/20">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-sm font-extrabold text-brand-950">{place.place_name}</CardTitle>
                        <span className="text-[9px] bg-brand-50 border border-brand-200 text-brand-650 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          {place.activity_type}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4 flex-1 space-y-3 text-xs text-slate-600">
                      <p className="text-slate-550 leading-relaxed">{place.description}</p>
                      
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 text-[11px] font-semibold text-slate-500 space-y-1">
                        <div>⏱ Suggested Stay: <span className="text-slate-800">{place.suggested_duration}</span></div>
                        <div>🌤 Best Period: <span className="text-slate-800">{place.recommended_visiting_period}</span></div>
                      </div>

                      <div className="text-[10px] text-slate-400 pt-1 font-bold">
                        💡 Match Context: <span className="text-slate-600 font-semibold italic">"{place.why_matches}"</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Outfits Tab */}
            {activeTab === 'outfits' && (
              <div className="space-y-4">
                <p className="text-slate-500 text-xs font-semibold">
                  👕 Suggested styling ideas for {trip.destination} matching activity settings. suggestions are generated using forecast models.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plan.outfit_recommendations?.map((outfit: any, idx: number) => {
                    const icons = {
                      Everyday: <Shirt className="text-brand-500" size={16} />,
                      Outdoor: <Sun className="text-amber-500" size={16} />,
                      'Rainy Weather': <CloudRain className="text-sky-500" size={16} />,
                      Evening: <CloudSun className="text-indigo-500" size={16} />
                    };
                    return (
                      <Card key={idx} className="border-slate-200 hover:shadow-sm">
                        <CardHeader className="pb-2 border-b border-slate-100 bg-slate-50/20 flex flex-row items-center gap-2">
                          {icons[outfit.category as keyof typeof icons] || <Shirt className="text-brand-500" size={16} />}
                          <CardTitle className="text-sm font-extrabold text-brand-950 pt-0.5">{outfit.category}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3 text-xs text-left">
                          <div className="flex flex-wrap gap-1.5">
                            {outfit.items.map((item: string, i: number) => (
                              <span key={i} className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-[10px]">
                                {item}
                              </span>
                            ))}
                          </div>
                          <p className="text-slate-500 text-[11px] font-semibold leading-relaxed pt-1">
                            {outfit.advice}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Packing Tab */}
            {activeTab === 'packing' && (
              <Card className="border-slate-200 shadow-sm text-left">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <CardTitle className="text-base text-brand-950 font-bold flex items-center gap-2">
                      <Briefcase size={18} className="text-brand-500" />
                      <span>Smart Packing Checklist</span>
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500 font-medium">
                      Check off items as you pack them. State matches trip duration and climate forecast.
                    </CardDescription>
                  </div>

                  {/* Stat Badge */}
                  <div className="bg-brand-50 border border-brand-200 px-3 py-1 rounded-xl text-brand-700 text-xs font-extrabold flex items-center gap-1.5">
                    <span>{packedCount} / {totalCount} Packed</span>
                    <span className="text-[10px] text-brand-400">({packedPercent}%)</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 space-y-6">
                  
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                    <div 
                      className="bg-brand-500 h-full transition-all duration-300"
                      style={{ width: `${packedPercent}%` }}
                    />
                  </div>

                  {/* Add Custom Packing Item */}
                  <form onSubmit={handleAddPackingItem} className="flex flex-col sm:flex-row gap-3 pt-1 pb-3 border-b border-slate-150">
                    <Input
                      placeholder="Add custom item (e.g. Hiking boots)"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      required
                      className="flex-1 bg-white border-slate-200 py-2 text-xs"
                    />
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="rounded-xl border border-slate-200 text-slate-650 bg-white font-semibold text-xs py-2 px-3 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      {['Clothing', 'Weather', 'Personal Care', 'Electronics', 'Documents', 'Activity-specific', 'Emergency Essentials'].map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" className="gap-1 px-4 py-2 text-xs">
                      <Plus size={14} />
                      <span>Add</span>
                    </Button>
                  </form>

                  {/* Checklist Items list */}
                  {packingList.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                      No packing checklist items generated yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {packingList.map((item: any) => (
                        <div 
                          key={item.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                            item.is_packed
                              ? 'bg-slate-50/50 border-slate-200'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <label className="flex items-center gap-3 cursor-pointer select-none flex-grow">
                            <div className="relative flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={item.is_packed}
                                onChange={() => handleTogglePack(item.id, item.is_packed)}
                                className="sr-only"
                              />
                              <div className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${
                                item.is_packed
                                  ? 'bg-teal-500 border-teal-500 text-white'
                                  : 'border-slate-300 bg-white hover:border-slate-450'
                              }`}>
                                {item.is_packed && <Check size={14} strokeWidth={3} />}
                              </div>
                            </div>
                            <div className="text-left text-xs font-semibold">
                              <span className={item.is_packed ? 'text-slate-400 line-through' : 'text-slate-850'}>
                                {item.name}
                              </span>
                              <span className="block text-[9px] text-slate-400 uppercase tracking-wider pt-0.5">
                                {item.category} {item.quantity > 1 ? `(Qty: ${item.quantity})` : ''}
                              </span>
                            </div>
                          </label>

                          <button
                            onClick={() => handleDeletePackingItem(item.id)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-50 transition-colors"
                            title="Delete Item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Chat Assistant Tab */}
            {activeTab === 'chat' && (
              <Card className="border-slate-200 shadow-sm flex flex-col h-[52vh]">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
                  <CardTitle className="text-base text-brand-950 font-bold flex items-center gap-2">
                    <MessageSquare size={18} className="text-brand-500" />
                    <span>AI Travel Assistant Chat</span>
                  </CardTitle>
                  <CardDescription className="text-[11px] text-slate-500 font-semibold">
                    Ask questions about your packing checklist, itinerary pacing, or weather alerts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col overflow-hidden relative">
                  
                  {/* Chat Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[30vh]">
                    {(!plan.chat_history || plan.chat_history.length === 0) ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-2 p-6">
                        <Sparkles size={28} className="text-brand-300" />
                        <h4 className="font-bold text-xs text-slate-700">Ask TripMate AI anything about your trip</h4>
                        <p className="text-slate-405 text-[10px] max-w-xs leading-relaxed">
                          "Is my itinerary too busy?", "What should I wear on Day 1?", "Suggest photography locations in my destination."
                        </p>
                      </div>
                    ) : (
                      plan.chat_history.map((msg: any, idx: number) => (
                        <div 
                          key={idx}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs text-left leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-brand-500 text-white'
                              : 'bg-slate-100 border border-slate-200 text-slate-800'
                          }`}>
                            <p className="whitespace-pre-line">{msg.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 text-xs flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-slate-455 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-slate-455 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-slate-455 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Suggestion Chips */}
                  <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/30 flex gap-2 overflow-x-auto select-none no-scrollbar">
                    {["What should I pack?", "What should I do on Day 2?", "Suggest photography spots.", "Suggest an indoor activity."].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSendChatMessage(prompt)}
                        disabled={chatLoading}
                        className="px-2.5 py-1 rounded-full border border-slate-200 bg-white hover:border-slate-350 text-[10px] font-bold text-slate-550 whitespace-nowrap shrink-0 disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  {/* Input Form */}
                  <div className="p-3 border-t border-slate-100 bg-white flex gap-2">
                    <input
                      type="text"
                      placeholder="Ask the travel assistant..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                      disabled={chatLoading}
                      className="flex-1 rounded-xl border border-slate-200 text-xs px-3 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white disabled:bg-slate-50"
                    />
                    <Button 
                      onClick={() => handleSendChatMessage()}
                      disabled={!chatInput.trim() || chatLoading}
                      size="sm"
                      className="gap-1 p-2.5"
                    >
                      <Send size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Weather Summary Card */}
          <div className="space-y-6">
            
            {/* Weather Card */}
            <Card className="border-slate-200 shadow-sm text-left overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <CloudSun size={14} className="text-brand-500" />
                  <span>Verified Weather Data</span>
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-450 font-medium">
                  Direct forecast feed for {trip.destination}.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs font-semibold text-slate-600">
                
                {weatherLoading ? (
                  <div className="text-center py-6 text-slate-405 animate-pulse">
                    Loading forecast feed...
                  </div>
                ) : !weather || !weather.is_available ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 p-3 rounded-xl">
                      <AlertTriangle size={16} className="shrink-0" />
                      <span className="text-[11px] font-bold">Weather information is currently unavailable.</span>
                    </div>
                    <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">
                      Please verify forecast conditions from a reliable local meteorological source before departure.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Forecast loop */}
                    <div className="divide-y divide-slate-100">
                      {weather.forecast.slice(0, 4).map((day: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center py-2 text-xs">
                          <div className="text-slate-500 font-medium">{new Date(day.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                          <div className="flex items-center gap-3">
                            {day.icon && (
                              <img src={day.icon} alt={day.condition} className="w-7 h-7 object-contain" />
                            )}
                            <div className="text-slate-800 font-bold">{Math.round(day.temp_c)}°C</div>
                            <div className="text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-500 uppercase tracking-wide font-bold">
                              {day.condition.split(' ')[0]}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Warnings Alert Banner */}
                    {weather.warnings?.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[10px]">
                        <div className="text-red-500 font-bold uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle size={11} />
                          <span>Weather advisories</span>
                        </div>
                        <ul className="list-disc pl-3 text-slate-500 space-y-1 font-semibold leading-relaxed">
                          {weather.warnings.map((warn: string, idx: number) => (
                            <li key={idx}>{warn}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Warning Advisory Card */}
            <Card className="border-slate-200 shadow-sm text-left">
              <CardHeader className="pb-2 border-b border-slate-100 bg-slate-50/20">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  AI Travel Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 text-xs font-semibold text-slate-500 leading-relaxed space-y-2">
                <p>
                  Suggestions are AI-generated based on available context. Outfits and itineraries adjust dynamically.
                </p>
                <p className="text-[10px] italic text-slate-400 pt-1">
                  * Note: Verify safety instructions, entry constraints, and flight operations locally.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIPlanner;
