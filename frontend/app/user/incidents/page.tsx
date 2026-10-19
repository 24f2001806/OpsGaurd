'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { AlertOctagon } from 'lucide-react';

const incidentList = [
  {
    id: 'INC-2026-089',
    endpointId: '2',
    endpoint: 'Billing & Checkout Service',
    url: 'https://api.service.com',
    status: 'ACTIVE',
    startedAt: '2026-10-18 18:24:50 UTC',
    duration: '18m 30s',
    reason: 'HTTP 503 Service Unavailable — Connection pool saturation on primary database replica',
  },
  {
    id: 'INC-2026-084',
    endpointId: '4',
    endpoint: 'Webhook Relay Worker',
    url: 'https://hooks.opsguard.io/dispatch',
    status: 'RESOLVED',
    startedAt: '2026-10-17 21:14:00 UTC',
    duration: '14m 40s',
    reason: 'HTTP 504 Gateway Timeout — Upstream deployment timeout',
  },
];

export default function IncidentsPage() {
  const [selectedIncidentId, setSelectedIncidentId] = useState('INC-2026-089');

  return (
    <div className="flex min-h-screen bg-[#060913] text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar title="Incident Command & Outage Logs" user="Standard User" />

        <main className="p-8 space-y-6 max-w-[1700px] w-full mx-auto">
          
          <div className="bg-[#0D1322] p-6 rounded-2xl border-2 border-[#FF0055]/40 shadow-xl flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF0055] to-[#FF7A00] flex items-center justify-center text-white shadow-lg shadow-[#FF0055]/30">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Incident Command & Outage Center</h2>
                <p className="text-xs text-[#94A3B8]">Real-time outage tracking and automated 10s fast-check verification</p>
              </div>
            </div>

            <button className="px-5 py-2.5 bg-gradient-to-r from-[#FF007A] to-[#FF7A00] text-white rounded-xl text-xs font-black shadow-lg shadow-[#FF7A00]/30 hover:opacity-90">
              Resolve All Active (1)
            </button>
          </div>

          <div className="space-y-4">
            {incidentList.map((item) => {
              const isSelected = selectedIncidentId === item.id;
              return (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedIncidentId(item.id)}
                  className={`p-6 rounded-2xl border-2 bg-[#0D1322] space-y-4 cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? item.status === 'ACTIVE'
                        ? 'border-[#FF0055] shadow-xl shadow-[#FF0055]/20 scale-[1.005]'
                        : 'border-[#10B981] shadow-xl shadow-[#10B981]/20 scale-[1.005]'
                      : 'border-[#1E293B] hover:border-[#334155]'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-black ${
                        item.status === 'ACTIVE' ? 'bg-[#FF0055]/20 text-[#FF0055] border border-[#FF0055]/40' : 'bg-[#10B981]/20 text-[#10B981]'
                      }`}>
                        ● {item.status}
                      </span>
                      <h4 className="font-black text-base text-white">{item.endpoint}</h4>
                      <span className="text-xs font-mono text-[#F97316]">({item.url})</span>
                    </div>

                    <a 
                      href={`/user/endpoints/${item.endpointId}`} 
                      onClick={(e) => e.stopPropagation()}
                      className="px-4 py-2 bg-[#1A2338] text-white rounded-xl text-xs font-bold hover:bg-[#24304C]"
                    >
                      Inspect Telemetry
                    </a>
                  </div>

                  <div className="bg-[#0B0F19] p-4 rounded-xl border border-[#1E293B] text-xs space-y-2">
                    <p className="text-[#94A3B8]"><strong className="text-white">Root Cause:</strong> {item.reason}</p>
                    <p className="text-[#94A3B8] font-mono"><strong className="text-white font-sans">Started:</strong> {item.startedAt} · <strong className="text-white font-sans">Duration:</strong> {item.duration}</p>
                  </div>
                </div>
              );
            })}
          </div>

        </main>
      </div>
    </div>
  );
}