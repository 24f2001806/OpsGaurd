'use client';

import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, ExternalLink } from 'lucide-react';

const historyChartData = [
  { time: '24h ago', responseTime: 98 },
  { time: '18h ago', responseTime: 120 },
  { time: '12h ago', responseTime: 140 },
  { time: '6h ago', responseTime: 110 },
  { time: 'Live Now', responseTime: 165 },
];

const checkLogs = [
  { timestamp: '2026-10-18 18:25:00 UTC', status: 'DOWN', httpCode: '503 Service Unavailable', responseTime: '842ms', details: '503 Service Unavailable — Upstream pool connection timeout' },
  { timestamp: '2026-10-18 18:24:50 UTC', status: 'DOWN', httpCode: '503 Service Unavailable', responseTime: '855ms', details: 'Connection pool exhausted' },
  { timestamp: '2026-10-18 18:24:00 UTC', status: 'UP', httpCode: '200 OK', responseTime: '195ms', details: 'None' },
  { timestamp: '2026-10-18 18:23:00 UTC', status: 'UP', httpCode: '200 OK', responseTime: '160ms', details: 'None' },
];

export default function EndpointDetailPage() {
  return (
    <div className="flex min-h-screen bg-[#060913] text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar title="Endpoint Details & Monitoring History" user="Standard User" />

        <main className="p-8 space-y-6 max-w-[1700px] w-full mx-auto">
          
          <div className="flex items-center gap-4">
            <a href="/user/dashboard" className="px-4 py-2 bg-[#0D1322] border border-[#1E293B] rounded-xl text-xs font-bold text-white hover:bg-[#1A2338] transition flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </a>
          </div>

          {/* Header Card */}
          <div className="bg-[#0D1322] p-6 rounded-2xl border-2 border-[#FF007A]/40 shadow-xl space-y-3">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-white">Billing & Checkout Service</h2>
                  <span className="px-3 py-0.5 rounded-full text-xs font-black bg-[#FF0055]/20 text-[#FF0055] border border-[#FF0055]/30">● DOWN</span>
                  <span className="px-3 py-0.5 rounded-full text-xs font-black bg-[#FF7A00]/20 text-[#FF7A00]">FAST Checking (10s)</span>
                </div>
                <a href="https://api.service.com" target="_blank" rel="noreferrer" className="text-xs font-mono text-[#F97316] hover:underline flex items-center gap-1">
                  https://api.service.com <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <button className="px-5 py-2.5 bg-gradient-to-r from-[#FF007A] to-[#FF7A00] text-white rounded-xl text-xs font-black shadow-lg shadow-[#FF7A00]/30 hover:opacity-90">
                Recover Endpoint (UP)
              </button>
            </div>
          </div>

          {/* Charts & Grid Blocks */}
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 bg-[#0D1322] p-6 rounded-2xl border border-[#1E293B] space-y-4">
              <h3 className="font-black text-sm text-white">Detailed Response Time (ms)</h3>
              <div className="h-60 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyChartData}>
                    <XAxis dataKey="time" stroke="#475569" fontSize={11} />
                    <YAxis stroke="#475569" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#1E293B' }} />
                    <Area type="monotone" dataKey="responseTime" stroke="#FF007A" strokeWidth={3} fill="#FF007A" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Uptime History Block Visualizer */}
            <div className="bg-[#0D1322] p-6 rounded-2xl border border-[#1E293B] space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-sm text-white">Uptime History (Last 48 Checks)</h3>
                <span className="text-xs font-mono text-[#10B981] font-bold">98.42%</span>
              </div>
              <p className="text-xs text-[#64748B]">Each block represents one monitoring check interval</p>

              {/* 48 Status Pills */}
              <div className="grid grid-cols-12 gap-2 pt-2">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-8 rounded-md transition-all ${
                      i >= 20 && i <= 23 ? 'bg-[#FF0055] shadow-sm shadow-[#FF0055]' : 'bg-[#10B981]'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono font-bold pt-4 text-[#94A3B8]">
                <span className="text-[#10B981]">● UP (100% Passed)</span>
                <span className="text-[#FF0055]">● DOWN (Failed)</span>
              </div>
            </div>
          </div>

          {/* Execution Table Log */}
          <div className="bg-[#0D1322] rounded-2xl border border-[#1E293B] p-6 space-y-4">
            <h3 className="font-black text-base text-white">Monitoring History Telemetry Stream</h3>
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#1E293B] text-[#64748B]">
                  <th className="py-3">TIMESTAMP</th>
                  <th className="py-3">STATUS</th>
                  <th className="py-3">LATENCY</th>
                  <th className="py-3">HTTP STATUS</th>
                  <th className="py-3">MESSAGE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2338]">
                {checkLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-[#131B2E]">
                    <td className="py-3.5 text-white">{log.timestamp}</td>
                    <td className="py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'UP' ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#FF0055]/20 text-[#FF0055]'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-white">{log.responseTime}</td>
                    <td className="py-3.5 text-white">{log.httpCode}</td>
                    <td className="py-3.5 text-[#94A3B8]">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </main>
      </div>
    </div>
  );
}