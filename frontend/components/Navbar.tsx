'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Shield, Mail, LogOut, X } from 'lucide-react';
import { api, clearToken, type User } from '@/lib/api';

interface NavbarProps {
  title: string;
  // Called after a website was added. Pages that show the list reload it here.
  onCreated?: () => void;
}

export default function Navbar({ title, onCreated }: NavbarProps) {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal Form State
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [checkInterval, setCheckInterval] = useState('60');
  const [fastInterval, setFastInterval] = useState('10');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.me().then(setMe).catch(() => {});
  }, []);

  const logout = () => {
    clearToken();
    window.location.href = '/';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;
    setSaving(true);
    setError('');
    try {
      await api.createEndpoint({
        name,
        url,
        check_interval: Number(checkInterval),
        fast_check_interval: Number(fastInterval),
      });
      setName('');
      setUrl('');
      setIsModalOpen(false);
      if (onCreated) onCreated();
      else router.push('/user/dashboard');
    } catch (err: any) {
      setError(err.message || 'Could not add the endpoint');
    } finally {
      setSaving(false);
    }
  };

  const displayName = me?.name || 'Account';

  return (
    <>
      <header className="h-20 bg-[#0B0F19] border-b border-[#1E293B] px-8 flex items-center justify-between shrink-0 relative z-40">
        <h1 className="text-xl font-black text-white tracking-tight">{title}</h1>

        <div className="flex items-center gap-4">
          {/* Add Endpoint Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#FF007A] to-[#FF7A00] text-white rounded-xl text-xs font-bold shadow-lg shadow-[#FF7A00]/25 hover:opacity-90 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Add Endpoint
          </button>

          {/* User Profile Badge + Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 bg-[#131B2E] border border-[#1E293B] hover:border-[#FF7A00]/50 px-3.5 py-1.5 rounded-xl transition-all"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#F97316] to-[#E11D48] text-white flex items-center justify-center font-bold text-xs shadow-md">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-white">{displayName}</span>
            </button>

            {/* Profile Menu Popup */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#0D1322] border border-[#1E293B] rounded-2xl shadow-2xl p-4 space-y-3 z-50">
                <div className="flex items-center gap-3 border-b border-[#1E293B] pb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#F97316] to-[#E11D48] text-white flex items-center justify-center font-black text-sm">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white">{me?.name || '—'}</h4>
                    <span className="text-[10px] text-[#10B981] font-mono block">● Active Session</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-[#94A3B8]">
                  <div className="flex items-center gap-2 px-2 py-1 bg-[#0B0F19] rounded-lg border border-[#1E293B]">
                    <Shield className="w-3.5 h-3.5 text-[#F97316]" />
                    <span>Role: <strong className="text-white">Standard User</strong></span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 bg-[#0B0F19] rounded-lg border border-[#1E293B]">
                    <Mail className="w-3.5 h-3.5 text-[#F97316]" />
                    <span className="truncate">{me?.email || '—'}</span>
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-[#FF0055]/10 border border-[#FF0055]/30 text-[#FF0055] rounded-xl text-xs font-bold hover:bg-[#FF0055]/20 transition"
                >
                  <LogOut className="w-3.5 h-3.5" /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Add Endpoint Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1322] border-2 border-[#1E293B] w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 relative">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#F97316]" /> Add Monitored Endpoint
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#64748B] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Payment Gateway API"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 bg-[#0B0F19] border border-[#1E293B] rounded-xl text-xs text-white focus:outline-none focus:border-[#F97316]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">Endpoint URL</label>
                <input
                  type="url"
                  placeholder="https://api.yourdomain.com/health"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full p-3 bg-[#0B0F19] border border-[#1E293B] rounded-xl text-xs text-white focus:outline-none focus:border-[#F97316]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">Check every (seconds)</label>
                  <input
                    type="number"
                    min={1}
                    value={checkInterval}
                    onChange={(e) => setCheckInterval(e.target.value)}
                    className="w-full p-3 bg-[#0B0F19] border border-[#1E293B] rounded-xl text-xs text-white focus:outline-none focus:border-[#F97316]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">Fast check when failing (s)</label>
                  <input
                    type="number"
                    min={1}
                    value={fastInterval}
                    onChange={(e) => setFastInterval(e.target.value)}
                    className="w-full p-3 bg-[#0B0F19] border border-[#1E293B] rounded-xl text-xs text-white focus:outline-none focus:border-[#F97316]"
                    required
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs font-bold text-[#FF0055] bg-[#FF0055]/10 border border-[#FF0055]/30 rounded-xl p-3">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[#1A2338] text-white rounded-xl text-xs font-bold hover:bg-[#24304C]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-[#FF007A] to-[#FF7A00] text-white rounded-xl text-xs font-bold shadow-lg shadow-[#FF7A00]/25 disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Start Monitoring'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
