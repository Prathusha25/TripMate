import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, Sparkles, User, ShieldCheck, MessageSquare, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const Landing: React.FC = () => {
  const navigate = useNavigate();

  const steps = [
    {
      num: '01',
      title: 'Create Your Profile',
      desc: 'Set your travel style (backpacking, luxury, relaxed) and personal interests (food, nature, culture).',
      icon: User,
    },
    {
      num: '02',
      title: 'Create Your Trip',
      desc: 'Set destination, dates, approximate budget, and description.',
      icon: Compass,
    },
    {
      num: '03',
      title: 'Find Travelers',
      desc: 'Discover other solo travelers heading to the same destinations.',
      icon: Sparkles,
    },
    {
      num: '04',
      title: 'Connect Mutually',
      desc: 'Connections are only established when both parties accept.',
      icon: ShieldCheck,
    },
    {
      num: '05',
      title: 'Travel & Chat',
      desc: 'Coordinate plans, share costs, and travel safer using built-in chat.',
      icon: MessageSquare,
    },
  ];

  const features = [
    {
      title: 'Travel Buddy Discovery',
      desc: 'Browse user cards with travel styles, budget ranges, interests, and matching destinations.',
      icon: Compass,
    },
    {
      title: 'AI Trip Planner',
      desc: 'Generate customized day-by-day itineraries and packing checklists with live weather awareness.',
      icon: Sparkles,
    },
    {
      title: 'Personalized Profiles',
      desc: 'Choose from interests like Nature, Photography, and Food, and style tags like Cultural or Solo.',
      icon: User,
    },
    {
      title: 'Smart Connections',
      desc: 'Double opt-in request flow ensures you only talk to the people you choose to connect with.',
      icon: ShieldCheck,
    },
    {
      title: 'Private Messaging',
      desc: 'Private messaging system lets you coordinate flights, accommodations, and itineraries securely.',
      icon: MessageSquare,
    },
  ];

  return (
    <div className="space-y-12 sm:space-y-16 text-left w-full min-w-0">
      
      {/* Hero Section — Proportioned for First Viewport */}
      <section className="relative rounded-2xl sm:rounded-3xl overflow-hidden py-8 sm:py-10 md:py-12 px-5 sm:px-8 text-center max-w-5xl mx-auto shadow-md bg-slate-900 border border-slate-800 flex flex-col items-center justify-center">
        {/* Background Image with Controlled Opacity */}
        <img 
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=1200" 
          alt="Adventure travel background" 
          className="absolute inset-0 w-full h-full object-cover opacity-25 select-none pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/75 to-slate-950/95" />
        
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-500/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Hero Content Container */}
        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center text-center space-y-2 sm:space-y-3">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-brand-400/20 bg-brand-500/10 text-brand-300 text-[11px] sm:text-xs font-semibold">
            <Sparkles size={11} className="text-amber-400 shrink-0" />
            <span>Smart & safe social travel platform</span>
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-4xl md:text-[44px] font-bold tracking-tight text-white leading-tight font-display">
            Find Your Travel People. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-300">
              Plan Better Trips.
            </span>
          </h1>

          {/* Supporting Text */}
          <p className="text-xs sm:text-sm md:text-base text-slate-300 max-w-lg leading-relaxed font-normal pt-0.5">
            Discover travelers heading to the same destinations, connect with like-minded companions, and use AI to customize your itineraries.
          </p>

          {/* Primary & Secondary CTAs */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2 sm:pt-3 w-full justify-center max-w-sm sm:max-w-md">
            <Link to="/travel-buddies" className="w-full sm:w-auto">
              <Button size="md" className="w-full sm:w-auto gap-1.5 font-medium shadow-sm bg-brand-600 hover:bg-brand-700 text-white h-9 sm:h-10 px-4">
                <span>Find Travel Buddies</span>
                <ArrowRight size={14} />
              </Button>
            </Link>
            <Link to="/ai-planner" className="w-full sm:w-auto">
              <Button 
                variant="outline" 
                size="md" 
                className="w-full sm:w-auto gap-1.5 bg-white/10 hover:bg-white/20 border-white/20 text-white font-medium h-9 sm:h-10 px-4"
              >
                <Sparkles size={14} className="text-amber-400" />
                <span>AI Trip Planner</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="space-y-6 scroll-mt-20">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-display">How It Works</h2>
          <p className="text-slate-500 text-xs sm:text-sm font-normal">Connect with travelers in 5 simple steps.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 max-w-5xl mx-auto">
          {steps.map((step, idx) => (
            <div key={idx} className="bg-white border border-slate-200/80 rounded-xl p-4 relative flex flex-col justify-between shadow-xs hover:border-slate-300 transition-all text-xs">
              <span className="absolute top-3 right-3 text-[10px] font-bold text-slate-400 tracking-wider font-mono">
                {step.num}
              </span>
              <div>
                <div className="bg-brand-50 p-2 rounded-lg text-brand-600 w-8 h-8 flex items-center justify-center mb-3">
                  <step.icon size={16} />
                </div>
                <h3 className="text-xs font-semibold text-slate-900 mb-1">{step.title}</h3>
                <p className="text-[11px] text-slate-500 leading-normal font-normal">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Key Platform Features */}
      <section id="features" className="space-y-6 scroll-mt-20">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-display">Platform Features</h2>
          <p className="text-slate-500 text-xs sm:text-sm font-normal">Everything you need to discover travelers and coordinate journeys.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-w-5xl mx-auto">
          {features.map((feat, idx) => (
            <div key={idx} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs space-y-2 text-xs">
              <div className="bg-teal-50 text-teal-600 p-2 rounded-lg w-8 h-8 flex items-center justify-center">
                <feat.icon size={16} />
              </div>
              <div className="space-y-0.5 text-left">
                <h3 className="text-xs font-semibold text-slate-900">{feat.title}</h3>
                <p className="text-[11px] text-slate-500 leading-normal font-normal">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Safety Section */}
      <section id="safety" className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-7 shadow-xs max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="space-y-2 text-left">
            <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg w-8 h-8 flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-display">Your Safety First</h2>
            <p className="text-slate-500 text-xs leading-relaxed font-normal">
              At TripMate AI, connections are established only through mutual consent, keeping contact information private until you choose to share it.
            </p>
          </div>

          <div className="space-y-2 text-xs text-slate-700 text-left bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span>Detailed traveler profiles with style & interest tags.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span>Double opt-in connection requests.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span>Safety reporting and blocking tools available.</span>
            </div>
            <p className="text-slate-400 text-[10px] font-normal italic border-t border-slate-200 pt-2 mt-2">
              TripMate helps travelers connect with confidence. Always verify travel details and exercise personal judgment.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
