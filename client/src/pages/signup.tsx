import { useState } from 'react';
import { useLocation } from 'wouter'; // For redirect after signup

export default function SignupPage() {
  // State for errors (shows red messages if something's wrong)
  const [errors, setErrors] = useState({ name: '', email: '', password: '' });
  // State for loading (disables button while submitting)
  const [loading, setLoading] = useState(false);
  // Wouter router for redirect
  const [, setLocation] = useLocation();

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    // Stop page from refreshing
    e.preventDefault();
    
    // Get form values
    const formData = new FormData(e.currentTarget);
    const name = formData.get('fullName')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    const password = formData.get('password')?.toString();
    const terms = (e.currentTarget as HTMLFormElement).querySelector('#terms') as HTMLInputElement;

    // Reset errors
    let newErrors = { name: '', email: '', password: '' };
    let isValid = true;

    // Check name
    if (!name) { 
      newErrors.name = 'Please enter your full name.'; 
      isValid = false; 
    }

    // Check email
    if (!email || !/\S+@\S+\.\S+/.test(email)) { 
      newErrors.email = 'Please enter a valid email.'; 
      isValid = false; 
    }

    // Check password
    if (password?.length < 6) { 
      newErrors.password = 'Password must be at least 6 characters.'; 
      isValid = false; 
    }

    // Check terms checkbox
    if (!terms.checked) { 
      alert('You must agree to the terms.'); 
      isValid = false; 
    }

    // Update errors on screen
    setErrors(newErrors);
    if (!isValid) return; // Stop if invalid

    // Show loading
    setLoading(true);

    try {
      // Send to API
      const response = await fetch('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Success! Save user to localStorage (simple session for now)
        localStorage.setItem('user', JSON.stringify(data.user));
        alert('Sign-up successful! Redirecting to feed...');
        setLocation('/feed'); // Wouter redirect
      } else {
        alert(data.error || 'Sign-up failed—try again!');
      }
    } catch (error) {
      alert('Network error—check your connection.');
    }

    // Hide loading
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-red-600">ChefSire</h1>
          <p className="mt-2 text-sm text-gray-600">Join the culinary community</p>
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Name Field */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                Full Name *
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                required
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., John Doe"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="e.g., john@example.com"
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password *
              </label>
              <input
                type="password"
                id="password"
                name="password"
                required
                minLength={6}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-red-500 focus:border-red-500 ${
                  errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="At least 6 characters"
              />
              {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
            </div>

            {/* Terms Checkbox */}
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Login Link */}
        <div className="text-center">
          <a href="/login" className="text-sm text-red-600 hover:underline">
            Already have an account? Log In
          </a>
        </div>

        {/* Footer */}
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