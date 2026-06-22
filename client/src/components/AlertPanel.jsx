import React, { useState, useEffect } from 'react';
import { useStore } from '../store';

// Helper component for live ticking relative timer
function RelativeTimer({ timestamp }) {
  const [relativeText, setRelativeText] = useState('');

  useEffect(() => {
    const calculateTime = () => {
      const elapsedMs = Date.now() - timestamp;
      const elapsedSec = Math.floor(elapsedMs / 1000);

      if (elapsedSec < 0) {
        setRelativeText('Just now');
      } else if (elapsedSec < 60) {
        setRelativeText(`${elapsedSec}s ago`);
      } else {
        const mins = Math.floor(elapsedSec / 60);
        const secs = elapsedSec % 60;
        setRelativeText(`${mins}m ${secs}s ago`);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return <span className="font-mono text-xs">{relativeText}</span>;
}

export default function AlertPanel() {
  const alerts = useStore((state) => state.alerts);
  const boats = useStore((state) => state.boats);
  const setFocusedCoords = useStore((state) => state.setFocusedCoords);

  const handleStatusTransition = async (alertId, currentStatus) => {
    let nextStatus = '';
    if (currentStatus === 'ACTIVE') nextStatus = 'ACKNOWLEDGED';
    else if (currentStatus === 'ACKNOWLEDGED') nextStatus = 'DISPATCHED';
    else if (currentStatus === 'DISPATCHED') nextStatus = 'RESOLVED';

    if (!nextStatus) return;

    try {
      const response = await fetch(`/api/alerts/${alertId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!response.ok) {
        throw new Error(`Failed to patch status: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error changing status:', error);
    }
  };

  const getStatusBadgeStyles = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-signal-red bg-opacity-25 text-signal-red border-signal-red animate-pulse';
      case 'ACKNOWLEDGED':
        return 'bg-signal-amber bg-opacity-20 text-signal-amber border-signal-amber';
      case 'DISPATCHED':
        return 'bg-signal-blue bg-opacity-20 text-signal-blue border-signal-blue';
      case 'RESOLVED':
        return 'bg-signal-green bg-opacity-20 text-signal-green border-signal-green';
      default:
        return 'bg-gray-800 text-gray-400 border-gray-700';
    }
  };

  const getActionButtonLabel = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'Acknowledge';
      case 'ACKNOWLEDGED':
        return 'Dispatch Coast Guard';
      case 'DISPATCHED':
        return 'Mark Resolved';
      default:
        return null;
    }
  };

  const getActionButtonStyles = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-signal-amber hover:bg-opacity-90 text-ocean-bg font-semibold';
      case 'ACKNOWLEDGED':
        return 'bg-signal-blue hover:bg-opacity-90 text-text-primary font-semibold';
      case 'DISPATCHED':
        return 'bg-signal-green hover:bg-opacity-90 text-ocean-bg font-semibold';
      default:
        return 'bg-gray-800 text-gray-500 cursor-not-allowed';
    }
  };

  const renderHopPath = (hopPathVal) => {
    let list = [];
    try {
      if (Array.isArray(hopPathVal)) {
        list = hopPathVal;
      } else if (typeof hopPathVal === 'string') {
        const clean = hopPathVal.trim();
        if (clean.startsWith('[') && clean.endsWith(']')) {
          list = JSON.parse(clean);
        } else {
          list = clean.split(',').map((s) => s.trim());
        }
      }
    } catch (e) {
      console.warn('Failed parsing hop path:', e);
    }

    if (!list || list.length === 0) return 'Direct Connection';

    // Map internal node labels to Gateway for presentation
    const formatted = list.map((node) => {
      if (node === 'SHORE_GW' || node === 'GATEWAY') return 'GATEWAY';
      // If we have boat object, get boat name, else node id
      return boats[node] ? boats[node].name : node;
    });

    return formatted.join(' ➔ ');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Panel Title */}
      <div className="px-4 py-3 bg-ocean-surface border-b border-ocean-border flex justify-between items-center shadow-inner">
        <h2 className="text-sm font-bold tracking-wider uppercase text-text-primary">
          🚨 Active Distress Logs
        </h2>
        <span className="text-xs font-semibold bg-ocean-border px-2 py-0.5 rounded text-text-muted">
          {alerts.length} Total
        </span>
      </div>

      {/* Alerts list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {alerts.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-text-muted text-sm space-y-2 py-10">
            <span className="text-2xl opacity-50">🟢</span>
            <p>No active distress alerts reported.</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const boatName = boats[alert.boat_id]?.name || alert.boat_id || 'Unknown Boat';
            const actionLabel = getActionButtonLabel(alert.status);

            return (
              <div
                key={alert.id}
                onClick={() => setFocusedCoords([alert.lat, alert.lng])}
                className="panel-glass p-4 rounded-lg border border-ocean-border hover:border-signal-blue transition-all cursor-pointer flex flex-col space-y-3 relative group"
              >
                {/* Header: Boat Name & Status Badge */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-text-primary group-hover:text-signal-blue transition-colors">
                      {boatName}
                    </h3>
                    <div className="flex space-x-2 mt-0.5 items-center">
                      <span className="text-xs text-text-muted">
                        {alert.lat.toFixed(4)}°N, {alert.lng.toFixed(4)}°E
                      </span>
                    </div>
                  </div>
                  
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeStyles(alert.status)}`}>
                    {alert.status}
                  </span>
                </div>

                {/* Routing Hop Path Chain */}
                <div className="bg-ocean-bg p-2 rounded border border-ocean-border border-opacity-50 text-[11px]">
                  <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider mb-1">
                    🔗 Mesh Routing Chain
                  </div>
                  <div className="font-mono text-text-primary truncate" title={renderHopPath(alert.hop_path)}>
                    {renderHopPath(alert.hop_path)}
                  </div>
                </div>

                {/* Footer relative time & Action Button */}
                <div className="flex justify-between items-center pt-1 border-t border-ocean-border border-opacity-40">
                  <div className="flex items-center space-x-1.5 text-text-muted">
                    <span className="text-xs">⏱️</span>
                    <RelativeTimer timestamp={alert.triggered_at} />
                  </div>

                  {actionLabel && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // prevent map centering on button click
                        handleStatusTransition(alert.id, alert.status);
                      }}
                      className={`px-3 py-1 rounded text-xs transition-colors duration-150 ${getActionButtonStyles(alert.status)}`}
                    >
                      {actionLabel}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
