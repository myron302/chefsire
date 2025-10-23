// client/src/pages/signup.tsx
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useUser } from '@/contexts/UserContext';
import {
  Crown, ChevronDown, Sparkles, Castle, Shield, Gem,
  Eye, EyeOff, Phone, Mail, CheckCircle2, XCircle
} from 'lucide-react';

type Errors = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  title: string;
  phone: string;
  captcha: string;
  verify: string;
};

type VerifyMethod = 'sms' | 'email';

const TITLE_SUFFIX_MAP: Record<string, string> = {
  'king': 'king',
  'queen': 'queen',
  'prince': 'prince',
  'princess': 'princess',
  'sire': 'sire',
  'your-majesty': 'yourmajesty',
  'your-highness': 'yourhighness',
  'duke': 'duke',
  'duchess': 'duchess',
  'lord': 'lord',
  'lady': 'lady',
  'knight': 'sirknight',
  'dame': 'dame',
  'royal-chef': 'royalchef',
  'court-master': 'courtsage',
  'noble-chef': 'noblechef',
  'imperial-chef': 'imperialchef',
  'majestic-chef': 'majesticchef',
  'chef': 'chef',
};

function slugify(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 32); // keep tidy
}

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { signup } = useUser();

  // Core state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({
    firstName: '', lastName: '', username: '', email: '', password: '',
    title: '', phone: '', captcha: '', verify: ''
  });

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [username, setUsername]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [phone, setPhone]         = useState('');
  const [agree, setAgree]         = useState(false);

  // Title dropdown
  const [showTitleDropdown, setShowTitleDropdown] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const titleBtnRef = useRef<HTMLButtonElement | null>(null);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Verification
  const [verifyMethod, setVerifyMethod] = useState<VerifyMethod>('email');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [emailLinkSent, setEmailLinkSent] = useState(false);

  // CAPTCHA (lightweight math)
  const [captchaA, setCaptchaA] = useState(0);
  const [captchaB, setCaptchaB] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  // Royal Titles - WITH 4 NEW TITLES ADDED
  const royalTitles = useMemo(() => ([
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
    { value: 'noble-chef', label: 'Noble Chef', emoji: '🌟', description: 'Distinguished Cook' },
    { value: 'imperial-chef', label: 'Imperial Chef', emoji: '👨‍🍳', description: 'Supreme Chef' },
    { value: 'majestic-chef', label: 'Majestic Chef', emoji: '✨', description: 'Extraordinary Chef' },
    { value: 'chef', label: 'Chef', emoji: '👨‍🍳', description: 'Master of Cuisine' },
  ]), []);

  const selectedTitleData = useMemo(
    () => royalTitles.find(t => t.value === selectedTitle),
    [royalTitles, selectedTitle]
  );

  // Init captcha
  useEffect(() => {
    setCaptchaA(Math.floor(Math.random() * 8) + 1);
    setCaptchaB(Math.floor(Math.random() * 8) + 1);
  }, []);

  // Close title dropdown on outside click or Esc
  useEffect(() => {
    if (!showTitleDropdown) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(t) &&
        titleBtnRef.current && !titleBtnRef.current.contains(t)
      ) {
        setShowTitleDropdown(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowTitleDropdown(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showTitleDropdown]);

  // Auto-build username base from first+last; keep manual edits
  const [userEditedUsername, setUserEditedUsername] = useState(false);
  useEffect(() => {
    if (userEditedUsername) return;
    const base = slugify(`${firstName} ${lastName}`.trim());
    if (!base) return;
    // attach title suffix if selected
    const suffix = selectedTitle ? TITLE_SUFFIX_MAP[selectedTitle] ?? selectedTitle : '';
    setUsername(suffix ? `${base}-${suffix}` : base);
  }, [firstName, lastName, selectedTitle, userEditedUsername]);

  // When title changes explicitly, append suffix to current username (once)
  useEffect(() => {
    if (!selectedTitle || !username) return;
    const suffix = TITLE_SUFFIX_MAP[selectedTitle] ?? selectedTitle;
    // If already has suffix, don't duplicate
    if (!username.endsWith(`-${suffix}`)) {
      setUsername(prev => {
        // If prev already ends with any known title suffix, replace; else append
        const hasAnySuffix = Object.values(TITLE_SUFFIX_MAP).some(s => prev.endsWith(`-${s}`));
        if (hasAnySuffix) {
          return prev.replace(/-([a-z0-9]+)$/, `-${suffix}`);
        }
        return `${prev}-${suffix}`;
      });
    }
  }, [selectedTitle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Basic validators
  const isEmailValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);
  const isPhoneValid = useMemo(() => {
    // Very permissive; normalize digits count between 10 and 15
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }, [phone]);

  const passwordScore = useMemo(() => {
    const p = password || '';
    let s = 0;
    if (p.length >= 6) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  }, [password]);

  const passwordStrength = useMemo(() => {
    if (passwordScore === 0) return { text: 'None', color: 'text-red-400' };
    if (passwordScore <= 2) return { text: 'Weak', color: 'text-red-400' };
    if (passwordScore === 3) return { text: 'Fair', color: 'text-yellow-400' };
    if (passwordScore === 4) return { text: 'Good', color: 'text-green-400' };
    return { text: 'Strong', color: 'text-green-500' };
  }, [passwordScore]);

  // --- Handlers ---
  const handleSendEmailLink = async () => {
    // Placeholder: call backend or mock
    await new Promise(r => setTimeout(r, 500));
    setEmailLinkSent(true);
  };

  const handleSendOtp = async () => {
    if (!isPhoneValid) {
      setErrors(e => ({ ...e, phone: 'Invalid phone number' }));
      return;
    }
    setErrors(e => ({ ...e, phone: '' }));
    // Placeholder
    await new Promise(r => setTimeout(r, 500));
    setOtpSent(true);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setErrors(e => ({ ...e, verify: 'Code must be 6 digits' }));
      return;
    }
    // Placeholder
    await new Promise(r => setTimeout(r, 500));
    setOtpVerified(true);
    setErrors(e => ({ ...e, verify: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset errors
    setErrors({
      firstName: '', lastName: '', username: '', email: '', password: '',
      title: '', phone: '', captcha: '', verify: ''
    });

    // Validate
    const newErrors: Errors = {
      firstName: '', lastName: '', username: '', email: '', password: '',
      title: '', phone: '', captcha: '', verify: ''
    };

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!username.trim()) newErrors.username = 'Username is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!isEmailValid) newErrors.email = 'Email is not valid';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    if (verifyMethod === 'email' && !emailLinkSent) {
      newErrors.verify = 'Please send and verify your email';
    } else if (verifyMethod === 'sms') {
      if (!phone.trim()) {
        newErrors.phone = 'Phone number is required for SMS verification';
      } else if (!isPhoneValid) {
        newErrors.phone = 'Invalid phone number';
      }
      if (!otpVerified) {
        newErrors.verify = 'Please verify your phone';
      }
    }

    // Captcha
    const sum = captchaA + captchaB;
    if (!captchaAnswer.trim() || parseInt(captchaAnswer, 10) !== sum) {
      newErrors.captcha = 'Incorrect answer. Try again.';
    }

    if (!agree) {
      alert('You must agree to the Royal Charter to proceed.');
      return;
    }

    // Show errors if any
    if (Object.values(newErrors).some(x => x !== '')) {
      setErrors(newErrors);
      return;
    }

    // --- All good, attempt signup ---
    setLoading(true);
    try {
      await signup({
        name: `${firstName} ${lastName}`,
        email,
        password,
        username,
        selectedTitle,
      });
      // Redirect to verify email page
      setLocation('/verify-email');
    } catch (err: any) {
      alert(`Signup failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-red-800 to-orange-600 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-yellow-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-green-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-75" />
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-150" />
      </div>

      {/* Floating icons */}
      <div className="absolute inset-0 pointer-events-none">
        <Crown className="absolute top-10 left-10 w-8 h-8 text-yellow-300 opacity-30 animate-bounce animation-delay-100" />
        <Shield className="absolute top-32 right-16 w-6 h-6 text-yellow-200 opacity-25 animate-bounce animation-delay-200" />
        <Sparkles className="absolute bottom-20 left-20 w-5 h-5 text-orange-300 opacity-30 animate-pulse animation-delay-300" />
        <Castle className="absolute bottom-40 right-32 w-10 h-10 text-purple-300 opacity-20 animate-bounce animation-delay-400" />
        <Gem className="absolute top-1/2 left-12 w-4 h-4 text-pink-300 opacity-25 animate-pulse animation-delay-500" />
      </div>

      {/* Main Card */}
      <div className="max-w-2xl mx-auto relative z-10">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 sm:p-10 border border-yellow-300/30">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4 shadow-lg">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-orange-200 to-yellow-300 mb-2">
              Join the Royal Court
            </h2>
            <p className="text-yellow-100 text-lg">
              Claim your title and enter the culinary kingdom
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title Selector */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-yellow-100 mb-2">
                Royal Title (Optional)
              </label>
              <div className="relative" ref={dropdownRef}>
                <button
                  ref={titleBtnRef}
                  type="button"
                  onClick={() => setShowTitleDropdown(!showTitleDropdown)}
                  className="relative w-full flex items-center justify-between px-4 py-3 bg-white/20 border border-yellow-300/50 rounded-2xl text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent hover:bg-white/25 transition"
                >
                  {selectedTitleData ? (
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{selectedTitleData.emoji}</span>
                      <div className="text-left">
                        <div className="font-semibold">{selectedTitleData.label}</div>
                        <div className="text-xs text-yellow-200 opacity-80">{selectedTitleData.description}</div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-yellow-200">Choose your royal title...</span>
                  )}
                  <ChevronDown className={`w-5 h-5 transition-transform ${showTitleDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showTitleDropdown && (
                  <div className="absolute z-50 mt-2 w-full bg-white/95 backdrop-blur-lg border border-yellow-300/50 rounded-2xl shadow-2xl max-h-80 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => { setSelectedTitle(''); setShowTitleDropdown(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-purple-100 transition text-gray-700 border-b border-gray-200"
                    >
                      <span className="text-gray-500">No Title</span>
                    </button>
                    {royalTitles.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => { setSelectedTitle(t.value); setShowTitleDropdown(false); }}
                        className={`w-full text-left px-4 py-3 hover:bg-purple-100 transition border-b border-gray-100 last:border-0 ${
                          selectedTitle === t.value ? 'bg-purple-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{t.emoji}</span>
                          <div>
                            <div className="font-semibold text-gray-800">{t.label}</div>
                            <div className="text-xs text-gray-600">{t.description}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.title && <p className="mt-2 text-sm text-red-300">{errors.title}</p>}
              <p className="mt-1 text-xs text-yellow-200">Choose a royal title to be displayed alongside your name</p>
            </div>

            {/* First + Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-yellow-100 mb-2">
                  First Name *
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                    errors.firstName ? 'border-red-400' : 'border-yellow-300/50'
                  }`}
                  placeholder="Arthur"
                />
                {errors.firstName && <p className="mt-2 text-sm text-red-300">{errors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-yellow-100 mb-2">
                  Last Name *
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={`w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                    errors.lastName ? 'border-red-400' : 'border-yellow-300/50'
                  }`}
                  placeholder="Pendragon"
                />
                {errors.lastName && <p className="mt-2 text-sm text-red-300">{errors.lastName}</p>}
              </div>
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-yellow-100 mb-2">
                Username *
              </label>
              <input
                id="username"
                name="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setUserEditedUsername(true); }}
                className={`w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                  errors.username ? 'border-red-400' : 'border-yellow-300/50'
                }`}
                placeholder="arthur-king"
              />
              {errors.username && <p className="mt-2 text-sm text-red-300">{errors.username}</p>}
              <p className="mt-1 text-xs text-yellow-200">
                Auto-generated from your name & title. You may edit it freely.
              </p>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-yellow-100 mb-2">
                Email Address *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                  errors.email ? 'border-red-400' : 'border-yellow-300/50'
                }`}
                placeholder="king@camelot.com"
              />
              {errors.email && <p className="mt-2 text-sm text-red-300">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-yellow-100 mb-2">
                Password *
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent pr-12 ${
                    errors.password ? 'border-red-400' : 'border-yellow-300/50'
                  }`}
                  placeholder="Enter your secret code"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-300 hover:text-yellow-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-2 text-sm text-red-300">{errors.password}</p>}
              {password && (
                <p className={`mt-1 text-xs ${passwordStrength.color}`}>
                  Strength: {passwordStrength.text}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-yellow-100 mb-2">
                Phone Number {verifyMethod === 'sms' ? '*' : '(Optional)'}
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                  errors.phone ? 'border-red-400' : 'border-yellow-300/50'
                }`}
                placeholder="+1 (555) 123-4567"
              />
              {errors.phone && <p className="mt-2 text-sm text-red-300">{errors.phone}</p>}
              <p className="mt-1 text-xs text-yellow-200">
                Required for SMS verification; optional for email verification
              </p>
            </div>

            {/* Verification Method */}
            <div className="p-4 bg-white/10 rounded-2xl border border-yellow-300/30">
              <label className="block text-sm font-medium text-yellow-100 mb-3">
                Verification Method *
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-yellow-100">
                  <input
                    type="radio"
                    name="verifyMethod"
                    value="email"
                    checked={verifyMethod === 'email'}
                    onChange={() => setVerifyMethod('email')}
                  />
                  <Mail className="w-4 h-4" /> Verify by Email Link
                </label>
                <label className="flex items-center gap-2 text-yellow-100">
                  <input
                    type="radio"
                    name="verifyMethod"
                    value="sms"
                    checked={verifyMethod === 'sms'}
                    onChange={() => setVerifyMethod('sms')}
                  />
                  <Phone className="w-4 h-4" /> Verify by SMS (OTP)
                </label>
              </div>

              {/* Email link flow */}
              {verifyMethod === 'email' && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSendEmailLink}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-400 text-purple-900 font-semibold hover:bg-yellow-300 transition"
                  >
                    <Mail className="w-4 h-4" /> Send Verification Link
                  </button>
                  {emailLinkSent ? (
                    <span className="inline-flex items-center gap-1 text-green-300 text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Link sent! Check your inbox.
                    </span>
                  ) : (
                    <span className="text-yellow-200 text-sm">You'll receive a clickable link.</span>
                  )}
                </div>
              )}

              {/* SMS OTP flow */}
              {verifyMethod === 'sms' && (
                <div className="mt-3 space-y-3">
                  {!otpSent ? (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-400 text-purple-900 font-semibold hover:bg-yellow-300 transition"
                    >
                      <Phone className="w-4 h-4" /> Send Code
                    </button>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                      <div className="flex-1">
                        <label className="block text-xs text-yellow-200 mb-1">Enter 6-digit code</label>
                        <input
                          inputMode="numeric"
                          pattern="\d*"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-4 py-3 bg-white/20 border border-yellow-300/50 rounded-2xl text-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                          placeholder="123456"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-400 text-purple-900 font-semibold hover:bg-yellow-300 transition"
                        >
                          Verify
                        </button>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 text-yellow-100 border border-yellow-300/30 font-semibold hover:bg-white/10 transition"
                        >
                          Resend
                        </button>
                      </div>
                    </div>
                  )}
                  {otpVerified && (
                    <span className="inline-flex items-center gap-1 text-green-300 text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Phone verified
                    </span>
                  )}
                  {!otpVerified && errors.verify && (
                    <span className="inline-flex items-center gap-1 text-red-300 text-sm">
                      <XCircle className="w-4 h-4" /> {errors.verify}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* CAPTCHA */}
            <div>
              <label htmlFor="captcha" className="block text-sm font-medium text-yellow-100 mb-2">
                Royal Riddle (CAPTCHA) *
              </label>
              <div className="flex items-center gap-3">
                <div className="px-3 py-2 rounded-xl bg-white/20 text-yellow-100 border border-yellow-300/50">
                  What is <span className="font-semibold">{captchaA}</span> + <span className="font-semibold">{captchaB}</span>?
                </div>
                <input
                  id="captcha"
                  name="captcha"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  className={`flex-1 px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                    errors.captcha ? 'border-red-400' : 'border-yellow-300/50'
                  }`}
                  placeholder="Answer"
                  aria-describedby="captcha-help"
                />
              </div>
              <p id="captcha-help" className="mt-1 text-xs text-yellow-200">Prove you are not a mischievous kitchen goblin.</p>
              {errors.captcha && <p className="mt-2 text-sm text-red-300">{errors.captcha}</p>}
            </div>

            {/* Charter Agreement */}
            <div className="flex items-start space-x-3 bg-white/10 rounded-2xl p-4 border border-yellow-300/30">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="h-5 w-5 text-yellow-500 focus:ring-yellow-400 border-yellow-300 rounded mt-1"
              />
              <label htmlFor="terms" className="text-yellow-100 text-sm">
                I swear allegiance to the Royal Charter and agree to the{' '}
                <a href="/terms" className="text-yellow-300 hover:text-yellow-200 underline">Royal Decree</a> and{' '}
                <a href="/privacy" className="text-yellow-300 hover:text-yellow-200 underline">Kingdom Privacy</a>
              </label>
            </div>

            {/* Submit */}
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
