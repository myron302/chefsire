import { useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@/contexts/UserContext";
import { Crown, Castle, Shield, AlertCircle } from "lucide-react";
import { FcGoogle } from 'react-icons/fc';
import { FaFacebook, FaInstagram, FaTiktok } from 'react-icons/fa';

export default function LoginPage() {
  const [errors, setErrors] = useState({ email: "", password: "", general: "" });
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { login } = useUser();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    setErrors({ email: "", password: "", general: "" });

    let ok = true;
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      ok = false;
      setErrors((prev) => ({ ...prev, email: "Please enter a valid royal decree address." }));
    }
    if (!password || password.length < 6) {
      ok = false;
      setErrors((prev) => ({ ...prev, password: "Royal seal must be at least 6 characters." }));
    }
    if (!ok) return;

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.ok) {
      // Surface server message (e.g., “Please verify your email to log in.”)
      setErrors((prev) => ({ ...prev, general: result.error || "Login failed" }));
      return;
    }

    alert("Welcome back to your kingdom!");
    setLocation("/feed");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-800 to-indigo-600 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-75"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-150"></div>
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

          {/* General Error Message */}
          {errors.general && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-400 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0" />
              <span className="text-red-200 text-sm">{errors.general}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
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
                    required
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
                    required
                    minLength={6}
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

          {/* OAuth Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-blue-300/30"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white/10 text-blue-200">Or continue with</span>
            </div>
          </div>

          {/* Social OAuth Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href="/api/auth/google"
              className="flex justify-center items-center gap-2 py-3 px-4 bg-white text-gray-700 rounded-2xl font-semibold hover:bg-gray-100 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <FcGoogle className="w-5 h-5" />
              <span className="hidden sm:inline">Google</span>
            </a>
            <a
              href="/api/auth/facebook"
              className="flex justify-center items-center gap-2 py-3 px-4 bg-white text-gray-700 rounded-2xl font-semibold hover:bg-gray-100 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <FaFacebook className="w-5 h-5 text-blue-600" />
              <span className="hidden sm:inline">Facebook</span>
            </a>
            <a
              href="/api/auth/instagram"
              className="flex justify-center items-center gap-2 py-3 px-4 bg-white text-gray-700 rounded-2xl font-semibold hover:bg-gray-100 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <FaInstagram className="w-5 h-5 text-pink-600" />
              <span className="hidden sm:inline">Instagram</span>
            </a>
            <a
              href="/api/auth/tiktok"
              className="flex justify-center items-center gap-2 py-3 px-4 bg-white text-gray-700 rounded-2xl font-semibold hover:bg-gray-100 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <FaTiktok className="w-5 h-5" />
              <span className="hidden sm:inline">TikTok</span>
            </a>
          </div>

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
    </div>
  );
}
