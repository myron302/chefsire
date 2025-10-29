// client/src/pages/auth/signup.tsx
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
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
  businessName: string;
  businessCategory: string;
};

type AccountType = 'personal' | 'business';
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
    .slice(0, 32);
}

export default function SignupPage() {
  const [, setLocation] = useLocation();

  // Core state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({
    firstName: '', lastName: '', username: '', email: '', password: '',
    title: '', phone: '', captcha: '', verify: '', businessName: '', businessCategory: ''
  });

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [username, setUsername]   = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [phone, setPhone]         = useState('');
  const [agree, setAgree]         = useState(false);

  // Account type and business fields
  const [accountType, setAccountType] = useState<AccountType>('personal');
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');

  // Title dropdown
  const [showTitleDropdown, setShowTitleDropdown] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState(''); // '' = no title; user can only clear by choosing "No Title"
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const titleBtnRef = useRef<HTMLButtonElement | null>(null);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Verification UI helpers (email option visible; SMS is UI-only here)
  const [verifyMethod, setVerifyMethod] = useState<VerifyMethod>('email');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [emailLinkSent, setEmailLinkSent] = useState(false);

  // CAPTCHA (lightweight math)
  const [captchaA, setCaptchaA] = useState(0);
  const [captchaB, setCaptchaB] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  // Royal Titles
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

  // Build a default username from first+last only (NO title suffix/hyphen)
  const [userEditedUsername, setUserEditedUsername] = useState(false);
  useEffect(() => {
    if (userEditedUsername) return;
    const base = `${firstName} ${lastName}`.trim();
    if (!base) return;
    setUsername(slugify(base)); // strictly slugified name — no title, no hyphen
  }, [firstName, lastName, userEditedUsername]);

  // Basic validators
  const isEmailValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);
  const isPhoneValid = useMemo(() => {
    const digits = (phone || '').replace(/\D/g, '');
    return digits.length === 0 || (digits.length >= 10 && digits.length <= 15);
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

  // --- API helpers ---
  async function apiSignup() {
    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: slugify(username.trim()), // never includes title
      email: email.trim(),
      password,
      // Title is stored separately; not appended to username.
      // Send both keys for backwards compatibility with your API.
      selectedTitle: selectedTitle || null,
      title: selectedTitle || null,
      phone,
      accountType,
      businessName: accountType === 'business' ? businessName.trim() : undefined,
      businessCategory: accountType === 'business' ? businessCategory.trim() : undefined,
    };

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Backend returns JSON with ok/message or error
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // bubble server message if present
      throw new Error(data?.error || "Signup failed");
    }
    return data;
  }

  // --- Handlers (UI-only for SMS/email buttons shown on the form) ---
  const handleSendEmailLink = async () => {
    await new Promise(r => setTimeout(r, 350));
    setEmailLinkSent(true);
  };

  const handleSendOtp = async () => {
    if (!isPhoneValid) {
      setErrors(e => ({ ...e, phone: 'Invalid phone number' }));
      return;
    }
    setErrors(e => ({ ...e, phone: '' }));
    await new Promise(r => setTimeout(r, 350));
    setOtpSent(true);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setErrors(e => ({ ...e, verify: 'Code must be 6 digits' }));
      return;
    }
    await new Promise(r => setTimeout(r, 350));
    setOtpVerified(true);
    setErrors(e => ({ ...e, verify: '' }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    // Reset errors
    setErrors({
      firstName: '', lastName: '', username: '', email: '', password: '',
      title: '', phone: '', captcha: '', verify: '', businessName: '', businessCategory: ''
    });

    // Validate
    const newErrors: Errors = {
      firstName: '', lastName: '', username: '', email: '', password: '',
      title: '', phone: '', captcha: '', verify: '', businessName: '', businessCategory: ''
    };

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!username.trim()) newErrors.username = 'Username is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    else if (!isEmailValid) newErrors.email = 'Email is not valid';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    if (!isPhoneValid) newErrors.phone = 'Enter a valid phone number or leave it blank';

    if (accountType === 'business') {
      if (!businessName.trim()) newErrors.businessName = 'Business name is required';
      if (!businessCategory.trim()) newErrors.businessCategory = 'Business category is required';
    }

    const sum = captchaA + captchaB;
    if (!captchaAnswer.trim() || parseInt(captchaAnswer, 10) !== sum) {
      newErrors.captcha = 'Incorrect answer. Try again.';
    }

    if (!agree) {
      alert('You must agree to the Royal Charter to proceed.');
      return;
    }

    if (Object.values(newErrors).some(x => x !== '')) {
      setErrors(newErrors);
      return;
    }

    // Submit to backend (no auto-login; email verification required)
    setLoading(true);
    try {
      const result = await apiSignup();

      // Store email so /verify-email page can offer "Resend"
      sessionStorage.setItem('pendingVerificationEmail', email.trim());

      // Optional: clear sensitive fields to be extra safe before leaving
      setPassword('');
      setPhone('');

      // Redirect to the verify page
      setLocation('/verify-email');
    } catch (err: any) {
      alert(err?.message || 'Signup failed. Please try again.');
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

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
            {/* AUTOFILL MITIGATION: decoy fields to absorb browser-saved creds */}
            <div className="sr-only" aria-hidden="true">
              <input type="text" name="username" autoComplete="username" tabIndex={-1} />
              <input type="email" name="email" autoComplete="email" tabIndex={-1} />
              <input type="password" name="password" autoComplete="current-password" tabIndex={-1} />
            </div>

            {/* Title Selector (optional, but cannot be erased unless 'No Title' is picked) */}
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

            {/* Account Type Selector */}
            <div className="p-4 bg-white/10 rounded-2xl border border-yellow-300/30">
              <label className="block text-sm font-medium text-yellow-100 mb-3">
                Account Type *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setAccountType('personal')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    accountType === 'personal'
                      ? 'border-yellow-400 bg-yellow-400/20'
                      : 'border-yellow-300/30 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2">👤</div>
                    <div className="font-semibold text-yellow-100">Personal</div>
                    <div className="text-xs text-yellow-200 mt-1">For individual chefs</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('business')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    accountType === 'business'
                      ? 'border-yellow-400 bg-yellow-400/20'
                      : 'border-yellow-300/30 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2">🏢</div>
                    <div className="font-semibold text-yellow-100">Business</div>
                    <div className="text-xs text-yellow-200 mt-1">For restaurants & stores</div>
                  </div>
                </button>
              </div>

              {accountType === 'business' && (
                <div className="mt-4 p-3 bg-green-500/20 border border-green-400/30 rounded-xl">
                  <div className="text-sm font-semibold text-green-100 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Business Account Benefits
                  </div>
                  <ul className="text-xs text-green-100 space-y-1">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>Create and manage your online store</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>List products and accept payments</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>Professional business profile</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>Advanced analytics and insights</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>Priority customer support</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Business Fields (conditional) */}
            {accountType === 'business' && (
              <div className="space-y-6 p-4 bg-white/10 rounded-2xl border border-yellow-300/30">
                <h3 className="text-sm font-semibold text-yellow-100 flex items-center gap-2">
                  <Castle className="w-4 h-4" />
                  Business Information
                </h3>

                <div>
                  <label htmlFor="businessName" className="block text-sm font-medium text-yellow-100 mb-2">
                    Business Name *
                  </label>
                  <input
                    id="businessName"
                    name="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className={`w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                      errors.businessName ? 'border-red-400' : 'border-yellow-300/50'
                    }`}
                    placeholder="Royal Kitchen Co."
                    autoComplete="organization"
                  />
                  {errors.businessName && <p className="mt-2 text-sm text-red-300">{errors.businessName}</p>}
                </div>

                <div>
                  <label htmlFor="businessCategory" className="block text-sm font-medium text-yellow-100 mb-2">
                    Business Category *
                  </label>
                  <select
                    id="businessCategory"
                    name="businessCategory"
                    value={businessCategory}
                    onChange={(e) => setBusinessCategory(e.target.value)}
                    className={`w-full px-4 py-3 bg-white/20 border rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                      errors.businessCategory ? 'border-red-400' : 'border-yellow-300/50'
                    }`}
                  >
                    <option value="" className="bg-purple-900">Select a category...</option>
                    <option value="restaurant" className="bg-purple-900">Restaurant</option>
                    <option value="cafe" className="bg-purple-900">Café</option>
                    <option value="bakery" className="bg-purple-900">Bakery</option>
                    <option value="catering" className="bg-purple-900">Catering Service</option>
                    <option value="food-truck" className="bg-purple-900">Food Truck</option>
                    <option value="grocery" className="bg-purple-900">Grocery Store</option>
                    <option value="specialty" className="bg-purple-900">Specialty Food Shop</option>
                    <option value="meal-prep" className="bg-purple-900">Meal Prep Service</option>
                    <option value="other" className="bg-purple-900">Other</option>
                  </select>
                  {errors.businessCategory && <p className="mt-2 text-sm text-red-300">{errors.businessCategory}</p>}
                </div>
              </div>
            )}

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
                  autoComplete="given-name"
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
                  autoComplete="family-name"
                />
                {errors.lastName && <p className="mt-2 text-sm text-red-300">{errors.lastName}</p>}
              </div>
            </div>

            {/* Username (no auto suffix, no hyphen from title) */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-yellow-100 mb-2">
                Username *
              </label>
              <input
                id="username"
                name="handle"                     // changed to avoid autofill reuse
                value={username}
                onChange={(e) => { setUsername(e.target.value); setUserEditedUsername(true); }}
                className={`w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                  errors.username ? 'border-red-400' : 'border-yellow-300/50'
                }`}
                placeholder="arthur-pendragon"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
              />
              {errors.username && <p className="mt-2 text-sm text-red-300">{errors.username}</p>}
              <p className="mt-1 text-xs text-yellow-200">
                We’ll use exactly what you type here (just cleaned to a URL-safe handle).
              </p>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-yellow-100 mb-2">
                Email Address *
              </label>
              <input
                id="email"
                name="contactEmail"              // changed to dodge saved autofill
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                  errors.email ? 'border-red-400' : 'border-yellow-300/50'
                }`}
                placeholder="king@camelot.com"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
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
                  name="newPassword"             // changed + 'new-password' to block reuse
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent pr-12 ${
                    errors.password ? 'border-red-400' : 'border-yellow-300/50'
                  }`}
                  placeholder="Enter your secret code"
                  autoComplete="new-password"
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
                autoComplete="tel"
              />
              {errors.phone && <p className="mt-2 text-sm text-red-300">{errors.phone}</p>}
              <p className="mt-1 text-xs text-yellow-200">
                Required for SMS verification; optional for email verification
              </p>
            </div>

            {/* Verification Method (UI only) */}
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

              {/* Email link flow (visual only; real mail is sent server-side on submit) */}
              {verifyMethod === 'email' && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSendEmailLink}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-400 text-purple-900 font-semibold hover:bg-yellow-300 transition"
                  >
                    <Mail className="w-4 h-4" /> Send Test Link
                  </button>
                  {emailLinkSent ? (
                    <span className="inline-flex items-center gap-1 text-green-300 text-sm">
                      <CheckCircle2 className="w-4 h-4" /> (UI test) Link prepared.
                    </span>
                  ) : (
                    <span className="text-yellow-200 text-sm">Actual link comes after you submit the form.</span>
                  )}
                </div>
              )}

              {/* SMS OTP flow (visual only) */}
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
                          autoComplete="one-time-code"
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
                  autoComplete="off"
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
