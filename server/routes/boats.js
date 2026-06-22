// server/routes/boats.js
// Ponytail: Simple Express route for querying all boats from the SQLite DB.
const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  try {
    const boats = db.getAllBoats();
    res.json(boats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
