
import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import { api } from "../api/axiosConfig";
import { cn } from "../utils/cn";
import { StaggeredText } from "../components/StaggeredText";

const spriteMap = [
  { img: "/gallery_novapay.jpg", bgPos: "center", bgSize: "cover" },
  { img: "/gallery_biosynth.jpg", bgPos: "center", bgSize: "cover" },
  { img: "/gallery_aurastream.jpg", bgPos: "center", bgSize: "cover" },
  { img: "/gallery_stacked.jpg", bgPos: "center 0%", bgSize: "100% 300%" },
  { img: "/gallery_stacked.jpg", bgPos: "center 50%", bgSize: "100% 300%" },
  { img: "/gallery_stacked.jpg", bgPos: "center 100%", bgSize: "100% 300%" },
];

// Odometer Component for rolling numbers
const Odometer = ({ value }: { value: number }) => {
  const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => current.toFixed(4));
  
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span className="font-mono tabular-nums">{display}</motion.span>;
};

export default function Gallery() {
  const [projects, setProjects] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch and initialize projects with simulated Z-scores
  useEffect(() => {
    api.get("/projects").then((res) => {
      const p = res.data.projects || [];
      const enriched = p.map((proj: any, i: number) => ({
        ...proj,
        score: Math.random() * 5 + 5, // initial score between 5 and 10
        sprite: spriteMap[i % spriteMap.length]
      }));
      setProjects(enriched.sort((a: any, b: any) => b.score - a.score));
    }).catch(console.error);
  }, []);

  // Simulate live WebSocket updates for Z-scores
  useEffect(() => {
    if (projects.length === 0) return;
    const interval = setInterval(() => {
      setProjects(current => {
        const updated = current.map(p => {
          // Randomly fluctuate score
          const change = (Math.random() - 0.45) * 0.5; // slight upward bias
          return { ...p, score: Math.max(0, Math.min(10, p.score + change)) };
        });
        // Re-sort to trigger Framer Motion layout animations (Positional Glide)
        return updated.sort((a, b) => b.score - a.score);
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [projects.length]);

  return (
    <div className="relative min-h-[80vh] w-full px-4 md:px-8 py-12">
      <header className="mb-16 text-center max-w-3xl mx-auto">
        <div className="text-[10px] uppercase tracking-[0.3em] text-accent-cyan mb-2 font-bold animate-pulse">Live Telemetry Active</div>
        <StaggeredText 
          text="The Z-Score Shuffler" 
          className="text-4xl md:text-6xl font-black mb-4 tracking-tighter uppercase" 
        />
        <p className="text-white/50 text-lg font-medium tracking-wide">
          Real-time global leaderboard. Rows mechanically glide as judges submit their pairwise calibrations.
        </p>
      </header>

      <div className="max-w-5xl mx-auto flex flex-col gap-4">
        {projects.length > 0 ? (
          projects.map((proj, index) => {
            const isExpanded = expandedId === proj.id;
            
            return (
              <motion.div 
                layout
                key={proj.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }} // taste-skill physics
                className={cn(
                  "bg-[#050505] border rounded-2xl overflow-hidden cursor-pointer transition-colors duration-500",
                  isExpanded ? "border-accent-cyan/50 shadow-[0_0_30px_rgba(34,211,238,0.1)]" : "border-white/10 hover:border-white/30"
                )}
                onClick={() => setExpandedId(isExpanded ? null : proj.id)}
              >
                {/* ROW HEADER */}
                <motion.div layout className="p-6 md:p-8 flex items-center justify-between z-10 relative bg-[#050505]">
                  <div className="flex items-center gap-6 md:gap-8">
                    <div className="text-3xl md:text-5xl font-black text-white/10 w-16 text-right">
                      #{index + 1}
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white mb-1 group-hover:text-accent-cyan transition-colors">{proj.title}</h3>
                      <div className="flex gap-3 items-center">
                        <span className="text-xs bg-white/5 text-white/60 px-2 py-1 rounded uppercase tracking-widest">{proj.trackId}</span>
                        <span className="text-xs text-white/40 font-mono hidden md:inline-block">ID: {proj.id.split("-")[0]}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Normalized Z-Score</div>
                    <div className="text-2xl md:text-3xl font-black text-accent-cyan">
                      <Odometer value={proj.score} />
                    </div>
                  </div>
                </motion.div>

                {/* EXPANDED DOSSIER (Multilayered Exploration) */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                      className="border-t border-white/5 bg-[#0A0A0A]"
                    >
                      <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Description */}
                        <div className="lg:col-span-1 space-y-6">
                          <div>
                            <h4 className="text-xs uppercase tracking-widest text-white/40 font-bold mb-2">Project Dossier</h4>
                            <p className="text-sm text-white/80 leading-relaxed">{proj.summary || "No description provided. The architecture speaks for itself."}</p>
                          </div>
                          <div>
                            <h4 className="text-xs uppercase tracking-widest text-white/40 font-bold mb-2">Tech Stack</h4>
                            <p className="text-sm text-white font-mono">{proj.repoUrl}</p>
                          </div>
                          
                          <button className="w-full py-4 border border-white/10 rounded-xl text-xs uppercase tracking-widest font-bold hover:bg-white/10 transition-colors">
                            Enter Duel Arena &rarr;
                          </button>
                        </div>
                        
                        {/* Multilayered Exploration Canvas */}
                        <div className="lg:col-span-2 relative min-h-[400px] md:min-h-[500px] rounded-xl overflow-hidden border border-white/10 group">
                          <div 
                            className="absolute inset-0 transition-transform duration-1000 group-hover:scale-105"
                            style={{
                              backgroundImage: `url(${proj.sprite.img})`,
                              backgroundPosition: proj.sprite.bgPos,
                              backgroundSize: proj.sprite.bgSize,
                              backgroundRepeat: "no-repeat"
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                          <div className="absolute bottom-6 left-6 pointer-events-none">
                            <div className="text-[10px] uppercase tracking-widest text-accent-cyan font-bold mb-1">Architecture Visualized</div>
                            <div className="text-sm font-medium">Live Render Engine</div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-20 text-white/30 uppercase tracking-widest text-sm">
            Awaiting cryptographic initialization...
          </div>
        )}
      </div>
    </div>
  );
}

