// server/simulator/runner.js
// Ponytail: Simulator runner scheduling heartbeats and random distress events.
// Coordinates DB updates and resets, in-memory positions, and WS broadcast events.
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { propagatePacket } = require('../mesh/flooding');
const { nodes } = require('../mesh/network');
const { INITIAL_BOATS } = require('./boats');

let broadcast = () => {};
let heartbeatIntervalId = null;
let distressTimeoutId = null;

const setBroadcastHandler = (fn) => {
  broadcast = fn;
};

const triggerManualDistress = (boatId) => {
  const boats = db.getAllBoats();
  const boat = boats.find(b => b.id === boatId);
  if (!boat) {
    console.error(`Boat ID ${boatId} not found for manual distress`);
    return null;
  }

  const distressPacket = {
    type: 'DISTRESS',
    boatId: boat.id,
    lat: boat.lat,
    lng: boat.lng,
    timestamp: Date.now(),
    msgId: uuidv4(),
    ttl: parseInt(process.env.TTL_DEFAULT) || 6,
    hopCount: 0,
    hopPath: [boat.id],
    battery: boat.battery
  };

  console.log(`Distress packet created for ${boat.id}, propagating into mesh.`);
  propagatePacket(distressPacket, boat.id);
  return distressPacket;
};

const triggerRandomDistress = () => {
  const boats = db.getAllBoats();
  const alerts = db.getAllAlerts();

  // Pick boats that do not currently have active distress status
  const activeAlerts = alerts.filter(a => ['ACTIVE', 'ACKNOWLEDGED', 'DISPATCHED'].includes(a.status));
  const distressedBoatIds = new Set(activeAlerts.map(a => a.boat_id));

  const eligibleBoats = boats.filter(b => b.status !== 'offline' && !distressedBoatIds.has(b.id));
  if (eligibleBoats.length === 0) {
    console.log('All boats are already distressed or offline.');
    return;
  }

  const randomBoat = eligibleBoats[Math.floor(Math.random() * eligibleBoats.length)];
  console.log(`Auto Distress Trigger: selecting ${randomBoat.id}`);
  triggerManualDistress(randomBoat.id);
};

const scheduleNextDistress = () => {
  const min = parseInt(process.env.DISTRESS_INTERVAL_MIN_MS) || 45000;
  const max = parseInt(process.env.DISTRESS_INTERVAL_MAX_MS) || 90000;
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;

  distressTimeoutId = setTimeout(() => {
    try {
      triggerRandomDistress();
    } catch (err) {
      console.error('Failed to trigger random distress:', err);
    }
    scheduleNextDistress();
  }, delay);
};

const startSimulator = () => {
  if (heartbeatIntervalId) return;

  console.log('Starting simulator heartbeats and auto distress loops...');

  // Heartbeat loop: sends node-to-gateway path update
  const interval = parseInt(process.env.SIM_INTERVAL_MS) || 8000;
  heartbeatIntervalId = setInterval(() => {
    try {
      const boats = db.getAllBoats();
      for (const boat of boats) {
        if (boat.status === 'offline') continue;

        const heartbeatPacket = {
          type: 'HEARTBEAT',
          boatId: boat.id,
          lat: boat.lat,
          lng: boat.lng,
          timestamp: Date.now(),
          battery: boat.battery
        };

        propagatePacket(heartbeatPacket, boat.id);
      }
    } catch (err) {
      console.error('Error in heartbeat loop execution:', err);
    }
  }, interval);

  // Auto distress loop
  scheduleNextDistress();
};

const stopSimulator = () => {
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
  if (distressTimeoutId) {
    clearTimeout(distressTimeoutId);
    distressTimeoutId = null;
  }
  console.log('Simulator loops stopped.');
};

const resetAll = () => {
  try {
    // 1. Wipe SQLite tables and reset boats
    db.resetAllDB();

    // 2. Synchronize memory coordinates inside network.js graph
    for (const boat of INITIAL_BOATS) {
      if (nodes[boat.id]) {
        nodes[boat.id].lat = boat.lat;
        nodes[boat.id].lng = boat.lng;
      }
    }

    // 3. Broadcast reset state to WS clients
    broadcast({
      type: 'RESET',
      boats: db.getAllBoats(),
      alerts: []
    });

    console.log('Simulator successfully reset.');
  } catch (err) {
    console.error('Simulator reset failed:', err);
  }
};

module.exports = {
  startSimulator,
  stopSimulator,
  triggerManualDistress,
  resetAll,
  setBroadcastHandler
};
