import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import Logo from '../components/Logo';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;
      
      navigate('/dashboard');

    } catch (error: any) {
      setError(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
        <div className="mb-8">
            <Logo />
        </div>
      <div className="w-full max-w-md bg-slate-800 p-8 rounded-lg shadow-lg border border-slate-700">
        <h1 className="text-2xl font-bold text-white text-center mb-6">Admin Login</h1>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-slate-300 mb-2" htmlFor="email">Email</label>
            <input
              id="email"
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-slate-300 mb-2" htmlFor="password">Password</label>
            <input
              id="password"
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-md transition-all duration-300 disabled:opacity-50"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
          {error && <p className="mt-4 text-red-400 text-center">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default LoginPage;