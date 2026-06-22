// server/gateway.js
// Ponytail: Shore gateway processor that handles incoming packets from the mesh network.
// Decoupled from WS implementation via a broadcast handler callback to prevent circular imports.
const db = require('./db');

let broadcast = () => {};

const setBroadcastHandler = (fn) => {
  broadcast = fn;
};

const handleIncomingPacket = (packet) => {
  if (!packet) return;

  if (packet.type === 'HEARTBEAT') {
    const lastSeen = packet.timestamp || Date.now();
    
    db.upsertBoat({
      id: packet.boatId,
      lat: packet.lat,
      lng: packet.lng,
      battery: packet.battery,
      last_seen: lastSeen,
      status: 'active'
    });

    broadcast({
      type: 'BOAT_UPDATE',
      boat: {
        id: packet.boatId,
        lat: packet.lat,
        lng: packet.lng,
        battery: packet.battery,
        last_seen: lastSeen,
        status: 'active'
      }
    });
  } else if (packet.type === 'DISTRESS') {
    const existing = db.getAlertById(packet.msgId);
    if (!existing) {
      const alert = {
        id: packet.msgId, // Use message ID as the database PK id
        boatId: packet.boatId,
        lat: packet.lat,
        lng: packet.lng,
        msgId: packet.msgId,
        hopCount: packet.hopCount,
        hopPath: packet.hopPath || [packet.boatId],
        timestamp: packet.timestamp || Date.now(),
        status: 'ACTIVE'
      };

      db.insertAlert(alert);

      // Log the discrete hop transitions inside the mesh_events table
      const path = packet.hopPath || [packet.boatId];
      for (let i = 0; i < path.length - 1; i++) {
        db.insertEvent({
          msgId: packet.msgId,
          fromNode: path[i],
          toNode: path[i + 1],
          packetType: 'DISTRESS',
          ts: packet.timestamp || Date.now()
        });
      }

      broadcast({
        type: 'DISTRESS_ALERT',
        alert: {
          ...alert,
          hopPath: path
        }
      });
    }
  } else if (packet.type === 'ACK') {
    db.updateAlertStatus(packet.alertId, 'ACKNOWLEDGED');
    
    broadcast({
      type: 'ACK_UPDATE',
      alertId: packet.alertId,
      status: 'ACKNOWLEDGED'
    });
  }
};

module.exports = {
  handleIncomingPacket,
  setBroadcastHandler
};
