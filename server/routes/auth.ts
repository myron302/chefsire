// client/src/pages/verify-success.tsx
import { Crown, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';

export default function VerifySuccessPage() {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(5);

  // Auto-redirect to login after 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLocation('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [setLocation]);

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
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 border-2 border-yellow-500/30">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-green-400 to-emerald-600 rounded-full p-6">
                <CheckCircle2 className="w-16 h-16 text-white" />
              </div>
            </div>
          </div>

          {/* Success Message */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-red-500 to-orange-500 bg-clip-text text-transparent">
              Email Verified! 🎉
            </h1>
            
            <div className="space-y-2">
              <p className="text-lg text-gray-700">
                Your royal account has been successfully verified!
              </p>
              <p className="text-sm text-gray-600">
                You can now log in and start your culinary journey.
              </p>
            </div>

            {/* Countdown Display */}
            <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-gray-600">
                Redirecting to login in{' '}
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-lg animate-pulse">
                  {countdown}
                </span>
                {' '}seconds...
              </p>
            </div>

            {/* Manual Login Button */}
            <Button
              onClick={() => setLocation('/login')}
              className="w-full mt-6 bg-gradient-to-r from-purple-600 via-red-500 to-orange-500 hover:from-purple-700 hover:via-red-600 hover:to-orange-600 text-white font-semibold py-6 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              <div className="flex items-center justify-center gap-2">
                <Crown className="w-5 h-5" />
                Go to Login
                <ArrowRight className="w-5 h-5" />
              </div>
            </Button>
          </div>

          {/* Decorative Elements */}
          <div className="mt-8 flex justify-center gap-4">
            <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
            <Crown className="w-8 h-8 text-yellow-500 animate-bounce" />
            <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse delay-75" />
          </div>

          {/* Footer Message */}
          <p className="mt-6 text-center text-xs text-gray-500">
            Welcome to the Royal Kitchen! 👑
          </p>
        </div>
      </div>
    </div>
  );
}
