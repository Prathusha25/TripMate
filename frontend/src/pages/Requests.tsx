import React, { useState, useEffect } from 'react';
import { requestService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { TravelRequest } from '../types';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Card, CardContent, CardFooter } from '../components/ui/Card';
import { Users, User, X, Check, Ban, Calendar, MapPin } from 'lucide-react';

export const Requests: React.FC = () => {
  const { toast } = useToast();
  const [incoming, setIncoming] = useState<TravelRequest[]>([]);
  const [sent, setSent] = useState<TravelRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const [incData, sentData] = await Promise.all([
        requestService.getIncomingRequests(),
        requestService.getSentRequests(),
      ]);
      setIncoming(incData);
      setSent(sentData);
    } catch (error) {
      console.error(error);
      setApiError('Failed to fetch travel requests. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAccept = async (requestId: string) => {
    setActioningId(requestId);
    try {
      await requestService.acceptRequest(requestId);
      toast('Buddy invitation accepted!', 'success');
      await fetchData(); // refresh list
    } catch (error: any) {
      console.error(error);
      toast('Failed to accept request.', 'error');
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setActioningId(requestId);
    try {
      await requestService.rejectRequest(requestId);
      toast('Invitation rejected.', 'info');
      await fetchData(); // refresh list
    } catch (error: any) {
      console.error(error);
      toast('Failed to reject request.', 'error');
    } finally {
      setActioningId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    setActioningId(requestId);
    try {
      await requestService.cancelRequest(requestId);
      toast('Invitation cancelled.', 'info');
      await fetchData(); // refresh list
    } catch (error: any) {
      console.error(error);
      toast('Failed to cancel request.', 'error');
    } finally {
      setActioningId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-amber-50 border-amber-250 text-amber-700',
      accepted: 'bg-teal-50 border-teal-250 text-teal-700',
      rejected: 'bg-red-50 border-red-250 text-red-700',
      cancelled: 'bg-slate-100 border-slate-200 text-slate-500',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${badges[status as keyof typeof badges] || ''}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto text-left py-4">
      <div>
        <h1 className="text-3xl font-extrabold text-brand-950">Travel Requests</h1>
        <p className="text-slate-500 font-medium">Manage incoming companion invites and track your sent buddy requests.</p>
      </div>

      {apiError && <Alert variant="error">{apiError}</Alert>}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-4">
              <div className="h-6 w-1/3 bg-slate-200 rounded" />
              <div className="bg-white border border-slate-200 rounded-3xl h-44 shadow-sm" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Incoming Requests Column */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-brand-950 flex items-center gap-2">
              <span>Incoming Invites</span>
              <span className="text-xs bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full text-brand-600 font-bold">
                {incoming.length}
              </span>
            </h2>

            {incoming.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center text-slate-500 text-xs shadow-sm py-16">
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <span className="font-semibold text-slate-400">No pending join requests received.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {incoming.map((req) => (
                  <Card key={req.id} className="border-slate-200 shadow-sm overflow-hidden hover:border-slate-300">
                    <CardContent className="p-5 space-y-4 text-xs text-left">
                      {/* User Info */}
                      <div className="flex items-center gap-3">
                        {req.sender?.profile_photo ? (
                          <img
                            src={req.sender.profile_photo}
                            alt={req.sender.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border shrink-0">
                            <User size={16} />
                          </div>
                        )}
                        <div className="text-left">
                          <h4 className="font-bold text-slate-800 text-sm">{req.sender?.name}</h4>
                          <p className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider line-clamp-1">
                            {req.sender?.bio || 'Travel Companion'}
                          </p>
                        </div>
                      </div>

                      {/* Request Message */}
                      <div className="text-sm font-semibold text-slate-700">
                        {req.request_type === 'buddy_request' ? (
                          <span>{req.sender?.name} wants to connect as a travel buddy.</span>
                        ) : (
                          <span>{req.sender?.name} wants to join your {req.trip?.destination} trip.</span>
                        )}
                      </div>

                      {/* Trip details */}
                      {req.trip ? (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs space-y-2">
                          <div className="flex items-center gap-1.5 font-bold text-slate-700">
                            <MapPin size={13} className="text-brand-500" />
                            <span>
                              {req.request_type === 'buddy_request' ? 'Matching trip:' : 'Destination:'} {req.trip.destination}
                            </span>
                          </div>
                          {req.trip?.start_date && (
                            <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                              <Calendar size={12} className="text-slate-400" />
                              <span>
                                Dates: {new Date(req.trip.start_date).toLocaleDateString()} — {new Date(req.trip.end_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {req.trip?.approximate_budget !== undefined && (
                            <div className="text-[11px] text-slate-600 font-semibold">
                              Budget: ₹{req.trip.approximate_budget.toLocaleString()}
                            </div>
                          )}
                          {req.sender?.interests && req.sender.interests.length > 0 && (
                            <div className="text-[11px] text-slate-650">
                              <span className="font-bold">Interests:</span> {req.sender.interests.join(', ')}
                            </div>
                          )}
                          {req.sender?.travel_style && req.sender.travel_style.length > 0 && (
                            <div className="text-[11px] text-slate-650">
                              <span className="font-bold">Travel Style:</span> {req.sender.travel_style.join(', ')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs space-y-2">
                          {req.sender?.interests && req.sender.interests.length > 0 && (
                            <div className="text-[11px] text-slate-650">
                              <span className="font-bold">Interests:</span> {req.sender.interests.join(', ')}
                            </div>
                          )}
                          {req.sender?.travel_style && req.sender.travel_style.length > 0 && (
                            <div className="text-[11px] text-slate-650">
                              <span className="font-bold">Travel Style:</span> {req.sender.travel_style.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                    
                    {/* Action buttons */}
                    <CardFooter className="py-3 px-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2 p-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs border-slate-300 bg-white text-slate-650 hover:bg-slate-50"
                        onClick={() => handleReject(req.id)}
                        disabled={actioningId === req.id}
                      >
                        <X size={12} />
                        <span>Reject</span>
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => handleAccept(req.id)}
                        isLoading={actioningId === req.id}
                      >
                        <Check size={12} />
                        <span>Accept</span>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
 
          {/* Sent Requests Column */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-brand-950 flex items-center gap-2">
              <span>Sent Requests</span>
              <span className="text-xs bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-slate-500 font-bold">
                {sent.length}
              </span>
            </h2>
 
            {sent.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center text-slate-500 text-xs shadow-sm py-16">
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <span className="font-semibold text-slate-400">No join requests sent yet. Go find trips to join!</span>
              </div>
            ) : (
              <div className="space-y-4">
                {sent.map((req) => (
                  <Card key={req.id} className="border-slate-200 shadow-sm overflow-hidden hover:border-slate-300">
                    <CardContent className="p-5 space-y-4 text-xs text-left">
                      {/* Recipient User Info */}
                      <div className="flex items-center gap-3">
                        {req.receiver?.profile_photo ? (
                          <img
                            src={req.receiver.profile_photo}
                            alt={req.receiver.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border shrink-0">
                            <User size={16} />
                          </div>
                        )}
                        <div className="text-left">
                          <h4 className="font-bold text-slate-800 text-sm">
                            {req.request_type === 'buddy_request' ? 'Traveler: ' : 'Trip Owner: '}{req.receiver?.name}
                          </h4>
                          <p className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider line-clamp-1">
                            {req.receiver?.bio || 'Travel Companion'}
                          </p>
                        </div>
                      </div>
 
                      {/* Request Wording */}
                      <div className="text-xs font-semibold text-slate-650">
                        {req.request_type === 'buddy_request' ? (
                          <span>You sent a travel buddy request to: <span className="font-bold text-slate-800">{req.receiver?.name}</span></span>
                        ) : (
                          <span>You requested to join: <span className="font-bold text-slate-800">{req.receiver?.name}'s {req.trip?.destination} trip</span></span>
                        )}
                      </div>

                      {/* Request Trip Details */}
                      {req.trip ? (
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-bold text-slate-700">
                              <MapPin size={13} className="text-brand-500" />
                              <span>
                                {req.request_type === 'buddy_request' ? 'Matching trip:' : 'Destination:'} {req.trip.destination}
                              </span>
                            </span>
                            {getStatusBadge(req.status)}
                          </div>
                          {req.trip?.start_date && (
                            <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                              <Calendar size={12} className="text-slate-400" />
                              <span>
                                Dates: {new Date(req.trip.start_date).toLocaleDateString()} — {new Date(req.trip.end_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 text-xs flex justify-between items-center">
                          <span className="text-slate-500 font-semibold">Direct Buddy Connection Invite</span>
                          {getStatusBadge(req.status)}
                        </div>
                      )}
                    </CardContent>
 
                    {/* Action buttons if Pending */}
                    {req.status === 'pending' && (
                      <CardFooter className="py-3 px-5 border-t border-slate-100 bg-slate-50/50 flex justify-end p-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs text-red-500 hover:text-red-650 hover:bg-red-50"
                          onClick={() => handleCancel(req.id)}
                          disabled={actioningId === req.id}
                        >
                          <Ban size={12} />
                          <span>Cancel Request</span>
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Requests;
