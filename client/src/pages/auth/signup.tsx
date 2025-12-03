// client/src/pages/auth/signup.tsx
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Crown, ChevronDown, Sparkles, Castle, Shield, Gem,
  Eye, EyeOff, Phone, Mail, CheckCircle2, XCircle,
  Mail as MailIcon, // Renamed to avoid conflict with email field
} from 'lucide-react';

// Import social icons (you'll need to install these or use SVGs/images)
// For example, using react-icons: npm install react-icons
import { FcGoogle } from 'react-icons/fc';
import { FaTiktok, FaInstagram, FaFacebook } from 'react-icons/fa';


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
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(false);

  // Account type and business fields
  const [accountType, setAccountType] = useState<AccountType>('personal');
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');

  // Profile picture
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);

  // Title dropdown
  const [showTitleDropdown, setShowTitleDropdown] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState('');
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

  // --- NEW: Handle social signup data from URL query params ---
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const socialFirstName = query.get('firstName');
    const socialLastName = query.get('lastName');
    const socialEmail = query.get('email');
    const socialUsername = query.get('username');
    const socialAvatar = query.get('avatar');
    const socialProvider = query.get('provider'); // e.g., 'google', 'tiktok'

    if (socialProvider) {
      if (socialFirstName && !firstName) setFirstName(socialFirstName);
      if (socialLastName && !lastName) setLastName(socialLastName);
      if (socialEmail && !email) setEmail(socialEmail); // Prefill email, but let user change if they want
      if (socialUsername && !username) setUsername(socialUsername);
      if (socialAvatar && !profilePicturePreview) setProfilePicturePreview(socialAvatar);
      // For now, we'll let them set a password, but you might want to auto-generate or skip it
      // if they are *only* social and you handle password resets later.

      // Optionally, remove the query parameters from the URL after processing
      // This prevents issues if the user navigates back and forth
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [firstName, lastName, email, username, profilePicturePreview]);


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

  // Handle profile picture change
  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- API helpers ---
  async function apiSignup() {
    const formData = new FormData();
    formData.append('firstName', firstName.trim());
    formData.append('lastName', lastName.trim());
    formData.append('username', slugify(username.trim()));
    formData.append('email', email.trim());
    formData.append('password', password);
    if (selectedTitle) formData.append('selectedTitle', selectedTitle);
    if (phone) formData.append('phone', phone);
    formData.append('accountType', accountType);
    if (accountType === 'business') {
      formData.append('businessName', businessName.trim());
      formData.append('businessCategory', businessCategory.trim());
    }
    if (profilePicture) {
      formData.append('avatar', profilePicture);
    } else if (profilePicturePreview && !profilePicturePreview.startsWith('data:')) {
      // If profilePicturePreview exists and is a URL (from social media), send it to the backend
      // The backend will then fetch and save this avatar.
      formData.append('avatarUrl', profilePicturePreview);
    }


    const res = await fetch("/api/auth/signup", {
      method: "POST",
      body: formData, // Send as FormData instead of JSON
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
    // This button is just visual here; the real email is sent by the server on signup.
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

      // Redirect to the verify page; backend already sent an email
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

          {/* Social Signup Section */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-yellow-100 mb-4 text-center">
              Or, Sign Up with Social Media
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <a
                href="/api/auth/google" // Your backend Google OAuth initiation route
                className="flex items-center justify-center w-full px-4 py-3 border border-yellow-300/50 rounded-2xl shadow-sm text-sm font-medium text-yellow-100 bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-purple-900"
              >
                <FcGoogle className="h-5 w-5 mr-2" />
                Google
              </a>
              <a
                href="/api/auth/facebook" // Backend Facebook OAuth initiation route (you'll need to create this)
                className="flex items-center justify-center w-full px-4 py-3 border border-yellow-300/50 rounded-2xl shadow-sm text-sm font-medium text-yellow-100 bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-purple-900"
              >
                <FaFacebook className="h-5 w-5 mr-2 text-blue-500" />
                Facebook
              </a>
              <a
                href="/api/auth/instagram" // Backend Instagram OAuth initiation route (you'll need to create this)
                className="flex items-center justify-center w-full px-4 py-3 border border-yellow-300/50 rounded-2xl shadow-sm text-sm font-medium text-yellow-100 bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-purple-900"
              >
                <FaInstagram className="h-5 w-5 mr-2 text-pink-500" />
                Instagram
              </a>
              <a
                href="/api/auth/tiktok" // Backend TikTok OAuth initiation route (you'll need to create this)
                className="flex items-center justify-center w-full px-4 py-3 border border-yellow-300/50 rounded-2xl shadow-sm text-sm font-medium text-yellow-100 bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-purple-900"
              >
                <FaTiktok className="h-5 w-5 mr-2" />
                TikTok
              </a>
            </div>
            <div className="relative flex justify-center text-sm my-8">
              <span className="px-2 bg-gradient-to-br from-purple-900 via-red-800 to-orange-600 text-yellow-200">
                Or continue with email
              </span>
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-yellow-300/30" />
              </div>
            </div>
          </div>

          {/* FORM starts */}
          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
            {/* Autofill sinks (absorb any saved creds so visible fields stay empty) */}
            <input
              type="text"
              name="fake-user"
              autoComplete="username"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
            />
            <input
              type="password"
              name="fake-pass"
              autoComplete="current-password"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
            />

            {/* Title Selector (optional) */}
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

            {/* Profile Picture Upload */}
            <div>
              <label htmlFor="profilePicture" className="block text-sm font-medium text-yellow-100 mb-2">
                Profile Picture (Optional)
              </label>
              <div className="flex items-center gap-4">
                {profilePicturePreview && (
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-yellow-400 shadow-lg">
                    <img
                      src={profilePicturePreview}
                      alt="Profile Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    id="profilePicture"
                    name="profilePicture"
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="profilePicture"
                    className="inline-flex items-center px-4 py-3 bg-white/20 border border-yellow-300/50 rounded-2xl text-yellow-100 hover:bg-white/25 transition cursor-pointer"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M
