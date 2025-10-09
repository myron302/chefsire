// client/src/pages/signup.tsx
import { useState } from 'react';
import { useRouter } from 'next/router'; // For redirect after success

export default function SignupPage() {
  const [errors, setErrors] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('fullName')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    const password = formData.get('password')?.toString();
    const terms = (e.currentTarget as HTMLFormElement).querySelector('#terms') as HTMLInputElement;

    let newErrors = { name: '', email: '', password: '' };
    let isValid = true;

    if (!name) { newErrors.name = 'Please enter your full name.'; isValid = false; }
    if (!email || !/\S+@\S+\.\S+/.test(email)) { newErrors.email = 'Please enter a valid email.'; isValid = false; }
    if (password?.length < 6) { newErrors.password = 'Password must be at least 6 characters.'; isValid = false; }
    if (!terms.checked) { alert('You must agree to the terms.'); isValid = false; }

    setErrors(newErrors);
    if (!isValid) return;

    setLoading(true);
    try {
      // Integrate with your backend (e.g., call storage.ts createUser via API)
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      if (response.ok) {
        alert('Sign-up successful! Redirecting to dashboard...');
        router.push('/feed'); // Or /profile, wherever new users land
      } else {
        alert('Sign-up failed—try again!');
      }
    } catch (error) {
      alert('Network error—check your connection.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-600">ChefSire</h1>
          <p className="mt-2 text-sm text-gray-600">Join the culinary community</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                required
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                minLength={6}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
            </div>
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
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        <div className="text-center">
          <a href="/login" className="text-sm text-red-600 hover:underline">
            Already have an account? Log In
          </a>
        </div>
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
