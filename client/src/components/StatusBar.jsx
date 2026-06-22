import React, { useState, useEffect } from 'react';
import { useStore } from '../store';

export default function StatusBar() {
  const wsConnected = useStore((state) => state.wsConnected);
  const boats = useStore((state) => state.boats);
  const alerts = useStore((state) => state.alerts);

  const [timeStr, setTimeStr] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const totalBoats = Object.keys(boats).length;
  
  // Calculate online boats (last seen in past 15s)
  const now = Date.now();
  const onlineBoats = Object.values(boats).filter(
    (boat) => (now - (boat.last_seen || 0)) <= 15000
  ).length;

  const activeAlerts = alerts.filter(a => a.status === 'ACTIVE').length;
  const unresolvedAlerts = alerts.filter(a => a.status !== 'RESOLVED').length;

  return (
    <div className="h-14 bg-ocean-surface border-b border-ocean-border px-6 flex items-center justify-between z-10 shadow-lg">
      {/* Left section: Identity */}
      <div className="flex items-center space-x-3">
        <span className="text-xl font-bold tracking-wider text-signal-blue flex items-center gap-1.5">
          ⚓ OCEANLINK
        </span>
        <span className="text-sm font-medium border-l border-ocean-border pl-3 text-text-muted">
          Karnataka Coast Guard Control Room
        </span>
      </div>

      {/* Right section: System stats */}
      <div className="flex items-center space-x-6 text-sm">
        {/* WebSocket Connection Status */}
        <div className="flex items-center space-x-2 bg-ocean-bg px-3 py-1.5 rounded border border-ocean-border">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              wsConnected 
                ? 'bg-signal-green shadow-[0_0_8px_#00c878]' 
                : 'bg-signal-red shadow-[0_0_8px_#ff3b3b]'
            }`}
          />
          <span className="font-semibold text-xs tracking-wide">
            {wsConnected ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
          </span>
        </div>

        {/* Connected Boats Count */}
        <div className="flex flex-col text-right">
          <span className="text-[10px] text-text-muted uppercase font-semibold leading-none mb-0.5">Boats Online</span>
          <span className="text-base font-bold text-text-primary leading-none">
            {onlineBoats} <span className="text-text-muted text-xs font-normal">/ {totalBoats}</span>
          </span>
        </div>

        {/* Active Alerts Count */}
        <div className="flex flex-col text-right">
          <span className="text-[10px] text-text-muted uppercase font-semibold leading-none mb-0.5">Active Alerts</span>
          <span className="text-base font-bold text-signal-red leading-none">
            {activeAlerts}{' '}
            {unresolvedAlerts > activeAlerts && (
              <span className="text-signal-amber text-xs font-normal">
                ({unresolvedAlerts - activeAlerts} acknowledged)
              </span>
            )}
          </span>
        </div>

        {/* Live System Clock */}
        <div className="border-l border-ocean-border pl-6 flex flex-col text-right">
          <span className="text-[10px] text-text-muted uppercase font-semibold leading-none mb-0.5">Local Time</span>
          <span className="text-base font-mono font-semibold tracking-wider text-text-primary leading-none">
            {timeStr}
          </span>
        </div>
      </div>
    </div>
  );
}
