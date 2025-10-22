import { useState } from 'react';
import { useLocation } from 'wouter';
import { useUser } from '@/contexts/UserContext';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useUser } from '@/contexts/UserContext';
import { Crown, ChevronDown, Sparkles, Castle, Shield, Gem } from 'lucide-react';

export default function SignupPage() {
  const [errors, setErrors] = useState({ name: '', email: '', password: '', title: '' });
  const [loading, setLoading] = useState(false);
  const [showTitleDropdown, setShowTitleDropdown] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [, setLocation] = useLocation();
  const { signup } = useUser();

  // Royal Titles Collection
  const royalTitles = [
    { value: 'king', label: 'King', emoji: '👑', description: 'Ruler of the Kitchen' },
    { value: 'queen', label: 'Queen', emoji: '👑', description: 'Ruler of the Kitchen' },
    { value: 'prince', label: 'Prince', emoji: '🤴', description: 'Culinary Heir' },
    { value: 'princess', label: 'Princess', emoji: '👸', description: 'Culinary Heir' },
    { value: 'sire', label: 'Sire', emoji: '⚔️', description: 'Noble Chef' },
    { value: 'your-majesty', label: 'Your Majesty', emoji: '🏰', description: 'Royal Highness' },
    { value: 'your-highness', label: 'Your Highness', emoji: '💎', description: 'Royal Excellence' },
    { value: 'duke', label: 'Duke', emoji: '🎩', description: 'Culinary Noble' },
    { value: 'duchess', label: 'Duchess', emoji: '💍', description: 'Culinary Noble' },
    { value: 'lord', label: 'Lord', emoji: '⚜️', description: 'Kitchen Lord' },
    { value: 'lady', label: 'Lady', emoji: '🌹', description: 'Kitchen Lady' },
    { value: 'knight', label: 'Sir Knight', emoji: '🛡️', description: 'Culinary Knight' },
    { value: 'dame', label: 'Dame', emoji: '🌟', description: 'Culinary Knight' },
    { value: 'royal-chef', label: 'Royal Chef', emoji: '🍳', description: 'Palace Chef' },
    { value: 'court-master', label: 'Court Master', emoji: '🎭', description: 'Royal Court' },
  ];

  const getSelectedTitleData = () => {
    return royalTitles.find(title => title.value === selectedTitle);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const name = formData.get('fullName')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    const password = formData.get('password')?.toString();
    const terms = (e.currentTarget as HTMLFormElement).querySelector('#terms') as HTMLInputElement;

    let newErrors = { name: '', email: '', password: '', title: '' };
    let isValid = true;

    if (!name) { 
      newErrors.name = 'Please enter your royal name.'; 
      isValid = false; 
    }

    if (!email || !/\S+@\S+\.\S+/.test(email)) { 
      newErrors.email = 'Please enter a valid royal decree address.'; 
      isValid = false; 
    }

    if (password && password.length < 6) { 
      newErrors.password = 'Royal decree must be at least 6 characters.'; 
      isValid = false; 
    }

    if (!selectedTitle) {
      newErrors.title = 'Please choose your royal title.';
      isValid = false;
    }

    if (!terms?.checked) { 
      alert('You must agree to the royal charter.'); 
      isValid = false; 
    }

    setErrors(newErrors);
    if (!isValid) return;

    setLoading(true);

    try {
      if (name && email && password) {
        const success = await signup(name, email, password, selectedTitle);
        if (success) {
          alert('Your kingdom awaits! Registration successful!');
          setLocation('/feed');
        } else {
          alert('The royal scribes encountered an issue. Please try again!');
        }
      }
    } catch (error) {
      alert('Royal courier unavailable. Check your connection.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-red-800 to-orange-600 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-yellow-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-red-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-75"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-150"></div>
        
        {/* Floating Crowns */}
        <div className="absolute top-20 left-20 animate-bounce">
          <Crown className="w-8 h-8 text-yellow-300 opacity-40" />
        </div>
        <div className="absolute bottom-20 right-20 animate-bounce delay-100">
          <Crown className="w-6 h-6 text-yellow-200 opacity-40" />
        </div>
        <div className="absolute top-1/2 right-40 animate-bounce delay-200">
          <Sparkles className="w-4 h-4 text-white opacity-30" />
        </div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Royal Header */}
        <div className="text-center">
          <div className="flex justify-center items-center mb-4">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-yellow-300">
                <Crown className="w-10 h-10 text-white" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-300 animate-pulse" />
            </div>
          </div>
          
          <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent mb-2">
            ChefSire
          </h1>
          <p className="text-yellow-100 text-lg mb-1">Join the Royal Culinary Court</p>
          <div className="flex justify-center items-center space-x-2 text-yellow-200">
            <Castle className="w-4 h-4" />
            <span className="text-sm">Where Every Chef Reigns Supreme</span>
            <Gem className="w-4 h-4" />
          </div>
        </div>

        {/* Royal Decree Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Claim Your Throne</h2>
            <p className="text-yellow-100">Begin your culinary reign today</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Royal Name Field */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-yellow-100 mb-2">
                  Royal Name *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    required
                    className={`block w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                      errors.name ? 'border-red-400' : 'border-yellow-300/50'
                    }`}
                    placeholder="Enter your royal name"
                  />
                  <Shield className="absolute right-3 top-1/2 transform -translate-y-1/2 text-yellow-300 w-5 h-5" />
                </div>
                {errors.name && <p className="mt-2 text-sm text-red-300">{errors.name}</p>}
              </div>

              {/* Royal Title Selection */}
              <div>
                <label className="block text-sm font-medium text-yellow-100 mb-2">
                  Choose Your Royal Title *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTitleDropdown(!showTitleDropdown)}
                    className={`flex items-center justify-between w-full px-4 py-3 bg-white/20 border rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                      errors.title ? 'border-red-400' : 'border-yellow-300/50'
                    } ${
                      selectedTitle ? 'text-yellow-100' : 'text-yellow-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {selectedTitle ? (
                        <>
                          <span className="text-xl">{getSelectedTitleData()?.emoji}</span>
                          <div className="text-left">
                            <div className="font-semibold">{getSelectedTitleData()?.label}</div>
                            <div className="text-xs text-yellow-200">{getSelectedTitleData()?.description}</div>
                          </div>
                        </>
                      ) : (
                        <span>Select your royal title...</span>
                      )}
                    </div>
                    <ChevronDown className={`w-5 h-5 text-yellow-300 transition-transform ${showTitleDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showTitleDropdown && (
                    <div className="absolute z-50 w-full mt-2 bg-purple-900/95 backdrop-blur-lg border border-yellow-300/30 rounded-2xl shadow-2xl overflow-hidden">
                      <div className="max-h-60 overflow-y-auto">
                        {royalTitles.map((title) => (
                          <button
                            key={title.value}
                            type="button"
                            onClick={() => {
                              setSelectedTitle(title.value);
                              setShowTitleDropdown(false);
                              setErrors(prev => ({ ...prev, title: '' }));
                            }}
                            className="flex items-center space-x-3 w-full px-4 py-3 text-left hover:bg-yellow-500/20 transition-colors border-b border-white/10 last:border-b-0"
                          >
                            <span className="text-xl">{title.emoji}</span>
                            <div className="flex-1">
                              <div className="font-semibold text-white">{title.label}</div>
                              <div className="text-xs text-yellow-200">{title.description}</div>
                            </div>
                            {selectedTitle === title.value && (
                              <Crown className="w-4 h-4 text-yellow-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {errors.title && <p className="mt-2 text-sm text-red-300">{errors.title}</p>}
              </div>

              {/* Royal Decree (Email) Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-yellow-100 mb-2">
                  Royal Decree Address (Email) *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className={`block w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                      errors.email ? 'border-red-400' : 'border-yellow-300/50'
                    }`}
                    placeholder="your@royalcourt.com"
                  />
                  <Castle className="absolute right-3 top-1/2 transform -translate-y-1/2 text-yellow-300 w-5 h-5" />
                </div>
                {errors.email && <p className="mt-2 text-sm text-red-300">{errors.email}</p>}
              </div>

              {/* Royal Seal (Password) Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-yellow-100 mb-2">
                  Royal Seal (Password) *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    minLength={6}
                    className={`block w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                      errors.password ? 'border-red-400' : 'border-yellow-300/50'
                    }`}
                    placeholder="Your royal secret"
                  />
                  <Gem className="absolute right-3 top-1/2 transform -translate-y-1/2 text-yellow-300 w-5 h-5" />
                </div>
                {errors.password && <p className="mt-2 text-sm text-red-300">{errors.password}</p>}
              </div>

              {/* Royal Charter Agreement */}
              <div className="flex items-start space-x-3 bg-white/10 rounded-2xl p-4 border border-yellow-300/30">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="h-5 w-5 text-yellow-500 focus:ring-yellow-400 border-yellow-300 rounded mt-1"
                />
                <label htmlFor="terms" className="text-yellow-100 text-sm">
                  I swear allegiance to the Royal Charter and agree to the{' '}
                  <a href="/terms" className="text-yellow-300 hover:text-yellow-200 underline">Royal Decree</a> and{' '}
                  <a href="/privacy" className="text-yellow-300 hover:text-yellow-200 underline">Kingdom Privacy</a>
                </label>
              </div>
            </div>

            {/* Claim Throne Button */}
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center items-center py-4 px-6 border border-transparent text-lg font-bold rounded-2xl text-purple-900 bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-300 hover:to-orange-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-purple-900 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-900 mr-3"></div>
                  Processing Royal Decree...
                </>
              ) : (
                <>
                  <Crown className="w-6 h-6 mr-2" />
                  Claim Your Throne
                  <Sparkles className="w-4 h-4 ml-2 animate-pulse" />
                </>
              )}
            </button>
          </form>

          {/* Already Have a Kingdom */}
          <div className="text-center mt-6 pt-6 border-t border-yellow-300/30">
            <p className="text-yellow-100">
              Already rule a kingdom?{' '}
              <a href="/login" className="text-yellow-300 hover:text-yellow-200 font-semibold underline">
                Enter Your Castle
              </a>
            </p>
          </div>
        </div>

        {/* Royal Footer */}
        <div className="text-center">
          <div className="text-yellow-200/70 text-xs space-y-1">
            <p>By the Royal Decree of ChefSire Kingdom</p>
            <p>© 2024 Royal Culinary Court. All rights protected by royal guard.</p>
            <div className="flex justify-center space-x-4 mt-2">
              <a href="/about" className="hover:text-yellow-300 transition-colors">About the Kingdom</a>
              <a href="/contact" className="hover:text-yellow-300 transition-colors">Contact Royal Court</a>
              <a href="/privacy" className="hover:text-yellow-300 transition-colors">Royal Privacy</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function SignupPage() {
  const [errors, setErrors] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { signup } = useUser();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const name = formData.get('fullName')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    const password = formData.get('password')?.toString();
    const terms = (e.currentTarget as HTMLFormElement).querySelector('#terms') as HTMLInputElement;

    let newErrors = { name: '', email: '', password: '' };
    let isValid = true;

    if (!name) { 
      newErrors.name = 'Please enter your full name.'; 
      isValid = false; 
    }

    if (!email || !/\S+@\S+\.\S+/.test(email)) { 
      newErrors.email = 'Please enter a valid email.'; 
      isValid = false; 
    }

    if (password && password.length < 6) { 
      newErrors.password = 'Password must be at least 6 characters.'; 
      isValid = false; 
    }

    if (!terms?.checked) { 
      alert('You must agree to the terms.'); 
      isValid = false; 
    }

    setErrors(newErrors);
    if (!isValid) return;

    setLoading(true);

    try {
      if (name && email && password) {
        const success = await signup(name, email, password);
        if (success) {
          alert('Sign-up successful! Redirecting to feed...');
          setLocation('/feed');
        } else {
          alert('Sign-up failed—please try again!');
        }
      }
    } catch (error) {
      alert('Network error—check your connection.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-600">ChefSire</h1>
          <p className="mt-2 text-sm text-gray-600">Join the culinary community</p>
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Name Field */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Full Name *
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                required
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., John Doe"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., john@example.com"
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                minLength={6}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="At least 6 characters"
              />
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
            </div>

            {/* Terms Checkbox */}
            <div className="flex items-center">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                required
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
                I agree to the{' '}
                <a href="/terms" className="text-red-600 hover:underline">Terms of Service</a> and{' '}
                <a href="/privacy" className="text-red-600 hover:underline">Privacy Policy</a>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Login Link */}
        <div className="text-center">
          <a href="/login" className="text-sm text-red-600 hover:underline">
            Already have an account? Log In
          </a>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          &copy; 2025 ChefSire.com All rights reserved. |{' '}
          <a href="/about" className="hover:underline">About</a> |{' '}
          <a href="/contact" className="hover:underline">Contact</a> |{' '}
          <a href="/privacy" className="hover:underline">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
