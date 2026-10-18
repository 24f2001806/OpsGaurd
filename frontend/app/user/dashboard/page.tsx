'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, ExternalLink } from 'lucide-react';

const globalChartData = [
  { time: '08:00', mean: 220, p95: 280 },
  { time: '10:00', mean: 230, p95: 310 },
  { time: '12:00', mean: 240, p95: 320 },
  { time: '14:00', mean: 235, p95: 300 },
  { time: '16:00', mean: 245, p95: 340 },
  { time: '18:00', mean: 260, p95: 380 },
  { time: '20:00', mean: 238, p95: 310 },
  { time: '22:00', mean: 225, p95: 280 },
  { time: '00:00', mean: 215, p95: 270 },
  { time: '02:00', mean: 220, p95: 275 },
  { time: '04:00', mean: 250, p95: 360 },
  { time: '06:00', mean: 240, p95: 310 },
];

const initialEndpoints = [
  {
    id: '1',
    name: 'Core Gateway API',
    url: 'https://api.opsguard.io',
    status: 'HEALTHY',
    mode: '60s',
    responseTime: '120ms',
    uptime: '99.98%',
    httpCode: '200',
  },
  {
    id: '2',
    name: 'Billing & Checkout Service',
    url: 'https://api.service.com',
    status: 'DOWN',
    mode: '10s FAST',
    responseTime: '842ms',
    uptime: '98.42%',
    httpCode: '503',
  },
  {
    id: '3',
    name: 'Identity & OAuth2 Token Server',
    url: 'https://auth.opsguard.io/v2/health',
    status: 'HEALTHY',
    mode: '60s',
    responseTime: '94ms',
    uptime: '99.99%',
    httpCode: '200',
  },
  {
    id: '4',
    name: 'Metrics Ingestion Collector',
    url: 'https://ingest.opsguard.io/write',
    status: 'HEALTHY',
    mode: '60s',
    responseTime: '142ms',
    uptime: '99.95%',
    httpCode: '200',
  },
];

export default function UserDashboard() {
  const [endpoints, setEndpoints] = useState(initialEndpoints);
  const [selectedId, setSelectedId] = useState<string>('2'); // Currently selected card ID
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'HEALTHY' | 'DOWN'>('ALL');

  const handleAddEndpoint = (newEp: { name: string; url: string }) => {
    const created = {
      id: (endpoints.length + 1).toString(),
      name: newEp.name,
      url: newEp.url,
      status: 'HEALTHY',
      mode: '60s',
      responseTime: '105ms',
      uptime: '100%',
      httpCode: '200',
    };
    setEndpoints([created, ...endpoints]);
  };

  const filteredEndpoints = endpoints.filter((item) => {
    const matchesFilter = filter === 'ALL' || item.status === filter;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.url.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex min-h-screen bg-[#060913] text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar title="System Health Dashboard" user="Standard User" onAddEndpoint={handleAddEndpoint} />

        <main className="p-8 space-y-8 max-w-[1700px] w-full mx-auto">
          
          {/* Top Metric Cards */}
          <div className="grid grid-cols-6 gap-4">
            <div className="bg-[#0D1322] p-5 rounded-2xl border border-[#1E293B]">
              <span className="text-xs font-bold text-[#94A3B8]">Total Monitored</span>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-3xl font-black text-white">{endpoints.length}</p>
                <span className="text-xs font-mono text-[#F97316]">Endpoints</span>
              </div>
            </div>

            <div className="bg-[#0D1322] p-5 rounded-2xl border border-[#1E293B]">
              <span className="text-xs font-bold text-[#94A3B8]">Healthy Endpoints</span>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-3xl font-black text-[#10B981]">{endpoints.filter(e => e.status === 'HEALTHY').length}</p>
                <span className="text-xs font-mono text-[#10B981]">60s Normal</span>
              </div>
            </div>

            <div className="bg-[#0D1322] p-5 rounded-2xl border border-[#FF0055]/30 bg-gradient-to-b from-[#FF0055]/5 to-transparent">
              <span className="text-xs font-bold text-[#94A3B8]">Down Endpoints</span>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-3xl font-black text-[#FF0055]">{endpoints.filter(e => e.status === 'DOWN').length}</p>
                <span className="text-xs font-mono text-[#FF0055] animate-pulse">10s Fast Check</span>
              </div>
            </div>

            <div className="bg-[#0D1322] p-5 rounded-2xl border border-[#F59E0B]/30">
              <span className="text-xs font-bold text-[#94A3B8]">Active Incidents</span>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-3xl font-black text-[#F59E0B]">1</p>
                <span className="text-xs font-mono text-[#F59E0B]">Open Alert</span>
              </div>
            </div>

            <div className="bg-[#0D1322] p-5 rounded-2xl border border-[#1E293B]">
              <span className="text-xs font-bold text-[#94A3B8]">Avg Response Time</span>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-3xl font-black text-white">216ms</p>
                <span className="text-xs font-mono text-[#F97316]">24h Mean</span>
              </div>
            </div>

            <div className="bg-[#0D1322] p-5 rounded-2xl border border-[#1E293B]">
              <span className="text-xs font-bold text-[#94A3B8]">Overall Uptime</span>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-3xl font-black text-[#EC4899]">99.76%</p>
                <span className="text-xs font-mono text-[#94A3B8]">SLA 99.9%</span>
              </div>
            </div>
          </div>

          {/* Telemetry Chart */}
          <div className="bg-[#0D1322] p-6 rounded-2xl border border-[#1E293B] space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-black text-base text-white tracking-tight flex items-center gap-2">
                  <span className="text-[#F97316]">📈</span> Global Response-Time Telemetry (24 Hours)
                </h3>
                <p className="text-xs font-medium text-[#64748B]">Aggregated HTTP probe latency across all endpoints · P95 vs Mean</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono font-bold">
                <span className="flex items-center gap-1.5 text-[#F97316]">
                  <span className="w-2.5 h-1 bg-[#F97316] rounded-full"></span> Mean Latency (216ms)
                </span>
                <span className="flex items-center gap-1.5 text-[#10B981]">
                  <span className="w-2.5 h-1 bg-[#10B981] rounded-full"></span> P95 Threshold (295ms)
                </span>
              </div>
            </div>

            <div className="h-64 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={globalChartData}>
                  <defs>
                    <linearGradient id="meanGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF007A" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#FF007A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#1E293B', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="p95" stroke="#10B981" strokeWidth={2} strokeDasharray="4 4" fill="transparent" />
                  <Area type="monotone" dataKey="mean" stroke="#FF007A" strokeWidth={3} fillOpacity={1} fill="url(#meanGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cards Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg text-white">Monitored Endpoint Cards ({filteredEndpoints.length})</h3>
                <p className="text-xs text-[#64748B]">Click any card to select it. Hovering or clicking moves the selection outline.</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#64748B]" />
                  <input 
                    type="text" 
                    placeholder="Filter by name or URL..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#0B0F19] border border-[#1E293B] rounded-xl text-xs text-white focus:outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="flex bg-[#0B0F19] p-1 rounded-xl border border-[#1E293B] text-xs font-bold">
                  <button onClick={() => setFilter('ALL')} className={`px-3 py-1 rounded-lg transition ${filter === 'ALL' ? 'bg-gradient-to-r from-[#FF007A] to-[#FF7A00] text-white' : 'text-[#64748B]'}`}>All</button>
                  <button onClick={() => setFilter('HEALTHY')} className={`px-3 py-1 rounded-lg transition ${filter === 'HEALTHY' ? 'bg-gradient-to-r from-[#FF007A] to-[#FF7A00] text-white' : 'text-[#64748B]'}`}>Healthy</button>
                  <button onClick={() => setFilter('DOWN')} className={`px-3 py-1 rounded-lg transition ${filter === 'DOWN' ? 'bg-gradient-to-r from-[#FF007A] to-[#FF7A00] text-white' : 'text-[#64748B]'}`}>Down</button>
                </div>
              </div>
            </div>

            {/* Grid of Interactive Endpoint Cards */}
            <div className="grid grid-cols-2 gap-5">
              {filteredEndpoints.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedId(item.id)}
                    className={`bg-[#0D1322] p-6 rounded-2xl border-2 space-y-4 cursor-pointer transition-all duration-300 ${
                      isSelected
                        ? item.status === 'DOWN'
                          ? 'border-[#FF0055] shadow-xl shadow-[#FF0055]/20 scale-[1.01]'
                          : 'border-[#FF7A00] shadow-xl shadow-[#FF7A00]/20 scale-[1.01]'
                        : 'border-[#1E293B] hover:border-[#334155]'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-base text-white">{item.name}</h4>
                        <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs font-mono text-[#F97316] hover:underline flex items-center gap-1 mt-0.5">
                          {item.url} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      
                      <span className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wide ${
                        item.status === 'HEALTHY' 
                          ? 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30' 
                          : 'bg-[#FF0055]/10 text-[#FF0055] border border-[#FF0055]/40 animate-pulse'
                      }`}>
                        ● {item.status} ({item.mode})
                      </span>
                    </div>

                    <div className="text-xs text-[#94A3B8] font-mono flex items-center justify-between pt-2 border-t border-[#1E293B]">
                      <span>Response Time · HTTP {item.httpCode}</span>
                      <span className={`text-base font-black ${item.status === 'DOWN' ? 'text-[#FF0055]' : 'text-white'}`}>
                        {item.responseTime} <span className="text-xs font-normal text-[#64748B]">· {item.uptime} uptime</span>
                      </span>
                    </div>

                    {/* Actions - View Details links dynamically to /user/endpoints/${item.id} */}
                    <div className="flex items-center justify-between pt-2">
                      <a 
                        href={`/user/endpoints/${item.id}`} 
                        onClick={(e) => e.stopPropagation()}
                        className="px-4 py-2 bg-gradient-to-r from-[#FF007A] to-[#FF7A00] text-white rounded-xl text-xs font-bold shadow-md shadow-[#FF7A00]/20 hover:opacity-90 transition"
                      >
                        View Details
                      </a>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button className="px-3 py-1.5 bg-[#1A2338] text-white rounded-lg text-xs font-bold hover:bg-[#24304C]">Probe</button>
                        <button className="px-3 py-1.5 bg-[#1A2338] text-white rounded-lg text-xs font-bold hover:bg-[#24304C]">Edit</button>
                        <button 
                          onClick={() => setEndpoints(endpoints.filter(e => e.id !== item.id))}
                          className="px-3 py-1.5 bg-[#FF0055]/20 text-[#FF0055] rounded-lg text-xs font-bold hover:bg-[#FF0055]/30"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}