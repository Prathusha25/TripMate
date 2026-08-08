import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Globe, Eye, EyeOff, Lock, Mail } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Check if redirected due to expired token
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('expired') === 'true') {
      setSessionExpiredMsg(true);
    }
  }, [location]);

  const validate = () => {
    const tempErrors: Record<string, string> = {};
    if (!formData.email.trim()) {
      tempErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      tempErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      tempErrors.password = 'Password is required';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setSessionExpiredMsg(false);
    
    if (!validate()) return;

    setIsLoading(true);
    try {
      await login({
        email: formData.email,
        password: formData.password,
      });
      toast('Welcome back to TripMate AI!', 'success');
      
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from);
    } catch (error: any) {
      console.error(error);
      const detail = error.response?.data?.detail;
      setApiError(
        typeof detail === 'string'
          ? detail
          : 'Incorrect email or password. Please try again.'
      );
      toast('Login failed.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex rounded-3xl overflow-hidden bg-white border border-slate-200 shadow-xl max-w-4xl mx-auto my-4">
      {/* Split visual screen layout on desktop */}
      <div className="hidden md:flex md:w-1/2 relative bg-slate-900 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=800" 
          alt="Travel trip" 
          className="absolute inset-0 w-full h-full object-cover opacity-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/20 to-transparent" />
        
        {/* Branding text details */}
        <div className="absolute inset-x-8 bottom-12 text-left text-white space-y-4">
          <div className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-white">
            <div className="bg-brand-500 p-2 rounded-xl text-white">
              <Globe size={22} />
            </div>
            <span>TripMate AI</span>
          </div>
          <p className="text-xl font-bold font-display leading-tight text-white">
            Find Your Travel People. <br />Plan Better Trips.
          </p>
          <p className="text-slate-300 text-xs font-semibold leading-relaxed">
            Connect with solo travelers heading to your destinations, coordinate housing, share budgets, and chat securely.
          </p>
        </div>
      </div>

      {/* Right side form */}
      <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center text-left">
        <div className="space-y-2 mb-6">
          <h2 className="text-2xl font-extrabold text-brand-950">Welcome Back</h2>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Log in to your social travel dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {sessionExpiredMsg && (
            <Alert variant="info">
              Your session has expired. Please log in again to continue.
            </Alert>
          )}

          {apiError && (
            <Alert variant="error">
              {apiError}
            </Alert>
          )}

          <div className="relative">
            <Input
              label="Email Address"
              name="email"
              type="email"
              placeholder="alex@example.com"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              required
              className="bg-white border-slate-200"
            />
          </div>

          <div className="relative">
            <div className="absolute right-4 bottom-3.5 z-10">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-slate-650"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <Input
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              required
              className="bg-white border-slate-200"
            />
          </div>

          {/* Remember me & Forgot Password Row */}
          <div className="flex items-center justify-between text-xs font-semibold pt-1">
            <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-350 text-brand-500 focus:ring-brand-500 w-4 h-4 cursor-pointer"
              />
              <span>Remember me</span>
            </label>
            <button 
              type="button"
              onClick={() => toast('Password recovery will be available in Phase 2.', 'info')}
              className="text-brand-500 hover:text-brand-650 hover:underline"
            >
              Forgot Password?
            </button>
          </div>

          <Button type="submit" className="w-full mt-4 py-3" isLoading={isLoading}>
            Log In
          </Button>
        </form>

        <div className="text-center text-xs text-slate-500 mt-8 font-semibold">
          Don't have an account?{' '}
          <Link to="/signup" className="text-brand-500 hover:text-brand-600 underline">
            Sign up here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
