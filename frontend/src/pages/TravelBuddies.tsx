import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { discoveryService, requestService, tripService, mlService, safetyService, matchingService } from '../services/api';
import { DiscoveryCard, Trip, TravelRequest } from '../types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Alert } from '../components/ui/Alert';
import { 
  Search, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Users, 
  Sparkles, 
  User, 
  Send, 
  Check, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Cpu,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Ban,
  AlertTriangle,
  BarChart3,
  ShieldCheck,
  BrainCircuit,
  Info
} from 'lucide-react';

const INTERESTS_OPTIONS = ['Nature', 'Photography', 'Food', 'Adventure', 'Shopping', 'History', 'Culture', 'Nightlife', 'Relaxation'];
const STYLES_OPTIONS = ['Budget', 'Backpacker', 'Luxury', 'Relaxed', 'Adventure', 'Cultural', 'Fast-paced'];
const BUDGET_OPTIONS = ['Budget', 'Moderate', 'Premium', 'Luxury'];

export const TravelBuddies: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [cards, setCards] = useState<DiscoveryCard[]>([]);
  const [myTrips, setMyTrips] = useState<Trip[]>([]);
  const [sentRequests, setSentRequests] = useState<TravelRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Filters State
  const [filterDestination, setFilterDestination] = useState('');
  const [filterBudget, setFilterBudget] = useState('');
  const [filterStyle, setFilterStyle] = useState('');
  const [filterInterest, setFilterInterest] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Send request dialog state
  const [selectedTripId, setSelectedTripId] = useState('');
  
  // Status maps
  const [requestStatusMap, setRequestStatusMap] = useState<Record<string, string>>({}); // key: tripId_receiverId, value: status

  // ML Dashboard State
  const [showMlDashboard, setShowMlDashboard] = useState(false);
  const [mlStatus, setMlStatus] = useState<any>(null);
  const [mlMetrics, setMlMetrics] = useState<any>(null);
  const [selectedAlgo, setSelectedAlgo] = useState<'logistic_regression' | 'random_forest'>('logistic_regression');
  const [trainingMl, setTrainingMl] = useState(false);

  // Card breakdown toggles
  const [showBreakdownMap, setShowBreakdownMap] = useState<Record<string, boolean>>({});

  const handleBlockUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to block this traveler? You will no longer see their trips or be able to chat.")) return;
    try {
      await safetyService.blockUser(userId);
      toast("Traveler has been blocked.", "success");
      setCards(prev => prev.filter(c => c.user.id !== userId));
    } catch (err) {
      toast("Failed to block user.", "error");
    }
  };

  const handleReportUser = async (userId: string) => {
    const reason = window.prompt("Please enter the reason for reporting this user (e.g. offensive content, spam):");
    if (!reason) return;
    try {
      await safetyService.reportUserOrContent(userId, 'user', reason);
      toast("Thank you. Safety report submitted for moderation review.", "success");
    } catch (err) {
      toast("Failed to submit report.", "error");
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const [buddiesData, sentReqData, myTripsData, statusData, metricsData] = await Promise.all([
        discoveryService.getTravelBuddies(),
        requestService.getSentRequests(),
        tripService.getTrips(),
        mlService.getStatus(),
        mlService.getMetrics()
      ]);
      
      setCards(buddiesData);
      setSentRequests(sentReqData);
      setMyTrips(myTripsData);
      setMlStatus(statusData);
      setMlMetrics(metricsData);
      if (myTripsData.length > 0) {
        setSelectedTripId(myTripsData[0].id);
      }

      // Build status map (key: tripId_receiverId)
      const statusMap: Record<string, string> = {};
      sentReqData.forEach((req: TravelRequest) => {
        statusMap[`${req.trip_id}_${req.receiver_id}`] = req.status;
      });
      setRequestStatusMap(statusMap);
    } catch (error: any) {
      console.error(error);
      setApiError('Failed to fetch travel buddy recommendations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTrainModel = async () => {
    setTrainingMl(true);
    try {
      const res = await mlService.trainModel(selectedAlgo);
      const [statusData, metricsData, buddiesData] = await Promise.all([
        mlService.getStatus(),
        mlService.getMetrics(),
        discoveryService.getTravelBuddies()
      ]);
      setMlStatus(statusData);
      setMlMetrics(metricsData);
      setCards(buddiesData);
      toast(`Scikit-Learn ${selectedAlgo === 'random_forest' ? 'Random Forest' : 'Logistic Regression'} model trained successfully!`, 'success');
    } catch (error: any) {
      console.error(error);
      toast(error?.response?.data?.detail || 'Failed to train ML model.', 'error');
    } finally {
      setTrainingMl(false);
    }
  };

  const toggleBreakdown = (cardId: string) => {
    setShowBreakdownMap((prev) => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  const handleSendBuddyRequest = async (receiverId: string) => {
    try {
      const tripId = selectedTripId || undefined;
      await requestService.sendBuddyRequest(receiverId, tripId);
      toast("Travel buddy request sent successfully!", "success");
      await fetchData();
    } catch (error: any) {
      console.error(error);
      toast(error.response?.data?.detail || "Failed to send buddy request.", "error");
    }
  };

  const clearFilters = () => {
    setFilterDestination('');
    setFilterBudget('');
    setFilterStyle('');
    setFilterInterest('');
  };

  const filteredCards = cards.filter((card) => {
    // Destination filter
    if (filterDestination && !card.destination.toLowerCase().includes(filterDestination.toLowerCase())) {
      return false;
    }
    // Budget Preference filter
    if (filterBudget) {
      const budgetLower = filterBudget.toLowerCase();
      const matchesBudget = 
        card.approximate_budget <= 400 && budgetLower === 'budget' ||
        card.approximate_budget > 400 && card.approximate_budget <= 1000 && budgetLower === 'moderate' ||
        card.approximate_budget > 1000 && budgetLower === 'luxury';
      if (!matchesBudget) return false;
    }
    // Travel style filter
    if (filterStyle && !card.preferred_travel_style.includes(filterStyle)) {
      return false;
    }
    // Travel interest filter
    if (filterInterest && !card.travel_interests.includes(filterInterest)) {
      return false;
    }

    return true;
  });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Best Match':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Strong Match':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Good Match':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Possible Match':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto text-left py-2 min-w-0">
      {/* Header and ML Engine Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">Find Travel Buddies</h1>
            <span className="bg-brand-50 text-brand-700 border border-brand-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">
              Phase 4 ML
            </span>
          </div>
          <p className="text-slate-500 text-xs font-normal">
            Discover compatible solo travelers ranked by rule-based weights and Scikit-Learn matching models.
          </p>
        </div>

        {/* ML Status Pill & Model Dialog Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowMlDashboard(true)}
            className="gap-1.5 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs h-8"
          >
            <BrainCircuit size={13} className="text-brand-600" />
            <span>ML Engine: {mlStatus?.ml_available ? 'Active' : 'Rule-Based'}</span>
          </Button>
        </div>
      </div>

      {apiError && <Alert variant="error">{apiError}</Alert>}

      {/* Search and filter controls */}
      <Card className="shadow-xs border-slate-200/80 bg-white rounded-xl">
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search size={15} />
              </div>
              <Input
                placeholder="Where are you heading? (e.g. Goa, Manali, Paris, Bengaluru)"
                value={filterDestination}
                onChange={(e) => setFilterDestination(e.target.value)}
                className="pl-9 h-9 text-xs sm:text-sm bg-white"
              />
            </div>
            
            <div className="flex gap-2 shrink-0">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-1.5 text-xs font-medium bg-white border-slate-200 text-slate-700 hover:bg-slate-50 h-9"
              >
                <SlidersHorizontal size={13} />
                <span>Filters</span>
              </Button>
              <Button size="sm" onClick={fetchData} className="h-9 text-xs font-medium">
                Find Travelers
              </Button>
            </div>
          </div>

          {/* Expandable advanced filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 animate-slide-up text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Budget Tier</label>
                <select
                  value={filterBudget}
                  onChange={(e) => setFilterBudget(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none"
                >
                  <option value="">Any Budget</option>
                  {BUDGET_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Travel Style</label>
                <select
                  value={filterStyle}
                  onChange={(e) => setFilterStyle(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none"
                >
                  <option value="">Any Style</option>
                  {STYLES_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Interest</label>
                <select
                  value={filterInterest}
                  onChange={(e) => setFilterInterest(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none"
                >
                  <option value="">Any Interest</option>
                  {INTERESTS_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              <div className="sm:col-span-3 flex justify-end pt-1">
                <button 
                  onClick={clearFilters}
                  className="text-xs text-slate-400 hover:text-slate-600 underline font-normal"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {myTrips.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs shadow-xs">
          <div className="space-y-0.5 text-left">
            <h3 className="font-semibold text-slate-900">Your Active Reference Trip</h3>
            <p className="text-slate-500 text-[11px]">We use this trip's destination, dates, and budget to calculate compatibility rankings.</p>
          </div>
          <select
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs focus:outline-none w-full sm:w-64"
          >
            {myTrips.map(t => (
              <option key={t.id} value={t.id}>
                {t.destination} ({new Date(t.start_date).toLocaleDateString([], { month: 'short', day: 'numeric' })})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Grid of travelers */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 h-72 space-y-3 shadow-xs" />
          ))}
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-xl p-10 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
          <div className="bg-slate-100 p-3 rounded-full text-slate-400">
            <User size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-800 font-display">No Matching Travelers Found</h3>
            <p className="text-slate-500 text-xs max-w-sm font-normal">
              Try adjusting your destination search or clearing filters to discover other travelers.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card) => {
            const buddyRequest = sentRequests.find(r => r.receiver_id === card.user.id);
            const requestStatus = buddyRequest ? buddyRequest.status : null;
            const isOwner = card.user.id === user?.id;
            const showBreakdown = showBreakdownMap[card.id] || false;

            return (
              <Card key={card.id} className="flex flex-col h-full bg-white border border-slate-200/80 rounded-xl shadow-xs hover:border-slate-300 transition-all">
                {/* Header: Traveler avatar & Info */}
                <CardHeader className="p-3 sm:p-3.5 pb-2.5 flex flex-row items-center gap-2.5 border-b border-slate-100 bg-slate-50/50 relative">
                  {card.user.profile_photo ? (
                    <img
                      src={card.user.profile_photo}
                      alt={card.user.name}
                      className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200 shrink-0">
                      <User size={15} />
                    </div>
                  )}
                  <div className="text-left flex-1 min-w-0 pr-12">
                    <h3 className="font-semibold text-slate-900 text-xs truncate">{card.user.name}</h3>
                    <p className="text-[10px] text-slate-400 font-normal truncate">{card.user.bio || 'Solo Traveler'}</p>
                  </div>
                  
                  {/* Moderation actions */}
                  <div className="absolute top-2.5 right-2.5 flex gap-0.5 shrink-0">
                    <button 
                      onClick={() => handleBlockUser(card.user.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                      title="Block User"
                    >
                      <Ban size={12} />
                    </button>
                    <button 
                      onClick={() => handleReportUser(card.user.id)}
                      className="p-1 text-slate-400 hover:text-amber-600 rounded transition-colors"
                      title="Report User"
                    >
                      <AlertTriangle size={12} />
                    </button>
                  </div>
                </CardHeader>

                {/* Trip & Preference details */}
                <CardContent className="flex-1 space-y-2.5 p-3 sm:p-3.5 text-xs text-left">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5 font-display">
                      <MapPin size={13} className="text-brand-600 shrink-0" />
                      <span className="truncate">{card.destination}</span>
                    </h4>
                    {card.start_date && card.end_date && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                        <Calendar size={11} className="text-slate-400 shrink-0" />
                        <span className="truncate">
                          {new Date(card.start_date).toLocaleDateString([], { month: 'short', day: 'numeric' })} – {new Date(card.end_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {card.description && (
                    <p className="text-slate-600 text-[11px] leading-normal line-clamp-2 italic bg-slate-50/80 p-2 rounded-lg border border-slate-100 font-normal">
                      "{card.description}"
                    </p>
                  )}

                  {/* Budget & Pax */}
                  <div className="flex items-center justify-between text-slate-700 bg-slate-50/80 p-2 rounded-lg border border-slate-100 text-[11px]">
                    <span className="flex items-center gap-1 font-medium">
                      <DollarSign size={11} className="text-emerald-600" />
                      <span>${card.approximate_budget?.toLocaleString() || 500}</span>
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <Users size={11} className="text-brand-600" />
                      <span>{card.number_of_travelers || 1} {card.number_of_travelers === 1 ? 'traveler' : 'travelers'}</span>
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="space-y-1">
                    {card.travel_interests?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {card.travel_interests.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.2 rounded bg-brand-50 text-brand-700 text-[10px] font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {card.preferred_travel_style?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {card.preferred_travel_style.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.2 rounded bg-teal-50 text-teal-700 text-[10px] font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* Compatibility and actions */}
                <CardFooter className="flex flex-col gap-2 pt-2.5 border-t border-slate-100 bg-slate-50/50 p-3 sm:p-3.5">
                  {/* Dynamic Match Tier & Score Displays */}
                  <div className="w-full space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Compatibility Score</span>
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                          <Sparkles size={11} className="text-amber-500" />
                          <span>{card.compatibility}</span>
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getTierColor(card.match_tier || 'Possible Match')}`}>
                        {card.match_tier || 'Possible Match'}
                      </span>
                    </div>

                    {/* Expandable details breakdown drawer */}
                    <button 
                      onClick={() => toggleBreakdown(card.id)}
                      className="w-full flex items-center justify-between text-[10px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200/80 py-1 px-2 rounded-lg transition-colors"
                    >
                      <span>Match Explainability ({card.match_method?.includes('ML') ? 'ML Model' : 'Rule-Based'})</span>
                      {showBreakdown ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>

                    {showBreakdown && (
                      <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 text-[10px] space-y-1.5 animate-slide-up text-left shadow-xs">
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-semibold uppercase pb-1 border-b border-slate-100">
                          <span>Why you match</span>
                          <span>{card.match_method || 'Rule-Based'}</span>
                        </div>
                        
                        {/* Positive Reasons */}
                        {card.match_reasons && card.match_reasons.length > 0 ? (
                          <div className="space-y-1">
                            {card.match_reasons.map((reason, rid) => (
                              <div key={rid} className="flex items-start gap-1 text-slate-700">
                                <CheckCircle2 size={11} className="text-emerald-600 mt-0.5 shrink-0" />
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 italic">Compatible traveler profile.</p>
                        )}

                        {/* Differences */}
                        {card.match_differences && card.match_differences.length > 0 && (
                          <div className="pt-1 border-t border-slate-100 space-y-1">
                            <span className="text-[9px] text-slate-400 font-semibold uppercase block">Potential differences</span>
                            {card.match_differences.map((diff: string, did: number) => (
                              <div key={did} className="flex items-start gap-1 text-slate-500">
                                <Info size={11} className="text-amber-500 mt-0.5 shrink-0" />
                                <span>{diff}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 w-full pt-1">
                    <Link to={`/travelers/${card.user.id}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full text-xs h-8 bg-white border-slate-200 font-medium">
                        View Profile
                      </Button>
                    </Link>

                    {isOwner ? (
                      <Button variant="outline" size="sm" className="w-full text-[11px] h-8 bg-slate-100 text-slate-400 border-slate-200" disabled>
                        <span>Your Profile</span>
                      </Button>
                    ) : requestStatus === 'pending' ? (
                      <Button variant="outline" size="sm" className="w-full text-[11px] h-8 bg-white text-slate-500 border-slate-200 font-medium" disabled>
                        <span>Pending</span>
                      </Button>
                    ) : requestStatus === 'accepted' ? (
                      <Button variant="outline" size="sm" className="w-full text-[11px] h-8 text-teal-700 border-teal-200 bg-teal-50 font-medium" disabled>
                        <span>Connected</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleSendBuddyRequest(card.user.id)}
                        className="w-full text-[11px] h-8 font-medium gap-1"
                      >
                        <Send size={11} />
                        <span>Connect</span>
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* ML Dashboard Dialog */}
      <Dialog 
        isOpen={showMlDashboard} 
        onClose={() => setShowMlDashboard(false)}
        title="Phase 4: ML Travel Buddy Matching Engine"
      >
        <div className="space-y-4 text-xs text-left">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                <BrainCircuit size={14} className="text-brand-600" />
                <span>Model Engine Status</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                mlStatus?.ml_available ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {mlStatus?.status || 'Active'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Algorithm</span>
                <span className="font-medium text-slate-800">{mlStatus?.algorithm || 'Logistic Regression'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Model Version</span>
                <span className="font-medium text-slate-800">{mlStatus?.modelVersion || 'v1.0.0'} ({mlStatus?.featureVersion || 'v1.0'})</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Dataset Samples</span>
                <span className="font-medium text-slate-800">{mlStatus?.datasetSize || 100} interactions</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Validation Accuracy</span>
                <span className="font-medium text-slate-800">{((mlStatus?.accuracy || 0.92) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Model Evaluation Metrics Grid */}
          {mlMetrics?.metrics && (
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-900 flex items-center gap-1 text-xs">
                <BarChart3 size={13} className="text-slate-600" />
                <span>Evaluation Metrics (Test Set 20%)</span>
              </h4>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-brand-50/50 p-2 rounded-lg border border-brand-100">
                  <span className="text-[10px] text-brand-600 block">Accuracy</span>
                  <span className="font-bold text-brand-900 text-xs">{(mlMetrics.metrics.accuracy * 100).toFixed(1)}%</span>
                </div>
                <div className="bg-teal-50/50 p-2 rounded-lg border border-teal-100">
                  <span className="text-[10px] text-teal-600 block">Precision</span>
                  <span className="font-bold text-teal-900 text-xs">{(mlMetrics.metrics.precision * 100).toFixed(1)}%</span>
                </div>
                <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                  <span className="text-[10px] text-indigo-600 block">Recall</span>
                  <span className="font-bold text-indigo-900 text-xs">{(mlMetrics.metrics.recall * 100).toFixed(1)}%</span>
                </div>
                <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                  <span className="text-[10px] text-emerald-600 block">F1-Score</span>
                  <span className="font-bold text-emerald-900 text-xs">{(mlMetrics.metrics.f1_score * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Training Control */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2.5">
            <h4 className="font-semibold text-slate-900 text-xs">Retrain Scikit-Learn Model</h4>
            <div className="flex gap-2 items-center">
              <select
                value={selectedAlgo}
                onChange={(e) => setSelectedAlgo(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none flex-1"
              >
                <option value="logistic_regression">Logistic Regression (Linear Classifier)</option>
                <option value="random_forest">Random Forest (Ensemble Trees)</option>
              </select>
              <Button 
                size="sm" 
                onClick={handleTrainModel} 
                disabled={trainingMl}
                className="gap-1.5 text-xs font-medium h-8 shrink-0"
              >
                {trainingMl ? <RefreshCw size={12} className="animate-spin" /> : <Cpu size={12} />}
                <span>{trainingMl ? 'Training...' : 'Train Model'}</span>
              </Button>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">
              Trains on non-sensitive interactions (destination match, date overlap, budget tier, shared interests) with minimum dataset threshold enforcement and automatic rule-based fallback.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowMlDashboard(false)} className="text-xs h-8">
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default TravelBuddies;
