import React, { useState } from 'react';
import { useStore } from '../store';

const BOAT_IDS = [
  'BOAT_01', 'BOAT_02', 'BOAT_03', 'BOAT_04', 'BOAT_05',
  'BOAT_06', 'BOAT_07', 'BOAT_08', 'BOAT_09', 'BOAT_10'
];

export default function SimControls() {
  const [selectedBoat, setSelectedBoat] = useState(BOAT_IDS[0]);
  const [loading, setLoading] = useState(false);
  const boats = useStore((state) => state.boats);
  const alerts = useStore((state) => state.alerts);

  const activeAlerts = alerts.filter(a => a.status !== 'RESOLVED').length;

  const triggerDistress = async () => {
    setLoading(true);
    try {
      await fetch('/api/simulate/distress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boatId: selectedBoat })
      });
    } catch (e) {
      console.error('Failed to trigger distress:', e);
    }
    setLoading(false);
  };

  const resetAll = async () => {
    setLoading(true);
    try {
      await fetch('/api/simulate/reset', { method: 'POST' });
    } catch (e) {
      console.error('Failed to reset:', e);
    }
    setLoading(false);
  };

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">🎮 Demo Controls</h3>

      {/* Boat selector + Trigger button */}
      <div className="flex gap-2 mb-3">
        <select
          value={selectedBoat}
          onChange={(e) => setSelectedBoat(e.target.value)}
          className="flex-1 bg-ocean-bg border border-ocean-border rounded px-2 py-1.5 text-xs text-text-primary focus:border-signal-blue outline-none"
        >
          {BOAT_IDS.map(id => (
            <option key={id} value={id}>
              {boats[id]?.name || id}
            </option>
          ))}
        </select>
        <button
          onClick={triggerDistress}
          disabled={loading}
          className="bg-signal-red hover:bg-opacity-80 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          🚨 Trigger Distress
        </button>
      </div>

      {/* Reset button */}
      <button
        onClick={resetAll}
        disabled={loading}
        className="w-full bg-ocean-bg border border-ocean-border hover:border-signal-amber text-text-muted hover:text-signal-amber text-xs font-semibold px-3 py-1.5 rounded transition-colors disabled:opacity-50"
      >
        ↻ Reset All Alerts
      </button>

      {/* Live counters */}
      <div className="flex justify-between mt-3 text-[10px] text-text-muted uppercase font-semibold">
        <span>Boats: {Object.keys(boats).length}</span>
        <span>Unresolved: {activeAlerts}</span>
      </div>
    </div>
  );
}
