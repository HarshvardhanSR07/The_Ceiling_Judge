
import React, { useEffect, useState } from "react";
import { setSession } from "../lib/api";
import { api } from "../api/axiosConfig";
import { PairwiseMatchup } from "../components/PairwiseMatchup";
import { MagneticButton } from "../components/MagneticButton";
import { motion, AnimatePresence } from "framer-motion";

export default function Judge() {
  const [pair, setPair] = useState<any[] | null>(null);
  const [msg, setMsg] = useState("");
  const [isBatchActive, setIsBatchActive] = useState(false);
  const [batchStats, setBatchStats] = useState({ cast: 0, forfeit: 0 });
  const [isDone, setIsDone] = useState(false);
  const [meter, setMeter] = useState(0);

  async function loadNext() {
    setSession("jdg_a_seed_01");
    try {
      const res = await api.get("/api/judge/next");
      const data = res.data;
      if (!data.projects || data.projects.length < 2) {
        setIsBatchActive(false);
        setIsDone(true);
        return;
      }
      setPair(data.projects);
      setMsg(data.hint || "");
    } catch (e) {
      setIsBatchActive(false);
      setIsDone(true);
    }
  }

  const startBatch = () => {
    setIsBatchActive(true);
    setIsDone(false);
    setBatchStats({ cast: 0, forfeit: 0 });
    setMeter(0);
    loadNext();
  };

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isBatchActive) {
      if (meter > 0) {
        if (confirm(`You have an active streak of ${meter} comparisons. Leaving now will pause your batch. Confirm exit?`)) {
          setIsBatchActive(false);
        }
      } else {
        setIsBatchActive(false);
      }
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isBatchActive, meter]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {isDone ? (
          <motion.div 
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="flex flex-col items-center justify-center w-full bg-indigo-900/10 backdrop-blur-xl border border-white/10 p-12 rounded-3xl shadow-2xl"
          >
            <h2 className="text-4xl font-bold mb-3 tracking-tight text-white">Batch Complete</h2>
            <p className="text-white/60 mb-8 font-medium">Excellent work — here is what got recorded.</p>
            <div className="flex gap-12 mb-10 text-sm text-white/50 uppercase tracking-widest font-bold">
              <div className="text-center"><b className="text-4xl text-accent-cyan block mb-2 font-black">{batchStats.cast}</b> decided</div>
              <div className="text-center"><b className="text-4xl text-white block mb-2 font-black">{batchStats.forfeit}</b> forfeited</div>
              <div className="text-center"><b className="text-4xl text-accent-purple block mb-2 font-black">{batchStats.cast + batchStats.forfeit}</b> total</div>
            </div>
            <button onClick={() => setIsDone(false)} className="bg-white/5 border border-white/10 px-8 py-3 rounded-xl hover:border-accent-cyan hover:bg-white/10 transition-all font-semibold">
              Return to Dashboard
            </button>
          </motion.div>
        ) : (
          <motion.div 
            key="start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center"
          >
            <h1 className="text-5xl font-black mb-6 tracking-tighter bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent">Comparison Engine</h1>
            <p className="text-white/60 mb-10 text-lg leading-relaxed">
              Evaluate pairwise combinations to train the IMBR-BT ranking model. <br/> Swipe, click, or use the arrow keys.
            </p>
            <button 
              onClick={startBatch} 
              className="bg-accent-purple text-white font-bold px-10 py-4 rounded-2xl hover:bg-accent-purple/90 transition-all active:scale-95 shadow-[0_0_40px_rgba(139,92,246,0.3)] hover:shadow-[0_0_60px_rgba(139,92,246,0.5)] border border-white/10 text-lg tracking-wide"
            >
              Start Judging Batch
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBatchActive && pair && (
          <PairwiseMatchup
            key="matchup-modal"
            pair={pair}
            onComplete={() => {
              setBatchStats(s => ({ ...s, cast: s.cast + 1 }));
              setMeter(m => m + 1);
              loadNext();
            }}
            onForfeit={() => {
              setBatchStats(s => ({ ...s, forfeit: s.forfeit + 1 }));
              loadNext();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


