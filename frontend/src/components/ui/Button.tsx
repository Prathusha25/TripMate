import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyle = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-600 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.99] select-none cursor-pointer text-xs sm:text-sm';
  
  const variants = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm border border-brand-600',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200',
    outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 shadow-sm hover:border-slate-300',
    ghost: 'bg-transparent hover:bg-slate-100/80 text-slate-650 hover:text-slate-900',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm border border-rose-600',
  };

  const sizes = {
    sm: 'px-2.5 py-1 text-xs gap-1.5 h-8',
    md: 'px-3.5 py-1.5 text-xs sm:text-sm gap-1.5 h-9',
    lg: 'px-4.5 py-2 text-sm gap-2 h-10',
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin h-3.5 w-3.5 text-current shrink-0"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};
export default Button;
