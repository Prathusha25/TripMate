import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in" 
        onClick={onClose} 
      />

      {/* Modal Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col shadow-xl relative z-10 animate-slide-up text-slate-900 overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-start gap-3 shrink-0 bg-slate-50/40">
          <div className="text-left min-w-0">
            <h3 className="text-sm sm:text-base font-semibold font-display text-slate-900 tracking-tight">{title}</h3>
            {description && (
              <p className="text-xs text-slate-500 font-normal mt-0.5">{description}</p>
            )}
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 hover:bg-slate-100 rounded-lg shrink-0"
            title="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 text-left min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
};
export default Dialog;
