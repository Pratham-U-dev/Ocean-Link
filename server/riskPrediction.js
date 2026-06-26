// server/riskPrediction.js
// Ponytail: "AI Risk Prediction" here is a transparent weighted heuristic,
// not a trained model — there's no labeled incident dataset to train one on
// in a simulation. It scores each boat 0-100 from signals that genuinely
// correlate with maritime risk (low battery, distance from the nearest
// shore gateway, rough weather in its region, and how stale its last
// heartbeat is) so the rest of the system (dashboard, rescue
// recommendations) has a real ranking to react to.
// Upgrade path: replace scoreBoat()'s weighted sum with a model trained on
// real distress-incident outcomes; keep the same 0-100 output contract.
const { getNearestGateway } = require('./mesh/network');
const { getWeatherForPosition, severityForReading } = require('./weather');

const WEIGHTS = {
  battery: 0.35,
  distance: 0.25,
  weather: 0.25,
  staleness: 0.15
};

function clamp01(x) {
  return Math.min(Math.max(x, 0), 1);
}

// Higher score = higher risk.
function scoreBoat(boat) {
  if (!boat) return null;

  const now = Date.now();
  const lastSeenMs = now - (boat.last_seen || now);

  // Battery: 100% battery -> 0 risk, 0% battery -> full risk contribution.
  const batteryRisk = clamp01(1 - (boat.battery ?? 100) / 100);

  // Distance from nearest shore gateway: scale so 0km -> 0 risk, 60km+ -> full risk.
  const nearestGw = getNearestGateway(boat.lat, boat.lng);
  const distanceKm = nearestGw ? nearestGw.distanceKm : 0;
  const distanceRisk = clamp01(distanceKm / 60);

  // Weather severity in the boat's region.
  const weather = getWeatherForPosition(boat.lat, boat.lng);
  const severity = weather ? severityForReading(weather) : 'NORMAL';
  const weatherRisk = severity === 'SEVERE' ? 1 : severity === 'WARNING' ? 0.55 : 0.1;

  // Heartbeat staleness: under 15s is healthy, 60s+ is fully stale.
  const stalenessRisk = clamp01((lastSeenMs - 15000) / 45000);

  const composite =
    WEIGHTS.battery * batteryRisk +
    WEIGHTS.distance * distanceRisk +
    WEIGHTS.weather * weatherRisk +
    WEIGHTS.staleness * stalenessRisk;

  const score = Math.round(clamp01(composite) * 100);

  let level = 'LOW';
  if (score >= 70) level = 'HIGH';
  else if (score >= 40) level = 'MODERATE';

  return {
    boatId: boat.id,
    score,
    level,
    factors: {
      batteryPct: boat.battery ?? null,
      distanceToShoreKm: nearestGw ? nearestGw.distanceKm : null,
      nearestGateway: nearestGw ? nearestGw.id : null,
      weatherSeverity: severity,
      lastSeenSecondsAgo: Math.round(lastSeenMs / 1000)
    }
  };
}

function scoreAllBoats(boats) {
  return boats.map(scoreBoat).filter(Boolean).sort((a, b) => b.score - a.score);
}

module.exports = { scoreBoat, scoreAllBoats };