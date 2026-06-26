// server/db.js — Pure in-memory store. No native compilation needed.
const { INITIAL_BOATS } = require('./simulator/boats');

const boatsMap = new Map();
const alertsMap = new Map();

const freshBattery = () => Math.floor(Math.random() * 61) + 40;

const initBoats = () => {
  for (const boat of INITIAL_BOATS) {
    boatsMap.set(boat.id, {
      id: boat.id, name: boat.name,
      lat: boat.lat, lng: boat.lng,
      battery: freshBattery(), last_seen: Date.now(), status: 'active'
    });
  }
};
initBoats();

const getAllBoats = () => Array.from(boatsMap.values());

const getBoatById = (id) => boatsMap.get(id) || null;

const getAllAlerts = () =>
  Array.from(alertsMap.values()).sort((a, b) => b.triggered_at - a.triggered_at);

const getAlertById = (id) => alertsMap.get(id) || null;

const resetAllDB = () => {
  alertsMap.clear();
  for (const boat of INITIAL_BOATS) {
    const existing = boatsMap.get(boat.id) || {};
    boatsMap.set(boat.id, { ...existing, lat: boat.lat, lng: boat.lng, battery: freshBattery(), last_seen: Date.now(), status: 'active' });
  }
};

module.exports = {
  db: null,
  upsertBoat: (boat) => {
    const existing = boatsMap.get(boat.id) || {};
    boatsMap.set(boat.id, {
      ...existing, id: boat.id,
      name: boat.name || existing.name || boat.id,
      lat: boat.lat, lng: boat.lng,
      battery: boat.battery,
      last_seen: boat.last_seen || Date.now(),
      status: boat.status || 'active'
    });
  },
  insertAlert: (alert) => {
    const dupe = Array.from(alertsMap.values()).find(a => a.msg_id === alert.msgId);
    if (dupe) return { changes: 0 };
    const hopPath = Array.isArray(alert.hopPath) ? JSON.stringify(alert.hopPath) : (alert.hopPath || '[]');
    alertsMap.set(alert.id, {
      id: alert.id, boat_id: alert.boatId,
      lat: alert.lat, lng: alert.lng,
      msg_id: alert.msgId, hop_count: alert.hopCount,
      hop_path: hopPath,
      triggered_at: alert.timestamp || Date.now(),
      status: alert.status || 'ACTIVE',
      rescue_recommendation: alert.rescueRecommendation || null,
      updated_at: Date.now()
    });
    return { changes: 1 };
  },
  insertEvent: () => ({ changes: 1 }),
  updateAlertStatus: (id, status) => {
    const alert = alertsMap.get(id);
    if (!alert) return { changes: 0 };
    alertsMap.set(id, { ...alert, status, updated_at: Date.now() });
    return { changes: 1 };
  },
  getAllBoats, getBoatById, getAllAlerts, getAlertById, resetAllDB
};