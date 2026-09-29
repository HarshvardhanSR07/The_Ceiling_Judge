
import React, { useEffect, useReducer, useRef, useState } from "react";
import { pairwiseReducer, PimReducerState } from "../hooks/usePairwiseReducer";
import { ProjectCard } from "./ProjectCard";
import { api } from "../api/axiosConfig";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { cn } from "../utils/cn";

export function PairwiseMatchup({ pair, onComplete, onForfeit }: { pair: any[]; onComplete: () => void; onForfeit: () => void; }) {
  const [state, dispatch] = useReducer(pairwiseReducer, {
    state: "PAIR_READY",
    context: { mode: "binary", preference: 3, meter: 0 },
  } as PimReducerState);

  const timerRef = useRef<any>(null);

  const startDecoyTimer = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      dispatch({ type: "DWELL_15S" });
    }, 15000);
  };

  useEffect(() => {
    startDecoyTimer();
    return () => clearTimeout(timerRef.current);
  }, [pair]);

  const handleActivity = () => {
    dispatch({ type: "ACTIVITY" });
    startDecoyTimer();
  };

  const handleCommit = async (prefValue: number) => {
    dispatch({ type: "COMMIT_PREF" });
    try {
      await api.post("/api/judge/observations", {
        projectA: pair[0].id,
        projectB: pair[1].id,
        preference: prefValue,
        channel: "binary",
      });
      setTimeout(() => {
        dispatch({ type: "FINISH_COMMIT" });
        onComplete();
      }, 300);
    } catch (e) {
      console.error(e);
      onComplete();
    }
  };

  const handleForfeit = async () => {
    dispatch({ type: "FORFEIT" });
    try {
      await api.post("/api/judge/observations/forfeit", {
        projectA: pair[0].id,
        projectB: pair[1].id,
      });
      setTimeout(() => {
        dispatch({ type: "FINISH_COMMIT" });
        onForfeit();
      }, 300);
    } catch (e) {
      console.error(e);
      onForfeit();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleActivity();
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
        handleCommit(1); // B wins
      }
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
        handleCommit(5); // A wins
      }
      if (e.key.toLowerCase() === "m") {
        dispatch({ type: "TOGGLE_MODE" });
      }
      if (e.key.toLowerCase() === "f") {
        handleForfeit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, pair]);

  // Framer motion drag setup for Tinder swipe
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-10, 10]);
  const opacity = useTransform(x, [-300, -100, 0, 100, 300], [0, 1, 1, 1, 0]);
  const yesOpacity = useTransform(x, [0, 150], [0, 1]);
  const noOpacity = useTransform(x, [0, -150], [0, 1]);

  const handleDragEnd = (e: any, info: any) => {
    if (info.offset.x > 150) {
      handleCommit(5); // Swiped right: A wins
    } else if (info.offset.x < -150) {
      handleCommit(1); // Swiped left: B wins
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-void text-white flex flex-col z-[100] p-8 md:p-12 overflow-hidden" 
      onMouseMove={handleActivity}
    >
      {/* HEADER */}
      <div className="flex justify-between items-center mb-10 max-w-5xl mx-auto w-full">
        <div className="text-sm text-white/50 font-medium">
          <span className="font-bold text-accent-cyan">{state.context.meter}</span> comparisons this batch
        </div>
        <div className="flex items-center gap-4 text-sm font-medium">
          <label className="flex items-center gap-3 cursor-pointer group">
            <span className={cn("transition-colors", state.context.mode === "unary" ? "text-white" : "text-white/50")}>Unary</span>
            <div 
              onClick={() => dispatch({ type: "TOGGLE_MODE" })}
              className={cn("w-12 h-6 rounded-full relative transition-colors", state.context.mode === "binary" ? "bg-accent-cyan" : "bg-accent-purple")}
            >
              <div className={cn("w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-sm", state.context.mode === "binary" ? "left-[26px]" : "left-1")} />
            </div>
            <span className={cn("transition-colors", state.context.mode === "binary" ? "text-white" : "text-white/50")}>Binary Swipe</span>
          </label>
        </div>
      </div>

      <div className={cn("absolute inset-0 bg-void/80 pointer-events-none z-10 transition-opacity duration-700 backdrop-blur-sm", state.state === "DECOY_ACTIVE" ? "opacity-100" : "opacity-0")} />

      <div className="flex-1 max-w-5xl mx-auto w-full relative z-30 flex flex-col justify-center items-center">
        
        {state.context.mode === "unary" ? (
          // UNARY MODE: Click Buttons (Side by Side)
          <div className="w-full">
            <motion.div key={pair[0].id + pair[1].id + "unary"} className="grid md:grid-cols-2 gap-8 relative">
              <ProjectCard project={pair[0]} side="A" preference={3} state={state.state} onHover={()=>{}} onLeave={()=>{}} onClick={()=>{}} />
              <ProjectCard project={pair[1]} side="B" preference={3} state={state.state} onHover={()=>{}} onLeave={()=>{}} onClick={()=>{}} />
            </motion.div>
            <motion.div className="flex justify-between items-center mt-12 gap-6 w-full" layout>
              <button onClick={() => handleCommit(5)} className="flex-1 bg-white/5 border border-white/10 py-5 rounded-xl hover:border-accent-cyan hover:bg-white/10 transition-all group shadow-xl">
                <span className="block font-bold text-lg group-hover:text-accent-cyan transition-colors">A Wins</span>
              </button>
              <button onClick={handleForfeit} className="px-6 py-4 border border-transparent rounded-xl text-white/40 hover:text-red-400 transition-all text-sm font-bold uppercase tracking-widest">
                Forfeit
              </button>
              <button onClick={() => handleCommit(1)} className="flex-1 bg-white/5 border border-white/10 py-5 rounded-xl hover:border-accent-cyan hover:bg-white/10 transition-all group shadow-xl">
                <span className="block font-bold text-lg group-hover:text-accent-cyan transition-colors">B Wins</span>
              </button>
            </motion.div>
          </div>
        ) : (
          // BINARY MODE: The Tinder/Elo Mechanic (Stacked Swipe)
          <div className="relative w-full max-w-md h-[500px]">
            {/* Background Card (Project B) */}
            <motion.div className="absolute inset-0 z-0">
              <div className="absolute top-4 right-4 z-10 bg-black/80 px-4 py-2 rounded-full border border-white/20 text-xs font-bold uppercase tracking-widest text-accent-purple">Project B</div>
              <ProjectCard project={pair[1]} side="B" preference={3} state={state.state} onHover={()=>{}} onLeave={()=>{}} onClick={()=>{}} />
            </motion.div>
            
            {/* Foreground Card (Project A) - Swipeable */}
            <motion.div 
              className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing shadow-2xl"
              style={{ x, rotate, opacity }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.9}
              onDragEnd={handleDragEnd}
            >
              <div className="absolute top-4 left-4 z-20 bg-black/80 px-4 py-2 rounded-full border border-white/20 text-xs font-bold uppercase tracking-widest text-accent-cyan">Project A</div>
              
              {/* Swipe Overlays */}
              <motion.div style={{ opacity: yesOpacity }} className="absolute top-1/2 left-8 -translate-y-1/2 z-30 pointer-events-none transform -rotate-12">
                <div className="border-4 border-accent-cyan text-accent-cyan text-4xl font-black uppercase tracking-widest px-6 py-2 rounded-xl backdrop-blur-md bg-black/50">WIN</div>
              </motion.div>
              <motion.div style={{ opacity: noOpacity }} className="absolute top-1/2 right-8 -translate-y-1/2 z-30 pointer-events-none transform rotate-12">
                <div className="border-4 border-red-500 text-red-500 text-4xl font-black uppercase tracking-widest px-6 py-2 rounded-xl backdrop-blur-md bg-black/50">PASS</div>
              </motion.div>

              <ProjectCard project={pair[0]} side="A" preference={3} state={state.state} onHover={()=>{}} onLeave={()=>{}} onClick={()=>{}} />
            </motion.div>
          </div>
        )}

      </div>
    </motion.div>
  );
}


