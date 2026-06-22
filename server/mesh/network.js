// server/mesh/network.js

// In-memory store of boats and shore gateway
const nodes = {
  BOAT_01: { id: 'BOAT_01', lat: 12.845, lng: 74.695, type: 'boat' },
  BOAT_02: { id: 'BOAT_02', lat: 12.920, lng: 74.640, type: 'boat' },
  BOAT_03: { id: 'BOAT_03', lat: 13.050, lng: 74.590, type: 'boat' },
  BOAT_04: { id: 'BOAT_04', lat: 13.200, lng: 74.560, type: 'boat' },
  BOAT_05: { id: 'BOAT_05', lat: 13.350, lng: 74.530, type: 'boat' },
  BOAT_06: { id: 'BOAT_06', lat: 13.550, lng: 74.490, type: 'boat' },
  BOAT_07: { id: 'BOAT_07', lat: 13.780, lng: 74.440, type: 'boat' },
  BOAT_08: { id: 'BOAT_08', lat: 14.050, lng: 74.380, type: 'boat' },
  BOAT_09: { id: 'BOAT_09', lat: 14.280, lng: 74.320, type: 'boat' },
  BOAT_10: { id: 'BOAT_10', lat: 14.720, lng: 74.050, type: 'boat' },
  SHORE_GW: { id: 'SHORE_GW', lat: 12.870, lng: 74.842, type: 'gateway' }
};

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

// Get array of neighboring boat/gateway IDs (distance < 25km)
function getNeighbors(boatId) {
  const origin = nodes[boatId];
  if (!origin) return [];
  return Object.keys(nodes).filter(id => {
    if (id === boatId) return false;
    const target = nodes[id];
    return haversineDistance(origin.lat, origin.lng, target.lat, target.lng) < 25;
  });
}

// <ponytail>
// Shortcut: BFS uses dynamic distance calculations (O(N^2) total pairs checked during graph discovery) and standard BFS queue search on each lookup.
// Ceiling: With node count N > 100, checking all pairs every query/update will choke the CPU.
// Upgrade path: Maintain a cached adjacency list, updated only inside updateBoatPosition() using an R-tree or simple 2D spatial grid.
// </ponytail>
function getPathToGateway(boatId) {
  if (!nodes[boatId]) return null;
  if (boatId === 'SHORE_GW') return ['SHORE_GW'];

  const queue = [[boatId]];
  const visited = new Set([boatId]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    if (current === 'SHORE_GW') {
      return path;
    }

    for (const neighbor of getNeighbors(current)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null; // unreachable
}

// Get full representation of the current topology
function getMeshTopology() {
  const nodeList = Object.values(nodes).map(n => ({
    id: n.id,
    lat: n.lat,
    lng: n.lng,
    type: n.type
  }));

  const edges = [];
  const keys = Object.keys(nodes);
  // O(N^2) edge generation
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const u = keys[i];
      const v = keys[j];
      if (haversineDistance(nodes[u].lat, nodes[u].lng, nodes[v].lat, nodes[v].lng) < 25) {
        edges.push({ from: u, to: v });
      }
    }
  }

  return { nodes: nodeList, edges };
}

// Update boat GPS coordinate in memory
function updateBoatPosition(boatId, lat, lng) {
  if (nodes[boatId]) {
    nodes[boatId].lat = lat;
    nodes[boatId].lng = lng;
    return true;
  }
  return false;
}

module.exports = {
  getNeighbors,
  getPathToGateway,
  getMeshTopology,
  updateBoatPosition,
  nodes
};
