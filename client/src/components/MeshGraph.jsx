import React from 'react';
import { useStore } from '../store';

// ponytail: O(N) linear scan to project geo coords into SVG pixel space.
// Ceiling: N > 200 nodes would warrant a proper spatial transform. Fine for 11 nodes.
export default function MeshGraph() {
  const topology = useStore((state) => state.topology);
  const hopPaths = useStore((state) => state.hopPaths);

  const { nodes = [], edges = [] } = topology;
  if (nodes.length === 0) return <div className="text-text-muted text-xs text-center py-4">Awaiting mesh data…</div>;

  // Compute bounding box and project to SVG coords
  const W = 280, H = 200, PAD = 24;
  const lats = nodes.map(n => n.lat);
  const lngs = nodes.map(n => n.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const dLat = maxLat - minLat || 1;
  const dLng = maxLng - minLng || 1;

  const project = (lat, lng) => ({
    x: PAD + ((lng - minLng) / dLng) * (W - 2 * PAD),
    // Flip Y so north is top
    y: PAD + ((maxLat - lat) / dLat) * (H - 2 * PAD)
  });

  const posMap = {};
  nodes.forEach(n => { posMap[n.id] = project(n.lat, n.lng); });

  // Build set of active hop edges for highlighting
  const now = Date.now();
  const activeEdgeSet = new Set();
  hopPaths
    .filter(h => now - h.timestamp <= 1500)
    .forEach(h => {
      activeEdgeSet.add(`${h.fromNode}-${h.toNode}`);
      activeEdgeSet.add(`${h.toNode}-${h.fromNode}`);
    });

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">📡 Mesh Topology</h3>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Edges */}
        {edges.map((e, i) => {
          const a = posMap[e.from], b = posMap[e.to];
          if (!a || !b) return null;
          const key = `${e.from}-${e.to}`;
          const isActive = activeEdgeSet.has(key);
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              className={isActive ? 'mesh-edge-active' : 'mesh-edge-normal mesh-edge'}
            />
          );
        })}
        {/* Nodes */}
        {nodes.map(n => {
          const p = posMap[n.id];
          if (!p) return null;
          const isGateway = n.type === 'gateway';
          return (
            <g key={n.id}>
              {isGateway ? (
                <rect
                  x={p.x - 6} y={p.y - 6} width={12} height={12}
                  fill="#00c878" rx={2}
                  className="mesh-node"
                />
              ) : (
                <circle
                  cx={p.x} cy={p.y} r={5}
                  fill="#0080ff"
                  className="mesh-node"
                />
              )}
              <text
                x={p.x} y={p.y + (isGateway ? 18 : 14)}
                textAnchor="middle" fill="#7a9cc0"
                fontSize="8" fontWeight="600"
              >
                {isGateway ? 'GW' : n.id.replace('BOAT_', 'B')}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
