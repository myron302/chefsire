// client/src/pages/verify-email.tsx
import { Crown, Mail, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // In a real app, you'd get email from query params or context
  // For now, we'll show a generic message
  const handleResendEmail = async () => {
    setResending(true);
    try {
      // You'll need to implement this endpoint or store user info to resend
      // const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
      // For now, just simulate
      await new Promise(resolve => setTimeout(resolve, 1000));
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (error) {
      alert('Failed to resend email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-red-800 to-orange-600 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Royal Header */}
        <div className="text-center">
          <div className="flex justify-center items-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-yellow-300 animate-pulse">
                <Mail className="w-12 h-12 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent mb-2">
            Check Your Royal Decree!
          </h1>
          <p className="text-yellow-100 text-lg">Your throne awaits verification</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl border border-white/20 p-8">
          <div className="space-y-6">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-400">
                <Crown className="w-8 h-8 text-green-400" />
              </div>
            </div>

            {/* Message */}
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold text-white">Account Created Successfully!</h2>
              <p className="text-yellow-100 text-base">
                We've sent a royal decree to your email address. Please check your inbox and click the verification link to activate your account.
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-white/10 rounded-2xl p-6 border border-yellow-300/30 space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-purple-900 font-bold text-sm">
                  1
                </div>
                <p className="text-yellow-100 text-sm">
                  Check your email inbox (and spam folder just in case)
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-purple-900 font-bold text-sm">
                  2
                </div>
                <p className="text-yellow-100 text-sm">
                  Click the verification link in the email
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-purple-900 font-bold text-sm">
                  3
                </div>
                <p className="text-yellow-100 text-sm">
                  Return to login and claim your throne!
                </p>
              </div>
            </div>

            {/* Resend Email */}
            {resent && (
              <div className="bg-green-500/20 border border-green-400 rounded-2xl p-4 flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                <p className="text-green-300 text-sm">Verification email resent! Check your inbox.</p>
              </div>
            )}

            <div className="text-center space-y-4">
              <p className="text-yellow-200 text-sm">Didn't receive the email?</p>
              <button
                onClick={handleResendEmail}
                disabled={resending || resent}
                className="inline-flex items-center justify-center px-6 py-3 border border-yellow-400 text-yellow-100 rounded-2xl hover:bg-yellow-400/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Resend Verification Email
                  </>
                )}
              </button>
            </div>

            {/* Warning */}
            <div className="bg-orange-500/20 border border-orange-400 rounded-2xl p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <p className="text-orange-300 text-sm">
                You must verify your email before you can log in to your account. The verification link expires in 30 minutes.
              </p>
            </div>

            {/* Go to Login Button */}
            <button
              onClick={() => setLocation('/login')}
              className="w-full py-4 px-6 text-lg font-bold rounded-2xl text-purple-900 bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-300 hover:to-orange-300 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
            >
              Go to Login Page
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-yellow-200/70 text-xs">
            Need help? Contact our{' '}
            <a href="/contact" className="text-yellow-300 hover:text-yellow-200 underline">
              Royal Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
