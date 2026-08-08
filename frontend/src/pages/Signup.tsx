import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Globe, Eye, EyeOff } from 'lucide-react';

export const Signup: React.FC = () => {
  const { signup, verifyCode, resendCode } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Email verification screen states
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const validate = () => {
    const tempErrors: Record<string, string> = {};
    if (!formData.name.trim()) tempErrors.name = 'Name is required';
    
    if (!formData.email.trim()) {
      tempErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      tempErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      tempErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      tempErrors.password = 'Password must be at least 6 characters long';
    }
    
    if (formData.password !== formData.confirmPassword) {
      tempErrors.confirmPassword = 'Passwords do not match';
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
    
    if (!validate()) return;

    setIsLoading(true);
    try {
      const data = await signup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        confirm_password: formData.confirmPassword,
      });

      if (data && data.status === 'verification_pending') {
        setVerificationEmail(formData.email);
        setIsVerifying(true);
        toast('Verification code sent to your email!', 'success');
      } else {
        toast('Account created successfully! Welcome to TripMate AI.', 'success');
        navigate('/profile?new=true'); // Redirect to profile page on success
      }
    } catch (error: any) {
      console.error(error);
      const detail = error.response?.data?.detail;
      setApiError(
        typeof detail === 'string' 
          ? detail 
          : 'Failed to register account. Please check your credentials and try again.'
      );
      toast('Registration failed.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError(null);

    if (verificationCode.length !== 6) {
      setVerificationError('Verification code must be exactly 6 digits');
      return;
    }

    setIsLoading(true);
    try {
      await verifyCode(verificationEmail, verificationCode);
      toast('Email verified successfully! Welcome to TripMate AI.', 'success');
      navigate('/profile?new=true');
    } catch (error: any) {
      console.error(error);
      const detail = error.response?.data?.detail;
      setVerificationError(
        typeof detail === 'string' 
          ? detail 
          : 'Invalid verification code. Please check and try again.'
      );
      toast('Verification failed.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setVerificationError(null);
    setIsResending(true);
    try {
      await resendCode(verificationEmail);
      toast('A new verification code has been sent!', 'success');
    } catch (error: any) {
      console.error(error);
      const detail = error.response?.data?.detail;
      setVerificationError(
        typeof detail === 'string' ? detail : 'Failed to resend code. Please try again.'
      );
    } finally {
      setIsResending(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-[80vh] flex rounded-3xl overflow-hidden bg-white border border-slate-200 shadow-xl max-w-4xl mx-auto my-4">
        {/* Left side travel visual image panel */}
        <div className="hidden md:flex md:w-1/2 relative bg-slate-900 overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&q=80&w=800" 
            alt="Adventure travel hiking" 
            className="absolute inset-0 w-full h-full object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/20 to-transparent" />
          
          <div className="absolute inset-x-8 bottom-12 text-left text-white space-y-4">
            <div className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-white">
              <div className="bg-brand-500 p-2 rounded-xl text-white">
                <Globe size={22} />
              </div>
              <span>TripMate AI</span>
            </div>
            <p className="text-xl font-bold font-display leading-tight text-white">
              Verify your email address.
            </p>
            <p className="text-slate-300 text-xs font-semibold leading-relaxed">
              We have sent a 6-digit verification code to your email. Enter it below to activate your account.
            </p>
          </div>
        </div>

        {/* Right side form */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center text-left">
          <div className="space-y-2 mb-6">
            <h2 className="text-2xl font-extrabold text-brand-950">Verify Email</h2>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Enter the 6-digit code sent to {verificationEmail}
            </p>
          </div>

          <form onSubmit={handleVerifySubmit} className="space-y-4">
            {verificationError && (
              <Alert variant="error">
                {verificationError}
              </Alert>
            )}

            <Input
              label="Verification Code"
              name="code"
              type="text"
              placeholder="123456"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              required
              className="bg-white border-slate-200 tracking-widest text-center text-xl font-bold font-mono"
            />

            <Button type="submit" className="w-full mt-4 py-3" isLoading={isLoading}>
              Verify Code
            </Button>
          </form>

          <div className="flex flex-col gap-4 mt-8 text-center text-xs font-semibold text-slate-500">
            <div>
              Didn't receive the code?{' '}
              <button 
                type="button" 
                onClick={handleResendCode} 
                disabled={isResending}
                className="text-brand-500 hover:text-brand-600 underline disabled:opacity-50"
              >
                {isResending ? 'Resending...' : 'Resend Code'}
              </button>
            </div>
            <div>
              <button 
                type="button" 
                onClick={() => setIsVerifying(false)} 
                className="text-slate-400 hover:text-slate-500 underline"
              >
                Back to registration
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex rounded-3xl overflow-hidden bg-white border border-slate-200 shadow-xl max-w-4xl mx-auto my-4">
      {/* Left side travel visual image panel */}
      <div className="hidden md:flex md:w-1/2 relative bg-slate-900 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&q=80&w=800" 
          alt="Adventure travel hiking" 
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
            Traveling solo doesn't mean traveling alone.
          </p>
          <p className="text-slate-300 text-xs font-semibold leading-relaxed">
            Create your traveler profile, share upcoming trips, and match/chat with travelers going to similar locations.
          </p>
        </div>
      </div>

      {/* Right side form */}
      <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center text-left">
        <div className="space-y-2 mb-6">
          <h2 className="text-2xl font-extrabold text-brand-950">Create Account</h2>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Join TripMate AI to find your travel partners</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {apiError && (
            <Alert variant="error">
              {apiError}
            </Alert>
          )}

          <Input
            label="Full Name"
            name="name"
            type="text"
            placeholder="Alex Mercer"
            value={formData.name}
            onChange={handleChange}
            error={errors.name}
            required
            className="bg-white border-slate-200"
          />

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

          <div className="relative">
            <div className="absolute right-4 bottom-3.5 z-10">
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-slate-400 hover:text-slate-650"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <Input
              label="Confirm Password"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              required
              className="bg-white border-slate-200"
            />
          </div>

          <Button type="submit" className="w-full mt-4 py-3" isLoading={isLoading}>
            Create Account
          </Button>
        </form>

        <div className="text-center text-xs text-slate-500 mt-8 font-semibold">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-500 hover:text-brand-600 underline">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
