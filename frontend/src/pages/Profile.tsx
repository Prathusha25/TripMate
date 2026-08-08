import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { userService } from '../services/api';
import { Input, Textarea } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { User, MapPin, DollarSign, Edit, Save, Check } from 'lucide-react';

const INTERESTS_OPTIONS = [
  'Nature', 'Photography', 'Food', 'Adventure', 
  'Shopping', 'History', 'Culture', 'Nightlife', 'Relaxation'
];

const STYLES_OPTIONS = [
  'Budget', 'Backpacker', 'Luxury', 'Relaxed', 
  'Adventure', 'Cultural', 'Solo', 'Fast-paced'
];

const BUDGET_OPTIONS = ['Budget', 'Moderate', 'Premium', 'Luxury'];

export const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const location = useLocation();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    profile_photo: '',
    bio: '',
    home_city: '',
    interests: [] as string[],
    travel_style: [] as string[],
    budget_preference: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [welcomeBanner, setWelcomeBanner] = useState(false);

  // Sync state with current user profile
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        profile_photo: user.profile_photo || '',
        bio: user.bio || '',
        home_city: user.home_city || '',
        interests: user.interests || [],
        travel_style: user.travel_style || [],
        budget_preference: user.budget_preference || '',
      });
    }

    // Check if new signup redirect
    const params = new URLSearchParams(location.search);
    if (params.get('new') === 'true') {
      setWelcomeBanner(true);
      setIsEditing(true); // Open edit mode by default for new users
    }
  }, [user, location]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectBudget = (budget: string) => {
    if (!isEditing) return;
    setFormData((prev) => ({ ...prev, budget_preference: budget }));
  };

  const toggleInterest = (interest: string) => {
    if (!isEditing) return;
    setFormData((prev) => {
      const interests = prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest];
      return { ...prev, interests };
    });
  };

  const toggleStyle = (style: string) => {
    if (!isEditing) return;
    setFormData((prev) => {
      const travel_style = prev.travel_style.includes(style)
        ? prev.travel_style.filter((s) => s !== style)
        : [...prev.travel_style, style];
      return { ...prev, travel_style };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await userService.updateProfile(formData);
      await refreshUser();
      toast('Profile updated successfully!', 'success');
      setIsEditing(false);
      setWelcomeBanner(false);
    } catch (error: any) {
      console.error(error);
      toast('Failed to update profile.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-left py-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-950">Traveler Profile</h1>
          <p className="text-slate-500 font-medium">Configure your personality details and matching preferences</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} className="gap-2 shrink-0">
            <Edit size={16} />
            <span>Edit Profile</span>
          </Button>
        ) : (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isLoading} className="bg-white border-slate-350">
              Cancel
            </Button>
            <Button onClick={handleSave} className="gap-2" isLoading={isLoading}>
              <Save size={16} />
              <span>Save Changes</span>
            </Button>
          </div>
        )}
      </div>

      {welcomeBanner && (
        <Alert variant="info" title="Welcome to TripMate AI! 👋">
          Please take a moment to complete your profile. Sharing your home city, bio, travel styles, and interests helps other solo travelers discover you and send buddy invites!
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Basic Info */}
        <div className="md:col-span-1 space-y-6">
          <Card className="text-center border-slate-200 shadow-sm">
            <CardContent className="pt-8 pb-6 flex flex-col items-center space-y-4">
              <div className="relative">
                {formData.profile_photo ? (
                  <img
                    src={formData.profile_photo}
                    alt={formData.name}
                    className="w-32 h-32 rounded-full object-cover border-4 border-slate-100 shadow-lg"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 border border-slate-300 shadow-lg">
                    <User size={48} />
                  </div>
                )}
              </div>
              <div className="space-y-0.5">
                <h2 className="text-xl font-extrabold text-brand-950">{formData.name}</h2>
                <p className="text-xs text-slate-400 font-medium">{user.email}</p>
              </div>

              {formData.home_city && (
                <div className="flex items-center justify-center gap-1 text-xs text-slate-500 font-semibold">
                  <MapPin size={14} className="text-brand-500" />
                  <span>Home: {formData.home_city}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Preferences Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Match Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs pt-4 font-semibold text-slate-600">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Home City</span>
                <span className="text-slate-800">{formData.home_city || 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Budget Tier</span>
                <span className="text-slate-800">{formData.budget_preference || 'Not specified'}</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-400 font-medium">Account Security</span>
                <span className="text-teal-600">Phase 1 Secure</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Editable Profile Fields */}
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
                <CardTitle className="text-base text-brand-950">About Me</CardTitle>
                <CardDescription className="text-[11px] text-slate-500 font-semibold">Describe your travel persona and stories</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                {isEditing ? (
                  <>
                    <Input
                      label="Full Name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="bg-white border-slate-200"
                    />
                    <Input
                      label="Avatar Image URL"
                      name="profile_photo"
                      value={formData.profile_photo}
                      onChange={handleChange}
                      placeholder="https://example.com/avatar.jpg"
                      className="bg-white border-slate-200"
                    />
                    <Input
                      label="Home City"
                      name="home_city"
                      value={formData.home_city}
                      onChange={handleChange}
                      placeholder="e.g. Mumbai, India"
                      className="bg-white border-slate-200"
                    />
                    <Textarea
                      label="Short Bio"
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      placeholder="Share a little bit about yourself, your favorite travel stories, and what you look for in a travel buddy..."
                      rows={4}
                      className="bg-white border-slate-200"
                    />
                  </>
                ) : (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bio Paragraph</h4>
                    <p className="text-sm text-slate-650 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-150 italic">
                      "{formData.bio || 'No bio written yet. Click Edit Profile to add one!'}"
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Interests Block */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
                  <CardTitle className="text-base text-brand-950">Travel Interests</CardTitle>
                  <CardDescription className="text-[11px] text-slate-500 font-semibold">Which activities do you enjoy most?</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    {INTERESTS_OPTIONS.map((interest) => {
                      const isSelected = formData.interests.includes(interest);
                      return (
                        <button
                          key={interest}
                          type="button"
                          disabled={!isEditing}
                          onClick={() => toggleInterest(interest)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-250 flex items-center gap-1 ${
                            isSelected
                              ? 'bg-brand-500/10 border-brand-500 text-brand-700'
                              : 'bg-white border-slate-250 text-slate-600 hover:border-slate-450 disabled:opacity-85 disabled:hover:border-slate-250'
                          }`}
                        >
                          {isSelected && <Check size={10} />}
                          <span>{interest}</span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Travel Style Block */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
                  <CardTitle className="text-base text-brand-950">Travel Style</CardTitle>
                  <CardDescription className="text-[11px] text-slate-500 font-semibold">How do you prefer to move and explore?</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    {STYLES_OPTIONS.map((style) => {
                      const isSelected = formData.travel_style.includes(style);
                      return (
                        <button
                          key={style}
                          type="button"
                          disabled={!isEditing}
                          onClick={() => toggleStyle(style)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-250 flex items-center gap-1 ${
                            isSelected
                              ? 'bg-teal-500/10 border-teal-500 text-teal-700'
                              : 'bg-white border-slate-250 text-slate-600 hover:border-slate-455 disabled:opacity-85 disabled:hover:border-slate-250'
                          }`}
                        >
                          {isSelected && <Check size={10} />}
                          <span>{style}</span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Budget preference block */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
                <CardTitle className="text-base text-brand-950">Budget Preference</CardTitle>
                <CardDescription className="text-[11px] text-slate-500 font-semibold">What is your typical budget tier?</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  {BUDGET_OPTIONS.map((budget) => {
                    const isSelected = formData.budget_preference === budget;
                    return (
                      <button
                        key={budget}
                        type="button"
                        disabled={!isEditing}
                        onClick={() => handleSelectBudget(budget)}
                        className={`flex-1 py-3 px-4 rounded-xl border text-center font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 ${
                          isSelected
                            ? 'bg-brand-500/10 border-brand-500 text-brand-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350 disabled:opacity-85'
                        }`}
                      >
                        <DollarSign size={13} className={isSelected ? 'text-brand-650' : 'text-slate-400'} />
                        <span>{budget}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
