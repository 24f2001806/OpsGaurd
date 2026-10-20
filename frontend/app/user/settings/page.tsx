'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { api, type Endpoint } from '@/lib/api';
import { useRequireLogin } from '@/lib/hooks';

export default function AlertSettingsPage() {
  useRequireLogin();

  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [emailEnabled, setEmailEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slack, setSlack] = useState('');

  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  // Load the list of websites once.
  useEffect(() => {
    api
      .listEndpoints()
      .then((eps) => {
        setEndpoints(eps);
        if (eps.length > 0) setSelectedId(eps[0].id);
      })
      .catch((err) => setMessage({ text: err.message, ok: false }))
      .finally(() => setLoaded(true));
  }, []);

  // Load the saved alert settings of the selected website.
  useEffect(() => {
    if (selectedId == null) return;
    setMessage(null);
    api
      .getAlerts(selectedId)
      .then((cfg) => {
        setEmailEnabled(cfg.email_enabled);
        setEmail(cfg.email_address ?? '');
        setSlackEnabled(cfg.slack_enabled);
        setSlack(cfg.slack_webhook ?? '');
      })
      .catch((err) => setMessage({ text: err.message, ok: false }));
  }, [selectedId]);

  const save = async () => {
    if (selectedId == null) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.saveAlerts(selectedId, {
        email_enabled: emailEnabled,
        slack_enabled: slackEnabled,
        email_address: email.trim() === '' ? null : email.trim(),
        slack_webhook: slack.trim() === '' ? null : slack.trim(),
      });
      setMessage({ text: 'Alert preferences saved.', ok: true });
    } catch (err: any) {
      setMessage({ text: err.message || 'Could not save', ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#060913] text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar title="User Alerts & Notifications Settings" />

        <main className="p-8 space-y-6 max-w-[1400px] w-full mx-auto">

          {/* Deduplication Explainer Banner */}
          <div className="bg-[#0D1322] p-6 rounded-2xl border-2 border-[#FF7A00]/40 space-y-4">
            <h2 className="text-lg font-black text-white">Alert Rule Summary — State-Machine Deduplication Engine</h2>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="bg-[#0B0F19] p-4 rounded-xl border border-[#1E293B] space-y-1">
                <span className="text-[10px] font-mono text-[#EC4899]">01. HEALTHY → DOWN</span>
                <p className="font-bold text-white">1 Outage Alert Dispatched</p>
                <p className="text-[#64748B] text-[11px]">Triggers one Email + Slack webhook notification.</p>
              </div>
              <div className="bg-[#0B0F19] p-4 rounded-xl border border-[#1E293B] space-y-1">
                <span className="text-[10px] font-mono text-[#F59E0B]">02. DOWN → DOWN</span>
                <p className="font-bold text-white">No Alert Flood (Suppressed)</p>
                <p className="text-[#64748B] text-[11px]">Keeps fast sampling with zero notification spam.</p>
              </div>
              <div className="bg-[#0B0F19] p-4 rounded-xl border border-[#1E293B] space-y-1">
                <span className="text-[10px] font-mono text-[#10B981]">03. DOWN → HEALTHY</span>
                <p className="font-bold text-white">1 Recovery Alert Dispatched</p>
                <p className="text-[#64748B] text-[11px]">Sends one resolution message and returns to the normal interval.</p>
              </div>
            </div>
          </div>

          {loaded && endpoints.length === 0 && (
            <div className="bg-[#0D1322] p-8 rounded-2xl border border-dashed border-[#1E293B] text-center text-xs text-[#94A3B8]">
              Add an endpoint first. Alert settings are saved per website.
            </div>
          )}

          {/* Form Settings */}
          {endpoints.length > 0 && (
            <div className="bg-[#0D1322] p-6 rounded-2xl border border-[#1E293B] space-y-6">
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-white">Website</h4>
                <select
                  value={selectedId ?? ''}
                  onChange={(e) => setSelectedId(Number(e.target.value))}
                  className="w-full p-3 bg-[#0B0F19] border border-[#1E293B] rounded-xl text-xs text-white focus:outline-none focus:border-[#F97316]"
                >
                  {endpoints.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.name} — {ep.url}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 font-bold text-sm text-white">
                  <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
                  Send email alerts
                </label>
                <input
                  type="text"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 bg-[#0B0F19] border border-[#1E293B] rounded-xl font-mono text-xs text-white focus:outline-none focus:border-[#F97316]"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 font-bold text-sm text-white">
                  <input type="checkbox" checked={slackEnabled} onChange={(e) => setSlackEnabled(e.target.checked)} />
                  Send Slack alerts
                </label>
                <input
                  type="text"
                  placeholder="https://hooks.slack.com/services/..."
                  value={slack}
                  onChange={(e) => setSlack(e.target.value)}
                  className="w-full p-3 bg-[#0B0F19] border border-[#1E293B] rounded-xl font-mono text-xs text-white focus:outline-none focus:border-[#F97316]"
                />
              </div>

              {message && (
                <p
                  className={`text-xs font-bold rounded-xl p-3 border ${
                    message.ok
                      ? 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30'
                      : 'text-[#FF0055] bg-[#FF0055]/10 border-[#FF0055]/30'
                  }`}
                >
                  {message.text}
                </p>
              )}

              <button
                onClick={save}
                disabled={saving}
                className="px-6 py-3 bg-gradient-to-r from-[#FF007A] to-[#FF7A00] text-white rounded-xl font-bold shadow-lg shadow-[#FF7A00]/25 hover:opacity-90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Alert Preferences'}
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
