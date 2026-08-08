import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tripService } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Trip } from '../types';
import { Input, Textarea } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { Plus, Edit, Trash2, Calendar, DollarSign, Users, Compass, Eye } from 'lucide-react';

const INTERESTS_OPTIONS = ['Nature', 'Photography', 'Food', 'Adventure', 'Shopping', 'History', 'Culture', 'Nightlife', 'Relaxation'];
const STYLES_OPTIONS = ['Budget', 'Backpacker', 'Luxury', 'Relaxed', 'Adventure', 'Cultural', 'Fast-paced'];

const DESTINATION_IMAGES: Record<string, string> = {
  'goa': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=600',
  'manali': 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&q=80&w=600',
  'jaipur': 'https://images.unsplash.com/photo-1477584322904-48618db51a73?auto=format&fit=crop&q=80&w=600',
  'kerala': 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&q=80&w=600',
  'bali': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&q=80&w=600',
  'paris': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=600',
  'tokyo': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=600',
};

export const Trips: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Form State (Modal edit only, create routes to /trips/create)
  const [formOpen, setFormOpen] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    destination: '',
    start_date: '',
    end_date: '',
    approximate_budget: '',
    number_of_travelers: '1',
    description: '',
    travel_interests: [] as string[],
    preferred_travel_style: [] as string[],
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete State
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchTrips = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const data = await tripService.getTrips();
      setTrips(data);
    } catch (error: any) {
      console.error(error);
      setApiError('Failed to fetch your trips. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleOpenEdit = (trip: Trip) => {
    setEditingTripId(trip.id);
    setFormData({
      destination: trip.destination,
      start_date: trip.start_date,
      end_date: trip.end_date,
      approximate_budget: String(trip.approximate_budget),
      number_of_travelers: String(trip.number_of_travelers),
      description: trip.description || '',
      travel_interests: trip.travel_interests || [],
      preferred_travel_style: trip.preferred_travel_style || [],
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const handleOpenDelete = (tripId: string) => {
    setDeletingTripId(tripId);
    setDeleteOpen(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const toggleInterest = (interest: string) => {
    setFormData((prev) => {
      const travel_interests = prev.travel_interests.includes(interest)
        ? prev.travel_interests.filter((i) => i !== interest)
        : [...prev.travel_interests, interest];
      return { ...prev, travel_interests };
    });
  };

  const toggleStyle = (style: string) => {
    setFormData((prev) => {
      const preferred_travel_style = prev.preferred_travel_style.includes(style)
        ? prev.preferred_travel_style.filter((s) => s !== style)
        : [...prev.preferred_travel_style, style];
      return { ...prev, preferred_travel_style };
    });
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.destination.trim()) errors.destination = 'Destination is required';
    if (!formData.start_date) errors.start_date = 'Start date is required';
    if (!formData.end_date) errors.end_date = 'End date is required';
    
    if (formData.start_date && formData.end_date) {
      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        errors.end_date = 'End date cannot be before start date';
      }
    }

    const budget = Number(formData.approximate_budget);
    if (!formData.approximate_budget) {
      errors.approximate_budget = 'Budget is required';
    } else if (isNaN(budget) || budget <= 0) {
      errors.approximate_budget = 'Budget must be a valid number greater than 0';
    }

    const travelers = Number(formData.number_of_travelers);
    if (!formData.number_of_travelers) {
      errors.number_of_travelers = 'Number of travelers is required';
    } else if (isNaN(travelers) || travelers < 1) {
      errors.number_of_travelers = 'Number of travelers must be at least 1';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setFormSubmitting(true);
    const payload = {
      destination: formData.destination,
      start_date: formData.start_date,
      end_date: formData.end_date,
      approximate_budget: Number(formData.approximate_budget),
      number_of_travelers: Number(formData.number_of_travelers),
      description: formData.description || null,
      travel_interests: formData.travel_interests,
      preferred_travel_style: formData.preferred_travel_style,
    };

    try {
      if (editingTripId) {
        await tripService.updateTrip(editingTripId, payload);
        toast('Trip settings updated successfully!', 'success');
      }
      setFormOpen(false);
      fetchTrips();
    } catch (error: any) {
      console.error(error);
      setFormErrors({ api: error.response?.data?.detail || 'Failed to save trip parameters.' });
      toast('Failed to update trip.', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deletingTripId) return;
    setDeleteSubmitting(true);
    try {
      await tripService.deleteTrip(deletingTripId);
      toast('Trip deleted successfully.', 'info');
      setDeleteOpen(false);
      fetchTrips();
    } catch (error) {
      console.error(error);
      toast('Failed to delete trip.', 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-left py-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-950">My Trips</h1>
          <p className="text-slate-500 font-medium font-display">Manage your upcoming travel itineraries and schedules</p>
        </div>
        <Link to="/trips/create">
          <Button className="gap-1.5 shrink-0 py-2.5">
            <Plus size={16} />
            <span>Create Trip</span>
          </Button>
        </Link>
      </div>

      {apiError && <Alert variant="error">{apiError}</Alert>}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-3xl h-60 shadow-sm" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
          <div className="bg-slate-100 p-4 rounded-full text-slate-400">
            <Compass size={36} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-700">No trips yet</h3>
            <p className="text-slate-500 text-sm max-w-sm">
              Your next adventure starts here. Create a trip schedule with dates and budgets to connect with travel buddies.
            </p>
          </div>
          <Link to="/trips/create" className="pt-2">
            <Button size="sm">Create Your First Trip</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {trips.map((trip) => {
            const destKey = Object.keys(DESTINATION_IMAGES).find(k => trip.destination.toLowerCase().includes(k)) || '';
            const bannerUrl = DESTINATION_IMAGES[destKey] || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=600';

            return (
              <Card key={trip.id} className="flex flex-col h-full hover:shadow-md border-slate-200 overflow-hidden">
                {/* Trip Card Banner Image */}
                <div className="h-40 bg-slate-100 relative">
                  <img 
                    src={bannerUrl} 
                    alt={trip.destination} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 text-white">
                    <h3 className="font-extrabold text-lg text-white font-display tracking-tight">{trip.destination}</h3>
                  </div>
                </div>

                <CardContent className="flex-1 space-y-4 pt-4 text-xs">
                  <div className="flex items-center gap-1 text-slate-500 font-semibold">
                    <Calendar size={13} className="text-brand-500" />
                    <span>
                      {new Date(trip.start_date).toLocaleDateString()} — {new Date(trip.end_date).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-5 text-slate-650 font-semibold">
                    <div className="flex items-center gap-1">
                      <DollarSign size={13} className="text-emerald-600" />
                      <span>${trip.approximate_budget.toLocaleString()} Budget</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users size={13} className="text-brand-500" />
                      <span>{trip.number_of_travelers} {trip.number_of_travelers === 1 ? 'Traveler' : 'Travelers'}</span>
                    </div>
                  </div>

                  {trip.description && (
                    <p className="text-slate-500 leading-relaxed line-clamp-3 italic">
                      "{trip.description}"
                    </p>
                  )}

                  {/* Tags */}
                  <div className="space-y-1.5 pt-1">
                    {trip.travel_interests?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {trip.travel_interests.map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 text-[10px] font-semibold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {trip.preferred_travel_style?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {trip.preferred_travel_style.map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-semibold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* Actions Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center gap-2">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(trip)}
                      className="p-2 border border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-350 rounded-xl transition-all"
                      title="Edit Trip Settings"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleOpenDelete(trip.id)}
                      className="p-2 border border-slate-200 bg-white text-slate-400 hover:text-red-500 hover:border-red-100 rounded-xl transition-all"
                      title="Delete Trip"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <Link to={`/trips/${trip.id}`} className="shrink-0">
                    <Button variant="outline" size="sm" className="gap-1 bg-white border-slate-300 text-xs font-semibold py-1.5">
                      <Eye size={12} />
                      <span>View details</span>
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Form Modal */}
      <Dialog
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title="Edit Trip Settings"
        description="Modify details of your scheduled trip itinerary."
      >
        <form onSubmit={handleFormSubmit} className="space-y-4 text-left">
          {formErrors.api && <Alert variant="error">{formErrors.api}</Alert>}

          <Input
            label="Destination"
            name="destination"
            placeholder="e.g. Goa, India"
            value={formData.destination}
            onChange={handleInputChange}
            error={formErrors.destination}
            required
            className="bg-white border-slate-200"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              name="start_date"
              type="date"
              value={formData.start_date}
              onChange={handleInputChange}
              error={formErrors.start_date}
              required
              className="bg-white border-slate-200"
            />
            <Input
              label="End Date"
              name="end_date"
              type="date"
              value={formData.end_date}
              onChange={handleInputChange}
              error={formErrors.end_date}
              required
              className="bg-white border-slate-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Approximate Budget (USD)"
              name="approximate_budget"
              type="number"
              placeholder="e.g. 500"
              value={formData.approximate_budget}
              onChange={handleInputChange}
              error={formErrors.approximate_budget}
              required
              className="bg-white border-slate-200"
            />
            <Input
              label="Number of Travelers"
              name="number_of_travelers"
              type="number"
              placeholder="e.g. 1"
              value={formData.number_of_travelers}
              onChange={handleInputChange}
              error={formErrors.number_of_travelers}
              required
              className="bg-white border-slate-200"
            />
          </div>

          <Textarea
            label="Trip Description"
            name="description"
            placeholder="Outline planned activities and buddy preferences..."
            value={formData.description}
            onChange={handleInputChange}
            error={formErrors.description}
            rows={3}
            className="bg-white border-slate-200"
          />

          {/* Interests Select */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Travel Interests
            </label>
            <div className="flex flex-wrap gap-1.5">
              {INTERESTS_OPTIONS.map((interest) => {
                const isSelected = formData.travel_interests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      isSelected
                        ? 'bg-brand-500/10 border-brand-500 text-brand-700'
                        : 'bg-transparent border-slate-200 text-slate-500 hover:border-slate-400'
                    }`}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Styles Select */}
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Preferred Travel Styles
            </label>
            <div className="flex flex-wrap gap-1.5">
              {STYLES_OPTIONS.map((style) => {
                const isSelected = formData.preferred_travel_style.includes(style);
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleStyle(style)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      isSelected
                        ? 'bg-teal-500/10 border-teal-500 text-teal-700'
                        : 'bg-transparent border-slate-200 text-slate-500 hover:border-slate-400'
                    }`}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)} disabled={formSubmitting} className="bg-white border-slate-300">
              Cancel
            </Button>
            <Button type="submit" isLoading={formSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete Trip Plan"
        description="Are you absolutely sure you want to delete this trip? This action is permanent and will remove matching recommendations."
      >
        <div className="flex justify-end gap-3 text-left">
          <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteSubmitting} className="bg-white border-slate-300">
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteSubmit} isLoading={deleteSubmitting}>
            Delete Trip
          </Button>
        </div>
      </Dialog>
    </div>
  );
};

export default Trips;
