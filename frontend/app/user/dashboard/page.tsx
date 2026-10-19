'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, ExternalLink } from 'lucide-react';
import { api, type DashboardSummary, type Endpoint, type HistoryItem } from '@/lib/api';
import { usePolling, useRequireLogin } from '@/lib/hooks';
import { formatClock, formatMs, isDownish, modeLabel, percentile, stateInfo, uptimePercent } from '@/lib/format';

// Builds the chart from the latest checks of all websites:
// the checks are sorted by time and cut into up to 12 groups.
function buildChartData(histories: Record<number, HistoryItem[]>) {
  const ok = Object.values(histories)
    .flat()
    .filter((h) => h.is_success && h.response_time_ms != null)
    .sort((a, b) => new Date(a.checked_at).getTime() - new Date(b.checked_at).getTime());
  if (ok.length === 0) return { data: [], mean: 0, p95: 0 };

  const size = Math.max(1, Math.ceil(ok.length / 12));
  const data = [];
  for (let i = 0; i < ok.length; i += size) {
    const group = ok.slice(i, i + size);
    const values = group.map((g) => g.response_time_ms as number);
    data.push({
      time: formatClock(group[group.length - 1].checked_at),
      mean: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      p95: Math.round(percentile(values, 95)),
    });
  }
  const all = ok.map((g) => g.response_time_ms as number);
  return {
    data,
    mean: Math.round(all.reduce((a, b) => a + b, 0) / all.length),
    p95: Math.round(percentile(all, 95)),
  };
}

export default function UserDashboard() {
  useRequireLogin();

  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [histories, setHistories] = useState<Record<number, HistoryItem[]>>({});
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'HEALTHY' | 'DOWN'>('ALL');

  // Loads everything from the backend. Runs now and then every 5 seconds.
  const load = async () => {
    try {
      const [eps, sum] = await Promise.all([api.listEndpoints(), api.summary()]);
      const lists = await Promise.all(eps.map((e) => api.history(e.id, 100)));
      const map: Record<number, HistoryItem[]> = {};
      eps.forEach((e, i) => (map[e.id] = lists[i]));
      setEndpoints(eps);
      setSummary(sum);
      setHistories(map);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Could not load data');
    } finally {
      setLoaded(true);
    }
  };
  usePolling(load, 5000);

  const handleDelete = async (ep: Endpoint) => {
    if (!window.confirm(`Delete "${ep.name}" and all its history?`)) return;
    try {
      await api.deleteEndpoint(ep.id);
      await load();
    } catch (err: any) {
      window.alert(err.message || 'Could not delete');
    }
  };

  const handleEdit = async (ep: Endpoint) => {
    const name = window.prompt('Service name', ep.name);
    if (name === null) return;
    const url = window.prompt('Endpoint URL', ep.url);
    if (url === null) return;
    try {
      await api.updateEndpoint(ep.id, { name, url });
      await load();
    } catch (err: any) {
      window.alert(err.message || 'Could not save');
    }
  };

  const filteredEndpoints = endpoints.filter((item) => {
    const downish = isDownish(item.current_state);
    const matchesFilter =
      filter === 'ALL' ||
      (filter === 'HEALTHY' && item.current_state === 'HEALTHY') ||
      (filter === 'DOWN' && downish);
    const q = search.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(q) || item.url.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const chart = buildChartData(histories);

  return (
    <div className="flex min-h-screen bg-[#060913] text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar title="System Health Dashboard" onCreated={load} />

        <main className="p-8 space-y-8 max-w-[1700px] w-full mx-auto">

          {error && (
            <p className="text-xs font-bold text-[#FF0055] bg-[#FF0055]/10 border border-[#FF0055]/30 rounded-xl p-3">
              {error}
            </p>
          )}

          {/* Top Metric Cards */}
          <div className="grid grid-cols-6 gap-4">
            <div className="bg-[#0D1322] p-5 rounded-2xl border border-[#1E293B]">
              <span className="text-xs font-bold text-[#94A3B8]">Total Monitored</span>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-3xl font-black text-white">{summary?.total_monitored ?? 0}</p>
                <span className="text-xs font-mono text-[#F97316]">Endpoints</span>
              </div>
            </div>

            <div className="bg-[#0D1322] p-5 rounded-2xl border border-[#1E293B]">
              <span className="text-xs font-bold text-[#94A3B8]">Healthy Endpoints</span>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-3xl font-black text-[#10B981]">{summary?.healthy ?? 0}</p>
                <span className="text-xs font-mono text-[#10B981]">Normal Check</span>
              </div>
            </div>

            <div className="bg-[#0D1322] p-5 rounded-2xl border border-[#FF0055]/30 bg-gradient-to-b from-[#FF0055]/5 to-transparent">
              <span className="text-xs font-bold text-[#94A3B8]">Down Endpoints</span>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-3xl font-black text-[#FF0055]">{summary?.down ?? 0}</p>
                <span className="text-xs font-mono text-[#FF0055] animate-pulse">Fast Check</span>
              </div>
            </div>

            <div className="bg-[#0D1322] p-5 rounded-2xl border border-[#F59E0B]/30">
              <span className="text-xs font-bold text-[#94A3B8]">Active Incidents</span>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-3xl font-black text-[#F59E0B]">{summary?.active_incidents ?? 0}</p>
                <span className="text-xs font-mono text-[#F59E0B]">Open Alert</span>
              </div>
            </div>

            <div className="bg-[#0D1322] p-5 rounded-2xl border border-[#1E293B]">
              <span className="text-xs font-bold text-[#94A3B8]">Avg Response Time</span>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-3xl font-black text-white">{formatMs(summary?.average_response_time_ms)}</p>
                <span className="text-xs font-mono text-[#F97316]">24h Mean</span>
              </div>
            </div>

            <div className="bg-[#0D1322] p-5 rounded-2xl border border-[#1E293B]">
              <span className="text-xs font-bold text-[#94A3B8]">Overall Uptime</span>
              <div className="flex items-baseline justify-between mt-2">
                <p className="text-3xl font-black text-[#EC4899]">
                  {summary?.overall_uptime_percent != null ? `${summary.overall_uptime_percent}%` : '—'}
                </p>
                <span className="text-xs font-mono text-[#94A3B8]">24h</span>
              </div>
            </div>
          </div>

          {/* Telemetry Chart */}
          <div className="bg-[#0D1322] p-6 rounded-2xl border border-[#1E293B] space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-black text-base text-white tracking-tight flex items-center gap-2">
                  <span className="text-[#F97316]">📈</span> Global Response-Time Telemetry (Latest Checks)
                </h3>
                <p className="text-xs font-medium text-[#64748B]">Latest 100 checks of every endpoint · P95 vs Mean</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono font-bold">
                <span className="flex items-center gap-1.5 text-[#F97316]">
                  <span className="w-2.5 h-1 bg-[#F97316] rounded-full"></span> Mean Latency ({chart.mean}ms)
                </span>
                <span className="flex items-center gap-1.5 text-[#10B981]">
                  <span className="w-2.5 h-1 bg-[#10B981] rounded-full"></span> P95 Threshold ({chart.p95}ms)
                </span>
              </div>
            </div>

            <div className="h-64 w-full pt-4">
              {chart.data.length === 0 ? (
                <p className="text-xs text-[#64748B] pt-16 text-center">
                  No successful checks yet. Results appear here a few seconds after you add an endpoint.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart.data}>
                    <defs>
                      <linearGradient id="meanGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF007A" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#FF007A" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#1E293B', borderRadius: '12px' }} />
                    <Area type="monotone" dataKey="p95" stroke="#10B981" strokeWidth={2} strokeDasharray="4 4" fill="transparent" isAnimationActive={false} />
                    <Area type="monotone" dataKey="mean" stroke="#FF007A" strokeWidth={3} fillOpacity={1} fill="url(#meanGradient)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Cards Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg text-white">Monitored Endpoint Cards ({filteredEndpoints.length})</h3>
                <p className="text-xs text-[#64748B]">Click any card to select it. The page refreshes by itself every 5 seconds.</p>
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

            {loaded && endpoints.length === 0 && (
              <div className="bg-[#0D1322] p-8 rounded-2xl border border-dashed border-[#1E293B] text-center text-xs text-[#94A3B8]">
                You are not monitoring anything yet. Click <strong className="text-white">Add Endpoint</strong> to start.
              </div>
            )}

            {/* Grid of Interactive Endpoint Cards */}
            <div className="grid grid-cols-2 gap-5">
              {filteredEndpoints.map((item) => {
                const isSelected = selectedId === item.id;
                const downish = isDownish(item.current_state);
                const history = histories[item.id] ?? [];
                const latest = history[0];
                const info = stateInfo(item.current_state, item.enabled);
                const uptime = uptimePercent(history);
                return (
                  <div
                    key={item.id}
                    data-testid={`endpoint-card-${item.id}`}
                    onClick={() => setSelectedId(item.id)}
                    className={`bg-[#0D1322] p-6 rounded-2xl border-2 space-y-4 cursor-pointer transition-all duration-300 ${
                      isSelected
                        ? downish
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

                      <span className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wide ${info.badge}`}>
                        ● {info.label} ({modeLabel(item)})
                      </span>
                    </div>

                    <div className="text-xs text-[#94A3B8] font-mono flex items-center justify-between pt-2 border-t border-[#1E293B]">
                      <span>Response Time · HTTP {latest?.status_code ?? '—'}</span>
                      <span className={`text-base font-black ${downish ? 'text-[#FF0055]' : 'text-white'}`}>
                        {formatMs(latest?.response_time_ms)}{' '}
                        <span className="text-xs font-normal text-[#64748B]">
                          · {uptime != null ? `${uptime}%` : '—'} uptime
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <a
                        href={`/user/endpoints/${item.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-4 py-2 bg-gradient-to-r from-[#FF007A] to-[#FF7A00] text-white rounded-xl text-xs font-bold shadow-md shadow-[#FF7A00]/20 hover:opacity-90 transition"
                      >
                        View Details
                      </a>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={load} className="px-3 py-1.5 bg-[#1A2338] text-white rounded-lg text-xs font-bold hover:bg-[#24304C]">Refresh</button>
                        <button onClick={() => handleEdit(item)} className="px-3 py-1.5 bg-[#1A2338] text-white rounded-lg text-xs font-bold hover:bg-[#24304C]">Edit</button>
                        <button
                          onClick={() => handleDelete(item)}
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
