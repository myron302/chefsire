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
    return Math.min(s, 4);
  }, [password]);

  const passwordLabel = ['Very weak', 'Weak', 'Okay', 'Good', 'Strong'][passwordScore] ?? 'Very weak';

  // Mock API helpers (replace with real endpoints if available)
  async function requestSmsCode(phoneNumber: string) {
    // Example: await fetch('/api/auth/request-otp', { method: 'POST', body: JSON.stringify({ phone: phoneNumber }) })
    await new Promise(res => setTimeout(res, 500));
    return { ok: true };
  }
  async function verifySmsCode(phoneNumber: string, code: string) {
    // Example: await fetch('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone: phoneNumber, code }) })
    await new Promise(res => setTimeout(res, 400));
    // Accept 6-digit demo code "123456" in this mock:
    return { ok: code === '123456' };
  }
  async function sendEmailVerification(emailAddr: string) {
    // Example: await fetch('/api/auth/send-email-verification', { method: 'POST', body: JSON.stringify({ email: emailAddr }) })
    await new Promise(res => setTimeout(res, 500));
    return { ok: true };
  }

  const validate = (): boolean => {
    const newErrors: Errors = {
      firstName: '', lastName: '', username: '', email: '', password: '',
      title: '', phone: '', captcha: '', verify: ''
    };
    let ok = true;

    if (!firstName.trim()) { newErrors.firstName = 'Please enter your given royal name.'; ok = false; }
    if (!lastName.trim())  { newErrors.lastName  = 'Please enter your family name.'; ok = false; }

    const uname = slugify(username);
    if (!uname) { newErrors.username = 'Choose a kingdom handle.'; ok = false; }

    if (!isEmailValid) { newErrors.email = 'Enter a valid royal decree address.'; ok = false; }
    if (!password || password.length < 6) { newErrors.password = 'Royal seal must be at least 6 characters.'; ok = false; }
    if (!selectedTitle) { newErrors.title = 'Choose your royal title.'; ok = false; }

    if (verifyMethod === 'sms' && !isPhoneValid) {
      newErrors.phone = 'Enter a valid phone number (include country code if outside US).';
      ok = false;
    }

    const sum = captchaA + captchaB;
    if (String(sum) !== captchaAnswer.trim()) {
      newErrors.captcha = 'Solve the royal riddle correctly.';
      ok = false;
    }

    if (!agree) {
      alert('You must agree to the royal charter.');
      ok = false;
    }

    setErrors(newErrors);
    return ok;
  };

  const handleSendOtp = async () => {
    setErrors(e => ({ ...e, phone: '', verify: '' }));
    if (!isPhoneValid) {
      setErrors(e => ({ ...e, phone: 'Enter a valid phone number first.' }));
      return;
    }
    const r = await requestSmsCode(phone);
    if (r.ok) setOtpSent(true);
  };

  const handleVerifyOtp = async () => {
    setErrors(e => ({ ...e, verify: '' }));
    if (!otpCode || otpCode.length < 4) {
      setErrors(e => ({ ...e, verify: 'Enter the 6-digit code.' }));
      return;
    }
    const r = await verifySmsCode(phone, otpCode);
    if (r.ok) {
      setOtpVerified(true);
    } else {
      setOtpVerified(false);
      setErrors(e => ({ ...e, verify: 'Invalid code. Try 123456 for demo.' }));
    }
  };

  const handleSendEmailLink = async () => {
    setErrors(e => ({ ...e, verify: '' }));
    if (!isEmailValid) {
      setErrors(e => ({ ...e, email: 'Enter a valid email first.' }));
      return;
    }
    const r = await sendEmailVerification(email);
    if (r.ok) setEmailLinkSent(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    if (!validate()) return;

    // If SMS verify chosen, require successful OTP verification before signup
    if (verifyMethod === 'sms' && !otpVerified) {
      setErrors(e => ({ ...e, verify: 'Verify your phone before continuing.' }));
      return;
    }

    setLoading(true);
    try {
      // Build convenience name for legacy signup signature
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

      // Try to pass extra meta if your signup supports it (arity check)
      let success = false;
      const meta = {
        username: slugify(username),
        phone,
        verifyMethod,
        otpVerified,
        emailLinkSent,
        title: selectedTitle,
      };

      try {
        // If signup has >=5 params, call with (name, email, password, title, meta)
        if ((signup as unknown as Function).length >= 5) {
          // @ts-expect-error – accepting extended signature if available
          success = await (signup as any)(fullName, email, password, selectedTitle, meta);
        } else {
          // Fallback to legacy 4-arg signature
          // @ts-expect-error legacy signature
          success = await signup(fullName, email, password, selectedTitle);
        }
      } catch {
        // Fallback in case length probing is unreliable at runtime
        // @ts-expect-error legacy signature
        success = await signup(fullName, email, password, selectedTitle);
      }

      if (success) {
        alert('Your kingdom awaits! Registration successful!');
        setLocation('/feed');
      } else {
        alert('The royal scribes encountered an issue. Please try again!');
      }
    } catch {
      alert('Royal courier unavailable. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-red-800 to-orange-600 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-yellow-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-red-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-75"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-150"></div>

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

      <div className="max-w-xl w-full space-y-8 relative z-10">
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

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* First Name */}
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-yellow-100 mb-2">
                  First Name *
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`block w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                    errors.firstName ? 'border-red-400' : 'border-yellow-300/50'
                  }`}
                  placeholder="Your given name"
                  autoComplete="given-name"
                />
                {errors.firstName && <p className="mt-2 text-sm text-red-300">{errors.firstName}</p>}
              </div>

              {/* Last Name */}
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-yellow-100 mb-2">
                  Last Name *
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={`block w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                    errors.lastName ? 'border-red-400' : 'border-yellow-300/50'
                  }`}
                  placeholder="Your family name"
                  autoComplete="family-name"
                />
                {errors.lastName && <p className="mt-2 text-sm text-red-300">{errors.lastName}</p>}
              </div>
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-yellow-100 mb-2">
                Kingdom Handle (Username) *
              </label>
              <input
                id="username"
                name="username"
                value={username}
                onChange={(e) => { setUserEditedUsername(true); setUsername(slugify(e.target.value)); }}
                className={`block w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                  errors.username ? 'border-red-400' : 'border-yellow-300/50'
                }`}
                placeholder="your-name"
                autoComplete="username"
              />
              <p className="mt-1 text-xs text-yellow-200">
                Your title is auto-appended. Example: <span className="font-semibold">{(username || 'your-name')}-sire</span>
              </p>
              {errors.username && <p className="mt-2 text-sm text-red-300">{errors.username}</p>}
            </div>

            {/* Title Selection */}
            <div>
              <label className="block text-sm font-medium text-yellow-100 mb-2">
                Choose Your Royal Title *
              </label>
              <div className="relative">
                <button
                  ref={titleBtnRef}
                  type="button"
                  onClick={() => setShowTitleDropdown(!showTitleDropdown)}
                  aria-haspopup="listbox"
                  aria-expanded={showTitleDropdown}
                  className={`flex items-center justify-between w-full px-4 py-3 bg-white/20 border rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                    errors.title ? 'border-red-400' : 'border-yellow-300/50'
                  } ${selectedTitle ? 'text-yellow-100' : 'text-yellow-200'}`}
                >
                  <div className="flex items-center space-x-3">
                    {selectedTitle ? (
                      <>
                        <span className="text-xl">{selectedTitleData?.emoji}</span>
                        <div className="text-left">
                          <div className="font-semibold">{selectedTitleData?.label}</div>
                          <div className="text-xs text-yellow-200">{selectedTitleData?.description}</div>
                        </div>
                      </>
                    ) : (
                      <span>Select your royal title...</span>
                    )}
                  </div>
                  <ChevronDown className={`w-5 h-5 text-yellow-300 transition-transform ${showTitleDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showTitleDropdown && (
                  <div ref={dropdownRef} className="absolute z-50 w-full mt-2 bg-purple-900/95 backdrop-blur-lg border border-yellow-300/30 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="max-h-60 overflow-y-auto" role="listbox">
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
                          role="option"
                          aria-selected={selectedTitle === title.value}
                        >
                          <span className="text-xl">{title.emoji}</span>
                          <div className="flex-1">
                            <div className="font-semibold text-white">{title.label}</div>
                            <div className="text-xs text-yellow-200">{title.description}</div>
                          </div>
                          {selectedTitle === title.value && <Crown className="w-4 h-4 text-yellow-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {errors.title && <p className="mt-2 text-sm text-red-300">{errors.title}</p>}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-yellow-100 mb-2">
                Royal Decree Address (Email) *
              </label>
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`block w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                    errors.email ? 'border-red-400' : 'border-yellow-300/50'
                  }`}
                  placeholder="your@royalcourt.com"
                  autoComplete="email"
                />
                <Castle className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-300 w-5 h-5" />
              </div>
              {errors.email && <p className="mt-2 text-sm text-red-300">{errors.email}</p>}
            </div>

            {/* Phone (for SMS verification) */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-yellow-100 mb-2">
                Royal Trumpet (Telephone)
              </label>
              <div className="relative">
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`block w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                    errors.phone ? 'border-red-400' : 'border-yellow-300/50'
                  }`}
                  placeholder="+1 555 555 5555"
                  autoComplete="tel"
                />
                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-300 w-5 h-5" />
              </div>
              {errors.phone && <p className="mt-2 text-sm text-red-300">{errors.phone}</p>}
              <p className="mt-1 text-xs text-yellow-200">Include country code if outside U.S. (e.g., +44, +61).</p>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-yellow-100 mb-2">
                Royal Seal (Password) *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  className={`block w-full px-4 py-3 pr-12 bg-white/20 border rounded-2xl placeholder-yellow-200 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                    errors.password ? 'border-red-400' : 'border-yellow-300/50'
                  }`}
                  placeholder="Your royal secret"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-yellow-300"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(v => !v)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="mt-2 text-sm text-red-300">{errors.password}</p>}
              <div className="mt-2">
                <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                  <div
                    className={`h-2 ${['w-1/5','w-2/5','w-3/5','w-4/5','w-full'][passwordScore]}`}
                    style={{ background: 'linear-gradient(to right,#fde047,#fb923c)' }}
                  />
                </div>
                <p className="text-xs text-yellow-200 mt-1">Strength: {passwordLabel}</p>
              </div>
            </div>

            {/* Verification Method */}
            <div className="bg-white/10 rounded-2xl p-4 border border-yellow-300/30">
              <p className="text-yellow-100 font-medium mb-2">Verify Your Identity *</p>
              <div className="flex flex-col sm:flex-row gap-3">
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
                    <span className="text-yellow-200 text-sm">You’ll receive a clickable link.</span>
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
