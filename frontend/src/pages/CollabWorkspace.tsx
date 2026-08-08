import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collaborationService, tripService } from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../context/ToastContext';
import { 
  ArrowLeft, 
  MessageSquare, 
  MapPin, 
  CheckSquare, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  AlertTriangle, 
  Info 
} from 'lucide-react';

export const CollabWorkspace: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const { toast } = useToast();
  const [trip, setTrip] = useState<any>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'places' | 'checklist' | 'chat' | 'members'>('notes');
  
  // Form states
  const [newNote, setNewNote] = useState('');
  const [suggestName, setSuggestName] = useState('');
  const [suggestDesc, setSuggestDesc] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Group states
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [groupMessages, setGroupMessages] = useState<any[]>([]);
  const [newGroupMsg, setNewGroupMsg] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  const loadWorkspaceData = async () => {
    if (!tripId) return;
    try {
      const [tripData, wsData] = await Promise.all([
        tripService.getTrip(tripId),
        collaborationService.getWorkspace(tripId)
      ]);
      setTrip(tripData);
      setWorkspace(wsData);
      
      // Load checklist state from local storage to simulate real-time checking without database bloating
      const cachedChecked = localStorage.getItem(`collab_checklist_checked_${tripId}`);
      if (cachedChecked) {
        setCheckedItems(JSON.parse(cachedChecked));
      }
      
      const cachedChecklist = localStorage.getItem(`collab_checklist_items_${tripId}`);
      if (cachedChecklist) {
        setChecklist(JSON.parse(cachedChecklist));
      } else {
        // Fallback checklist items
        const defaultItems = ['Passport & Tickets', 'Chargers & Powerbank', 'First-Aid Kit', 'Comfortable Shoes', 'Sunscreen'];
        setChecklist(defaultItems);
        localStorage.setItem(`collab_checklist_items_${tripId}`, JSON.stringify(defaultItems));
      }
    } catch (err) {
      console.error(err);
      toast('Failed to load collaboration workspace.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, [tripId]);

  // Load group members
  useEffect(() => {
    if (!tripId || activeTab !== 'members') return;
    const fetchMembers = async () => {
      setMembersLoading(true);
      try {
        const data = await collaborationService.getGroupMembers(tripId);
        setGroupMembers(data);
      } catch (err) {
        toast('Failed to load group members.', 'error');
      } finally {
        setMembersLoading(false);
      }
    };
    fetchMembers();
  }, [tripId, activeTab]);

  // Load and poll group chat messages
  useEffect(() => {
    if (!tripId || activeTab !== 'chat') return;
    const fetchMessages = async (silent = false) => {
      if (!silent) setChatLoading(true);
      try {
        const data = await collaborationService.getGroupMessages(tripId);
        setGroupMessages(data);
      } catch (err) {
        console.error("Failed to load group messages:", err);
      } finally {
        if (!silent) setChatLoading(false);
      }
    };
    fetchMessages();
    const interval = setInterval(() => fetchMessages(true), 3000); // sync every 3s
    return () => clearInterval(interval);
  }, [tripId, activeTab]);

  const handleSendGroupMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId || !newGroupMsg.trim()) return;

    try {
      const added = await collaborationService.postGroupMessage(tripId, newGroupMsg);
      setGroupMessages(prev => [...prev, added]);
      setNewGroupMsg('');
    } catch (err) {
      toast('Failed to send group message.', 'error');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId || !newNote.trim()) return;

    try {
      const added = await collaborationService.addNote(tripId, newNote);
      setWorkspace((prev: any) => ({
        ...prev,
        notes: [...(prev.notes || []), added]
      }));
      setNewNote('');
      toast('Note posted to board.', 'success');
    } catch (err) {
      toast('Failed to post note.', 'error');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!tripId) return;
    try {
      await collaborationService.deleteNote(tripId, noteId);
      setWorkspace((prev: any) => ({
        ...prev,
        notes: (prev.notes || []).filter((n: any) => n.id !== noteId)
      }));
      toast('Note removed.', 'success');
    } catch (err) {
      toast('Failed to remove note.', 'error');
    }
  };

  const handleSuggestPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId || !suggestName.trim()) return;

    try {
      const added = await collaborationService.suggestPlace(tripId, suggestName, suggestDesc);
      setWorkspace((prev: any) => ({
        ...prev,
        suggested_places: [...(prev.suggested_places || []), added]
      }));
      setSuggestName('');
      setSuggestDesc('');
      toast('Place suggestion shared.', 'success');
    } catch (err) {
      toast('Failed to share suggestion.', 'error');
    }
  };

  const handleResolveSuggestion = async (placeId: string, action: 'approved' | 'rejected') => {
    if (!tripId) return;
    try {
      await collaborationService.updateSuggestionStatus(tripId, placeId, action);
      toast(`Place suggestion ${action}.`, 'success');
      
      // Reload workspace to refresh lists
      const updated = await collaborationService.getWorkspace(tripId);
      setWorkspace(updated);
    } catch (err) {
      toast('Failed to update suggestion.', 'error');
    }
  };

  const handleToggleChecklist = (item: string) => {
    const nextChecked = { ...checkedItems, [item]: !checkedItems[item] };
    setCheckedItems(nextChecked);
    localStorage.setItem(`collab_checklist_checked_${tripId}`, JSON.stringify(nextChecked));
  };

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;
    const nextList = [...checklist, newChecklistItem.trim()];
    setChecklist(nextList);
    localStorage.setItem(`collab_checklist_items_${tripId}`, JSON.stringify(nextList));
    setNewChecklistItem('');
    toast('Item added to checklist.', 'success');
  };

  const handleDeleteChecklistItem = (item: string) => {
    const nextList = checklist.filter(i => i !== item);
    setChecklist(nextList);
    localStorage.setItem(`collab_checklist_items_${tripId}`, JSON.stringify(nextList));
    
    const nextChecked = { ...checkedItems };
    delete nextChecked[item];
    setCheckedItems(nextChecked);
    localStorage.setItem(`collab_checklist_checked_${tripId}`, JSON.stringify(nextChecked));
  };

  const isTripCreator = trip && workspace && trip.user_id === workspace.creator_id; // wait, or just check user roles if backend returns it

  if (isLoading || !trip) {
    return (
      <div className="max-w-4xl mx-auto py-12 space-y-6 text-left animate-pulse">
        <div className="h-10 w-48 bg-slate-200 rounded-xl" />
        <div className="h-96 bg-slate-100 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto text-left py-4 space-y-6">
      {/* Back button header */}
      <div className="flex justify-between items-center">
        <Link to="/connections" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft size={14} />
          <span>Back to Connections</span>
        </Link>
        <span className="text-[10px] uppercase bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded">
          Active Collaboration Space
        </span>
      </div>

      {/* Trip Brief Banner */}
      <div className="bg-gradient-to-r from-brand-900 to-brand-950 p-6 md:p-8 rounded-3xl text-white shadow-xl space-y-2 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl transform translate-x-10 -translate-y-10" />
        <h1 className="text-2xl md:text-3xl font-black font-display leading-tight">Shared Trip to {trip.destination}</h1>
        <p className="text-xs text-brand-200 font-bold">
          {new Date(trip.start_date).toLocaleDateString()} – {new Date(trip.end_date).toLocaleDateString()}
        </p>
        {trip.description && (
          <p className="text-xs text-slate-200 italic font-semibold pt-1 max-w-xl">
            "{trip.description}"
          </p>
        )}
      </div>

      {/* Mandatory Safety Notice Footer Banner */}
      <div className="bg-amber-50/50 border border-amber-250 p-4 rounded-2xl flex gap-3 text-xs font-semibold text-amber-900">
        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-amber-950 uppercase tracking-wide block text-[10px]">Travel Safety Advisory</span>
          <p className="leading-relaxed">
            TripMate AI coordinates travel buddies for social matching and recommendation exploration. This platform does NOT guarantee traveler credentials, travel conditions, or local host validation. Solo travelers are strongly encouraged to meet in public settings, carry personal verification, and check safety bulletins independently.
          </p>
        </div>
      </div>

      {/* Tabs Control */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-3 text-xs font-bold transition-all duration-200 border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === 'notes'
              ? 'border-brand-500 text-brand-700'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <MessageSquare size={14} />
          <span>Shared Notes</span>
        </button>
        
        <button
          onClick={() => setActiveTab('places')}
          className={`flex-1 py-3 text-xs font-bold transition-all duration-200 border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === 'places'
              ? 'border-brand-500 text-brand-700'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <MapPin size={14} />
          <span>Suggested Places</span>
        </button>

        <button
          onClick={() => setActiveTab('checklist')}
          className={`flex-1 py-3 text-xs font-bold transition-all duration-200 border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === 'checklist'
              ? 'border-brand-500 text-brand-700'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <CheckSquare size={14} />
          <span>Joint Checklist</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-xs font-bold transition-all duration-200 border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === 'chat'
              ? 'border-brand-500 text-brand-700'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <MessageSquare size={14} />
          <span>Group Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex-1 py-3 text-xs font-bold transition-all duration-200 border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === 'members'
              ? 'border-brand-500 text-brand-700'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>Members</span>
        </button>
      </div>

      {/* Active Tab View Panels */}
      <div className="space-y-6">
        {activeTab === 'notes' && (
          <div className="space-y-6">
            {/* Add Note Form */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <Input
                    placeholder="Type a group update, flight detail, or travel reminder..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    required
                    className="flex-1 bg-white border-slate-200 text-xs font-semibold py-2.5"
                  />
                  <Button type="submit" size="sm" className="gap-1 font-bold">
                    <Plus size={14} />
                    <span>Post</span>
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Notes List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(!workspace?.notes || workspace.notes.length === 0) ? (
                <div className="col-span-full bg-slate-50 border border-dashed border-slate-200 p-8 rounded-2xl text-center text-xs font-semibold text-slate-400">
                  No notes posted yet. Share flights, meeting times, or hotel details above!
                </div>
              ) : (
                workspace.notes.map((note: any) => (
                  <Card key={note.id} className="border-slate-200 shadow-sm bg-yellow-50/10 hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex flex-col justify-between min-h-[120px] text-xs font-semibold text-left">
                      <p className="text-slate-800 leading-relaxed font-bold">"{note.content}"</p>
                      
                      <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-4 text-[10px] text-slate-400">
                        <div>
                          <span className="font-bold text-slate-700 block">{note.author_name}</span>
                          <span>{new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'places' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left side Suggest Place Input */}
            <div className="md:col-span-1">
              <Card className="border-slate-200 shadow-sm text-left">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Suggest Destination</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <form onSubmit={handleSuggestPlace} className="space-y-3.5">
                    <Input
                      label="Place Name"
                      placeholder="e.g. Baga Beach, Museum"
                      value={suggestName}
                      onChange={(e) => setSuggestName(e.target.value)}
                      required
                      className="bg-white border-slate-200 text-xs font-semibold"
                    />
                    <Input
                      label="Description"
                      placeholder="e.g. Great sunset views"
                      value={suggestDesc}
                      onChange={(e) => setSuggestDesc(e.target.value)}
                      className="bg-white border-slate-200 text-xs font-semibold"
                    />
                    <Button type="submit" className="w-full font-bold gap-1">
                      <Plus size={14} />
                      <span>Suggest Place</span>
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Right side Lists of Places */}
            <div className="md:col-span-2 space-y-6">
              {/* Approved Places / Bookmarks */}
              <Card className="border-slate-200 shadow-sm text-left">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-teal-700 flex items-center gap-1">
                    <Check size={14} />
                    <span>Saved Places bucket</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-slate-100 p-0 text-xs font-semibold">
                  {(!workspace?.saved_places || workspace.saved_places.length === 0) ? (
                    <div className="p-6 text-center text-slate-400">
                      No places approved or bookmarked yet.
                    </div>
                  ) : (
                    workspace.saved_places.map((place: any) => (
                      <div key={place.id} className="p-4 flex justify-between items-start gap-4">
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1">
                            <MapPin size={12} className="text-teal-600" />
                            <span>{place.name}</span>
                          </h4>
                          {place.description && (
                            <p className="text-slate-500 font-medium text-[11px] mt-0.5">{place.description}</p>
                          )}
                        </div>
                        <button 
                          onClick={() => collaborationService.deleteBookmarkedPlace(tripId!, place.id).then(() => loadWorkspaceData())}
                          className="text-red-500 hover:bg-red-55 p-1 rounded"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Suggestions Queue */}
              <Card className="border-slate-200 shadow-sm text-left">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    Suggestions Queue
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-slate-100 p-0 text-xs font-semibold">
                  {(!workspace?.suggested_places || workspace.suggested_places.length === 0) ? (
                    <div className="p-6 text-center text-slate-400">
                      No suggested places currently pending.
                    </div>
                  ) : (
                    workspace.suggested_places.map((place: any) => (
                      <div key={place.id} className="p-4 flex justify-between items-center gap-4">
                        <div>
                          <h4 className="font-bold text-slate-800">{place.name}</h4>
                          {place.description && (
                            <p className="text-slate-500 font-medium text-[11px] mt-0.5">{place.description}</p>
                          )}
                          <span className="text-[10px] text-slate-450 block mt-1">
                            Suggested by {place.suggested_by_name}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          {place.status === 'pending' ? (
                            <>
                              <button 
                                onClick={() => handleResolveSuggestion(place.id, 'approved')}
                                className="bg-teal-50 hover:bg-teal-100 text-teal-700 p-1.5 rounded-lg border border-teal-200 transition-colors"
                                title="Approve & add to bucket"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={() => handleResolveSuggestion(place.id, 'rejected')}
                                className="bg-red-50 hover:bg-red-100 text-red-700 p-1.5 rounded-lg border border-red-200 transition-colors"
                                title="Reject"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              place.status === 'approved' 
                                ? 'bg-teal-50 text-teal-700' 
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {place.status.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* Add Checklist Item Box */}
            <div className="md:col-span-1">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Add checklist item</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <form onSubmit={handleAddChecklistItem} className="space-y-3.5">
                    <Input
                      placeholder="e.g. Swimwear, Camera lens"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      required
                      className="bg-white border-slate-200 text-xs font-semibold py-2"
                    />
                    <Button type="submit" className="w-full font-bold gap-1">
                      <Plus size={14} />
                      <span>Add Item</span>
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Checklist items list */}
            <div className="md:col-span-2">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Cooperative Packing List</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2 text-xs font-bold">
                  {checklist.length === 0 ? (
                    <div className="text-center text-slate-400 py-8 font-semibold">
                      Checklist is empty. Add items on the left!
                    </div>
                  ) : (
                    checklist.map((item) => (
                      <div 
                        key={item} 
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                          checkedItems[item] 
                            ? 'bg-slate-50 border-slate-150 opacity-60 line-through text-slate-400' 
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <label className="flex items-center gap-3 cursor-pointer flex-1 select-none">
                          <input
                            type="checkbox"
                            checked={!!checkedItems[item]}
                            onChange={() => handleToggleChecklist(item)}
                            className="rounded text-brand-600 focus:ring-brand-500 cursor-pointer h-4 w-4"
                          />
                          <span>{item}</span>
                        </label>
                        <button
                          onClick={() => handleDeleteChecklistItem(item)}
                          className="text-red-400 hover:text-red-650 transition-colors p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <Card className="border-slate-200 shadow-sm text-left">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Group Trip Chat</CardTitle>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Discuss details dynamically with connected travelers</p>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="h-96 overflow-y-auto border border-slate-100 rounded-2xl p-4 bg-slate-50/30 space-y-3 flex flex-col">
                {chatLoading ? (
                  <div className="text-center text-slate-400 py-12 font-semibold">Loading messages...</div>
                ) : groupMessages.length === 0 ? (
                  <div className="text-center text-slate-400 py-12 font-semibold my-auto">
                    No messages yet. Send a hello to get started!
                  </div>
                ) : (
                  groupMessages.map((msg) => {
                    const isMe = msg.sender_id === 'u_1' || msg.sender_id === trip?.user_id; // Check if current user
                    return (
                      <div key={msg.id} className={`flex items-start gap-2 max-w-lg ${isMe ? 'ml-auto flex-row-reverse' : ''}`}>
                        {msg.sender_photo ? (
                          <img src={msg.sender_photo} alt={msg.sender_name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs uppercase border border-slate-350 shrink-0">
                            {msg.sender_name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className={`text-[10px] text-slate-400 font-bold mb-0.5 ${isMe ? 'text-right' : ''}`}>
                            {msg.sender_name}
                          </div>
                          <div className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed ${
                            isMe ? 'bg-brand-500 text-white rounded-tr-none' : 'bg-white border border-slate-150 text-slate-800 rounded-tl-none shadow-sm'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSendGroupMessage} className="flex gap-2">
                <Input
                  placeholder="Type your message to the group..."
                  value={newGroupMsg}
                  onChange={(e) => setNewGroupMsg(e.target.value)}
                  required
                  className="flex-1 bg-white border-slate-200 text-xs font-semibold py-2.5"
                />
                <Button type="submit" size="sm" className="gap-1 font-bold">
                  <span>Send</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeTab === 'members' && (
          <Card className="border-slate-200 shadow-sm text-left">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Trip Members ({groupMembers.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {membersLoading ? (
                <div className="text-center text-slate-400 py-12 font-semibold">Loading members...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupMembers.map((member) => (
                    <Card key={member.id} className="border-slate-150 hover:border-slate-200 transition-all duration-200 shadow-sm">
                      <CardContent className="p-4 flex gap-3">
                        {member.profile_photo ? (
                          <img src={member.profile_photo} alt={member.name} className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-250 flex items-center justify-center text-slate-500 font-bold text-sm uppercase shrink-0">
                            {member.name.charAt(0)}
                          </div>
                        )}
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-extrabold text-slate-800 text-sm truncate">{member.name}</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                              member.role === 'Organizer' 
                                ? 'bg-brand-50 text-brand-700 border border-brand-200' 
                                : 'bg-teal-50 text-teal-700 border border-teal-200'
                            }`}>
                              {member.role}
                            </span>
                          </div>

                          {member.interests && member.interests.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {member.interests.slice(0, 3).map((interest: string) => (
                                <span key={interest} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 font-bold text-[9px] rounded">
                                  {interest}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          {member.travel_style && member.travel_style.length > 0 && (
                            <div className="text-[10px] text-slate-450 font-bold truncate pt-0.5">
                              Style: {member.travel_style.join(', ')}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CollabWorkspace;
