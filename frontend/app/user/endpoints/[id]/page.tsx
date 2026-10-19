'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { api, ApiError, type Endpoint, type HistoryItem } from '@/lib/api';
import { usePolling, useRequireLogin } from '@/lib/hooks';
import { formatClock, formatDateTime, formatMs, isDownish, stateInfo, uptimePercent } from '@/lib/format';

export default function EndpointDetailPage() {
  useRequireLogin();
  const params = useParams();
  const id = Number(params?.id);

  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = async () => {
    try {
      const [ep, hist] = await Promise.all([api.getEndpoint(id), api.history(id, 100)]);
      setEndpoint(ep);
      setHistory(hist);
      setError('');
      setNotFound(false);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(err.message || 'Could not load data');
    }
  };
  usePolling(load, 5000);

  const togglePause = async () => {
    if (!endpoint) return;
    try {
      await api.updateEndpoint(endpoint.id, { enabled: !endpoint.enabled });
      await load();
    } catch (err: any) {
      window.alert(err.message || 'Could not change monitoring');
    }
  };

  // history comes newest first. The chart and the blocks want oldest first.
  const oldestFirst = [...history].reverse();
  const chartData = oldestFirst.slice(-60).map((h) => ({
    time: formatClock(h.checked_at),
    responseTime: Math.round(h.response_time_ms ?? 0),
  }));
  const last48 = oldestFirst.slice(-48);
  const padding = 48 - last48.length;
  const uptime48 = uptimePercent(last48);
  const logs = history.slice(0, 20);

  const info = endpoint ? stateInfo(endpoint.current_state, endpoint.enabled) : null;
  const downish = endpoint ? isDownish(endpoint.current_state) : false;

  return (
    <div className="flex min-h-screen bg-[#060913] text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar title="Endpoint Details & Monitoring History" />

        <main className="p-8 space-y-6 max-w-[1700px] w-full mx-auto">

          <div className="flex items-center gap-4">
            <a href="/user/dashboard" className="px-4 py-2 bg-[#0D1322] border border-[#1E293B] rounded-xl text-xs font-bold text-white hover:bg-[#1A2338] transition flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </a>
          </div>

          {error && (
            <p className="text-xs font-bold text-[#FF0055] bg-[#FF0055]/10 border border-[#FF0055]/30 rounded-xl p-3">{error}</p>
          )}

          {notFound && (
            <div className="bg-[#0D1322] p-8 rounded-2xl border border-[#1E293B] text-center text-sm text-[#94A3B8]">
              This endpoint does not exist (it may have been deleted).
            </div>
          )}

          {endpoint && info && (
            <>
              {/* Header Card */}
              <div className="bg-[#0D1322] p-6 rounded-2xl border-2 border-[#FF007A]/40 shadow-xl space-y-3">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-black text-white">{endpoint.name}</h2>
                      <span className={`px-3 py-0.5 rounded-full text-xs font-black ${info.badge}`}>● {info.label}</span>
                      {downish && endpoint.enabled && (
                        <span className="px-3 py-0.5 rounded-full text-xs font-black bg-[#FF7A00]/20 text-[#FF7A00]">
                          FAST Checking ({endpoint.fast_check_interval}s)
                        </span>
                      )}
                    </div>
                    <a href={endpoint.url} target="_blank" rel="noreferrer" className="text-xs font-mono text-[#F97316] hover:underline flex items-center gap-1">
                      {endpoint.url} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <p className="text-[11px] font-mono text-[#64748B]">
                      Checks every {endpoint.check_interval}s · last check {formatDateTime(endpoint.last_check_at)}
                    </p>
                  </div>

                  <button
                    onClick={togglePause}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#FF007A] to-[#FF7A00] text-white rounded-xl text-xs font-black shadow-lg shadow-[#FF7A00]/30 hover:opacity-90"
                  >
                    {endpoint.enabled ? 'Pause Monitoring' : 'Resume Monitoring'}
                  </button>
                </div>
              </div>

              {/* Charts & Grid Blocks */}
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-2 bg-[#0D1322] p-6 rounded-2xl border border-[#1E293B] space-y-4">
                  <h3 className="font-black text-sm text-white">Detailed Response Time (ms) · latest {chartData.length} checks</h3>
                  <div className="h-60 w-full pt-4">
                    {chartData.length === 0 ? (
                      <p className="text-xs text-[#64748B] pt-16 text-center">No checks yet. The first result appears within a few seconds.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <XAxis dataKey="time" stroke="#475569" fontSize={11} />
                          <YAxis stroke="#475569" fontSize={11} />
                          <Tooltip contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#1E293B' }} />
                          <Area type="monotone" dataKey="responseTime" stroke="#FF007A" strokeWidth={3} fill="#FF007A" fillOpacity={0.2} isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Uptime History Block Visualizer */}
                <div className="bg-[#0D1322] p-6 rounded-2xl border border-[#1E293B] space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-black text-sm text-white">Uptime History (Last 48 Checks)</h3>
                    <span className="text-xs font-mono text-[#10B981] font-bold">{uptime48 != null ? `${uptime48}%` : '—'}</span>
                  </div>
                  <p className="text-xs text-[#64748B]">Each block represents one monitoring check</p>

                  <div className="grid grid-cols-12 gap-2 pt-2" data-testid="uptime-blocks">
                    {Array.from({ length: padding }).map((_, i) => (
                      <div key={`empty-${i}`} className="h-8 rounded-md bg-[#1E293B]" />
                    ))}
                    {last48.map((h) => (
                      <div
                        key={h.id}
                        title={`${formatDateTime(h.checked_at)} · ${h.is_success ? 'UP' : 'DOWN'}`}
                        className={`h-8 rounded-md transition-all ${
                          h.is_success ? 'bg-[#10B981]' : 'bg-[#FF0055] shadow-sm shadow-[#FF0055]'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono font-bold pt-4 text-[#94A3B8]">
                    <span className="text-[#10B981]">● UP</span>
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
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[#64748B]">No checks recorded yet.</td>
                      </tr>
                    )}
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#131B2E]">
                        <td className="py-3.5 text-white">{formatDateTime(log.checked_at)}</td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            log.is_success ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#FF0055]/20 text-[#FF0055]'
                          }`}>
                            {log.is_success ? 'UP' : 'DOWN'}
                          </span>
                        </td>
                        <td className="py-3.5 text-white">{formatMs(log.response_time_ms)}</td>
                        <td className="py-3.5 text-white">{log.status_code ?? '—'}</td>
                        <td className="py-3.5 text-[#94A3B8]">{log.error || 'None'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </main>
      </div>
    </div>
  );
}
