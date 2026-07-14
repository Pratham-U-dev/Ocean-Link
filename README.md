# OceanLink — LoRa Mesh Maritime Distress Alert System

An emergency communication and distress alert system designed for coastal Karnataka fishermen. Since offshore areas lack cellular/internet coverage, OceanLink uses a simulated LoRa Mesh Network to relay distress signals boat-to-boat until they reach a Shore Gateway, which forwards the alert to the Coast Guard/Search and Rescue (SAR) Control Room dashboard in real-time.

---

## Architecture Diagram

```text
  [ Offshore Boats (Simulated Proximity Mesh) ]
  
   +---------+  < 25km   +---------+
   | Boat 04 |---------->| Boat 02 |
   +---------+           +---------+
        |                     |
        | < 25km              | < 25km
        v                     v
   +---------+           +---------+            (WiFi/Cellular)          +-----------------------+
   | Boat 03 |---------->| Boat 01 |--------=========================>|   Shore Gateway       |
   +---------+           +---------+                                  |   (Mangaluru Port)    |
                                                                      +-----------------------+
                                                                                  |
                                                                                  | HTTP / WebSocket
                                                                                  v
                                                                      +-----------------------+
                                                                      |  Express & WS Server  |
                                                                      |    (SQLite Store)     |
                                                                      +-----------------------+
                                                                                  |
                                                                                  | WebSockets
                                                                                  v
                                                                      +-----------------------+
                                                                      |  Coast Guard Control  |
                                                                      |    Room Dashboard     |
                                                                      +-----------------------+
```

---

## Features

1. **Simulated Proximity Graph**: 10 boats placed along the Karnataka coast (from Mangaluru up to Karwar). Edges are dynamically created when boats are within the 25 km LoRa transmission range.
2. **Proximity-Based Relaying**: Heartbeat packets and high-priority Distress packets flood the network using a hop-by-hop flooding protocol.
3. **Shore Gateway Integration**: The Shore Gateway (located at Mangaluru Port) receives packets from the mesh and routes them to the backend server.
4. **WebSocket Communication**: Instantaneous data delivery from server to browser client for real-time visualization of boat heartbeats, GPS drift, distress signals, and hop paths.
5. **Interactive Controls**: Ability to trigger manual distress events, adjust/reset simulation states, and manage distress status workflows (Active $\rightarrow$ Acknowledged $\rightarrow$ Dispatched $\rightarrow$ Resolved).
6. **Web Audio Alarm & Hop Visualization**: High-visibility yellow hop paths drawn dynamically on the dashboard, combined with an audio alarm when distress signals are received.

---

## Setup & Running

This project is structured as a monorepo. You can install all dependencies and run the entire system using simple commands from the root directory.

### Quick Start

1. **Install all dependencies** (root, server, and client):
   ```bash
   npm run install:all
   ```
2. **Run in development mode** (launches backend server + Vite client concurrently):
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to:
   * Dashboard: `http://localhost:5173` (or the Vite output port)
   * API Server: `http://localhost:3001`

---

## Simulation Details

### Initial Boat Positions (Karnataka Coast)
* **BOAT_01**: 12.845°N, 74.695°E (Mangaluru offshore, 8km out)
* **BOAT_02**: 12.920°N, 74.640°E (Ullal area, 12km out)
* **BOAT_03**: 13.050°N, 74.590°E (Mulki area, 15km out)
* **BOAT_04**: 13.200°N, 74.560°E (Kundapur area, 18km out)
* **BOAT_05**: 13.350°N, 74.530°E (Udupi/Malpe area, 20km out)
* **BOAT_06**: 13.550°N, 74.490°E (Byndoor area, 22km out)
* **BOAT_07**: 13.780°N, 74.440°E (Bhatkal area, 25km out)
* **BOAT_08**: 14.050°N, 74.380°E (Murdeshwar area, 20km out)
* **BOAT_09**: 14.280°N, 74.320°E (Honavar area, 22km out)
* **BOAT_10**: 14.720°N, 74.050°E (Karwar area, 30km out)
* **SHORE_GW**: 12.870°N, 74.842°E (Mangaluru Port Shore Gateway)

### Algorithms & Calculations
* **Distance Metric**: Proximity calculation uses the **Haversine formula** to compute distances over the earth's sphere.
* **Adjacency**: An edge exists between any two nodes if their distance is strictly less than `LORA_RANGE_KM` (default: `25`).
* **Flooding & Deduplication**:
  * Distress packets carry a unique `msgId` and a `ttl` (Time-to-Live, default: `6`).
  * Relaying boats maintain a `dedupeCache` mapping `msgId -> timestamp` to drop already-seen packets.
  * For each valid hop, `ttl` is decremented, `hopCount` is incremented, the current node is appended to the packet's `hopPath`, and the packet is broadcast to all neighboring nodes.
  * Active path lines are drawn on the map to visualize the exact route the signal took to reach the Shore Gateway.

---

## REST API Endpoints

The backend server exposes the following REST endpoints under `/api`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/boats` | Returns status and latest positions of all 10 boats. |
| `GET` | `/api/alerts` | Returns a list of all distress alerts from the database, ordered latest first. |
| `PATCH`| `/api/alerts/:id/status` | Updates the status of an alert. Allowed values: `ACTIVE`, `ACKNOWLEDGED`, `DISPATCHED`, `RESOLVED`. Broadcasts update to clients. |
| `POST` | `/api/ack/:alertId` | Injects an ACK packet back into the mesh to notify the boat that help is on the way. |
| `POST` | `/api/simulate/distress` | Manually triggers distress from a specific boat. Body: `{ boatId }`. |
| `POST` | `/api/simulate/reset` | Resets all simulation states, clears alerts in the database, and resets boat positions. |

---

## WebSocket Events

Clients connect to the WebSocket server at `ws://localhost:3001` to receive real-time updates.

* **`INIT`** (Server $\rightarrow$ Client): Sent immediately on connection. Contains the current state of boats, alerts, and mesh topology.
* **`BOAT_UPDATE`** (Server $\rightarrow$ Client): Emitted whenever a boat drifts or updates its battery/status.
* **`DISTRESS_ALERT`** (Server $\rightarrow$ Client): Emitted when a new distress alert is successfully received by the gateway. Triggers the browser audible alert and pulses.
* **`MESH_HOP`** (Server $\rightarrow$ Client): Emitted during propagation for each packet relay step. Used by the client to animate the dashed yellow line path on the map and topology graph.
* **`ACK_UPDATE`** / **`ALERT_STATUS_UPDATE`** (Server $\rightarrow$ Client): Emitted when distress alerts change status.

---

