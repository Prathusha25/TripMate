import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { connectionService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Connection } from '../types';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Card, CardContent, CardFooter } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { User, MessageSquare, Trash2, Calendar, MapPin, Globe } from 'lucide-react';

export const Connections: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Remove Connection State
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removingConnId, setRemovingConnId] = useState<string | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = useState(false);

  const fetchConnections = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const data = await connectionService.getConnections();
      setConnections(data);
    } catch (error) {
      console.error(error);
      setApiError('Failed to fetch your connections. Please check your network.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleOpenRemove = (connId: string) => {
    setRemovingConnId(connId);
    setRemoveOpen(true);
  };

  const handleRemoveSubmit = async () => {
    if (!removingConnId) return;
    setRemoveSubmitting(true);
    try {
      await connectionService.removeConnection(removingConnId);
      toast('Connection removed.', 'info');
      setRemoveOpen(false);
      fetchConnections();
    } catch (error: any) {
      console.error(error);
      toast('Failed to remove connection.', 'error');
    } finally {
      setRemoveSubmitting(false);
    }
  };

  const handleOpenChat = (connId: string) => {
    navigate(`/chat/${connId}`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-left py-4">
      <div>
        <h1 className="text-3xl font-extrabold text-brand-950">Your Travel Connections</h1>
        <p className="text-slate-500 font-medium">View and chat with mutually connected solo travel partners.</p>
      </div>

      {apiError && <Alert variant="error">{apiError}</Alert>}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-3xl h-48 shadow-sm" />
          ))}
        </div>
      ) : connections.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="bg-slate-100 p-4 rounded-full text-slate-400">
            <Globe size={36} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-700">No active connections yet</h3>
            <p className="text-slate-500 text-sm max-w-sm">
              Connections are formed when you accept buddy requests or when travelers accept yours. Go find travelers heading your way!
            </p>
          </div>
          <Button onClick={() => navigate('/travel-buddies')} className="pt-2">
            Find Travel Buddies
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {connections.map((conn) => (
            <Card key={conn.id} className="flex flex-col h-full hover:shadow-md border-slate-200 overflow-hidden">
              <CardContent className="p-5 flex-1 space-y-4 text-xs">
                {/* Buddy Profile */}
                <div className="flex items-center gap-3">
                  {conn.buddy.profile_photo ? (
                    <img
                      src={conn.buddy.profile_photo}
                      alt={conn.buddy.name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border shrink-0">
                      <User size={20} />
                    </div>
                  )}
                  <div className="text-left">
                    <h3 className="font-extrabold text-brand-950 text-base">{conn.buddy.name}</h3>
                    <p className="text-slate-555 line-clamp-1 italic font-medium">"{conn.buddy.bio || 'Laid-back traveler'}"</p>
                  </div>
                </div>

                {/* Shared trip information */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2 text-xs text-slate-650">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Shared Trip Context</div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-805">
                    <MapPin size={13} className="text-brand-500" />
                    <span>{conn.shared_trip.destination}</span>
                  </div>
                  {conn.shared_trip.start_date && (
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
                      <Calendar size={12} className="text-slate-450" />
                      <span>
                        {new Date(conn.shared_trip.start_date).toLocaleDateString()} — {new Date(conn.shared_trip.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Tags snippet */}
                {conn.buddy.interests?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {conn.buddy.interests.slice(0, 3).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 text-[10px] font-semibold">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>

              {/* Footer Actions */}
              <CardFooter className="py-3 px-5 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs p-4">
                <span className="text-teal-650 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
                  <span>Connected</span>
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="p-2 border-slate-200 bg-white text-slate-400 hover:text-red-500 hover:border-red-100"
                    onClick={() => handleOpenRemove(conn.id)}
                    title="Remove Buddy"
                  >
                    <Trash2 size={14} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs px-3 border-slate-250 bg-white text-teal-650 hover:bg-teal-50"
                    onClick={() => navigate(`/trips/${conn.trip_id}/collaboration`)}
                  >
                    <Globe size={14} />
                    <span>Collab</span>
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs px-4 py-2"
                    onClick={() => handleOpenChat(conn.id)}
                  >
                    <MessageSquare size={14} />
                    <span>Open Chat</span>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Remove Confirmation Modal */}
      <Dialog
        isOpen={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title="Remove Connection"
        description="Are you sure you want to remove this connection? You will no longer be able to message this traveler."
      >
        <div className="flex justify-end gap-3 text-left">
          <Button variant="outline" onClick={() => setRemoveOpen(false)} disabled={removeSubmitting} className="bg-white border-slate-300">
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRemoveSubmit} isLoading={removeSubmitting}>
            Remove Connection
          </Button>
        </div>
      </Dialog>
    </div>
  );
};

export default Connections;
