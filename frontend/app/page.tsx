'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, ArrowRight, Lock, Mail, User } from 'lucide-react';
import { api, getToken, setToken } from '@/lib/api';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Already signed in? Go straight to the dashboard.
  useEffect(() => {
    if (getToken()) router.replace('/user/dashboard');
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!isLogin) {
        await api.signup(name, email, password); // create the account first
      }
      const { access_token } = await api.login(email, password);
      setToken(access_token);
      router.push('/user/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F3F9] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-[#CBD5E1] shadow-xl max-w-md w-full p-8 space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-[#EA580C] rounded-2xl flex items-center justify-center text-white mx-auto shadow-md shadow-[#EA580C]/30">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">OpsGuard</h1>
          <p className="text-xs font-semibold text-[#475569]">
            {isLogin ? 'Sign in to access your monitoring dashboard' : 'Create an account to monitor your services'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0] text-xs font-bold">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-2 rounded-lg transition ${
              isLogin ? 'bg-[#0F172A] text-white shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-2 rounded-lg transition ${
              !isLogin ? 'bg-[#0F172A] text-white shadow-sm' : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[#475569] block">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-xs focus:outline-none focus:border-[#EA580C]"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[#475569] block">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-xs focus:outline-none focus:border-[#EA580C]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[#475569] block">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
              <input
                type="password"
                required
                minLength={isLogin ? undefined : 8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#CBD5E1] rounded-xl text-xs focus:outline-none focus:border-[#EA580C]"
              />
            </div>
            {!isLogin && <p className="text-[11px] text-[#64748B]">At least 8 characters.</p>}
          </div>

          {error && (
            <p className="text-xs font-bold text-[#E11D48] bg-[#E11D48]/10 border border-[#E11D48]/30 rounded-xl p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#EA580C] hover:bg-[#C2410C] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-[#EA580C]/20 transition mt-2 disabled:opacity-60"
          >
            {loading ? 'Please wait…' : isLogin ? 'Access Portal' : 'Register Account'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

      </div>
    </div>
  );
}
