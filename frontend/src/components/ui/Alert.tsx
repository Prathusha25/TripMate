import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

interface AlertProps {
  variant?: 'info' | 'success' | 'error' | 'warning';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  className = '',
}) => {
  const styles = {
    info: 'bg-sky-50 border-sky-200/80 text-sky-950',
    success: 'bg-emerald-50 border-emerald-200/80 text-emerald-950',
    error: 'bg-rose-50 border-rose-200/80 text-rose-950',
    warning: 'bg-amber-50 border-amber-200/80 text-amber-950',
  };

  const iconColors = {
    info: 'text-sky-600',
    success: 'text-emerald-600',
    error: 'text-rose-600',
    warning: 'text-amber-600',
  };

  const icons = {
    info: <Info size={16} className={`shrink-0 mt-0.5 ${iconColors[variant]}`} />,
    success: <CheckCircle2 size={16} className={`shrink-0 mt-0.5 ${iconColors[variant]}`} />,
    error: <AlertCircle size={16} className={`shrink-0 mt-0.5 ${iconColors[variant]}`} />,
    warning: <AlertTriangle size={16} className={`shrink-0 mt-0.5 ${iconColors[variant]}`} />,
  };

  return (
    <div className={`p-3 sm:p-3.5 rounded-lg border flex gap-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${styles[variant]} ${className}`}>
      {icons[variant]}
      <div className="flex-1 text-left min-w-0">
        {title && <span className="font-semibold block mb-0.5 text-xs sm:text-sm">{title}</span>}
        <div className="text-xs font-normal">{children}</div>
      </div>
    </div>
  );
};
export default Alert;
