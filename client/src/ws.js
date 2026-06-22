import { useStore } from './store';

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.url = `ws://${window.location.hostname}:3001`;
    this.reconnectDelay = 500;
    this.maxReconnectDelay = 16000;
    this.shouldReconnect = true;
    this.reconnectTimer = null;
  }

  connect() {
    if (this.ws) {
      this.ws.close();
    }

    console.log(`Connecting to WebSocket: ${this.url}`);
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('WebSocket connected.');
      useStore.getState().setWsConnected(true);
      this.reconnectDelay = 500;
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    this.ws.onclose = (e) => {
      console.log(`WebSocket closed: ${e.reason || 'No reason'}`);
      useStore.getState().setWsConnected(false);
      
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      this.ws.close();
    };
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    console.log(`Reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  handleMessage(data) {
    const { type } = data;
    const state = useStore.getState();

    switch (type) {
      case 'INIT':
        state.initState(data.boats, data.alerts, data.topology);
        break;
      case 'BOAT_UPDATE':
        state.updateBoat(data.boat);
        break;
      case 'DISTRESS_ALERT':
        state.addAlert(data.alert);
        playBeep();
        break;
      case 'ALERT_UPDATE':
      case 'ACK_UPDATE':
        if (data.alert) {
          state.addAlert(data.alert);
        } else if (data.alertId) {
          state.updateAlertStatus(data.alertId, data.status);
        }
        break;
      case 'MESH_HOP':
        state.addHopEvent(data.hopEvent || data);
        break;
      case 'ALERT_STATUS_UPDATE':
        state.updateAlertStatus(data.alertId, data.status);
        break;
      case 'RESET':
        state.initState(data.boats, data.alerts || [], state.topology);
        break;
      default:
        console.warn('Unknown WebSocket message type:', type);
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}

let audioCtx = null;
export function playBeep() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880 Hz

    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (error) {
    console.warn('Audio playback failed or blocked:', error);
  }
}

const wsInstance = new WebSocketManager();
export default wsInstance;
