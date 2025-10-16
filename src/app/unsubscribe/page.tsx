'use client';

import { useState, FormEvent } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import ReCAPTCHA from 'react-google-recaptcha';

export default function UnsubscribePage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // --- State for the reCAPTCHA token ---
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

  const { settings, isLoading: themeLoading } = useTheme();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');

    // --- Check if reCAPTCHA was completed ---
    if (!recaptchaToken) {
      setError('Please complete the reCAPTCHA verification.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // --- Send email and token to the backend ---
        body: JSON.stringify({ email, token: recaptchaToken }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Something went wrong');
      }

      setMessage(result.message);
      setEmail('');
    } catch (err: unknown) {
      // Narrow unknown to Error if possible, otherwise use a generic message
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err) || 'An unknown error occurred');
      }
    } finally {
      setIsLoading(false);
      // Reset the token so the user has to solve it again
      setRecaptchaToken(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 font-sans">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">Unsubscribe</h1>
          <p className="mt-2 text-gray-600">
            We&apos;re sorry to see you go. Unsubscribe from our mailing list below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="sr-only">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-3 py-2 text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || themeLoading}
            style={{ backgroundColor: settings.themeColor }}
            className={`w-full px-4 py-2 font-semibold text-white rounded-md transition-colors duration-200 bg-black
              ${(isLoading || !recaptchaToken)
                ? 'cursor-not-allowed opacity-70'
                : 'focus:outline-none focus:ring-2 focus:ring-offset-2'
              }`}
          >
            {isLoading ? 'Processing...' : 'Unsubscribe'}
          </button>
          {/* --- Google reCAPTCHA v2 Widget --- */}
          <div className="flex justify-center">
            <ReCAPTCHA
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
              onChange={(token) => setRecaptchaToken(token)}
              onExpired={() => setRecaptchaToken(null)}
            />
          </div>
        </form>

        <div className="text-center">
          {message && (
            <p className="p-3 mt-4 text-sm text-green-800 bg-green-100 border border-green-200 rounded-md">
              {message}
            </p>
          )}
          {error && (
            <p className="p-3 mt-4 text-sm text-red-800 bg-red-100 border border-red-200 rounded-md">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}