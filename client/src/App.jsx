import React, { useEffect } from 'react';
import wsInstance from './ws';
import StatusBar from './components/StatusBar';
import Map from './components/Map';
import MeshGraph from './components/MeshGraph';
import SimControls from './components/SimControls';
import AlertPanel from './components/AlertPanel';

function App() {
  useEffect(() => {
    wsInstance.connect();
    return () => {
      wsInstance.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-ocean-bg font-sans overflow-hidden text-text-primary">
      {/* Top Status Bar */}
      <StatusBar />

      {/* Main Dashboard Area */}
      <div className="flex flex-1 w-full overflow-hidden">
        {/* Left Pane: Map (70%) */}
        <div className="w-[70%] h-full relative border-r border-ocean-border">
          <Map />
        </div>

        {/* Right Pane: Controls & Alerts (30%) */}
        <div className="w-[30%] h-full flex flex-col overflow-hidden bg-ocean-surface bg-opacity-40">
          {/* Real-time Mesh Topology SVG */}
          <div className="border-b border-ocean-border p-4">
            <MeshGraph />
          </div>

          {/* Simulation & Demo Controls */}
          <div className="border-b border-ocean-border p-4">
            <SimControls />
          </div>

          {/* Alert Panel (takes remaining space and scrolls) */}
          <div className="flex-1 min-h-0">
            <AlertPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
