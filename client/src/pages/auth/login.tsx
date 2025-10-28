import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Crown, Castle, Shield, AlertCircle, X, Mail } from "lucide-react";

/**
 * LoginPage
 * - Calls POST /api/auth/login (server decides everything)
 * - On 403 (email not verified), shows a banner with "Resend verification"
 * - Resend calls POST /api/auth/resend-verification and opens a success modal
 * - No localStorage-based auth logic anywhere
 */
export default function LoginPage() {
  const [, setLocation] = useLocation();

  // form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // UI/state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resentLoading, setResentLoading] = useState(false);

  // success modal
  const [showSentModal, setShowSentModal] = useState(false);
  const [sentTo, setSentTo] = useState("");

  // If you came from /verify/success or after signup, we may have stashed the email
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingVerificationEmail");
    if (pending) setEmail(pending);
  }, []);

  const emailValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setNeedsVerification(false);

    const next: typeof errors = {};
    if (!emailValid) next.email = "Please enter a valid email address.";
    if (!password || password.length < 6) next.password = "Password must be at least 6 characters.";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.status === 403) {
        // Unverified email
        setNeedsVerification(true);
        setErrors({ general: "Please verify your email before logging in." });
      } else if (res.status === 401) {
        setErrors({ general: "Invalid email or password." });
      } else if (!res.ok) {
        let msg = "Login failed. Please try again.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        setErrors({ general: msg });
      } else {
        // success — server sets the session cookie
        setLocation("/feed");
      }
    } catch {
      setErrors({ general: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!emailValid) {
      setErrors({ email: "Enter a valid email to resend the verification link." });
      return;
    }
    setResentLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        let msg = "Failed to resend verification email. Please try again later.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        setErrors({ general: msg });
        return;
      }

      // success
      setSentTo(email.trim());
      sessionStorage.setItem("pendingVerificationEmail", email.trim());
      setShowSentModal(true);
    } catch {
      setErrors({ general: "Network error while resending verification. Please try again." });
    } finally {
      setResentLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-800 to-indigo-600 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-75" />
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-150" />
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Royal Header */}
        <div className="text-center">
          <div className="flex justify-center items-center mb-4">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-blue-300">
                <Crown className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>

          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent mb-2">
            ChefSire
          </h1>
          <p className="text-blue-100 text-lg">Return to Your Culinary Kingdom</p>
        </div>

        {/* Royal Login Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Enter Your Castle</h2>
            <p className="text-blue-100">Welcome back, your highness</p>
          </div>

          {/* Verification needed bar */}
          {needsVerification && (
            <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-400 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-yellow-100 text-sm">
                <AlertCircle className="w-5 h-5 text-yellow-300" />
                Please verify your email to continue.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resentLoading}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-400 text-indigo-900 font-semibold hover:bg-yellow-300 transition"
                >
                  <Mail className="w-4 h-4" />
                  {resentLoading ? "Sending..." : "Resend verification"}
                </button>
              </div>
            </div>
          )}

          {/* General Error Message */}
          {errors.general && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-400 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0" />
              <span className="text-red-200 text-sm">{errors.general}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              {/* Royal Decree (Email) Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-blue-100 mb-2">
                  Royal Decree Address *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className={`block w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-blue-200 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent ${
                      errors.email ? "border-red-400" : "border-blue-300/50"
                    }`}
                    placeholder="your@royalcourt.com"
                  />
                  <Castle className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-300 w-5 h-5" />
                </div>
                {errors.email && <p className="mt-2 text-sm text-red-300">{errors.email}</p>}
              </div>

              {/* Royal Seal (Password) Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-blue-100 mb-2">
                  Royal Seal *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    id="password"
                    name="password"
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className={`block w-full px-4 py-3 bg-white/20 border rounded-2xl placeholder-blue-200 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent ${
                      errors.password ? "border-red-400" : "border-blue-300/50"
                    }`}
                    placeholder="Your royal secret"
                  />
                  <Shield className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-300 w-5 h-5" />
                </div>
                {errors.password && <p className="mt-2 text-sm text-red-300">{errors.password}</p>}
              </div>
            </div>

            {/* Enter Castle Button */}
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center items-center py-4 px-6 border border-transparent text-lg font-bold rounded-2xl text-indigo-900 bg-gradient-to-r from-blue-400 to-indigo-400 hover:from-blue-300 hover:to-indigo-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-indigo-900 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-900 mr-3"></div>
                  Verifying Royal Credentials...
                </>
              ) : (
                <>
                  <Crown className="w-6 h-6 mr-2" />
                  Enter Your Castle
                </>
              )}
            </button>
          </form>

          {/* No Kingdom Yet */}
          <div className="text-center mt-6 pt-6 border-t border-blue-300/30">
            <p className="text-blue-100">
              No kingdom yet?{" "}
              <a href="/signup" className="text-blue-300 hover:text-blue-200 font-semibold underline">
                Claim Your Throne
              </a>
            </p>
          </div>
        </div>

        {/* Royal Footer */}
        <div className="text-center">
          <div className="text-blue-200/70 text-xs">
            <p>© 2024 Royal Culinary Court. Protected by royal guard.</p>
          </div>
        </div>
      </div>

      {/* Modal: verification email sent */}
      {showSentModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2 font-semibold">
                <Mail className="w-5 h-5" />
                Verification Email Sent
              </div>
              <button
                onClick={() => setShowSentModal(false)}
                className="p-1 rounded hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p>
                We’ve sent a verification link to <strong>{sentTo}</strong>. Please check your inbox
                (and spam folder).
              </p>
              <p className="text-sm text-slate-600">
                After verifying, return here and log in with your email and password.
              </p>
            </div>
            <div className="px-5 py-4 border-t flex justify-end">
              <button
                onClick={() => setShowSentModal(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-500"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
