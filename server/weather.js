// server/weather.js
// Ponytail: Simulated Weather Service + Weather Alert Engine.
// There's no real meteorological feed wired up (no API key, no network access
// to a weather provider), so conditions are generated with a slow random walk
// per shore-gateway region. This keeps the rest of the system (risk scoring,
// dashboard alerts) exercising real logic against plausible, ever-changing
// inputs without pretending to be a live forecast.
// Upgrade path: swap generateNextReading() for a real provider call (e.g.
// OpenWeatherMap/IMD) keyed by each gateway's lat/lng; the consumer-facing
// shape (WEATHER_UPDATE payload) would not need to change.
const { GATEWAY_IDS, nodes } = require('./mesh/network');

const HIGH_WIND_KMPH = 45;
const HIGH_WAVE_M = 2.5;
const HIGH_WAVE_WARNING_M = 1.8;

let broadcast = () => {};
const setBroadcastHandler = (fn) => {
  broadcast = fn;
};

// Current reading per gateway region, keyed by gateway id.
const regionWeather = new Map();

const freshReading = () => ({
  windKmph: 10 + Math.random() * 20,
  waveHeightM: 0.5 + Math.random() * 1.0,
  rainMm: Math.random() * 2,
  visibilityKm: 8 + Math.random() * 7,
  updatedAt: Date.now()
});

const initWeather = () => {
  for (const gwId of GATEWAY_IDS) {
    regionWeather.set(gwId, freshReading());
  }
};
initWeather();

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Random-walk the previous reading rather than resampling from scratch, so
// conditions feel continuous rather than flickering between extremes.
function stepReading(prev) {
  return {
    windKmph: clamp(prev.windKmph + (Math.random() - 0.45) * 6, 5, 70),
    waveHeightM: clamp(prev.waveHeightM + (Math.random() - 0.45) * 0.3, 0.2, 4.5),
    rainMm: clamp(prev.rainMm + (Math.random() - 0.5) * 1.5, 0, 25),
    visibilityKm: clamp(prev.visibilityKm + (Math.random() - 0.5) * 2, 1, 15),
    updatedAt: Date.now()
  };
}

function severityForReading(reading) {
  if (reading.windKmph >= HIGH_WIND_KMPH || reading.waveHeightM >= HIGH_WAVE_M) {
    return 'SEVERE';
  }
  if (reading.windKmph >= HIGH_WIND_KMPH * 0.75 || reading.waveHeightM >= HIGH_WAVE_WARNING_M) {
    return 'WARNING';
  }
  return 'NORMAL';
}

function getWeatherForGateway(gwId) {
  return regionWeather.get(gwId) || null;
}

// Nearest-gateway lookup is cheap to recompute since there are only 4
// stations; used so any lat/lng (a boat's position) can be matched to the
// weather region that applies to it.
function getWeatherForPosition(lat, lng) {
  const { getNearestGateway } = require('./mesh/network');
  const nearest = getNearestGateway(lat, lng);
  if (!nearest) return null;
  return { gateway: nearest.id, ...getWeatherForGateway(nearest.id) };
}

function getAllWeather() {
  return GATEWAY_IDS.map((gwId) => ({
    gateway: gwId,
    gatewayName: nodes[gwId].name,
    lat: nodes[gwId].lat,
    lng: nodes[gwId].lng,
    ...regionWeather.get(gwId),
    severity: severityForReading(regionWeather.get(gwId))
  }));
}

let tickIntervalId = null;

function startWeatherService(intervalMs) {
  if (tickIntervalId) return;
  const interval = intervalMs || parseInt(process.env.WEATHER_INTERVAL_MS) || 20000;

  tickIntervalId = setInterval(() => {
    const updates = [];
    for (const gwId of GATEWAY_IDS) {
      const next = stepReading(regionWeather.get(gwId));
      regionWeather.set(gwId, next);
      const severity = severityForReading(next);
      updates.push({ gateway: gwId, gatewayName: nodes[gwId].name, ...next, severity });

      // Weather Alert Engine: only broadcast a dedicated alert when conditions
      // cross into WARNING/SEVERE territory, instead of spamming every tick.
      if (severity !== 'NORMAL') {
        broadcast({
          type: 'WEATHER_ALERT',
          alert: {
            gateway: gwId,
            gatewayName: nodes[gwId].name,
            severity,
            windKmph: Math.round(next.windKmph),
            waveHeightM: Math.round(next.waveHeightM * 10) / 10,
            message: severity === 'SEVERE'
              ? `Severe sea conditions near ${nodes[gwId].name}: wind ${Math.round(next.windKmph)} km/h, waves ${next.waveHeightM.toFixed(1)}m.`
              : `Rising sea conditions near ${nodes[gwId].name}: wind ${Math.round(next.windKmph)} km/h, waves ${next.waveHeightM.toFixed(1)}m.`,
            timestamp: Date.now()
          }
        });
      }
    }

    broadcast({ type: 'WEATHER_UPDATE', weather: updates });
  }, interval);
}

function stopWeatherService() {
  if (tickIntervalId) {
    clearInterval(tickIntervalId);
    tickIntervalId = null;
  }
}

module.exports = {
  startWeatherService,
  stopWeatherService,
  setBroadcastHandler,
  getAllWeather,
  getWeatherForGateway,
  getWeatherForPosition,
  severityForReading
};