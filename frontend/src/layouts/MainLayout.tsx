import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 w-full min-w-0 overflow-x-hidden">
      <Navbar />
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0 animate-fade-in">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;
