import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiMail, FiLock, FiUser, FiBarChart2, FiAlertCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import { supabase } from '../supabaseClient';

export default function SignupPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Name is required.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address.'); return; }
    if (!password) { setError('Password is required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      });

      if (error) throw error;
      
      if (data?.session) {
        navigate('/dashboard');
      } else {
        setError('Registration successful! Please check your email for the confirmation link.');
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50/50 to-accent-50/30 flex items-center justify-center px-4">
      <div className="fixed -top-40 -right-40 w-96 h-96 bg-primary-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-96 h-96 bg-accent-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-slide-up pb-10 pt-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-accent-500 rounded-xl flex items-center justify-center shadow-lg">
              <FiBarChart2 className="text-white" size={20} />
            </div>
            <span className="font-bold text-gray-900 text-xl">Retail<span className="gradient-text">IQ</span></span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-6">Create an account</h1>
          <p className="text-gray-500 text-sm mt-1">Join us to start analyzing your customer segments</p>
        </div>

        <div className="card shadow-xl border-0">
          {error && (
            <div className={`flex items-center gap-2.5 border text-sm rounded-xl px-4 py-3 mb-5 ${
              error.includes('successful') ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'
            }`}>
              <FiAlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="name">
                Full name
              </label>
              <div className="relative">
                <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="email">
                Email address
              </label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              id="signup-btn"
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Creating account…
                </>
              ) : 'Sign Up'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 pb-6">
          <Link to="/" className="hover:text-primary-600 transition-colors">← Back to homepage</Link>
        </p>
      </div>
    </div>
  );
}
