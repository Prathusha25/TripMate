import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { tripService, requestService, connectionService } from '../services/api';
import { Trip, TravelRequest, Connection } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
  Calendar, 
  MapPin, 
  DollarSign, 
  UserPlus, 
  Users, 
  Compass, 
  MessageSquare, 
  Plus, 
  Globe, 
  UserCheck,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Sun
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<TravelRequest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [tripsData, reqData, connData] = await Promise.all([
        tripService.getTrips(),
        requestService.getIncomingRequests(),
        connectionService.getConnections(),
      ]);
      setTrips(tripsData || []);
      setIncomingRequests(reqData || []);
      setConnections(connData || []);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleAcceptRequest = async (requestId: string) => {
    setActioningId(requestId);
    try {
      await requestService.acceptRequest(requestId);
      toast('Buddy request accepted!', 'success');
      await fetchDashboardData();
    } catch (error) {
      console.error(error);
      toast('Failed to accept request.', 'error');
    } finally {
      setActioningId(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setActioningId(requestId);
    try {
      await requestService.rejectRequest(requestId);
      toast('Request rejected.', 'info');
      await fetchDashboardData();
    } catch (error) {
      console.error(error);
      toast('Failed to reject request.', 'error');
    } finally {
      setActioningId(null);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-left w-full min-w-0">
      
      {/* Clean, Compact Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-display">
            Welcome back, {user.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
            Plan your next journey with AI, find travel buddies, and coordinate trips.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link to="/ai-planner">
            <Button size="md" className="gap-1.5 font-medium bg-brand-600 hover:bg-brand-700 text-white">
              <Sparkles size={14} />
              <span>AI Trip Planner</span>
            </Button>
          </Link>
          <Link to="/trips/create">
            <Button size="md" variant="outline" className="gap-1.5 font-medium">
              <Plus size={14} />
              <span>Create Trip</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Compact Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="glass-card">
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider truncate">Upcoming Trips</p>
              <h3 className="text-xl font-bold text-slate-900">{isLoading ? '...' : trips.length}</h3>
            </div>
            <div className="p-2 bg-brand-50 text-brand-600 rounded-lg shrink-0">
              <Calendar size={18} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider truncate">Buddy Requests</p>
              <h3 className="text-xl font-bold text-slate-900">{isLoading ? '...' : incomingRequests.length}</h3>
            </div>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg shrink-0">
              <UserPlus size={18} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider truncate">Connections</p>
              <h3 className="text-xl font-bold text-slate-900">{isLoading ? '...' : connections.length}</h3>
            </div>
            <div className="p-2 bg-accent-50 text-accent-600 rounded-lg shrink-0">
              <Users size={18} />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider truncate">Active Destination</p>
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {trips[0]?.destination || 'None active'}
              </h3>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
              <Globe size={18} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Trips and Requests */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          
          {/* Upcoming Trips List */}
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Calendar size={16} className="text-brand-600" />
                <h2 className="text-sm sm:text-base font-semibold text-slate-900 font-display">Scheduled Trips</h2>
              </div>
              <Link to="/trips" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-0.5">
                <span>View all ({trips.length})</span>
                <ChevronRight size={13} />
              </Link>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4 h-36 skeleton-shimmer" />
                <div className="bg-white border border-slate-200 rounded-xl p-4 h-36 skeleton-shimmer" />
              </div>
            ) : trips.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-xl p-6 text-center space-y-3">
                <div className="mx-auto w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
                  <Compass size={20} />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-slate-800 text-xs sm:text-sm">No Trips Scheduled Yet</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto font-normal">
                    Generate an itinerary with AI or schedule a trip to match with travel buddies.
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-1">
                  <Link to="/ai-planner">
                    <Button size="sm" className="gap-1 font-medium">
                      <Sparkles size={13} />
                      <span>AI Trip Planner</span>
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {trips.slice(0, 2).map((trip) => (
                  <Card key={trip.id} className="glass-card flex flex-col justify-between h-full">
                    <CardHeader className="p-4 pb-2.5 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-semibold text-slate-900 truncate">
                            {trip.destination}
                          </CardTitle>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-normal">
                            <Calendar size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate">
                              {new Date(trip.start_date).toLocaleDateString([], { month: 'short', day: 'numeric' })} – {new Date(trip.end_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </p>
                        </div>
                        <span className="text-[10px] font-medium px-2 py-0.2 rounded bg-slate-100 text-slate-700 shrink-0">
                          {trip.preferred_travel_style?.[0] || 'Adventure'}
                        </span>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-4 py-3 space-y-2 flex-1 text-xs">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Budget:</span>
                        <span className="text-slate-800 font-semibold">
                          ${trip.approximate_budget ? trip.approximate_budget.toLocaleString() : 'Flexible'}
                        </span>
                      </div>
                      {trip.travel_interests?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {trip.travel_interests.slice(0, 3).map((tag) => (
                            <span key={tag} className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-normal">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </CardContent>

                    <div className="p-4 pt-0 border-t border-slate-100 flex justify-end">
                      <Link to={`/trips/${trip.id}`} className="w-full">
                        <Button variant="outline" size="sm" className="w-full text-xs font-medium py-1.5">
                          <span>View Trip Details</span>
                          <ArrowRight size={12} />
                        </Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Incoming Buddy Requests */}
          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <UserCheck size={16} className="text-teal-600" />
                <h2 className="text-sm sm:text-base font-semibold text-slate-900 font-display">Buddy Requests</h2>
              </div>
              <Link to="/requests" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-0.5">
                <span>View all</span>
                <ChevronRight size={13} />
              </Link>
            </div>
            
            {isLoading ? (
              <div className="bg-white border border-slate-200 rounded-xl p-4 h-24 skeleton-shimmer" />
            ) : incomingRequests.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-xl p-6 text-center text-slate-500 text-xs">
                <p className="font-normal">No pending incoming travel requests.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {incomingRequests.slice(0, 3).map((req) => (
                  <div key={req.id} className="bg-white border border-slate-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {req.sender?.profile_photo ? (
                        <img
                          src={req.sender.profile_photo}
                          alt={req.sender.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                          <Users size={14} />
                        </div>
                      )}
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="font-semibold text-slate-900 text-xs truncate">{req.sender?.name}</h4>
                        <p className="text-slate-500 text-[11px] truncate font-normal">
                          Wants to join trip to <span className="text-slate-800 font-medium">{req.trip?.destination}</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 justify-end shrink-0">
                      <Link to={`/travelers/${req.sender_id}`}>
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                          Profile
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-rose-200 text-rose-600 hover:bg-rose-50 h-7 px-2.5"
                        onClick={() => handleRejectRequest(req.id)}
                        disabled={actioningId === req.id}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2.5"
                        onClick={() => handleAcceptRequest(req.id)}
                        isLoading={actioningId === req.id}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right 1 Column: Quick Actions & Active Connections */}
        <div className="space-y-6 min-w-0">
          
          {/* Quick Actions Panel */}
          <section className="space-y-2.5 bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-sm text-left">
            <h3 className="font-semibold text-xs text-slate-500 uppercase tracking-wider">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <Link to="/ai-planner" className="w-full">
                <Button variant="outline" className="w-full text-xs font-medium py-2.5 h-auto flex flex-col items-center gap-1 bg-slate-50/50 hover:bg-brand-50/50 hover:border-brand-300">
                  <Sparkles size={15} className="text-brand-600" />
                  <span>AI Planner</span>
                </Button>
              </Link>
              <Link to="/travel-buddies" className="w-full">
                <Button variant="outline" className="w-full text-xs font-medium py-2.5 h-auto flex flex-col items-center gap-1 bg-slate-50/50 hover:bg-teal-50/50 hover:border-teal-300">
                  <Compass size={15} className="text-teal-600" />
                  <span>Find Buddies</span>
                </Button>
              </Link>
              <Link to="/weather" className="w-full">
                <Button variant="outline" className="w-full text-xs font-medium py-2.5 h-auto flex flex-col items-center gap-1 bg-slate-50/50 hover:bg-amber-50/50 hover:border-amber-300">
                  <Sun size={15} className="text-amber-500" />
                  <span>Weather</span>
                </Button>
              </Link>
              <Link to="/connections" className="w-full">
                <Button variant="outline" className="w-full text-xs font-medium py-2.5 h-auto flex flex-col items-center gap-1 bg-slate-50/50 hover:bg-accent-50/50 hover:border-accent-300">
                  <Globe size={15} className="text-accent-500" />
                  <span>Connections</span>
                </Button>
              </Link>
            </div>
          </section>

          {/* Active Connections */}
          <section className="space-y-2.5">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Connections</h2>
              <Link to="/connections" className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                View all
              </Link>
            </div>
            
            {isLoading ? (
              <div className="bg-white border border-slate-200 rounded-xl p-4 h-24 skeleton-shimmer" />
            ) : connections.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-xl p-4 text-center text-slate-500 text-xs">
                <span>No active connections yet. Match with travelers to begin chatting.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {connections.slice(0, 3).map((conn) => (
                  <div key={conn.id} className="bg-white border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2.5 text-xs shadow-sm hover:border-slate-300 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      {conn.buddy?.profile_photo ? (
                        <img
                          src={conn.buddy.profile_photo}
                          alt={conn.buddy.name}
                          className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                          <Users size={12} />
                        </div>
                      )}
                      <div className="min-w-0 text-left">
                        <h4 className="font-semibold text-slate-900 text-xs truncate">{conn.buddy?.name}</h4>
                        <p className="text-[10px] text-slate-500 truncate font-normal">{conn.shared_trip?.destination}</p>
                      </div>
                    </div>
                    <Link to={`/chat?connection_id=${conn.id}`}>
                      <Button size="sm" className="p-1.5 bg-brand-50 hover:bg-brand-100 text-brand-600 border-none shrink-0 rounded-lg h-7 w-7">
                        <MessageSquare size={13} />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
