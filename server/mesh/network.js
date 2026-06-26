// server/mesh/network.js

// In-memory store of boats, wearable SOS devices, and shore gateways.
// Boat coordinates are evenly spaced (~23.6km per hop) from Mangaluru to Karwar so
// every consecutive pair falls within the 25km LoRa range threshold.
// Wearables are anchored close to their carrier boat (within LoRa range of it)
// and drift along with it.
const nodes = {
  BOAT_01: { id: 'BOAT_01', lat: 12.845, lng: 74.695, type: 'boat' },
  BOAT_02: { id: 'BOAT_02', lat: 13.051, lng: 74.642, type: 'boat' },
  BOAT_03: { id: 'BOAT_03', lat: 13.257, lng: 74.589, type: 'boat' },
  BOAT_04: { id: 'BOAT_04', lat: 13.463, lng: 74.537, type: 'boat' },
  BOAT_05: { id: 'BOAT_05', lat: 13.669, lng: 74.484, type: 'boat' },
  BOAT_06: { id: 'BOAT_06', lat: 13.876, lng: 74.431, type: 'boat' },
  BOAT_07: { id: 'BOAT_07', lat: 14.082, lng: 74.378, type: 'boat' },
  BOAT_08: { id: 'BOAT_08', lat: 14.288, lng: 74.326, type: 'boat' },
  BOAT_09: { id: 'BOAT_09', lat: 14.494, lng: 74.273, type: 'boat' },
  BOAT_10: { id: 'BOAT_10', lat: 14.700, lng: 74.220, type: 'boat' },

  // Wearable SOS / GPS modules carried by crew, riding alongside their boat
  // with a small fixed offset (within LoRa range of the carrier).
  WEARABLE_01: { id: 'WEARABLE_01', lat: 12.847, lng: 74.693, type: 'wearable', carrierBoat: 'BOAT_01', offsetLat: 0.002, offsetLng: -0.002 },
  WEARABLE_05: { id: 'WEARABLE_05', lat: 13.671, lng: 74.482, type: 'wearable', carrierBoat: 'BOAT_05', offsetLat: 0.002, offsetLng: -0.002 },
  WEARABLE_08: { id: 'WEARABLE_08', lat: 14.290, lng: 74.324, type: 'wearable', carrierBoat: 'BOAT_08', offsetLat: 0.002, offsetLng: -0.002 },

  // Shore Gateways: coastal Karnataka stations forwarding mesh traffic to the
  // Coast Guard Control Room over WebSocket/API.
  GW_MANGALURU: { id: 'GW_MANGALURU', name: 'Mangaluru', lat: 12.870, lng: 74.842, type: 'gateway' },
  GW_UDUPI: { id: 'GW_UDUPI', name: 'Udupi', lat: 13.341, lng: 74.747, type: 'gateway' },
  GW_MURDESHWAR: { id: 'GW_MURDESHWAR', name: 'Murdeshwar', lat: 14.094, lng: 74.485, type: 'gateway' },
  GW_KARWAR: { id: 'GW_KARWAR', name: 'Karwar', lat: 14.812, lng: 74.129, type: 'gateway' }
};

const GATEWAY_IDS = Object.keys(nodes).filter((id) => nodes[id].type === 'gateway');

// Backwards-compatible alias: older code referencing the single original
// gateway by its old id still resolves to the Mangaluru station.
// <ponytail> Shortcut: keep one legacy key pointing at the same object
// instead of migrating every caller in one pass. Ceiling: remove once no
// code references SHORE_GW directly. </ponytail>
nodes.SHORE_GW = nodes.GW_MANGALURU;

// Haversine distance in kilometers
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isGateway(nodeId) {
  return !!nodes[nodeId] && nodes[nodeId].type === 'gateway';
}

// Get array of neighboring node IDs (distance < LoRa range, default 25km)
function getNeighbors(nodeId) {
  const origin = nodes[nodeId];
  if (!origin) return [];
  const range = parseFloat(process.env.LORA_RANGE_KM) || 25;
  return Object.keys(nodes).filter(id => {
    if (id === nodeId) return false;
    if (id === 'SHORE_GW') return false; // skip the legacy alias duplicate
    const target = nodes[id];
    return haversineDistance(origin.lat, origin.lng, target.lat, target.lng) < range;
  });
}

// <ponytail>
// Shortcut: BFS uses dynamic distance calculations (O(N^2) total pairs checked during graph discovery) and standard BFS queue search on each lookup.
// Ceiling: With node count N > 100, checking all pairs every query/update will choke the CPU.
// Upgrade path: Maintain a cached adjacency list, updated only inside updateBoatPosition() using an R-tree or simple 2D spatial grid.
// </ponytail>
// Returns the shortest hop path from a node to whichever shore gateway is
// reached first via the mesh (boats are no longer tied to one fixed station).
function getPathToGateway(nodeId) {
  if (!nodes[nodeId]) return null;
  if (isGateway(nodeId)) return [nodeId];

  const queue = [[nodeId]];
  const visited = new Set([nodeId]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (isGateway(current)) {
      return path;
    }

    for (const neighbor of getNeighbors(current)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null; // unreachable from any gateway
}

// Straight-line nearest gateway to a lat/lng (used by the Rescue
// Recommendation Engine — independent of mesh hop count).
function getNearestGateway(lat, lng) {
  let best = null;
  let bestDist = Infinity;
  for (const gwId of GATEWAY_IDS) {
    const gw = nodes[gwId];
    const d = haversineDistance(lat, lng, gw.lat, gw.lng);
    if (d < bestDist) {
      bestDist = d;
      best = gw;
    }
  }
  return best ? { ...best, distanceKm: Math.round(bestDist * 10) / 10 } : null;
}

// Get full representation of the current topology
function getMeshTopology() {
  const nodeList = Object.keys(nodes)
    .filter((id) => id !== 'SHORE_GW') // drop legacy alias duplicate from output
    .map((id) => {
      const n = nodes[id];
      return { id: n.id, name: n.name || n.id, lat: n.lat, lng: n.lng, type: n.type };
    });

  const edges = [];
  const keys = nodeList.map((n) => n.id);
  const range = parseFloat(process.env.LORA_RANGE_KM) || 25;
  // O(N^2) edge generation
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const u = keys[i];
      const v = keys[j];
      if (haversineDistance(nodes[u].lat, nodes[u].lng, nodes[v].lat, nodes[v].lng) < range) {
        edges.push({ from: u, to: v });
      }
    }
  }

  return { nodes: nodeList, edges };
}

// Update boat/wearable GPS coordinate in memory
function updateBoatPosition(nodeId, lat, lng) {
  if (!nodes[nodeId]) return false;

  nodes[nodeId].lat = lat;
  nodes[nodeId].lng = lng;

  // Keep wearables co-located with their carrier boat (fixed offset) when the boat drifts.
  if (nodes[nodeId].type === 'boat') {
    for (const id of Object.keys(nodes)) {
      const w = nodes[id];
      if (w.carrierBoat === nodeId) {
        w.lat = lat + w.offsetLat;
        w.lng = lng + w.offsetLng;
      }
    }
  }
  return true;
}

module.exports = {
  getNeighbors,
  getPathToGateway,
  getNearestGateway,
  getMeshTopology,
  updateBoatPosition,
  isGateway,
  GATEWAY_IDS,
  nodes
};