import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';

export default function SignUp() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
    } else {
      setSuccess('Account created. Please sign in to continue.');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-slate-900">Create Account</h1>
          <p className="text-slate-600 mt-2">Secure access to patient dashboard</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"

              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"

              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900"

              required
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-slate-900 text-white rounded-lg py-2 font-semibold hover:bg-slate-800 transition"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          Already have access?{' '}
          <Link to="/login" className="font-semibold text-slate-900 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
