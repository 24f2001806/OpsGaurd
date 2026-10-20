'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { AlertOctagon } from 'lucide-react';
import { api, type Endpoint, type Incident } from '@/lib/api';
import { usePolling, useRequireLogin } from '@/lib/hooks';
import { formatDateTime, formatDuration } from '@/lib/format';

export default function IncidentsPage() {
  useRequireLogin();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null);

  const load = async () => {
    try {
      const [list, eps] = await Promise.all([api.incidents(), api.listEndpoints()]);
      const map: Record<number, string> = {};
      eps.forEach((e: Endpoint) => (map[e.id] = e.url));
      setIncidents(list);
      setUrls(map);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Could not load incidents');
    } finally {
      setLoaded(true);
    }
  };
  usePolling(load, 5000);

  const active = incidents.filter((i) => i.status === 'OPEN').length;
  const resolved = incidents.length - active;

  const durationOf = (item: Incident) => {
    if (item.duration_seconds != null) return formatDuration(item.duration_seconds);
    if (item.resolved_at) {
      return formatDuration((new Date(item.resolved_at).getTime() - new Date(item.started_at).getTime()) / 1000);
    }
    return formatDuration((Date.now() - new Date(item.started_at).getTime()) / 1000) + ' (ongoing)';
  };

  return (
    <div className="flex min-h-screen bg-[#060913] text-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar title="Incident Command & Outage Logs" />

        <main className="p-8 space-y-6 max-w-[1700px] w-full mx-auto">

          {error && (
            <p className="text-xs font-bold text-[#FF0055] bg-[#FF0055]/10 border border-[#FF0055]/30 rounded-xl p-3">{error}</p>
          )}

          <div className="bg-[#0D1322] p-6 rounded-2xl border-2 border-[#FF0055]/40 shadow-xl flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF0055] to-[#FF7A00] flex items-center justify-center text-white shadow-lg shadow-[#FF0055]/30">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Incident Command & Outage Center</h2>
                <p className="text-xs text-[#94A3B8]">An incident opens when a website fails 2 checks in a row and closes by itself when it recovers</p>
              </div>
            </div>

            <div className="text-xs font-black font-mono text-right space-y-1">
              <p className="text-[#FF0055]">{active} active</p>
              <p className="text-[#10B981]">{resolved} resolved</p>
            </div>
          </div>

          {loaded && incidents.length === 0 && (
            <div className="bg-[#0D1322] p-8 rounded-2xl border border-dashed border-[#1E293B] text-center text-xs text-[#94A3B8]">
              No incidents recorded. Everything you monitor has been healthy.
            </div>
          )}

          <div className="space-y-4">
            {incidents.map((item) => {
              const isActive = item.status === 'OPEN';
              const isSelected = selectedIncidentId === item.id;
              return (
                <div
                  key={item.id}
                  data-testid={`incident-${item.id}`}
                  onClick={() => setSelectedIncidentId(item.id)}
                  className={`p-6 rounded-2xl border-2 bg-[#0D1322] space-y-4 cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? isActive
                        ? 'border-[#FF0055] shadow-xl shadow-[#FF0055]/20 scale-[1.005]'
                        : 'border-[#10B981] shadow-xl shadow-[#10B981]/20 scale-[1.005]'
                      : 'border-[#1E293B] hover:border-[#334155]'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-black ${
                        isActive ? 'bg-[#FF0055]/20 text-[#FF0055] border border-[#FF0055]/40' : 'bg-[#10B981]/20 text-[#10B981]'
                      }`}>
                        ● {isActive ? 'ACTIVE' : 'RESOLVED'}
                      </span>
                      <h4 className="font-black text-base text-white">{item.endpoint_name ?? `Endpoint ${item.endpoint_id}`}</h4>
                      {urls[item.endpoint_id] && (
                        <span className="text-xs font-mono text-[#F97316]">({urls[item.endpoint_id]})</span>
                      )}
                    </div>

                    <a
                      href={`/user/endpoints/${item.endpoint_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-4 py-2 bg-[#1A2338] text-white rounded-xl text-xs font-bold hover:bg-[#24304C]"
                    >
                      Inspect Telemetry
                    </a>
                  </div>

                  <div className="bg-[#0B0F19] p-4 rounded-xl border border-[#1E293B] text-xs space-y-2">
                    <p className="text-[#94A3B8] font-mono">
                      <strong className="text-white font-sans">Incident:</strong> INC-{String(item.id).padStart(4, '0')} ·{' '}
                      <strong className="text-white font-sans">Started:</strong> {formatDateTime(item.started_at)} ·{' '}
                      <strong className="text-white font-sans">Duration:</strong> {durationOf(item)}
                    </p>
                    {item.resolved_at && (
                      <p className="text-[#94A3B8] font-mono">
                        <strong className="text-white font-sans">Resolved:</strong> {formatDateTime(item.resolved_at)}
                      </p>
                    )}
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
