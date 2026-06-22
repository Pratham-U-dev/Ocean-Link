// server/routes/ack.js
// Ponytail: Endpoint to trigger an ACK packet propagation back through the mesh network.
// It retrieves the alert's original hop path and feeds the ACK packet back into the flooding simulation.
const express = require('express');
const router = express.Router();
const db = require('../db');
const { propagatePacket } = require('../mesh/flooding');

router.post('/:alertId', (req, res) => {
  const { alertId } = req.params;

  try {
    const alert = db.getAlertById(alertId);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Retrieve original hop path that packet traveled
    const hopPath = typeof alert.hop_path === 'string' ? JSON.parse(alert.hop_path) : alert.hop_path;

    // Create ACK packet. It contains the alertId it acknowledges.
    const ackPacket = {
      type: 'ACK',
      alertId: alert.id,
      msgId: `ack_${alert.id}`,
      timestamp: Date.now(),
      hopPath: hopPath // The routing logic inside flooding.js will trace this backwards
    };

    // Propagate starting from the shore gateway
    propagatePacket(ackPacket, 'SHORE_GW');

    res.json({ success: true, message: 'ACK packet propagated into mesh', packet: ackPacket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
