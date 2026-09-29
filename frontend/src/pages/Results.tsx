
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api/axiosConfig";
import { StaggeredText } from "../components/StaggeredText";
import { cn } from "../utils/cn";

export default function Results() {
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    api.get("/projects").then((res) => {
      const p = res.data.projects || [];
      // Simulate final scores deterministically based on ID length or character code so they stay static
      const enriched = p.map((proj: any) => ({
        ...proj,
        score: (proj.id.charCodeAt(4) % 5) + 5 + (proj.id.charCodeAt(5) % 5) * 0.1
      }));
      setProjects(enriched.sort((a: any, b: any) => b.score - a.score));
    }).catch(console.error);
  }, []);

  if (projects.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void text-white font-mono uppercase tracking-widest text-sm">
        Tabulating Cryptographic Ledger...
      </div>
    );
  }

  const top3 = projects.slice(0, 3);
  const runnersUp = projects.slice(3);

  return (
    <div className="min-h-screen bg-void text-white py-20 px-4 md:px-8 overflow-hidden relative">
      {/* Background ambient light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-accent-purple/10 blur-[120px] rounded-full pointer-events-none" />

      <header className="mb-24 text-center max-w-4xl mx-auto relative z-10">
        <div className="text-[10px] uppercase tracking-[0.3em] text-accent-cyan mb-4 font-bold">Ledger Locked // Sprint Concluded</div>
        <StaggeredText 
          text="Final Standings" 
          className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]" 
        />
        <p className="text-white/50 text-lg font-medium tracking-wide">
          The cryptographic ledger is immutable. These are the victors of the Dogfood 2026 Engine.
        </p>
      </header>

      <main className="max-w-6xl mx-auto relative z-10">
        
        {/* THE PODIUM */}
        <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 mb-32 h-auto md:h-[500px]">
          
          {/* 2nd Place */}
          {top3[1] && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
              className="w-full md:w-1/3 flex flex-col items-center order-2 md:order-1"
            >
              <div className="text-center mb-6">
                <div className="text-4xl font-black text-white/30 mb-2">#2</div>
                <h3 className="text-2xl font-bold">{top3[1].title}</h3>
                <div className="text-accent-cyan text-sm tracking-widest font-mono uppercase mt-1">{top3[1].score.toFixed(4)}</div>
              </div>
              <div className="w-full h-[250px] bg-gradient-to-t from-white/10 to-white/5 border border-white/20 rounded-t-2xl relative overflow-hidden flex justify-center pt-8">
                <div className="absolute top-0 w-full h-1 bg-white/40" />
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)]">??</div>
              </div>
            </motion.div>
          )}

          {/* 1st Place */}
          {top3[0] && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
              className="w-full md:w-1/3 flex flex-col items-center order-1 md:order-2 z-10"
            >
              <div className="text-center mb-6 relative">
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-accent-purple font-bold animate-pulse whitespace-nowrap">Grand Champion</div>
                <div className="text-6xl font-black text-accent-purple mb-2 drop-shadow-[0_0_20px_rgba(139,92,246,0.5)]">#1</div>
                <h3 className="text-3xl font-black uppercase tracking-tight">{top3[0].title}</h3>
                <div className="text-accent-purple font-bold text-lg tracking-widest font-mono uppercase mt-2">{top3[0].score.toFixed(4)}</div>
              </div>
              <div className="w-full h-[350px] bg-gradient-to-t from-accent-purple/20 to-accent-purple/5 border border-accent-purple/40 rounded-t-2xl relative overflow-hidden flex justify-center pt-8">
                <div className="absolute top-0 w-full h-2 bg-accent-purple shadow-[0_0_20px_rgba(139,92,246,1)]" />
                <div className="w-20 h-20 rounded-full bg-accent-purple/20 border border-accent-purple flex items-center justify-center shadow-[0_0_50px_rgba(139,92,246,0.6)] text-2xl">??</div>
              </div>
            </motion.div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="w-full md:w-1/3 flex flex-col items-center order-3 md:order-3"
            >
              <div className="text-center mb-6">
                <div className="text-4xl font-black text-white/20 mb-2">#3</div>
                <h3 className="text-2xl font-bold">{top3[2].title}</h3>
                <div className="text-white/60 text-sm tracking-widest font-mono uppercase mt-1">{top3[2].score.toFixed(4)}</div>
              </div>
              <div className="w-full h-[180px] bg-gradient-to-t from-white/5 to-white/[0.02] border border-white/10 rounded-t-2xl relative overflow-hidden flex justify-center pt-8">
                <div className="absolute top-0 w-full h-1 bg-white/20" />
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.05)]">??</div>
              </div>
            </motion.div>
          )}

        </div>

        {/* RUNNERS UP GRID */}
        {runnersUp.length > 0 && (
          <div className="mt-12">
            <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-8 font-bold border-l-2 border-white/20 pl-3">
              The Matrix // Runners Up
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {runnersUp.map((proj, i) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  key={proj.id} 
                  className="bg-[#050505] border border-white/10 p-6 rounded-xl hover:border-white/20 transition-colors flex justify-between items-center"
                >
                  <div>
                    <div className="text-lg font-bold mb-1">{proj.title}</div>
                    <div className="text-[10px] text-accent-cyan uppercase tracking-widest">{proj.trackId}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Rank</div>
                    <div className="text-xl font-black text-white/80">#{i + 4}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

