// server/rescueRecommendation.js
// Ponytail: Rescue Recommendation Engine. Given a distress alert's position,
// recommends which shore gateway/station should dispatch and a rough ETA.
// ETA is straight-line distance over an assumed coast-guard launch speed,
// slowed down under bad weather — not a routed/marine-traffic-aware estimate.
// Upgrade path: replace the speed constant with real vessel routing
// (coastline-aware distance, currents) once that data is available.
const { getNearestGateway } = require('./mesh/network');
const { getWeatherForPosition, severityForReading } = require('./weather');

const BASE_LAUNCH_SPEED_KMPH = 35;

function recommendRescue(alert) {
  if (!alert || typeof alert.lat !== 'number' || typeof alert.lng !== 'number') return null;

  const gateway = getNearestGateway(alert.lat, alert.lng);
  if (!gateway) return null;

  const weather = getWeatherForPosition(alert.lat, alert.lng);
  const severity = weather ? severityForReading(weather) : 'NORMAL';

  // Bad weather slows the rescue launch down.
  const speedFactor = severity === 'SEVERE' ? 0.5 : severity === 'WARNING' ? 0.75 : 1;
  const effectiveSpeed = BASE_LAUNCH_SPEED_KMPH * speedFactor;
  const etaMinutes = Math.max(5, Math.round((gateway.distanceKm / effectiveSpeed) * 60));

  let priority = 'STANDARD';
  if (severity === 'SEVERE' || gateway.distanceKm > 40) priority = 'URGENT';

  return {
    recommendedGateway: gateway.id,
    recommendedGatewayName: gateway.name,
    distanceKm: gateway.distanceKm,
    weatherSeverity: severity,
    estimatedEtaMinutes: etaMinutes,
    priority,
    notes: severity === 'SEVERE'
      ? `Sea conditions are severe near ${gateway.name}; expect a slower launch and consider air support.`
      : severity === 'WARNING'
        ? `Conditions near ${gateway.name} are deteriorating; launch with caution.`
        : `Conditions near ${gateway.name} are normal for a standard launch.`
  };
}

module.exports = { recommendRescue };