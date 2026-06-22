const { v4: uuidv4 } = require('uuid');

function createHeartbeat(boatId, lat, lng, battery, timestamp = Date.now()) {
  return {
    type: 'HEARTBEAT',
    boatId,
    lat,
    lng,
    timestamp,
    battery
  };
}

function createDistress(boatId, lat, lng, battery, timestamp = Date.now()) {
  return {
    type: 'DISTRESS',
    boatId,
    lat,
    lng,
    timestamp,
    msgId: uuidv4(),
    ttl: 6,
    hopCount: 0,
    hopPath: [boatId],
    battery
  };
}

function createACK(alertId, msgId, timestamp = Date.now()) {
  return {
    type: 'ACK',
    alertId,
    msgId,
    timestamp
  };
}

module.exports = {
  createHeartbeat,
  createDistress,
  createACK
};
