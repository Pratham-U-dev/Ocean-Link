// server/routes/alerts.js
// Ponytail: Alert routes for fetching alerts and patching status. 
// Uses a clean validation list and WS broadcast registration to update dashboard clients.
const express = require('express');
const router = express.Router();
const db = require('../db');

let broadcast = () => {};
const setBroadcastHandler = (fn) => {
  broadcast = fn;
};

// GET /api/alerts - Returns all alerts, sorted by triggered_at DESC
router.get('/', (req, res) => {
  try {
    const alerts = db.getAllAlerts();
    const parsedAlerts = alerts.map(alert => ({
      ...alert,
      hopPath: typeof alert.hop_path === 'string' ? JSON.parse(alert.hop_path) : alert.hop_path
    }));
    res.json(parsedAlerts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/alerts/:id/status - Update alert status
router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['ACTIVE', 'ACKNOWLEDGED', 'DISPATCHED', 'RESOLVED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Choose from: ${validStatuses.join(', ')}` });
  }

  try {
    const result = db.updateAlertStatus(id, status);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Broadcast the update immediately to all control room panels
    broadcast({
      type: 'ALERT_STATUS_UPDATE',
      alertId: id,
      status
    });

    res.json({ success: true, id, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  router,
  setBroadcastHandler
};
