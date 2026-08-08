import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { 
  Calendar, Compass, Sparkles, Plus, Trash2, Check, Users, 
  DollarSign, ArrowLeft, ArrowRight, CloudRain, Sun, Bed, 
  UtensilsCrossed, RefreshCw, Sliders, X, Search, Heart, 
  MapPin, Clock, Edit3, Save, CheckSquare
} from 'lucide-react';
import { aiService, tripService, weatherService, locationService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { LocationResult } from '../types';

interface Place {
  name: string;
  description: string;
  why_matches: string;
  selected?: boolean;
}

interface Category {
  category_name: string;
  places: Place[];
}

export const AITripPlannerPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Wizard Steps: 1 = Input Form, 2 = Customize Places, 3 = Questions, 4 = Final Plan
  const [step, setStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Dynamic Options (loaded from DB, with fallbacks)
  const [interestOptions, setInterestOptions] = useState<string[]>([]);
  const [styleOptions, setStyleOptions] = useState<string[]>([]);
  const [budgetOptions, setBudgetOptions] = useState<string[]>([]);
  const [activityOptions, setActivityOptions] = useState<string[]>([]);
  const [savedDrafts, setSavedDrafts] = useState<any[]>([]);

  // Step 1: Form Inputs & Geocoding Autocomplete State
  const [destination, setDestination] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [disambiguationModalOpen, setDisambiguationModalOpen] = useState<boolean>(false);
  const [disambiguationCandidates, setDisambiguationCandidates] = useState<LocationResult[]>([]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('Balanced');
  const [travelStyle, setTravelStyle] = useState('Balanced');
  const [travelers, setTravelers] = useState<number>(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);

  // Step 2: Recommendations State
  const [categories, setCategories] = useState<Category[]>([]);
  const [customPlacePrompt, setCustomPlacePrompt] = useState('');
  const [isAddingPlace, setIsAddingPlace] = useState(false);

  // Step 3: Preference Questions State
  const [pace, setPace] = useState('Balanced');
  const [focus, setFocus] = useState('Balanced');
  const [timePreference, setTimePreference] = useState('Early mornings');

  // Step 4: Final Plan State
  const [finalPlan, setFinalPlan] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);

  // Day Regeneration State
  const [regeneratingDayIdx, setRegeneratingDayIdx] = useState<number | null>(null);
  const [dayRegenPrompt, setDayRegenPrompt] = useState('');

  // Edit settings on Step 4 panel
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [step4CustomPrompt, setStep4CustomPrompt] = useState('');

  // Fallbacks in case database options fail to load
  const defaultInterests = ['Nature', 'Photography', 'Food', 'Adventure', 'Shopping', 'History', 'Culture', 'Nightlife', 'Relaxation'];
  const defaultStyles = ['Budget', 'Relaxed', 'Adventure', 'Luxury', 'Balanced', 'Backpacking', 'Family'];
  const defaultBudgets = ['Budget', 'Balanced', 'Luxury'];
  const defaultActivities = ['Hiking', 'Sightseeing', 'Museum visiting', 'Beach walk', 'Shopping', 'Dining', 'Spa & Wellness', 'Night clubs', 'Guided tours', 'Photography walk'];

  // Initialize options and drafts
  useEffect(() => {
    const loadOptionsAndDrafts = async () => {
      try {
        const opts = await aiService.getPlannerOptions();
        setInterestOptions(opts.interests || defaultInterests);
        setStyleOptions(opts.travel_styles || defaultStyles);
        setBudgetOptions(opts.budgets || defaultBudgets);
        setActivityOptions(opts.activities || defaultActivities);
      } catch (err) {
        console.error("Failed to load options from DB, using defaults:", err);
        setInterestOptions(defaultInterests);
        setStyleOptions(defaultStyles);
        setBudgetOptions(defaultBudgets);
        setActivityOptions(defaultActivities);
      }

      try {
        const drafts = await aiService.getDraftPlans();
        setSavedDrafts(drafts || []);
      } catch (err) {
        console.error("Failed to load saved drafts:", err);
      }
    };

    loadOptionsAndDrafts();
  }, []);

  // Debounced Open-Meteo Geocoding Search
  useEffect(() => {
    if (!destination || destination.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLocationSearchError(null);
      return;
    }

    // Don't re-search if destination matches already selected location
    if (
      selectedLocation && 
      (selectedLocation.name.toLowerCase() === destination.trim().toLowerCase() ||
       `${selectedLocation.name}, ${selectedLocation.country}`.toLowerCase() === destination.trim().toLowerCase())
    ) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingLocation(true);
      setLocationSearchError(null);
      try {
        const data = await locationService.searchLocations(destination.trim(), 8);
        const results = data.results || [];
        setSuggestions(results);
        setShowSuggestions(true);
        if (results.length === 0 && destination.trim().length >= 3) {
          setLocationSearchError('No matching destination was found. Try entering a city, town, region, or country.');
        }
      } catch (err: any) {
        console.error("Geocoding search failed:", err);
        setLocationSearchError("We couldn't verify this destination right now. Please try again.");
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
    setLocationSearchError(null);
    setDisambiguationModalOpen(false);
  };

  const handleClearDestination = () => {
    setDestination('');
    setSelectedLocation(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setLocationSearchError(null);
  };

  const handleInterestToggle = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleActivityToggle = (activity: string) => {
    if (selectedActivities.includes(activity)) {
      setSelectedActivities(selectedActivities.filter(a => a !== activity));
    } else {
      setSelectedActivities([...selectedActivities, activity]);
    }
  };

  // Step 1 -> Step 2
  const handleGetRecommendations = async (e?: React.FormEvent, overrideLocation?: LocationResult) => {
    if (e) e.preventDefault();
    if (!destination.trim()) {
      setErrorMsg('Please enter a destination.');
      return;
    }
    if (!startDate || !endDate) {
      setErrorMsg('Please select start and end dates.');
      return;
    }
    if (selectedInterests.length === 0) {
      setErrorMsg('Please select at least one travel interest.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    // Resolve location if not already selected
    let activeLoc = overrideLocation || selectedLocation;
    if (!activeLoc) {
      try {
        const searchRes = await locationService.searchLocations(destination.trim(), 5);
        const results = searchRes.results || [];
        if (results.length === 0) {
          setErrorMsg('No matching destination was found. Try entering a city, town, region, or country.');
          setIsLoading(false);
          return;
        } else if (results.length === 1) {
          activeLoc = results[0];
          setSelectedLocation(activeLoc);
        } else {
          // Multiple results found! Show selection prompt
          setDisambiguationCandidates(results);
          setDisambiguationModalOpen(true);
          setIsLoading(false);
          return;
        }
      } catch (err: any) {
        setErrorMsg("We couldn't verify this destination right now. Please try again.");
        setIsLoading(false);
        return;
      }
    }

    try {
      const data = await aiService.getRecommendations(
        activeLoc.name,
        selectedInterests,
        travelStyle,
        budget,
        travelers,
        selectedActivities,
        activeLoc
      );
      // Initialize places as selected
      const formattedCats = (data.categories || []).map((cat: any) => ({
        ...cat,
        places: (cat.places || []).map((p: any) => ({ ...p, selected: true }))
      }));
      setCategories(formattedCats);
      setStep(2);
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail;
      const msg = typeof errorDetail === 'object' && errorDetail?.message 
        ? errorDetail.message 
        : (typeof errorDetail === 'string' ? errorDetail : 'Failed to fetch place recommendations. Please try again.');
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle Selection
  const handleTogglePlace = (catIdx: number, placeIdx: number) => {
    const updated = [...categories];
    updated[catIdx].places[placeIdx].selected = !updated[catIdx].places[placeIdx].selected;
    setCategories(updated);
  };

  // Remove Place completely
  const handleRemovePlace = (catIdx: number, placeIdx: number) => {
    const updated = [...categories];
    updated[catIdx].places.splice(placeIdx, 1);
    if (updated[catIdx].places.length === 0) {
      updated.splice(catIdx, 1);
    }
    setCategories(updated);
  };

  // Remove Place by name (Step 4 quick edits)
  const handleRemovePlaceByName = (placeName: string) => {
    const updated = [...categories];
    updated.forEach(cat => {
      cat.places = cat.places.filter(p => p.name !== placeName);
    });
    setCategories(updated.filter(cat => cat.places.length > 0));
    toast(`Removed ${placeName}. Click 'Regenerate Itinerary' to recalculate plan.`, 'info');
  };

  // Add custom place
  const handleAddCustomPlace = async () => {
    if (!customPlacePrompt.trim()) return;
    setIsAddingPlace(true);
    try {
      const data = await aiService.suggestAndAddPlace(destination, customPlacePrompt);
      const newPlaces = (data.places || []).map((p: any) => ({ ...p, selected: true }));
      
      if (newPlaces.length > 0) {
        const updated = [...categories];
        const custCatIdx = updated.findIndex(c => c.category_name === 'Custom Suggestions');
        if (custCatIdx > -1) {
          updated[custCatIdx].places.push(...newPlaces);
        } else {
          updated.push({
            category_name: 'Custom Suggestions',
            places: newPlaces
          });
        }
        setCategories(updated);
        setCustomPlacePrompt('');
        toast('New places added to your customization list!', 'success');
      } else {
        toast('No suggestions found matching that description.', 'info');
      }
    } catch (err) {
      console.error(err);
      toast('Failed to suggest place.', 'error');
    } finally {
      setIsAddingPlace(false);
    }
  };

  // Generate Itinerary (Step 3 -> Step 4 or Step 4 settings change)
  const handleGenerateItinerary = async () => {
    const selectedPlacesList: string[] = [];
    categories.forEach(cat => {
      cat.places.forEach(p => {
        if (p.selected) {
          selectedPlacesList.push(p.name);
        }
      });
    });

    if (selectedPlacesList.length === 0) {
      toast('Please select or add at least one place for your plan.', 'error');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. Fetch real weather forecast using resolved destination coordinates
      let weatherForecast: any = { forecast_available: false, weather: [] };
      try {
        const queryDestination = selectedLocation 
          ? `${selectedLocation.name}${selectedLocation.country ? `, ${selectedLocation.country}` : ''}`
          : destination;
        weatherForecast = await weatherService.getGeneralForecast(queryDestination, startDate, endDate);
        setWeatherData(weatherForecast);
      } catch (wErr) {
        console.error("Weather forecast fetch failed:", wErr);
      }

      // 2. Call Planner API to generate weather-aware itinerary
      const planData = await aiService.generateItineraryPlan(
        selectedLocation?.name || destination,
        startDate,
        endDate,
        budget,
        selectedInterests,
        travelStyle,
        travelers,
        selectedPlacesList,
        selectedActivities,
        selectedLocation
      );
      setFinalPlan(planData);
      setStep(4);
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail;
      const msg = typeof errorDetail === 'object' && errorDetail?.message 
        ? errorDetail.message 
        : (typeof errorDetail === 'string' ? errorDetail : 'Failed to generate itinerary. Please try again.');
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Save Plan as Draft to MongoDB
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      const selectedPlacesList: string[] = [];
      categories.forEach(cat => {
        cat.places.forEach(p => {
          if (p.selected) {
            selectedPlacesList.push(p.name);
          }
        });
      });

      const draftPayload = {
        destination,
        start_date: startDate,
        end_date: endDate,
        budget,
        interests: selectedInterests,
        travel_style: travelStyle,
        activities: selectedActivities,
        number_of_travelers: travelers,
        selected_places: selectedPlacesList,
        itinerary: finalPlan?.itinerary || null,
        packing_checklist: finalPlan?.packing_checklist || null,
        outfit_recommendations: finalPlan?.outfit_recommendations || [],
        hotels: finalPlan?.hotels || [],
        restaurants: finalPlan?.restaurants || []
      };

      let saved;
      if (currentDraftId) {
        saved = await aiService.updateDraftPlan(currentDraftId, draftPayload);
        toast('Draft plan updated successfully!', 'success');
      } else {
        saved = await aiService.saveDraftPlan(draftPayload);
        setCurrentDraftId(saved.id || saved._id);
        toast('Draft plan saved successfully!', 'success');
      }

      // Refresh drafts
      const drafts = await aiService.getDraftPlans();
      setSavedDrafts(drafts || []);
    } catch (err) {
      console.error(err);
      toast('Failed to save draft plan.', 'error');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Open Draft
  const handleOpenDraft = (draft: any) => {
    setDestination(draft.destination || '');
    setStartDate(draft.start_date || '');
    setEndDate(draft.end_date || '');
    setBudget(draft.budget || 'Balanced');
    setTravelStyle(draft.travel_style || 'Balanced');
    setTravelers(draft.number_of_travelers || 1);
    setSelectedInterests(draft.interests || []);
    setSelectedActivities(draft.activities || []);
    setCurrentDraftId(draft._id || draft.id);

    if (draft.itinerary) {
      setFinalPlan({
        itinerary: draft.itinerary,
        packing_checklist: draft.packing_checklist,
        outfit_recommendations: draft.outfit_recommendations,
        hotels: draft.hotels,
        restaurants: draft.restaurants
      });

      // Populate customization categories for Step 2
      setCategories([{
        category_name: 'Selected Spots',
        places: (draft.selected_places || []).map((name: string) => ({
          name,
          description: 'Loaded spot from saved draft plan',
          why_matches: 'Selected',
          selected: true
        }))
      }]);

      setStep(4);
    } else {
      setStep(1);
    }
    toast('Draft plan loaded!', 'success');
  };

  // Delete Draft
  const handleDeleteDraft = async (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this draft plan?")) return;
    try {
      await aiService.deleteDraftPlan(draftId);
      toast('Draft deleted.', 'success');
      setSavedDrafts(prev => prev.filter(d => (d._id || d.id) !== draftId));
      if (currentDraftId === draftId) {
        setCurrentDraftId(null);
      }
    } catch (err) {
      console.error(err);
      toast('Failed to delete draft.', 'error');
    }
  };

  // Save Plan as actual Trip in MongoDB
  const handleSaveAsTrip = async () => {
    if (!finalPlan) return;
    setIsLoading(true);
    try {
      const selectedPlacesList: string[] = [];
      categories.forEach(cat => {
        cat.places.forEach(p => {
          if (p.selected) {
            selectedPlacesList.push(p.name);
          }
        });
      });

      // 1. Create Trip in MongoDB
      const newTrip = await tripService.createTrip({
        destination,
        start_date: startDate,
        end_date: endDate,
        approximate_budget: budget === 'Budget' ? 15000 : budget === 'Balanced' ? 35000 : 75000,
        travel_interests: selectedInterests,
        preferred_travel_style: [travelStyle],
        number_of_travelers: travelers,
        description: `Plan generated by AI containing ${selectedPlacesList.length} customized spots.`
      });

      // 2. Save active plan details under this Trip's ID (in ai_plans collection)
      await aiService.saveTripPlan(newTrip.id, {
        places: finalPlan.places || categories.flatMap(c => c.places.filter(p => p.selected)),
        visiting_times_explanation: finalPlan.visiting_times_explanation || {},
        itinerary: finalPlan.itinerary,
        outfit_recommendations: finalPlan.outfit_recommendations || [],
        packing_checklist: finalPlan.packing_checklist || {},
        hotels: finalPlan.hotels || [],
        restaurants: finalPlan.restaurants || []
      });

      // 3. Delete draft from planner workspace drafts to keep space clean (optional, let's keep it clean or leave it)
      if (currentDraftId) {
        try {
          await aiService.deleteDraftPlan(currentDraftId);
        } catch (dErr) {
          console.warn("Draft cleanup failed:", dErr);
        }
      }

      toast('Saved successfully! Your trip is now active.', 'success');
      navigate('/trips');
    } catch (err) {
      console.error(err);
      toast('Failed to save trip to MongoDB.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Single Day Regeneration
  const handleRegenerateDay = async (dayIdx: number) => {
    const day = finalPlan.itinerary[dayIdx];
    setIsLoading(true);
    try {
      // Fetch weather details for this specific day if available
      let targetWeather = {};
      if (weatherData && weatherData.weather) {
        targetWeather = weatherData.weather.find((w: any) => w.date === day.date) || {};
      }

      const selectedPlacesList: string[] = [];
      categories.forEach(cat => {
        cat.places.forEach(p => {
          if (p.selected) {
            selectedPlacesList.push(p.name);
          }
        });
      });

      const regeneratedDaySlots = await aiService.regenerateDayPlan({
        destination,
        day_number: day.day,
        date: day.date,
        budget,
        travel_style: travelStyle,
        interests: selectedInterests,
        selected_places: selectedPlacesList,
        weather_details: targetWeather,
        prompt: dayRegenPrompt || undefined
      });

      // Replace day slots in state
      const updatedItinerary = [...finalPlan.itinerary];
      updatedItinerary[dayIdx] = {
        ...day,
        morning: regeneratedDaySlots.morning || [],
        afternoon: regeneratedDaySlots.afternoon || [],
        evening: regeneratedDaySlots.evening || []
      };

      setFinalPlan({
        ...finalPlan,
        itinerary: updatedItinerary
      });

      setRegeneratingDayIdx(null);
      setDayRegenPrompt('');
      toast(`Day ${day.day} itinerary successfully regenerated!`, 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to regenerate day. Please check API settings.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getWeatherEmoji = (condition: string) => {
    const cond = condition.toLowerCase();
    if (cond.includes('clear') || cond.includes('sunny')) return '☀️';
    if (cond.includes('partly cloudy')) return '🌤️';
    if (cond.includes('cloudy') || cond.includes('overcast')) return '☁️';
    if (cond.includes('drizzle') || cond.includes('shower')) return '🌦️';
    if (cond.includes('rain')) return '🌧️';
    if (cond.includes('thunderstorm')) return '⛈️';
    return '☁️';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 animate-fade-in text-slate-800 w-full min-w-0">
      
      {/* Refined Page Header */}
      <div className="text-left space-y-1 pb-3 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles className="text-brand-600" size={20} />
            <span>AI Trip Planner</span>
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-normal">
            Build and customize personalized, weather-aware travel itineraries in seconds.
          </p>
        </div>
        {currentDraftId && step === 4 && (
          <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
            <Save size={12} />
            <span>Editing Saved Draft</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <Alert variant="error" className="text-left">
          {errorMsg}
        </Alert>
      )}

      {/* STEP 1: Preference Input Form & Saved Drafts Dashboard */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Input Form */}
          <div className="lg:col-span-2">
            <Card className="glass-card">
              <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100">
                <CardTitle className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-1.5">
                  <Sliders className="text-brand-600" size={16} />
                  <span>Configure Trip Details</span>
                </CardTitle>
                <CardDescription className="text-xs">Enter your destination, dates, and preferences to start planning.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 py-5">
                <form onSubmit={handleGetRecommendations} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Destination with Dynamic Geocoding Autocomplete */}
                    <div className="space-y-1 text-left relative">
                      <label className="text-xs font-medium text-slate-700 flex items-center justify-between">
                        <span>Destination</span>
                        {isSearchingLocation && (
                          <span className="text-[11px] text-brand-600 font-medium flex items-center gap-1">
                            <RefreshCw size={10} className="animate-spin" />
                            <span>Verifying...</span>
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="e.g. Manali, Paris, Goa, Munnar, Tokyo"
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
                          className="pl-9 pr-8 h-9 text-xs sm:text-sm"
                          required
                        />
                        {destination && (
                          <button
                            type="button"
                            onClick={handleClearDestination}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full"
                            title="Clear destination"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      {/* Autocomplete Dropdown */}
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute z-50 left-0 right-0 top-[60px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 animate-fade-in max-h-60 overflow-y-auto">
                          <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                            <span>Matching Destinations</span>
                            <span>Open-Meteo Verified</span>
                          </div>
                          {suggestions.map((loc, idx) => {
                            const isTopMatch = idx === 0;
                            return (
                              <button
                                type="button"
                                key={`${loc.name}-${loc.latitude}-${loc.longitude}-${idx}`}
                                onClick={() => handleSelectLocation(loc)}
                                className={`w-full px-3.5 py-2 text-left transition-colors flex items-center justify-between group text-xs ${
                                  isTopMatch ? 'bg-brand-50/30 hover:bg-brand-50/70' : 'hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <MapPin size={14} className={`mt-0.5 shrink-0 ${isTopMatch ? 'text-brand-600' : 'text-slate-400 group-hover:text-brand-500'}`} />
                                  <div className="min-w-0">
                                    <div className="font-semibold text-slate-900 group-hover:text-brand-700 transition-colors truncate flex items-center gap-1.5">
                                      <span>{loc.name}</span>
                                      {loc.country && (
                                        <span className="text-[10px] font-normal text-slate-500">
                                          · {[loc.region, loc.country].filter(Boolean).join(', ')}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}° · {loc.timezone}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  {isTopMatch ? (
                                    <span className="text-[9px] font-semibold text-brand-700 bg-brand-100/80 px-1.5 py-0.2 rounded-full border border-brand-200">
                                      Top Match
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                      {loc.country_code || 'GEO'}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Selected Location Badge */}
                      {selectedLocation && (
                        <div className="mt-1 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs animate-fade-in">
                          <div className="flex items-center gap-1.5">
                            <div className="bg-emerald-600 text-white rounded-full p-0.5">
                              <Check size={10} />
                            </div>
                            <span className="font-semibold text-emerald-900">
                              {selectedLocation.name}{selectedLocation.country ? `, ${selectedLocation.country}` : ''}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLocation(null);
                              setShowSuggestions(true);
                            }}
                            className="text-[11px] font-medium text-emerald-700 hover:text-emerald-900 underline ml-2 shrink-0"
                          >
                            Change
                          </button>
                        </div>
                      )}
                    </div>

                      {/* Location Search Helper Error */}
                      {locationSearchError && !selectedLocation && (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl flex items-center justify-between animate-fade-in">
                          <span>{locationSearchError}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setLocationSearchError(null);
                              setIsSearchingLocation(true);
                              locationService.searchLocations(destination.trim())
                                .then(d => setSuggestions(d.results || []))
                                .catch(() => {})
                                .finally(() => setIsSearchingLocation(false));
                            }}
                            className="text-[11px] font-bold text-amber-800 underline ml-2 shrink-0"
                          >
                            Retry
                          </button>
                        </div>
                      )}

                    {/* Number of Travelers */}
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Number of Travelers</label>
                      <div className="relative">
                        <Users className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                        <Input
                          type="number"
                          min={1}
                          value={travelers}
                          onChange={(e) => setTravelers(parseInt(e.target.value) || 1)}
                          className="pl-11 h-12 rounded-xl text-sm"
                          required
                        />
                      </div>
                    </div>

                    {/* Start Date */}
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Start Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="pl-11 h-12 rounded-xl text-sm"
                          required
                        />
                      </div>
                    </div>

                    {/* End Date */}
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">End Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="pl-11 h-12 rounded-xl text-sm"
                          required
                        />
                      </div>
                    </div>

                    {/* Budget */}
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Budget Style</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                        <select
                          value={budget}
                          onChange={(e) => setBudget(e.target.value)}
                          className="w-full pl-11 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 h-12 text-sm font-semibold bg-white"
                        >
                          {budgetOptions.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Travel Style */}
                    <div className="space-y-2 text-left">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Travel Style</label>
                      <select
                        value={travelStyle}
                        onChange={(e) => setTravelStyle(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 h-12 text-sm font-semibold bg-white"
                      >
                        {styleOptions.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Travel Interests (Multi-select) */}
                  <div className="space-y-3 text-left">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-slate-550 block">Select Interests</label>
                    <div className="flex flex-wrap gap-2">
                      {interestOptions.map(interest => {
                        const isSelected = selectedInterests.includes(interest);
                        return (
                          <button
                            type="button"
                            key={interest}
                            onClick={() => handleInterestToggle(interest)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                              isSelected
                                ? 'bg-brand-500 border-brand-500 text-white shadow-md shadow-brand-500/10'
                                : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100'
                            }`}
                          >
                            {interest}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Activities (Multi-select) */}
                  <div className="space-y-3 text-left">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-slate-550 block">Select Preferred Activities</label>
                    <div className="flex flex-wrap gap-2">
                      {activityOptions.map(activity => {
                        const isSelected = selectedActivities.includes(activity);
                        return (
                          <button
                            type="button"
                            key={activity}
                            onClick={() => handleActivityToggle(activity)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                              isSelected
                                ? 'bg-teal-655 bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-500/10'
                                : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100'
                            }`}
                          >
                            {activity}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full md:w-auto bg-brand-500 hover:bg-brand-600 text-white font-bold h-12 px-8 shadow-lg shadow-brand-500/20 rounded-xl flex items-center justify-center gap-2"
                    >
                      <Sparkles size={16} />
                      {isLoading ? 'Processing Preferences...' : 'Discover Places'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Saved Drafts Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="glass-card shadow-sm border-slate-200 bg-white rounded-3xl h-full flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-50 text-left">
                <CardTitle className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Save className="text-brand-500" size={16} />
                  <span>My Saved Plan Drafts</span>
                </CardTitle>
                <CardDescription className="text-[10px]">Load previous configurations and plans instantly.</CardDescription>
              </CardHeader>
              <CardContent className="py-4 space-y-3 flex-1 overflow-y-auto max-h-[500px] scrollbar-thin">
                {savedDrafts.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-semibold italic">
                    No saved drafts found.
                  </div>
                ) : (
                  savedDrafts.map((draft) => (
                    <div 
                      key={draft._id || draft.id}
                      onClick={() => handleOpenDraft(draft)}
                      className="group p-3 border border-slate-150 rounded-2xl bg-slate-50/50 hover:bg-brand-50/30 hover:border-brand-300 transition-all duration-200 cursor-pointer text-left relative flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-800 text-xs truncate max-w-[80%]">{draft.destination}</span>
                          <button
                            onClick={(e) => handleDeleteDraft(draft._id || draft.id, e)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 absolute top-2 right-2"
                            title="Delete Draft"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                          <Calendar size={10} />
                          <span>{draft.start_date} to {draft.end_date}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1.5">
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 uppercase tracking-wide">
                            {draft.budget}
                          </span>
                          {draft.itinerary && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-250 uppercase tracking-wide">
                              Plan Ready
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      )}

      {/* STEP 2: Customize Recommended Places */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => setStep(1)}
              variant="outline"
              className="bg-white border-slate-300 text-slate-700 px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Back
            </Button>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <span>📍</span> AI Recommended Places
            </h2>
            <Button
              onClick={() => setStep(3)}
              className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-1 shadow-md shadow-brand-500/10"
            >
              Preferences <ArrowRight size={14} />
            </Button>
          </div>

          {/* Place Search/Add Input */}
          <Card className="glass-card shadow-sm bg-white border-slate-200 text-left rounded-3xl">
            <CardContent className="py-5 space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-550 block">Search & Add Custom Spot with AI suggestions</span>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="e.g. Add a photography waterfall, local hidden cafe, or riverside spot..."
                    value={customPlacePrompt}
                    onChange={(e) => setCustomPlacePrompt(e.target.value)}
                    className="pl-11 h-11 rounded-xl text-sm"
                  />
                </div>
                <Button
                  onClick={handleAddCustomPlace}
                  disabled={isAddingPlace || !customPlacePrompt.trim()}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold px-5 h-11 text-xs rounded-xl whitespace-nowrap"
                >
                  {isAddingPlace ? 'Suggesting...' : '+ Add Place'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Places Grid */}
          <div className="space-y-6">
            {categories.map((cat, catIdx) => (
              <div key={cat.category_name} className="space-y-3 text-left">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-brand-700 pl-1 flex items-center gap-1.5">
                  <Heart size={14} />
                  <span>{cat.category_name}</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {cat.places.map((place, placeIdx) => (
                    <Card key={place.name} className={`border shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between rounded-2xl ${
                      place.selected ? 'border-brand-300 bg-brand-50/5' : 'border-slate-200 bg-white opacity-85'
                    }`}>
                      <CardContent className="pt-5 pb-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="font-extrabold text-slate-800 text-sm leading-snug">{place.name}</h4>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleTogglePlace(catIdx, placeIdx)}
                              className={`flex h-6 w-6 items-center justify-center rounded-lg border transition-all ${
                                place.selected
                                  ? 'bg-brand-500 border-brand-500 text-white shadow-sm'
                                  : 'bg-white border-slate-300 text-transparent hover:border-slate-400'
                              }`}
                            >
                              <Check size={14} className="stroke-[3]" />
                            </button>
                            <button
                              onClick={() => handleRemovePlace(catIdx, placeIdx)}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete spot completely"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed">{place.description}</p>
                      </CardContent>
                      <CardFooter className="pt-2 pb-3.5 text-[10px] text-slate-450 font-bold italic border-t border-slate-50 px-5 mt-auto flex items-center gap-1">
                        <Sparkles size={10} className="text-brand-400" />
                        <span>Reason: {place.why_matches}</span>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Optional Preference Questions */}
      {step === 3 && (
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="glass-card shadow-sm border-slate-200 bg-white rounded-3xl">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between text-left">
              <Button
                onClick={() => setStep(2)}
                variant="outline"
                className="bg-white border-slate-300 text-slate-700 px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1"
              >
                <ArrowLeft size={13} /> Back
              </Button>
              <CardTitle className="text-base font-bold text-slate-800">Customize Travel Preferences</CardTitle>
              <div className="w-16" />
            </CardHeader>
            <CardContent className="py-6 space-y-6 text-left">
              
              {/* Pace */}
              <div className="space-y-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">What travel pace do you prefer?</span>
                <div className="grid grid-cols-3 gap-3">
                  {['Relaxed', 'Balanced', 'Packed'].map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPace(option)}
                      className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all ${
                        pace === option
                          ? 'bg-brand-500 border-brand-500 text-white shadow-md'
                          : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus */}
              <div className="space-y-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">What is the primary plan focus?</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['Nature', 'Food', 'Photography', 'Adventure'].map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFocus(option)}
                      className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all ${
                        focus === option
                          ? 'bg-brand-500 border-brand-500 text-white shadow-md'
                          : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time preference */}
              <div className="space-y-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">How do you prefer starting the day?</span>
                <div className="grid grid-cols-2 gap-3">
                  {['Early mornings', 'Late starts'].map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTimePreference(option)}
                      className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all ${
                        timePreference === option
                          ? 'bg-brand-500 border-brand-500 text-white shadow-md'
                          : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleGenerateItinerary}
                  disabled={isLoading}
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold h-12 px-6 shadow-lg shadow-brand-500/20 rounded-xl flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={16} />
                  {isLoading ? 'Creating Your Itinerary...' : '✨ Make My Plan'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading overlay for planner gen */}
      {isLoading && (step === 3 || step === 4) && (
        <Card className="glass-card bg-white border-slate-200 py-16 flex flex-col items-center justify-center space-y-4 rounded-3xl shadow-lg">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
          <p className="text-sm font-extrabold text-slate-600 animate-pulse">
            AI is creating a realistic, weather-aware itinerary...
          </p>
          <span className="text-xs text-slate-400">Querying coordinates, checking available weather forecasts, and allocating time slots.</span>
        </Card>
      )}

      {/* STEP 4: Display Plan & Customization Panel */}
      {step === 4 && finalPlan && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 text-left items-start w-full min-w-0">
          
          {/* Left Itinerary Block (2/3 Column) */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8 animate-slide-up w-full min-w-0">
            
            {/* Header controls for plan draft */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-55 bg-slate-100/50 p-4 border border-slate-200 rounded-2xl">
              <Button
                onClick={() => setStep(3)}
                variant="outline"
                className="bg-white border-slate-300 text-slate-700 px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1"
              >
                <ArrowLeft size={13} /> Adjust Settings
              </Button>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  variant="outline"
                  className="bg-white border-slate-300 text-slate-700 px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1"
                >
                  <Save size={13} />
                  {isSavingDraft ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button
                  onClick={handleSaveAsTrip}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-1 shadow-md shadow-emerald-500/10"
                >
                  Save as Trip
                </Button>
              </div>
            </div>

            {/* Weather Aware Schedule Context */}
            {weatherData && (
              <Card className="glass-card border-slate-200 bg-white rounded-3xl">
                <CardHeader className="py-3 bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between text-left rounded-t-3xl">
                  <div>
                    <CardTitle className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Weather Aware Schedule Context</CardTitle>
                    <CardDescription className="text-[10px] text-slate-400">
                      Real-time weather API forecast supplied to OpenAI
                    </CardDescription>
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-250 uppercase tracking-widest animate-pulse">
                    Live Forecast
                  </span>
                </CardHeader>
                <CardContent className="py-4">
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
                    {(weatherData.weather || []).map((day: any) => (
                      <div key={day.date} className="min-w-[130px] p-3 rounded-2xl border border-slate-200 bg-slate-50/50 text-center space-y-1.5 flex-1 shrink-0 text-[10px]">
                        <div className="text-slate-450 font-bold">
                          {new Date(day.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-xl">{getWeatherEmoji(day.condition)}</div>
                        <div className="font-extrabold text-slate-700">{day.temp_max}°C / {day.temp_min}°C</div>
                        <div className="text-slate-500 font-bold">{day.condition}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Day-by-Day Itinerary */}
            <div className="space-y-6">
              {(finalPlan.itinerary || []).map((day: any, dayIdx: number) => (
                <Card key={day.day} className="border-slate-200 shadow-sm bg-white text-left rounded-3xl overflow-hidden">
                  <CardHeader className="pb-3 border-b border-slate-150 bg-slate-50/50 flex flex-row items-center justify-between gap-4 py-4 px-6">
                    <CardTitle className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                      <span className="bg-brand-500/10 text-brand-700 px-2 py-0.5 rounded-lg text-xs">Day {day.day}</span>
                      <span>{day.date ? new Date(day.date).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }) : ''}</span>
                    </CardTitle>
                    
                    {/* Regenerate Day Button */}
                    <div className="relative">
                      {regeneratingDayIdx === dayIdx ? (
                        <div className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl shadow-lg z-10 absolute right-0 top-0 min-w-[280px]">
                          <Input
                            type="text"
                            placeholder="Day prompt (e.g. more nature)..."
                            value={dayRegenPrompt}
                            onChange={(e) => setDayRegenPrompt(e.target.value)}
                            className="h-8 text-xs flex-1 rounded-lg"
                          />
                          <button
                            onClick={() => handleRegenerateDay(dayIdx)}
                            className="bg-brand-500 hover:bg-brand-600 text-white p-1.5 rounded-lg text-xs font-bold flex items-center justify-center shrink-0"
                            title="Go"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => { setRegeneratingDayIdx(null); setDayRegenPrompt(''); }}
                            className="bg-slate-100 text-slate-500 p-1.5 rounded-lg text-xs font-bold flex items-center justify-center shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => setRegeneratingDayIdx(dayIdx)}
                          variant="ghost"
                          className="text-brand-600 hover:bg-brand-50 px-2.5 py-1 text-[11px] font-bold rounded-lg flex items-center gap-1 border border-brand-200"
                        >
                          <RefreshCw size={11} className="animate-spin-slow" />
                          <span>Regen Day</span>
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="py-4 px-6 space-y-4">
                    
                    {/* Morning */}
                    {day.morning && day.morning.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-start pt-2 border-b border-slate-100 pb-3">
                        <span className="text-xs font-extrabold text-brand-600 uppercase tracking-widest md:pt-1">Morning</span>
                        <div className="md:col-span-3 space-y-2">
                          {day.morning.map((act: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 relative group">
                              <span className="font-extrabold text-slate-850 text-xs block pr-6">{act.place_name}</span>
                              <p className="text-xs text-slate-550 font-medium leading-relaxed mt-1">{act.activity}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-0.5">
                                  <Clock size={10} />
                                  <span>{act.duration}</span>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Afternoon */}
                    {day.afternoon && day.afternoon.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-start pt-2 border-b border-slate-100 pb-3">
                        <span className="text-xs font-extrabold text-amber-600 uppercase tracking-widest md:pt-1">Afternoon</span>
                        <div className="md:col-span-3 space-y-2">
                          {day.afternoon.map((act: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 relative group">
                              <span className="font-extrabold text-slate-850 text-xs block pr-6">{act.place_name}</span>
                              <p className="text-xs text-slate-550 font-medium leading-relaxed mt-1">{act.activity}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-0.5">
                                  <Clock size={10} />
                                  <span>{act.duration}</span>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Evening */}
                    {day.evening && day.evening.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-start pt-2">
                        <span className="text-xs font-extrabold text-purple-600 uppercase tracking-widest md:pt-1">Evening</span>
                        <div className="md:col-span-3 space-y-2">
                          {day.evening.map((act: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 relative group">
                              <span className="font-extrabold text-slate-850 text-xs block pr-6">{act.place_name}</span>
                              <p className="text-xs text-slate-550 font-medium leading-relaxed mt-1">{act.activity}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-0.5">
                                  <Clock size={10} />
                                  <span>{act.duration}</span>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Smart Checklist & Outfits suggestions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              {/* Outfits */}
              <Card className="border-slate-200 shadow-sm bg-white rounded-3xl">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/30 rounded-t-3xl">
                  <CardTitle className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Weather-Based Outfits</CardTitle>
                </CardHeader>
                <CardContent className="py-4">
                  <ul className="list-disc list-inside space-y-2.5 text-xs text-slate-600 font-medium leading-relaxed pl-1">
                    {(finalPlan.outfit_recommendations || []).map((rec: string, idx: number) => (
                      <li key={idx} className="marker:text-brand-500">{rec}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Smart Checklist */}
              <Card className="border-slate-200 shadow-sm bg-white rounded-3xl">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/30 rounded-t-3xl">
                  <CardTitle className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">AI Smart Packing Checklist</CardTitle>
                </CardHeader>
                <CardContent className="py-4 max-h-[300px] overflow-y-auto scrollbar-thin space-y-4">
                  {Object.entries(finalPlan.packing_checklist || {}).map(([category, items]: any) => (
                    <div key={category} className="space-y-1.5">
                      <h5 className="font-extrabold text-[10px] uppercase tracking-wider text-brand-600">{category.replace('_', ' ')}</h5>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((item: any, idx: number) => {
                          const name = typeof item === 'string' ? item : item.item;
                          return (
                            <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-150 text-[10px] font-bold text-slate-650 shadow-inner">
                              {name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Accommodation & Food suggestions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              {/* Hotels */}
              <Card className="border-slate-200 shadow-sm bg-white rounded-3xl">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/30 rounded-t-3xl">
                  <CardTitle className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Bed size={15} className="text-brand-500" />
                    <span>Accommodation Areas</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-4 space-y-4">
                  {(finalPlan.hotels || []).map((h: any, idx: number) => (
                    <div key={idx} className="space-y-1 p-3 rounded-2xl border border-slate-150 bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-800">{h.area || 'AI-suggested area/type'}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 tracking-wide uppercase">{h.type || 'AI-suggested type'}</span>
                      </div>
                      <p className="text-xs text-slate-550 font-medium leading-relaxed mt-1">{h.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Restaurants */}
              <Card className="border-slate-200 shadow-sm bg-white rounded-3xl">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/30 rounded-t-3xl">
                  <CardTitle className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <UtensilsCrossed size={15} className="text-brand-500" />
                    <span>Food Suggestions</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-4 space-y-4">
                  {(finalPlan.restaurants || []).map((r: any, idx: number) => (
                    <div key={idx} className="space-y-1 p-3 rounded-2xl border border-slate-150 bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-800">{r.area || 'AI-suggested area/type'}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 tracking-wide uppercase">{r.type || 'AI-suggested type'}</span>
                      </div>
                      <p className="text-xs text-slate-550 font-medium leading-relaxed mt-1">{r.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

          </div>

          {/* Right Adjustments Panel (1/3 Column) */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="glass-card shadow-sm border-slate-200 bg-white rounded-3xl sticky top-20">
              <CardHeader className="pb-3 border-b border-slate-50 text-left">
                <CardTitle className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Edit3 className="text-brand-500" size={16} />
                  <span>Modify Plan parameters</span>
                </CardTitle>
                <CardDescription className="text-[10px]">Alter criteria and regenerate details dynamically.</CardDescription>
              </CardHeader>
              <CardContent className="py-4 space-y-4 text-left">
                
                {/* Selected Places tag pool */}
                <div className="space-y-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">Selected Places Pool</span>
                  <div className="flex flex-wrap gap-1 max-h-[160px] overflow-y-auto border border-slate-150 p-2 rounded-xl bg-slate-50/30">
                    {categories.flatMap(c => c.places).map((p) => (
                      <span key={p.name} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700 shadow-sm">
                        <span>{p.name}</span>
                        <button
                          onClick={() => handleRemovePlaceByName(p.name)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                          title="Remove spot"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    {categories.flatMap(c => c.places).length === 0 && (
                      <span className="text-[10px] text-slate-400 font-semibold italic">No spots selected yet.</span>
                    )}
                  </div>
                </div>

                {/* Quick Place Search and Add */}
                <div className="space-y-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">Add specific place to pool</span>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="e.g. Riverside cafe..."
                      value={step4CustomPrompt}
                      onChange={(e) => setStep4CustomPrompt(e.target.value)}
                      className="h-8 text-xs rounded-lg flex-1"
                    />
                    <Button
                      onClick={async () => {
                        if (!step4CustomPrompt.trim()) return;
                        setIsAddingPlace(true);
                        try {
                          const data = await aiService.suggestAndAddPlace(destination, step4CustomPrompt);
                          const newPlaces = (data.places || []).map((p: any) => ({ ...p, selected: true }));
                          if (newPlaces.length > 0) {
                            const updated = [...categories];
                            const custCatIdx = updated.findIndex(c => c.category_name === 'Custom Suggestions');
                            if (custCatIdx > -1) {
                              updated[custCatIdx].places.push(...newPlaces);
                            } else {
                              updated.push({
                                category_name: 'Custom Suggestions',
                                places: newPlaces
                              });
                            }
                            setCategories(updated);
                            setStep4CustomPrompt('');
                            toast('Places added! Click Regenerate Itinerary to apply.', 'success');
                          } else {
                            toast('No suggestions found.', 'info');
                          }
                        } catch (err) {
                          console.error(err);
                          toast('Error adding place.', 'error');
                        } finally {
                          setIsAddingPlace(false);
                        }
                      }}
                      disabled={isAddingPlace || !step4CustomPrompt.trim()}
                      className="h-8 px-2 bg-slate-100 border border-slate-350 text-slate-700 text-[10px] font-bold rounded-lg shrink-0 whitespace-nowrap"
                    >
                      {isAddingPlace ? 'Suggesting...' : '+ Add'}
                    </Button>
                  </div>
                </div>

                {/* Budget */}
                <div className="space-y-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">Budget Style</span>
                  <select
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 h-9 text-xs font-bold bg-white"
                  >
                    {budgetOptions.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {/* Travel Style */}
                <div className="space-y-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">Travel Style</span>
                  <select
                    value={travelStyle}
                    onChange={(e) => setTravelStyle(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 h-9 text-xs font-bold bg-white"
                  >
                    {styleOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Interests Tag Cloud */}
                <div className="space-y-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">Active Interests</span>
                  <div className="flex flex-wrap gap-1.5">
                    {interestOptions.map(i => {
                      const active = selectedInterests.includes(i);
                      return (
                        <button
                          key={i}
                          onClick={() => handleInterestToggle(i)}
                          className={`px-2 py-1 border rounded-lg text-[10px] font-bold transition-all ${
                            active ? 'bg-brand-500 border-brand-500 text-white' : 'bg-white border-slate-250 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {i}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Activities Tag Cloud */}
                <div className="space-y-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block">Active Activities</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activityOptions.map(a => {
                      const active = selectedActivities.includes(a);
                      return (
                        <button
                          key={a}
                          onClick={() => handleActivityToggle(a)}
                          className={`px-2 py-1 border rounded-lg text-[10px] font-bold transition-all ${
                            active ? 'bg-teal-650 bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-250 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {a}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Major Action: Regenerate Plan */}
                <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                  <Button
                    onClick={handleGenerateItinerary}
                    disabled={isLoading}
                    className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold h-10 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-brand-500/10 text-xs"
                  >
                    <RefreshCw size={13} className="animate-spin-slow" />
                    <span>Regenerate Entire Itinerary</span>
                  </Button>
                </div>

              </CardContent>
            </Card>
          </div>

        </div>
      )}

      {/* Destination Disambiguation Modal */}
      {disambiguationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 text-left space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MapPin className="text-brand-500" size={20} />
                <h3 className="text-lg font-extrabold text-slate-900">Select Destination</h3>
              </div>
              <button
                onClick={() => setDisambiguationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="text-xs text-slate-500">
              We found multiple locations matching <span className="font-bold text-slate-800">"{destination}"</span>. Please select the correct place to continue:
            </p>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {disambiguationCandidates.map((loc, idx) => (
                <button
                  key={`${loc.name}-${loc.latitude}-${loc.longitude}-${idx}`}
                  onClick={() => {
                    handleSelectLocation(loc);
                    handleGetRecommendations(undefined, loc);
                  }}
                  className="w-full p-3.5 rounded-2xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50/40 text-left transition-all flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold text-slate-800 group-hover:text-brand-600">
                      {loc.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {[loc.region, loc.country].filter(Boolean).join(', ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                      {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
                    </span>
                    {loc.timezone && (
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {loc.timezone}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setDisambiguationModalOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AITripPlannerPage;
