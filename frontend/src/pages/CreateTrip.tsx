import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { tripService } from '../services/api';
import { Input, Textarea } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Calendar, DollarSign, Users, Tag, Compass, ArrowLeft } from 'lucide-react';

const INTERESTS_OPTIONS = ['Nature', 'Photography', 'Food', 'Adventure', 'Shopping', 'History', 'Culture', 'Nightlife', 'Relaxation'];
const STYLES_OPTIONS = ['Budget', 'Backpacker', 'Luxury', 'Relaxed', 'Adventure', 'Cultural', 'Fast-paced'];

export const CreateTrip: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const validate = () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast('Please correct the validation errors.', 'error');
      return;
    }

    setIsSubmitting(true);
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
      await tripService.createTrip(payload);
      toast('Trip created successfully!', 'success');
      navigate('/trips');
    } catch (error: any) {
      console.error(error);
      setFormErrors({ api: error.response?.data?.detail || 'Failed to save trip parameters.' });
      toast('Unable to save trip.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto text-left py-4 space-y-6">
      <button 
        onClick={() => navigate('/trips')} 
        className="flex items-center gap-1 text-slate-500 hover:text-slate-700 transition-colors text-sm font-semibold"
      >
        <ArrowLeft size={16} />
        <span>Back to My Trips</span>
      </button>

      <Card className="shadow-lg border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-6">
          <CardTitle className="text-2xl text-brand-950 font-extrabold flex items-center gap-2">
            <Compass className="text-brand-500 w-6 h-6" />
            <span>Create Your Trip</span>
          </CardTitle>
          <CardDescription className="text-slate-500 font-medium">Tell us about your next adventure to match with travel buddies.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              placeholder="Tell potential travel buddies what kind of experience you're looking for, planned activities, and routes..."
              value={formData.description}
              onChange={handleInputChange}
              error={formErrors.description}
              rows={4}
              className="bg-white border-slate-200"
            />

            {/* Travel Interests select chips */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Travel Interests
              </label>
              <div className="flex flex-wrap gap-2">
                {INTERESTS_OPTIONS.map((interest) => {
                  const isSelected = formData.travel_interests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                        isSelected
                          ? 'bg-brand-500/10 border-brand-500 text-brand-700'
                          : 'bg-white border-slate-250 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Travel Style select chips */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Travel Style
              </label>
              <div className="flex flex-wrap gap-2">
                {STYLES_OPTIONS.map((style) => {
                  const isSelected = formData.preferred_travel_style.includes(style);
                  return (
                    <button
                      key={style}
                      type="button"
                      onClick={() => toggleStyle(style)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                        isSelected
                          ? 'bg-teal-500/10 border-teal-500 text-teal-700'
                          : 'bg-white border-slate-250 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      {style}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => navigate('/trips')} 
                disabled={isSubmitting}
                className="bg-white border-slate-300"
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Save Trip
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateTrip;
