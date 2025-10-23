// client/src/pages/verify-email.tsx
import { useState } from 'react';
import { Crown, Mail, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { useLocation } from 'wouter';

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResendEmail = async () => {
    setResending(true);
    try {
      // TODO: Implement actual resend logic
      // For now, just simulate a delay
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-red-800 to-orange-600 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-yellow-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-green-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-75"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-150"></div>

        {/* Floating crowns */}
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
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-100 mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Resend Email
                  </>
                )}
              </button>
            </div>

            {/* Important Note */}
            <div className="bg-orange-500/20 border border-orange-400 rounded-2xl p-4">
              <p className="text-orange-200 text-xs text-center">
                ⚠️ You must verify your email before you can log in to your account. The link expires in 24 hours.
              </p>
            </div>

            {/* Go to Login */}
            <button
              onClick={() => setLocation('/login')}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-300 hover:to-orange-300 text-purple-900 font-bold rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Already Verified? Enter Your Castle
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-yellow-200/70 text-xs">
            Need help?{' '}
            <a href="/contact" className="text-yellow-300 hover:text-yellow-200 underline">
              Contact our Royal Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
