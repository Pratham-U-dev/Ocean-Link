// server/index.js
// Ponytail: Main server file starting Express + WS on the same HTTP server.
// Hooks into meshEmitter to broadcast hops in real-time and routes gateway packets.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });


const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const db = require('./db');
const { getMeshTopology, isGateway } = require('./mesh/network');
const { meshEmitter } = require('./mesh/flooding');
const { handleIncomingPacket, setBroadcastHandler: setGatewayBroadcast } = require('./gateway');

const boatsRouter = require('./routes/boats');
const { router: alertsRouter, setBroadcastHandler: setAlertsBroadcast } = require('./routes/alerts');
const ackRouter = require('./routes/ack');
const simulateRouter = require('./routes/simulate');
const weatherRouter = require('./routes/weather');
const riskRouter = require('./routes/risk');
const wearablesRouter = require('./routes/wearables');

const { startDriftSimulation, setBroadcastHandler: setMovementBroadcast } = require('./simulator/movement');
const { startSimulator, setBroadcastHandler: setRunnerBroadcast } = require('./simulator/runner');
const { startWeatherService, setBroadcastHandler: setWeatherBroadcast, getAllWeather } = require('./weather');
const { scoreAllBoats } = require('./riskPrediction');

const app = express();
app.use(cors());
app.use(express.json());

// API Endpoints
app.use('/api/boats', boatsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/ack', ackRouter);
app.use('/api/simulate', simulateRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/risk', riskRouter);
app.use('/api/wearables', wearablesRouter);

app.get('/api/status', (req, res) => {
  res.json({ status: 'active', timestamp: Date.now() });
});

// Configure shared HTTP/WS server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Central broadcast utility to dispatch JSON payloads to all connected WebSocket clients
const broadcast = (data) => {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};

// Wire broadcast handlers to individual modules to avoid cyclic imports
setGatewayBroadcast(broadcast);
setAlertsBroadcast(broadcast);
setMovementBroadcast(broadcast);
setRunnerBroadcast(broadcast);
setWeatherBroadcast(broadcast);

// WebSocket connection lifecycle
wss.on('connection', (ws) => {
  console.log('Control Room client connected via WS.');

  try {
    const boats = db.getAllBoats();
    const alerts = db.getAllAlerts().map(a => ({
      ...a,
      hopPath: typeof a.hop_path === 'string' ? JSON.parse(a.hop_path) : a.hop_path
    }));
    const topology = getMeshTopology();
    const weather = getAllWeather();
    const risk = scoreAllBoats(boats);

    // Send complete database snapshot and connection topology immediately on connection
    ws.send(JSON.stringify({
      type: 'INIT',
      boats,
      alerts,
      topology,
      weather,
      risk
    }));
  } catch (err) {
    console.error('Failed to send INIT state to client:', err);
  }

  ws.on('close', () => {
    console.log('Control Room client disconnected.');
  });
});

// Subscribe to simulated mesh network packet transmission events
meshEmitter.on('packet', ({ packet, fromNode, toNode }) => {
  // Broadcast every hop transition to animate in dashboard
  broadcast({
    type: 'MESH_HOP',
    packet,
    fromNode,
    toNode
  });

  // Shore gateway packet interceptor — any of the 4 coastal stations can receive traffic
  if (isGateway(toNode)) {
    handleIncomingPacket(packet);
  }

  // Reverse path interceptor for ACK reaching the original distressed boat
  if (packet.type === 'ACK' && toNode === packet.hopPath[0]) {
    handleIncomingPacket(packet);
  }
});

// AI Risk Prediction loop: periodically re-score every tracked boat and push
// the ranked list to dashboard clients (battery/weather/distance/staleness
// based heuristic — see riskPrediction.js for the full explanation).
const RISK_INTERVAL_MS = parseInt(process.env.RISK_INTERVAL_MS) || 15000;
setInterval(() => {
  try {
    const boats = db.getAllBoats();
    broadcast({ type: 'RISK_UPDATE', risk: scoreAllBoats(boats) });
  } catch (err) {
    console.error('Risk prediction loop failed:', err);
  }
}, RISK_INTERVAL_MS);

// Start the server and start simulation runners
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`OceanLink Backend running on port ${PORT}`);
  startDriftSimulation();
  startSimulator();
  startWeatherService();
});