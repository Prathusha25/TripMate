import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { discoveryService, requestService, tripService, mlService, safetyService } from '../services/api';
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
  AlertTriangle
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
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [targetTravelerId, setTargetTravelerId] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  
  // Status maps
  const [requestStatusMap, setRequestStatusMap] = useState<Record<string, string>>({}); // key: tripId_receiverId, value: status

  // ML Dashboard State
  const [showMlDashboard, setShowMlDashboard] = useState(false);
  const [mlMetrics, setMlMetrics] = useState<any>(null);
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
      const [buddiesData, sentReqData, myTripsData, metricsData] = await Promise.all([
        discoveryService.getTravelBuddies(),
        requestService.getSentRequests(),
        tripService.getTrips(),
        mlService.getMetrics()
      ]);
      
      setCards(buddiesData);
      setSentRequests(sentReqData);
      setMyTrips(myTripsData);
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
      const res = await mlService.trainModel();
      setMlMetrics(res.metrics || res);
      toast('ML model successfully retrained on connections dataset!', 'success');
      // Reload matching lists with new model weights
      const buddiesData = await discoveryService.getTravelBuddies();
      setCards(buddiesData);
    } catch (error) {
      console.error(error);
      toast('Failed to train ML model.', 'error');
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
        return 'bg-emerald-50 text-emerald-700 border-emerald-250';
      case 'Strong Match':
        return 'bg-teal-50 text-teal-700 border-teal-250';
      case 'Good Match':
        return 'bg-indigo-50 text-indigo-700 border-indigo-250';
      case 'Possible Match':
        return 'bg-amber-50 text-amber-700 border-amber-250';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-250';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-left py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-950 font-display">Find Your Travel People</h1>
          <p className="text-slate-500 font-semibold text-sm">Discover compatible solo travelers ranked by our matching engine.</p>
        </div>
      </div>

      {apiError && <Alert variant="error">{apiError}</Alert>}


      {/* Search and filter controls */}
      <Card className="shadow-sm border-slate-200 bg-white">
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search size={18} />
              </div>
              <Input
                placeholder="Where are you heading? (e.g. Goa, Manali, Paris)"
                value={filterDestination}
                onChange={(e) => setFilterDestination(e.target.value)}
                className="pl-10 py-3 bg-white border-slate-200 text-slate-800"
              />
            </div>
            
            <div className="flex gap-2 shrink-0">
              <Button 
                variant="outline" 
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2 bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <SlidersHorizontal size={16} />
                <span>Filters</span>
              </Button>
              <Button onClick={fetchData}>Find Travelers</Button>
            </div>
          </div>

          {/* Expandable advanced filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 animate-slide-up text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-slate-500 uppercase tracking-wider">Budget Tier</label>
                <select
                  value={filterBudget}
                  onChange={(e) => setFilterBudget(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
                >
                  <option value="">Any Budget</option>
                  {BUDGET_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-500 uppercase tracking-wider">Travel Style</label>
                <select
                  value={filterStyle}
                  onChange={(e) => setFilterStyle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
                >
                  <option value="">Any Style</option>
                  {STYLES_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-500 uppercase tracking-wider">Interest</label>
                <select
                  value={filterInterest}
                  onChange={(e) => setFilterInterest(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
                >
                  <option value="">Any Interest</option>
                  {INTERESTS_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              <div className="sm:col-span-3 flex justify-end">
                <button 
                  onClick={clearFilters}
                  className="text-xs text-slate-400 hover:text-slate-650 underline font-bold"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {myTrips.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-semibold shadow-sm">
          <div className="space-y-0.5 text-left">
            <h3 className="font-bold text-brand-950">Select your active trip to match buddies:</h3>
            <p className="text-slate-500 font-medium">We will use this trip's preferences to highlight compatibilities.</p>
          </div>
          <select
            value={selectedTripId}
            onChange={(e) => {
              setSelectedTripId(e.target.value);
            }}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none w-full sm:w-64"
          >
            {myTrips.map(t => (
              <option key={t.id} value={t.id}>
                {t.destination} ({new Date(t.start_date).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Grid of travelers */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 h-80 space-y-4 shadow-sm" />
          ))}
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="bg-slate-100 p-4 rounded-full text-slate-400">
            <User size={36} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-700 font-display">No Matching Travelers Found</h3>
            <p className="text-slate-500 text-xs max-w-sm font-semibold">
              Try adjusting your search filters or clearing tags to explore other trips.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCards.map((card) => {
            const buddyRequest = sentRequests.find(r => r.receiver_id === card.id && r.request_type === 'buddy_request');
            const requestStatus = buddyRequest ? buddyRequest.status : null;
            const isOwner = card.user.id === user?.id;
            const showBreakdown = showBreakdownMap[card.id] || false;

            return (
              <Card key={card.id} className="glass-card flex flex-col h-full">
                {/* Header card creator avatar */}
                <CardHeader className="p-3.5 sm:p-4 pb-3 flex flex-row items-center gap-2.5 border-b border-slate-100 bg-slate-50/50 relative">
                  {card.user.profile_photo ? (
                    <img
                      src={card.user.profile_photo}
                      alt={card.user.name}
                      className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border shrink-0">
                      <User size={15} />
                    </div>
                  )}
                  <div className="text-left flex-1 min-w-0 pr-12">
                    <h3 className="font-semibold text-slate-900 text-xs sm:text-sm truncate">{card.user.name}</h3>
                    <p className="text-[10px] text-slate-400 font-normal truncate uppercase tracking-wider">{card.user.bio || 'Solo Traveler'}</p>
                  </div>
                  
                  {/* Safety moderation buttons */}
                  <div className="absolute top-2.5 right-2.5 flex gap-0.5 shrink-0">
                    <button 
                      onClick={() => handleBlockUser(card.user.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors"
                      title="Block User"
                    >
                      <Ban size={12} />
                    </button>
                    <button 
                      onClick={() => handleReportUser(card.user.id)}
                      className="p-1 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded transition-colors"
                      title="Report User"
                    >
                      <AlertTriangle size={12} />
                    </button>
                  </div>
                </CardHeader>

                {/* Trip parameters */}
                <CardContent className="flex-1 space-y-3 p-3.5 sm:p-4 text-xs text-left">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 font-display">
                      <MapPin size={13} className="text-brand-600 shrink-0" />
                      <span className="truncate">{card.destination}</span>
                    </h4>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                      <Calendar size={11} className="text-slate-400 shrink-0" />
                      <span className="truncate">
                        {new Date(card.start_date).toLocaleDateString([], { month: 'short', day: 'numeric' })} – {new Date(card.end_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {card.description && (
                    <p className="text-slate-600 text-xs leading-normal line-clamp-2 italic bg-slate-50/80 p-2.5 rounded-lg border border-slate-150 font-normal">
                      "{card.description}"
                    </p>
                  )}

                  {/* Budget & pax */}
                  <div className="flex items-center justify-between text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-150 text-xs">
                    <span className="flex items-center gap-1 font-semibold">
                      <DollarSign size={12} className="text-emerald-600" />
                      <span>${card.approximate_budget.toLocaleString()}</span>
                    </span>
                    <span className="flex items-center gap-1 text-slate-500 text-[11px]">
                      <Users size={12} className="text-brand-600" />
                      <span>{card.number_of_travelers} {card.number_of_travelers === 1 ? 'buddy' : 'buddies'}</span>
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="space-y-1">
                    {card.travel_interests?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {card.travel_interests.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[10px] font-semibold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {card.preferred_travel_style?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {card.preferred_travel_style.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-semibold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* Compatibility and actions */}
                <CardFooter className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 bg-slate-50/50 p-4">
                  {/* Dynamic Match Tier & Score Displays */}
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Compatibility Score</span>
                        <span className="text-sm font-extrabold text-brand-950 flex items-center gap-1">
                          <Sparkles size={13} className="text-accent-500 animate-pulse-subtle" />
                          <span>{card.compatibility}</span>
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getTierColor(card.match_tier || 'Possible Match')}`}>
                        {card.match_tier || 'Possible Match'}
                      </span>
                    </div>

                    {/* Expandable details breakdown drawer */}
                    <button 
                      onClick={() => toggleBreakdown(card.id)}
                      className="w-full flex items-center justify-between text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 py-1.5 px-2.5 rounded-lg transition-all duration-200 focus:outline-none"
                    >
                      <span>Match Details Breakdown</span>
                      {showBreakdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {showBreakdown && (
                      <div className="bg-white border border-slate-200 rounded-xl p-3 text-[10px] font-semibold space-y-2 animate-slide-up text-left max-h-36 overflow-y-auto shadow-inner">
                        <span className="text-[9px] uppercase text-slate-400 font-bold block pb-1 border-b border-slate-100">
                          Breakdown Summary ({card.match_method || 'Engine'})
                        </span>
                        
                        {card.match_reasons && card.match_reasons.length > 0 ? (
                          <div className="space-y-1.5 font-medium">
                            {card.match_reasons.map((reason, rid) => {
                              const isNegative = reason.includes("Different budget");
                              return (
                                <div key={rid} className="flex items-start gap-1.5">
                                  {isNegative ? (
                                    <XCircle size={12} className="text-red-500 mt-0.5 shrink-0" />
                                  ) : (
                                    <CheckCircle2 size={12} className="text-teal-600 mt-0.5 shrink-0" />
                                  )}
                                  <span className={isNegative ? 'text-slate-400' : 'text-slate-650'}>{reason}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-slate-400 italic">No specific overlap parameters resolved. Matching is base-level profile interest calculations.</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 w-full pt-1.5">
                    <Link to={`/travelers/${card.id}`} className="w-full">
                      <Button variant="outline" className="w-full text-xs py-1.5 bg-white border-slate-350 font-semibold">
                        View Profile
                      </Button>
                    </Link>

                    {isOwner ? (
                      <Button variant="outline" className="w-full gap-1 text-[11px] py-1.5 bg-slate-100 text-slate-500 border-slate-200 font-semibold" disabled>
                        <span>Your Profile</span>
                      </Button>
                    ) : requestStatus === 'pending' ? (
                      <Button variant="outline" className="w-full gap-1 text-[11px] py-1.5 bg-white text-slate-500 border-slate-200 font-semibold" disabled>
                        <span>Request Pending</span>
                      </Button>
                    ) : requestStatus === 'accepted' ? (
                      <Button variant="outline" className="w-full gap-1 text-[11px] py-1.5 text-teal-655 border-teal-200 bg-teal-50 font-semibold animate-fade-in" disabled>
                        <span>Connected</span>
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleSendBuddyRequest(card.id)}
                        className="w-full gap-1 text-[11px] py-1.5 font-bold"
                      >
                        <span>Send Buddy Request</span>
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TravelBuddies;
