import { create } from 'zustand';

export const useStore = create((set) => ({
  boats: {},
  alerts: [],
  hopPaths: [],
  topology: { nodes: [], edges: [] },
  wsConnected: false,
  focusedCoords: null,

  initState: (boats, alerts, topology) => set(() => {
    // If boats is received as an array, map it to boatId -> boatData
    const boatsMap = Array.isArray(boats)
      ? boats.reduce((acc, boat) => {
          acc[boat.id] = boat;
          return acc;
        }, {})
      : boats || {};

    const sortedAlerts = Array.isArray(alerts)
      ? [...alerts].sort((a, b) => b.triggered_at - a.triggered_at)
      : [];

    return {
      boats: boatsMap,
      alerts: sortedAlerts,
      topology: topology || { nodes: [], edges: [] }
    };
  }),

  setFocusedCoords: (coords) => set(() => ({
    focusedCoords: coords
  })),

  updateBoat: (boat) => set((state) => {
    if (!boat || !boat.id) return {};
    const existing = state.boats[boat.id] || {};
    return {
      boats: {
        ...state.boats,
        [boat.id]: {
          ...existing,
          ...boat,
          last_seen: boat.last_seen || Date.now()
        }
      }
    };
  }),

  addAlert: (alert) => set((state) => {
    if (!alert || !alert.id) return {};
    const existingIndex = state.alerts.findIndex(a => a.id === alert.id);
    let updated = [...state.alerts];
    if (existingIndex > -1) {
      updated[existingIndex] = { ...updated[existingIndex], ...alert };
    } else {
      updated.unshift(alert);
    }
    // Sort descending by triggered_at
    updated.sort((a, b) => b.triggered_at - a.triggered_at);
    return { alerts: updated };
  }),

  updateAlertStatus: (alertId, status) => set((state) => ({
    alerts: state.alerts.map((a) =>
      a.id === alertId ? { ...a, status, updated_at: Date.now() } : a
    )
  })),

  addHopEvent: (hopEvent) => set((state) => {
    const now = Date.now();
    const newEvent = {
      ...hopEvent,
      id: hopEvent.id || `${hopEvent.fromNode}-${hopEvent.toNode}-${now}-${Math.random()}`,
      timestamp: hopEvent.timestamp || now
    };
    // Append and keep only hop paths less than 3 seconds old
    const cleanHops = [...state.hopPaths, newEvent].filter(
      (hop) => now - hop.timestamp <= 3000
    );
    return { hopPaths: cleanHops };
  }),

  setTopology: (topology) => set(() => ({
    topology: topology || { nodes: [], edges: [] }
  })),

  setWsConnected: (status) => set(() => ({
    wsConnected: status
  })),

  resetState: () => set(() => ({
    boats: {},
    alerts: [],
    hopPaths: [],
    topology: { nodes: [], edges: [] }
  }))
}));
