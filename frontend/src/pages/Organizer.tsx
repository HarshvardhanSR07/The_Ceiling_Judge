
import React, { useEffect, useState, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import ForceGraph3D from "react-force-graph-3d";
import { motion } from "framer-motion";
import * as THREE from "three";

// Dummy data for the 3D ledger
const generateLedgerData = () => {
  const nodes = [];
  const links = [];
  for (let i = 0; i < 40; i++) {
    nodes.push({ 
      id: i, 
      group: Math.floor(Math.random() * 3), 
      val: Math.random() * 20 + 5,
      anomalous: i === 12 
    });
  }
  for (let i = 0; i < 60; i++) {
    links.push({
      source: Math.floor(Math.random() * 40),
      target: Math.floor(Math.random() * 40),
    });
  }
  return { nodes, links };
};

// Tactical Hold Button Component
const InterventionButton = ({ label, onTrigger, type = "danger" }: any) => {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isHolding && !triggered) {
      interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            setIsHolding(false);
            setTriggered(true);
            onTrigger();
            setTimeout(() => {
              setTriggered(false);
              setProgress(0);
            }, 2000);
            return 100;
          }
          return p + 2; // 50 ticks of 40ms = 2000ms
        });
      }, 40);
    } else if (!triggered) {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [isHolding, triggered, onTrigger]);

  return (
    <button
      onMouseDown={() => setIsHolding(true)}
      onMouseUp={() => setIsHolding(false)}
      onMouseLeave={() => setIsHolding(false)}
      className="relative overflow-hidden bg-void border border-white/20 text-white font-mono text-xs px-6 py-4 uppercase tracking-widest hover:border-white/50 active:scale-[0.98] transition-transform select-none flex-1 flex justify-center items-center"
    >
      <div
        className={`absolute left-0 top-0 bottom-0 transition-all ease-linear ${
          type === "danger" ? "bg-red-600/30" : "bg-white/20"
        }`}
        style={{ width: `${progress}%` }}
      />
      <span className="relative z-10 flex items-center gap-2">
        {triggered ? "EXECUTED" : label}
        {isHolding && !triggered && (
          <span className="block w-2 h-2 rounded-full animate-pulse bg-white" />
        )}
      </span>
    </button>
  );
};

export default function Organizer() {
  const [graphData] = useState(generateLedgerData());
  const [ingestionData, setIngestionData] = useState<any[]>([]);

  useEffect(() => {
    // Simulate real-time ingestion payloads
    const initialData = Array.from({ length: 20 }, (_, i) => ({
      time: i,
      payload: Math.random() * 5 + 1,
    }));
    setIngestionData(initialData);

    const interval = setInterval(() => {
      setIngestionData((prev) => {
        const newData = [...prev.slice(1), { time: prev[prev.length - 1].time + 1, payload: Math.random() * 8 + (Math.random() > 0.8 ? 15 : 1) }];
        return newData;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-void text-white font-mono selection:bg-white selection:text-black">
      {/* OVERSEERS BRIDGE HEADER */}
      <header className="px-8 py-6 border-b border-white/10 flex justify-between items-end bg-[#050505]">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Root Access Verified
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">Overseer Bridge</h1>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/50 uppercase tracking-widest">System Status</div>
          <div className="text-lg font-bold text-white tracking-widest">NOMINAL</div>
        </div>
      </header>

      <main className="p-8 max-w-[1600px] mx-auto space-y-8">
        
        {/* INTERVENTION MATRIX */}
        <section>
          <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-4 font-bold border-l-2 border-white/20 pl-2">
            The Intervention Matrix // Tactical Overrides
          </div>
          <div className="flex gap-4 w-full">
            <InterventionButton label="Hold to Disqualify Payload" type="danger" onTrigger={() => console.log("Disqualified")} />
            <InterventionButton label="Hold to Invalidate Score" type="danger" onTrigger={() => console.log("Invalidated")} />
            <InterventionButton label="Hold to Throttle Bandwidth" type="warning" onTrigger={() => console.log("Throttled")} />
            <InterventionButton label="Recalculate Ledger" type="safe" onTrigger={() => console.log("Recalculating")} />
          </div>
        </section>

        {/* BENTO GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: CRYPTOGRAPHIC LEDGER */}
          <div className="lg:col-span-2 bg-[#050505] border border-white/10 rounded-xl overflow-hidden flex flex-col relative min-h-[500px]">
            <div className="absolute top-0 left-0 w-full p-6 z-10 pointer-events-none flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold tracking-tight uppercase">Cryptographic Ledger</h2>
                <div className="text-xs text-white/40 uppercase tracking-widest mt-1">Interactive 3D Node Graph</div>
              </div>
              <div className="bg-void/80 backdrop-blur px-3 py-1 border border-red-500/30 text-red-500 text-[10px] uppercase tracking-widest animate-pulse">
                Anomaly Detected
              </div>
            </div>
            
            <div className="flex-1 cursor-grab active:cursor-grabbing">
              <ForceGraph3D
                graphData={graphData}
                backgroundColor="#0D0B14"
                nodeRelSize={6}
                nodeColor={(node: any) => node.anomalous ? "#ef4444" : (node.group === 1 ? "#ffffff" : "#444444")}
                linkColor={() => "rgba(255,255,255,0.1)"}
                nodeOpacity={1}
                width={800} // Responsive wrapper would be better, but fixed for now
                height={500}
                nodeLabel={(node: any) => `<div style="background: rgba(0,0,0,0.8); padding: 8px; border: 1px solid rgba(255,255,255,0.2); font-family: monospace; font-size: 10px;">TX_HASH: 0x${Math.random().toString(16).slice(2, 10)}<br/>Z-DELTA: +${(Math.random() * 2).toFixed(2)}</div>`}
              />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-8 flex flex-col">
            
            {/* THE INGESTION VALVE */}
            <div className="bg-[#050505] border border-white/10 rounded-xl p-6 flex-1">
              <h2 className="text-sm font-bold tracking-widest uppercase mb-6 text-white/70">The Ingestion Valve</h2>
              <div className="h-[150px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ingestionData}>
                    <defs>
                      <linearGradient id="ingestColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffffff" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#000", border: "1px solid #333", fontSize: "12px", borderRadius: "0" }}
                      itemStyle={{ color: "#fff" }}
                    />
                    <Area type="step" dataKey="payload" stroke="#ffffff" strokeWidth={1} fillOpacity={1} fill="url(#ingestColor)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-between items-center text-[10px] text-white/40 uppercase tracking-widest">
                <span>Payload Size (MB)</span>
                <span>Live Telemetry</span>
              </div>
            </div>

            {/* JUDGE CALIBRATION */}
            <div className="bg-[#050505] border border-white/10 rounded-xl p-0 flex-1 overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <h2 className="text-sm font-bold tracking-widest uppercase text-white/70">Judge Calibration</h2>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-white/5 text-white/40 uppercase tracking-widest">
                    <th className="py-3 px-6 font-normal">Judge ID</th>
                    <th className="py-3 px-6 font-normal">Z-Curve</th>
                    <th className="py-3 px-6 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-red-500/10 border-b border-white/5 relative group cursor-pointer">
                    <td className="py-4 px-6 font-bold text-red-400">J-0X9A</td>
                    <td className="py-4 px-6 text-white/70">+3.4 (Erratic)</td>
                    <td className="py-4 px-6 text-red-500 animate-pulse">FLAGGED</td>
                  </tr>
                  <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6 font-bold text-white/90">J-0X1B</td>
                    <td className="py-4 px-6 text-white/50">-0.2 (Nominal)</td>
                    <td className="py-4 px-6 text-white/30">OK</td>
                  </tr>
                  <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6 font-bold text-white/90">J-0X7C</td>
                    <td className="py-4 px-6 text-white/50">+0.5 (Nominal)</td>
                    <td className="py-4 px-6 text-white/30">OK</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6 font-bold text-white/90">J-0X4D</td>
                    <td className="py-4 px-6 text-white/50">-0.1 (Nominal)</td>
                    <td className="py-4 px-6 text-white/30">OK</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}


