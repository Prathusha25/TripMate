import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { connectionService, messageService } from '../services/api';
import { Connection, Message } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { 
  Send, 
  User, 
  MessageSquare, 
  MapPin, 
  Globe, 
  ChevronLeft, 
  Smile, 
  Compass, 
  MoreVertical,
  CheckCheck
} from 'lucide-react';

export const Chat: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { connectionId } = useParams<{ connectionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<any>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Parse connection ID from URL query params or path params
  const getActiveConnectionId = () => {
    if (connectionId) return connectionId;
    const params = new URLSearchParams(location.search);
    return params.get('connection_id');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startPolling = () => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(() => {
      fetchMessages(true);
    }, 4000);
  };

  // 1. Fetch connections list
  const fetchConnections = async (selectId?: string | null) => {
    setConnectionsLoading(true);
    setApiError(null);
    try {
      const data = await connectionService.getConnections();
      setConnections(data || []);

      if (data && data.length > 0) {
        const idToSelect = selectId || getActiveConnectionId();
        const found = data.find((c: Connection) => c.id === idToSelect);
        if (found) {
          setSelectedConnection(found);
        } else if (!selectedConnection && window.innerWidth >= 768) {
          setSelectedConnection(data[0]);
          navigate(`/chat/${data[0].id}`, { replace: true });
        }
      }
    } catch (error) {
      console.error(error);
      setApiError('Failed to load connections.');
    } finally {
      setConnectionsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [connectionId, location.search]);

  // 2. Fetch messages for selected connection
  const fetchMessages = async (silent = false) => {
    if (!selectedConnection) return;
    if (!silent) setMessagesLoading(true);
    try {
      const data = await messageService.getMessages(selectedConnection.id);
      setMessages(data || []);
      if (!silent) {
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error("Failed to sync messages:", error);
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  };

  // Triggered when selected connection changes
  useEffect(() => {
    if (selectedConnection) {
      fetchMessages();

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      const token = localStorage.getItem('tripmate_token');
      const mockToken = token && token.startsWith('mock_token_');
      
      if (token && !mockToken) {
        try {
          const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
          const wsUrl = `${apiBaseUrl.replace(/^http/, wsProtocol)}/ws/chat/${selectedConnection.id}?token=${token}`;
          
          const socket = new WebSocket(wsUrl);
          socketRef.current = socket;

          socket.onmessage = (event) => {
            try {
              const newMsg = JSON.parse(event.data);
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              scrollToBottom();
            } catch (err) {
              console.error("Failed to parse websocket message:", err);
            }
          };

          socket.onerror = (err) => {
            console.error("WebSocket error, falling back to HTTP polling:", err);
            startPolling();
          };

          socket.onclose = () => {
            console.log("WebSocket connection closed");
          };
        } catch (err) {
          console.error("WebSocket initialization failed:", err);
          startPolling();
        }
      } else {
        startPolling();
      }
    }

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [selectedConnection?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConnection || !typedMessage.trim() || sending) return;

    const content = typedMessage.trim();
    setTypedMessage('');
    setSending(true);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({
          content,
          connection_id: selectedConnection.id,
          sender_id: user?.id || ''
        }));
        setSending(false);
        return;
      } catch (err) {
        console.error("Failed to send via WebSocket, falling back to REST:", err);
      }
    }

    try {
      const newMsg = await messageService.sendMessage(selectedConnection.id, content);
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      scrollToBottom();
      
      setTimeout(() => {
        fetchMessages(true);
      }, 1600);
    } catch (error: any) {
      console.error(error);
      toast('Failed to deliver message.', 'error');
      setTypedMessage(content);
    } finally {
      setSending(false);
    }
  };

  const handleSelectBuddy = (conn: Connection) => {
    setSelectedConnection(conn);
    navigate(`/chat/${conn.id}`);
  };

  if (!user) return null;

  return (
    <div className="h-[calc(100vh-140px)] min-h-[520px] max-h-[850px] flex rounded-3xl overflow-hidden bg-white border border-slate-200/90 shadow-md w-full min-w-0">
      
      {/* 1. Left Connections Master Pane */}
      <div className={`w-full md:w-80 lg:w-88 border-r border-slate-200 flex flex-col bg-slate-50/50 min-w-0 shrink-0 ${
        selectedConnection ? 'hidden md:flex' : 'flex'
      }`}>
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2 font-display">
              <MessageSquare size={18} className="text-brand-600" />
              <span>Messages</span>
            </h2>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {connections.length}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-w-0">
          {connectionsLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="p-4 flex gap-3 animate-pulse">
                <div className="w-11 h-11 rounded-full bg-slate-200 shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="h-3 w-1/3 bg-slate-200 rounded" />
                  <div className="h-3 w-2/3 bg-slate-200 rounded" />
                </div>
              </div>
            ))
          ) : connections.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center h-full space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <Globe size={22} />
              </div>
              <p className="font-bold text-slate-700">No active conversations</p>
              <p className="text-slate-400 text-xs max-w-[200px]">
                Match with a travel buddy from the discovery page to start chatting!
              </p>
              <Button size="sm" className="mt-2 text-xs font-bold" onClick={() => navigate('/travel-buddies')}>
                Find Buddies
              </Button>
            </div>
          ) : (
            connections.map((conn) => {
              const isSelected = selectedConnection?.id === conn.id;
              return (
                <button
                  key={conn.id}
                  onClick={() => handleSelectBuddy(conn)}
                  className={`w-full p-4 flex gap-3 items-center text-left hover:bg-slate-100/60 transition-all duration-150 min-w-0 ${
                    isSelected ? 'bg-brand-50/80 border-l-4 border-brand-600' : ''
                  }`}
                >
                  {conn.buddy?.profile_photo ? (
                    <img
                      src={conn.buddy.profile_photo}
                      alt={conn.buddy.name}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 border shrink-0">
                      <User size={18} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{conn.buddy?.name}</h4>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate font-medium">
                      <MapPin size={11} className="text-teal-600 shrink-0" />
                      <span className="truncate">{conn.shared_trip?.destination}</span>
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Right Conversation Detail Pane */}
      <div className={`flex-1 flex flex-col bg-slate-50/30 min-w-0 ${
        !selectedConnection ? 'hidden md:flex' : 'flex'
      }`}>
        {selectedConnection ? (
          <>
            {/* Conversation Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-200 bg-white flex items-center gap-3 justify-between shadow-2xs shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setSelectedConnection(null)}
                  className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl shrink-0 transition-colors"
                  aria-label="Back to chat list"
                >
                  <ChevronLeft size={20} />
                </button>
                {selectedConnection.buddy?.profile_photo ? (
                  <img
                    src={selectedConnection.buddy.profile_photo}
                    alt={selectedConnection.buddy.name}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 border shrink-0">
                    <User size={18} />
                  </div>
                )}
                <div className="text-left min-w-0">
                  <h3 className="font-extrabold text-slate-900 text-sm truncate font-display">{selectedConnection.buddy?.name}</h3>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium truncate">
                    <MapPin size={11} className="text-teal-600 shrink-0" />
                    <span className="truncate">Trip to {selectedConnection.shared_trip?.destination}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1 shrink-0">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate(`/travelers/${selectedConnection.buddy?.id}`)}
                  className="text-xs text-brand-600 font-bold hidden sm:inline-flex"
                >
                  View Profile
                </Button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-slate-50/40 min-w-0">
              {messagesLoading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="w-7 h-7 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs space-y-2.5">
                  <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                    <MessageSquare size={20} />
                  </div>
                  <span className="font-bold text-slate-700 text-sm">No Messages Yet</span>
                  <span className="text-slate-400 text-xs max-w-[240px] text-center font-medium">
                    Send a message to coordinate dates, travel preferences, and itinerary plans!
                  </span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender_id === user.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} min-w-0`}>
                      <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-xs text-left shadow-2xs ${
                        isMe 
                          ? 'bg-brand-600 text-white rounded-br-xs' 
                          : 'bg-white text-slate-800 rounded-bl-xs border border-slate-200/90'
                      }`}>
                        <p className="leading-relaxed break-words font-medium text-xs sm:text-sm">{msg.content}</p>
                        <span className={`block text-[10px] text-right mt-1 font-medium ${isMe ? 'text-brand-100' : 'text-slate-400'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Typing Input */}
            <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-slate-200 bg-white flex gap-2 items-center shrink-0">
              <button 
                type="button" 
                onClick={() => toast('Emoji support is active in input field!', 'info')}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition-colors shrink-0"
                title="Add emoji"
              >
                <Smile size={20} />
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-250 hover:border-slate-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-all min-w-0"
                disabled={sending}
              />
              <Button 
                type="submit" 
                size="sm" 
                className="h-10 w-10 p-0 shrink-0 rounded-xl bg-brand-600 hover:bg-brand-700 font-bold" 
                disabled={!typedMessage.trim() || sending}
              >
                <Send size={15} />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm space-y-3 p-8">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <MessageSquare size={26} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-slate-700 text-base font-display">Select a Conversation</h3>
              <p className="text-xs text-slate-400 max-w-xs font-medium">
                Choose a connected travel buddy from the left pane to begin chatting.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
