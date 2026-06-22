// server/simulator/movement.js
// Ponytail: Drift simulation which updates boat coordinates randomly to simulate offshore movement.
// Decoupled from index.js via a registered broadcast callback.
const db = require('../db');
const { updateBoatPosition } = require('../mesh/network');

let broadcast = () => {};
let driftIntervalId = null;

const setBroadcastHandler = (fn) => {
  broadcast = fn;
};

const startDriftSimulation = () => {
  if (driftIntervalId) return;

  driftIntervalId = setInterval(() => {
    try {
      const boats = db.getAllBoats();
      for (const boat of boats) {
        if (boat.status === 'offline') continue;

        // Drift coordinates slightly (±0.001 degrees)
        const latDrift = (Math.random() - 0.5) * 0.002;
        const lngDrift = (Math.random() - 0.5) * 0.002;
        const newLat = parseFloat((boat.lat + latDrift).toFixed(6));
        const newLng = parseFloat((boat.lng + lngDrift).toFixed(6));

        // Slow battery decay: decay slightly on drift (with some random probability)
        let newBattery = boat.battery;
        if (Math.random() > 0.6 && newBattery > 10) {
          newBattery -= 1;
        }

        // 1. Update in-memory graph
        updateBoatPosition(boat.id, newLat, newLng);

        // 2. Update DB
        db.upsertBoat({
          id: boat.id,
          name: boat.name,
          lat: newLat,
          lng: newLng,
          battery: newBattery,
          last_seen: Date.now(),
          status: boat.status
        });

        // 3. Broadcast to all clients
        broadcast({
          type: 'BOAT_UPDATE',
          boat: {
            id: boat.id,
            lat: newLat,
            lng: newLng,
            battery: newBattery,
            last_seen: Date.now(),
            status: boat.status
          }
        });
      }
    } catch (err) {
      console.error('Drift movement simulation failed:', err);
    }
  }, 30000);
};

const stopDriftSimulation = () => {
  if (driftIntervalId) {
    clearInterval(driftIntervalId);
    driftIntervalId = null;
  }
};

module.exports = {
  startDriftSimulation,
  stopDriftSimulation,
  setBroadcastHandler
};
