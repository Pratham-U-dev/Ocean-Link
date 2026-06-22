import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../store';

// Helper to determine coordinates for a node (boat or gateway)
const getNodeCoords = (nodeId, boats) => {
  if (nodeId === 'SHORE_GW' || nodeId === 'GATEWAY') {
    return [12.870, 74.842]; // Mangaluru Port Gateway
  }
  const boat = boats[nodeId];
  return boat ? [boat.lat, boat.lng] : null;
};

// Map Controller component to fly to coordinates when requested
function MapController() {
  const map = useMap();
  const focusedCoords = useStore((state) => state.focusedCoords);
  const setFocusedCoords = useStore((state) => state.setFocusedCoords);

  useEffect(() => {
    if (focusedCoords) {
      map.setView(focusedCoords, 10, { animate: true, duration: 1.5 });
      // Reset focused coords so user can focus same item again
      setFocusedCoords(null);
    }
  }, [focusedCoords, map, setFocusedCoords]);

  return null;
}

// Custom Leaflet DivIcons using raw SVGs
const createBoatIcon = (status) => {
  let color = '#0080ff'; // signal-blue
  let className = '';

  if (status === 'distress') {
    color = '#ff3b3b'; // signal-red
    className = 'pulse-distress';
  } else if (status === 'offline') {
    color = '#7a9cc0'; // text-muted / gray
  }

  return L.divIcon({
    html: `
      <div class="${className}" style="display: flex; justify-content: center; align-items: center; width: 32px; height: 32px;">
        <svg viewBox="0 0 64 64" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 40 L16 52 L48 52 L56 40 Z" fill="${color}" stroke="#0a0f1e" stroke-width="2.5" />
          <rect x="25" y="24" width="14" height="16" fill="${color}" stroke="#0a0f1e" stroke-width="2" />
          <line x1="32" y1="8" x2="32" y2="24" stroke="${color}" stroke-width="3" />
          <polygon points="32,8 48,12 32,16" fill="${color}" />
        </svg>
      </div>
    `,
    className: '', // Clear Leaflet default container styles
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

const gatewayIcon = L.divIcon({
  html: `
    <div style="display: flex; justify-content: center; align-items: center; width: 38px; height: 38px;">
      <svg viewBox="0 0 64 64" width="38" height="38" xmlns="http://www.w3.org/2000/svg">
        <polygon points="32,8 18,58 46,58" fill="none" stroke="#00c878" stroke-width="3.5" />
        <line x1="25" y1="34" x2="39" y2="34" stroke="#00c878" stroke-width="3" />
        <line x1="22" y1="46" x2="42" y2="46" stroke="#00c878" stroke-width="3" />
        <circle cx="32" cy="8" r="6" fill="#00c878" />
        <circle cx="32" cy="8" r="12" fill="none" stroke="#00c878" stroke-width="1.5" stroke-dasharray="3,3" />
      </svg>
    </div>
  `,
  className: '',
  iconSize: [38, 38],
  iconAnchor: [19, 58],
  popupAnchor: [0, -50]
});

const createSonarIcon = () => {
  return L.divIcon({
    html: `
      <div style="position: relative; width: 0; height: 0;">
        <div class="sonar-ring sonar-ring-1"></div>
        <div class="sonar-ring sonar-ring-2"></div>
        <div class="sonar-ring sonar-ring-3"></div>
      </div>
    `,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

export default function Map() {
  const boats = useStore((state) => state.boats);
  const alerts = useStore((state) => state.alerts);
  const hopPaths = useStore((state) => state.hopPaths);

  const [timeTick, setTimeTick] = useState(Date.now());

  // Periodically force update of active hops to handle automatic fading
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick(Date.now());
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const activeBoatsList = Object.values(boats);
  const now = Date.now();

  // Filter hops that are active (under 3s old)
  const activeHops = hopPaths.filter((hop) => timeTick - hop.timestamp <= 3000);

  return (
    <MapContainer
      center={[13.5, 74.5]}
      zoom={8}
      zoomControl={true}
      className="w-full h-full"
    >
      {/* Premium dark mode map tiles */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <MapController />

      {/* Gateway Marker */}
      <Marker position={[12.870, 74.842]} icon={gatewayIcon}>
        <Popup>
          <div className="text-xs p-1">
            <h3 className="font-bold text-signal-green text-sm mb-1">📟 Shore Gateway (GW_01)</h3>
            <p className="text-text-muted">Mangaluru Port Base Station</p>
            <p className="mt-1"><strong className="text-text-primary">Status:</strong> Operational</p>
            <p><strong className="text-text-primary">Coordinates:</strong> 12.870°N, 74.842°E</p>
          </div>
        </Popup>
      </Marker>

      {/* Boat Markers */}
      {activeBoatsList.map((boat) => {
        const isOffline = (now - (boat.last_seen || 0)) > 15000;
        const isDistress = boat.status === 'distress';
        
        let statusKey = 'online';
        if (isDistress) statusKey = 'distress';
        else if (isOffline) statusKey = 'offline';

        const lastSeenSec = Math.round((now - (boat.last_seen || 0)) / 1000);

        return (
          <Marker
            key={boat.id}
            position={[boat.lat, boat.lng]}
            icon={createBoatIcon(statusKey)}
          >
            <Popup>
              <div className="text-xs p-1">
                <div className="flex justify-between items-center mb-1.5 border-b border-ocean-border pb-1">
                  <h3 className="font-bold text-sm text-text-primary">{boat.name}</h3>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    isDistress ? 'bg-signal-red text-white' : isOffline ? 'bg-gray-700 text-text-muted' : 'bg-signal-blue text-white'
                  }`}>
                    {statusKey.toUpperCase()}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Battery:</span>
                    <span className={`font-semibold ${boat.battery < 30 ? 'text-signal-red' : boat.battery < 60 ? 'text-signal-amber' : 'text-signal-green'}`}>
                      {boat.battery}%
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Coordinates:</span>
                    <p className="text-text-primary">{boat.lat.toFixed(4)}°N, {boat.lng.toFixed(4)}°E</p>
                  </div>
                  <div className="flex justify-between border-t border-ocean-border pt-1 mt-1 text-[10px] text-text-muted">
                    <span>Last Ping:</span>
                    <span>{isOffline ? `${lastSeenSec}s ago` : 'Active Now'}</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Distress Sonar Rings for Active Alerts */}
      {alerts
        .filter((alert) => alert.status === 'ACTIVE')
        .map((alert) => (
          <Marker
            key={`sonar-${alert.id}`}
            position={[alert.lat, alert.lng]}
            icon={createSonarIcon()}
          />
        ))}

      {/* Active Hop Lines (Fade out after 3 seconds) */}
      {activeHops.map((hop) => {
        const fromCoords = getNodeCoords(hop.fromNode, boats);
        const toCoords = getNodeCoords(hop.toNode, boats);

        if (!fromCoords || !toCoords) return null;

        return (
          <Polyline
            key={hop.id}
            positions={[fromCoords, toCoords]}
            pathOptions={{
              color: '#ffaa00',
              weight: 3.5,
              opacity: 0.9,
              dashArray: '10, 6',
              className: 'hop-line-active'
            }}
          />
        );
      })}
    </MapContainer>
  );
}
