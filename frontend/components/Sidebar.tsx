'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Globe, AlertTriangle, Bell, Shield, LogOut } from 'lucide-react';

export default function Sidebar() {
  const rawPathname = usePathname();
  const [pathname, setPathname] = useState('');

  useEffect(() => {
    if (rawPathname) setPathname(rawPathname);
  }, [rawPathname]);

  const navLinks = [
    { name: 'Dashboard', href: '/user/dashboard', icon: LayoutDashboard, count: '12' },
    { name: 'Endpoints', href: '/user/endpoints/1', icon: Globe, status: '2 Down', statusColor: 'text-pink-500 font-bold' },
    { name: 'Incidents', href: '/user/incidents', icon: AlertTriangle, status: '1 Active', statusColor: 'text-amber-400 font-bold' },
    { name: 'Alert Settings', href: '/user/settings', icon: Bell },
  ];

  return (
    <aside className="w-64 bg-[#0B0F19] border-r border-[#1E293B] min-h-screen p-5 flex flex-col justify-between shrink-0 shadow-2xl">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#EA580C] to-[#EC4899] p-0.5 shadow-lg shadow-[#EA580C]/30">
            <div className="w-full h-full bg-[#0B0F19] rounded-[10px] flex items-center justify-center text-[#F97316]">
              <Shield className="w-5 h-5 fill-[#F97316]/20" />
            </div>
          </div>
          <div>
            <h1 className="font-black text-lg text-white tracking-wider flex items-center gap-1">
              Ops<span className="text-[#F97316]">Guard</span>
            </h1>
            <span className="text-[10px] text-[#94A3B8] font-bold tracking-widest uppercase block -mt-1">
              Reliability Console
            </span>
          </div>
        </div>

        <div className="text-[10px] font-black text-[#64748B] tracking-widest uppercase px-3 mb-3">
          Standard User Portal
        </div>

        {/* Nav Items */}
        <nav className="space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href.includes('/endpoints') && pathname.includes('/endpoints'));
            return (
              <a
                key={link.href}
                href={link.href}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#FF007A] to-[#FF7A00] text-white shadow-lg shadow-[#FF7A00]/20'
                    : 'text-[#94A3B8] hover:bg-[#1E293B]/60 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{link.name}</span>
                </div>
                {link.count && (
                  <span className="text-[11px] font-mono bg-[#0B0F19]/40 px-2 py-0.5 rounded-md text-white">
                    {link.count}
                  </span>
                )}
                {link.status && (
                  <span className={`text-[10px] font-mono ${link.statusColor}`}>
                    {link.status}
                  </span>
                )}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Logout */}
      <div className="border-t border-[#1E293B] pt-4">
        <a
          href="/"
          className="flex items-center gap-2 text-xs font-bold text-[#64748B] hover:text-[#EF4444] px-3 py-2 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" /> Exit Session
        </a>
      </div>
    </aside>
  );
}