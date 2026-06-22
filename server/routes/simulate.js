// server/routes/simulate.js
// Ponytail: Simulator endpoints for manual distress trigger and system-wide database/position reset.
const express = require('express');
const router = express.Router();
const { triggerManualDistress, resetAll } = require('../simulator/runner');

// POST /api/simulate/distress - Trigger distress manually on a specific boat
router.post('/distress', (req, res) => {
  const { boatId } = req.body;
  if (!boatId) {
    return res.status(400).json({ error: 'Missing boatId in body' });
  }

  try {
    const packet = triggerManualDistress(boatId);
    if (!packet) {
      return res.status(404).json({ error: `Boat ID ${boatId} not found or offline.` });
    }
    res.json({ success: true, packet });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/simulate/reset - Reset simulator database and boat positions
router.post('/reset', (req, res) => {
  try {
    resetAll();
    res.json({ success: true, message: 'Simulator reset successfully.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
