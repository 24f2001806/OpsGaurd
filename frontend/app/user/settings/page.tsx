'use client';

import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';

export default function AlertSettingsPage() {
  return (
    <div className="flex min-h-screen bg-[#060913] text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar title="User Alerts & Notifications Settings" user="Standard User" />

        <main className="p-8 space-y-6 max-w-[1400px] w-full mx-auto">
          
          {/* Deduplication Explainer Banner */}
          <div className="bg-[#0D1322] p-6 rounded-2xl border-2 border-[#FF7A00]/40 space-y-4">
            <h2 className="text-lg font-black text-white">Alert Rule Summary — State-Machine Deduplication Engine</h2>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="bg-[#0B0F19] p-4 rounded-xl border border-[#1E293B] space-y-1">
                <span className="text-[10px] font-mono text-[#EC4899]">01. HEALTHY → DOWN</span>
                <p className="font-bold text-white">1 Outage Alert Dispatched</p>
                <p className="text-[#64748B] text-[11px]">Triggers immediate Email + Slack webhook notification.</p>
              </div>
              <div className="bg-[#0B0F19] p-4 rounded-xl border border-[#1E293B] space-y-1">
                <span className="text-[10px] font-mono text-[#F59E0B]">02. DOWN → DOWN</span>
                <p className="font-bold text-white">No Alert Flood (Suppressed)</p>
                <p className="text-[#64748B] text-[11px]">Maintains 10s fast sampling with zero notification spam.</p>
              </div>
              <div className="bg-[#0B0F19] p-4 rounded-xl border border-[#1E293B] space-y-1">
                <span className="text-[10px] font-mono text-[#10B981]">03. DOWN → HEALTHY</span>
                <p className="font-bold text-white">1 Recovery Alert Dispatched</p>
                <p className="text-[#64748B] text-[11px]">Dispatches resolution webhook and restores 60s probe interval.</p>
              </div>
            </div>
          </div>

          {/* Form Settings */}
          <div className="bg-[#0D1322] p-6 rounded-2xl border border-[#1E293B] space-y-6">
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-white">Primary Dispatch Email Address</h4>
              <input
                type="text"
                defaultValue="sansui@opsguard.io"
                className="w-full p-3 bg-[#0B0F19] border border-[#1E293B] rounded-xl font-mono text-xs text-white focus:outline-none focus:border-[#F97316]"
              />
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-sm text-white">Incoming Slack Webhook URL</h4>
              <input
                type="text"
                defaultValue="https://hooks.slack.com/services/T00/B00/XXXXX"
                className="w-full p-3 bg-[#0B0F19] border border-[#1E293B] rounded-xl font-mono text-xs text-white focus:outline-none focus:border-[#F97316]"
              />
            </div>

            <button className="px-6 py-3 bg-gradient-to-r from-[#FF007A] to-[#FF7A00] text-white rounded-xl font-bold shadow-lg shadow-[#FF7A00]/25 hover:opacity-90">
              Save Alert Preferences
            </button>
          </div>

        </main>
      </div>
    </div>
  );
}