import React from 'react';
import { Globe, ShieldAlert } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 text-slate-500 py-12 px-4 sm:px-6 lg:px-8 mt-auto shadow-inner">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Brand */}
        <div className="space-y-4 text-left">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-brand-950">
            <div className="bg-brand-500 p-1.5 rounded-lg text-white">
              <Globe size={16} />
            </div>
            <span>TripMate <span className="text-teal-500">AI</span></span>
          </div>
          <p className="text-xs leading-relaxed text-slate-500 font-medium">
            Find your travel people. Plan better trips. Connecting solo travelers worldwide for safe, shared adventures.
          </p>
        </div>

        {/* Links */}
        <div className="text-left">
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-950 mb-4">Platform</h4>
          <ul className="space-y-2 text-xs font-semibold text-slate-600">
            <li><a href="#how-it-works" className="hover:text-brand-500 transition-colors">How It Works</a></li>
            <li><a href="#features" className="hover:text-brand-500 transition-colors">Features</a></li>
            <li><a href="#safety" className="hover:text-brand-500 transition-colors">Safety Guidelines</a></li>
          </ul>
        </div>

        {/* Company */}
        <div className="text-left">
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-950 mb-4">About</h4>
          <ul className="space-y-2 text-xs font-semibold text-slate-600">
            <li><span className="hover:text-brand-500 cursor-pointer transition-colors">Our Vision</span></li>
            <li><span className="hover:text-brand-500 cursor-pointer transition-colors">Careers</span></li>
            <li><span className="hover:text-brand-500 cursor-pointer transition-colors">Contact Support</span></li>
          </ul>
        </div>

        {/* Safety Disclaimer */}
        <div className="space-y-3 text-left">
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-950 flex items-center gap-1.5">
            <ShieldAlert size={14} className="text-accent-500" />
            <span>Safety First</span>
          </h4>
          <p className="text-[11px] leading-relaxed text-slate-500">
            TripMate AI is a platform designed to connect travelers with shared interests. 
            <strong> We do not perform background checks on users and cannot guarantee user safety.</strong> 
            Always meet in public, tell friends/family about your plans, and trust your instincts.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-t border-slate-100 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 font-medium gap-4">
        <div>
          © {new Date().getFullYear()} TripMate AI. All rights reserved. Built for Phase 1.
        </div>
        <div className="flex gap-4">
          <span className="hover:text-slate-600 cursor-pointer">Privacy Policy</span>
          <span className="hover:text-slate-600 cursor-pointer">Terms of Service</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
