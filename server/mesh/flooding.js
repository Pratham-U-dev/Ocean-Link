// server/mesh/flooding.js
// Ponytail: Core flooding module propagating packet hops. 
// Uses per-node deduplication cache keys (`${nodeId}_${msgId}`) to prevent infinite loops in cyclic graphs.
const EventEmitter = require('events');
const { getPathToGateway, getNeighbors, isGateway } = require('./network');

const meshEmitter = new EventEmitter();
const dedupeCache = new Map();

// Cleanup interval to evict dedupe entries older than 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of dedupeCache.entries()) {
    if (now - ts > 600000) {
      dedupeCache.delete(key);
    }
  }
}, 60000);

const propagatePacket = (packet, fromNodeId) => {
  if (!packet) return;

  if (packet.type === 'HEARTBEAT') {
    // Heartbeats route along the BFS shortest path to SHORE_GW
    const path = getPathToGateway(packet.boatId);
    if (!path || path.length < 2) return;

    const sendHop = (index) => {
      if (index >= path.length - 1) return;
      const from = path[index];
      const to = path[index + 1];

      const delay = Math.floor(Math.random() * 150) + 50; // 50ms - 200ms latency
      setTimeout(() => {
        meshEmitter.emit('packet', { packet, fromNode: from, toNode: to });
        sendHop(index + 1);
      }, delay);
    };
    
    sendHop(0);

  } else if (packet.type === 'DISTRESS') {
    // Distress packets flood outward across proximity neighbors
    const flood = (currentNode, prevNode, pkt) => {
      const dedupeKey = `${currentNode}_${pkt.msgId}`;
      if (dedupeCache.has(dedupeKey)) return;
      dedupeCache.set(dedupeKey, Date.now());

      const isOrigin = currentNode === pkt.boatId;
      const localPacket = {
        ...pkt,
        hopPath: [...pkt.hopPath]
      };

      if (!isOrigin) {
        localPacket.ttl -= 1;
        localPacket.hopCount += 1;
        if (!localPacket.hopPath.includes(currentNode)) {
          localPacket.hopPath.push(currentNode);
        }
      }

      if (localPacket.ttl <= 0) return;

      const neighbors = getNeighbors(currentNode);
      for (const neighbor of neighbors) {
        if (neighbor === prevNode) continue; // Exclude the node that forwarded this to us

        const delay = Math.floor(Math.random() * 150) + 50;
        setTimeout(() => {
          meshEmitter.emit('packet', { packet: localPacket, fromNode: currentNode, toNode: neighbor });
          
          if (!isGateway(neighbor)) {
            flood(neighbor, currentNode, localPacket);
          }
        }, delay);
      }
    };

    flood(packet.boatId, null, packet);

  } else if (packet.type === 'ACK') {
    // ACK packets propagate backward tracing the original distress hop path in reverse
    const originalPath = packet.hopPath || [];
    if (originalPath.length < 2) return;

    const reversePath = [...originalPath].reverse();

    const sendAckHop = (index) => {
      if (index >= reversePath.length - 1) return;
      const from = reversePath[index];
      const to = reversePath[index + 1];

      const delay = Math.floor(Math.random() * 150) + 50;
      setTimeout(() => {
        meshEmitter.emit('packet', { packet, fromNode: from, toNode: to });
        sendAckHop(index + 1);
      }, delay);
    };

    sendAckHop(0);
  }
};

module.exports = {
  meshEmitter,
  propagatePacket
};