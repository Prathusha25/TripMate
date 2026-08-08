import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { userService, tripService, requestService } from '../services/api';
import { User, Trip } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Dialog } from '../components/ui/Dialog';
import { MapPin, DollarSign, Calendar, Compass, ArrowLeft, Send, Check } from 'lucide-react';

export const TravelerProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [traveler, setTraveler] = useState<User | null>(null);
  const [travelerTrips, setTravelerTrips] = useState<Trip[]>([]);
  const [myTrips, setMyTrips] = useState<Trip[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSentTrips, setRequestSentTrips] = useState<Record<string, boolean>>({}); // key: tripId, value: sent

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!userId) return;
      setIsLoading(true);
      try {
        const profileData = await userService.getUserProfile(userId);
        setTraveler(profileData);

        // Fetch this traveler's public trips
        const allTripsResponse = await tripService.getTrips(); // In mock mode we can get all or filter in discovery
        // In real backend, we'd query /users/{userId}/trips. For mock, let's load all trips from DB and filter by this userId
        const rawTrips = localStorage.getItem('tripmate_trips');
        const tripsList: Trip[] = rawTrips ? JSON.parse(rawTrips) : [];
        const publicTrips = tripsList.filter((t) => t.user_id === userId);
        setTravelerTrips(publicTrips);

        // Fetch my trips so I can select one to send an invite
        const myTripsData = await tripService.getTrips();
        setMyTrips(myTripsData);
        if (myTripsData.length > 0) {
          setSelectedTripId(myTripsData[0].id);
        }

        // Fetch already sent requests to check status
        const sentRequests = await requestService.getSentRequests();
        const sentMap: Record<string, boolean> = {};
        sentRequests.forEach((req: any) => {
          if (req.receiver_id === userId) {
            sentMap[req.trip_id] = true;
          }
        });
        setRequestSentTrips(sentMap);
      } catch (error) {
        console.error(error);
        toast('Failed to load traveler profile.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [userId]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId || !userId) return;

    setSendingRequest(true);
    try {
      await requestService.sendRequest(selectedTripId, userId);
      toast('Travel buddy request sent successfully!', 'success');
      setRequestSentTrips((prev) => ({ ...prev, [selectedTripId]: true }));
      setRequestDialogOpen(false);
    } catch (error: any) {
      console.error(error);
      toast(error.response?.data?.detail || 'Failed to send travel request.', 'error');
    } finally {
      setSendingRequest(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-brand-500 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm font-semibold animate-pulse-subtle">Loading traveler details...</p>
      </div>
    );
  }

  if (!traveler) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <Alert variant="error">Traveler profile not found.</Alert>
        <Button variant="outline" onClick={() => navigate('/travel-buddies')}>Back to Discovery</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-left py-4">
      {/* Back button */}
      <button 
        onClick={() => navigate('/travel-buddies')} 
        className="flex items-center gap-1 text-slate-500 hover:text-slate-700 transition-colors text-sm font-semibold animate-fade-in"
      >
        <ArrowLeft size={16} />
        <span>Back to Find Travelers</span>
      </button>

      {/* Profile Header Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Basic Specs */}
        <div className="md:col-span-1 space-y-6">
          <Card className="text-center shadow-md border-slate-200">
            <CardContent className="pt-8 pb-6 flex flex-col items-center space-y-4">
              {traveler.profile_photo ? (
                <img
                  src={traveler.profile_photo}
                  alt={traveler.name}
                  className="w-28 h-28 rounded-full object-cover border-4 border-slate-100 shadow-lg"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shadow-lg">
                  <span className="text-3xl font-extrabold">{traveler.name[0]}</span>
                </div>
              )}
              
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-brand-950">{traveler.name}</h2>
                {traveler.home_city && (
                  <p className="text-xs text-slate-500 font-semibold flex items-center justify-center gap-1">
                    <MapPin size={12} className="text-brand-500" />
                    <span>Home City: {traveler.home_city}</span>
                  </p>
                )}
              </div>

              {/* Budget preference tag */}
              {traveler.budget_preference && (
                <div className="flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                  <DollarSign size={12} />
                  <span>{traveler.budget_preference} Budget Preference</span>
                </div>
              )}

              {myTrips.length > 0 ? (
                <Button 
                  onClick={() => setRequestDialogOpen(true)}
                  className="w-full gap-1.5 text-xs py-2 shadow-md shadow-brand-500/10"
                >
                  <Send size={12} />
                  <span>Send Travel Request</span>
                </Button>
              ) : (
                <Button 
                  disabled 
                  variant="outline" 
                  className="w-full text-xs py-2"
                >
                  Create a Trip to Connect
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Bio & Travel Interests */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-6 md:p-8 space-y-6">
              <div>
                <h3 className="text-base font-bold text-brand-950 mb-2 border-b border-slate-100 pb-2">About Me</h3>
                <p className="text-sm text-slate-650 leading-relaxed italic bg-slate-50 p-4 rounded-xl border border-slate-100">
                  "{traveler.bio || 'No bio written yet.'}"
                </p>
              </div>

              {/* Interests tag list */}
              {traveler.interests?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Travel Interests</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {traveler.interests.map((tag) => (
                      <span key={tag} className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold border border-brand-100">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Styles tag list */}
              {traveler.travel_style?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Travel Style</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {traveler.travel_style.map((tag) => (
                      <span key={tag} className="px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold border border-teal-100">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Traveler Public Itinerary Trips */}
          <section className="space-y-4 text-left">
            <h3 className="text-lg font-bold text-brand-950">Active Public Trips</h3>
            {travelerTrips.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-xs">
                This traveler does not have any active trip itineraries published.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {travelerTrips.map((trip) => {
                  const isSent = requestSentTrips[trip.id];
                  return (
                    <Card key={trip.id} className="glass-card shadow-sm flex flex-col justify-between h-full">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-brand-950">{trip.destination}</CardTitle>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                          <Calendar size={12} className="text-brand-500" />
                          <span>
                            {new Date(trip.start_date).toLocaleDateString()} – {new Date(trip.end_date).toLocaleDateString()}
                          </span>
                        </p>
                      </CardHeader>
                      <CardContent className="pb-4 text-xs flex-grow space-y-3">
                        <p className="text-slate-600 line-clamp-2 italic">
                          "{trip.description || 'Heading here soon!'}"
                        </p>
                        <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <span className="text-slate-500 font-medium">Approx. Budget:</span>
                          <span className="text-brand-950 font-bold">${trip.approximate_budget.toLocaleString()}</span>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-3 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2 p-4">
                        {isSent ? (
                          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs py-1.5 bg-white" disabled>
                            <Check size={12} className="text-teal-600" />
                            <span>Request Sent</span>
                          </Button>
                        ) : myTrips.length > 0 ? (
                          <Button 
                            onClick={() => {
                              setSelectedTripId(myTrips[0]?.id || '');
                              setRequestDialogOpen(true);
                            }}
                            size="sm" 
                            className="w-full gap-1 text-xs py-1.5"
                          >
                            <Send size={12} />
                            <span>Invite Buddy</span>
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Create a trip to invite</span>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Select Trip Dialog */}
      <Dialog
        isOpen={requestDialogOpen}
        onClose={() => setRequestDialogOpen(false)}
        title="Send Travel Buddy Request"
        description={`Select which of your upcoming trips you would like to invite ${traveler.name} to join.`}
      >
        <form onSubmit={handleSendRequest} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Choose Your Active Trip
            </label>
            <select
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 transition-all duration-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              required
            >
              {myTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.destination} ({new Date(t.start_date).toLocaleDateString()} - {new Date(t.end_date).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setRequestDialogOpen(false)} disabled={sendingRequest}>
              Cancel
            </Button>
            <Button type="submit" isLoading={sendingRequest} className="gap-1.5">
              <Send size={14} />
              <span>Send Request</span>
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};

export default TravelerProfile;
