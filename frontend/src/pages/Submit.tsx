
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { api } from "../api/axiosConfig";
import { cn } from "../utils/cn";

const CountdownMatrix = () => {
  const [time, setTime] = useState({ hours: 12, minutes: 45, seconds: 30 });
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(t => {
        if (t.seconds > 0) return { ...t, seconds: t.seconds - 1 };
        if (t.minutes > 0) return { ...t, minutes: t.minutes - 1, seconds: 59 };
        return { hours: t.hours - 1, minutes: 59, seconds: 59 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden h-full">
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent-cyan/10 blur-[50px] -z-10" />
      <div className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold">Sprint Chronometer</div>
      <div className="flex items-baseline gap-2 font-mono">
        <span className="text-4xl md:text-5xl font-black tracking-tighter text-white">{String(time.hours).padStart(2, "0")}</span>
        <span className="text-xl text-accent-cyan font-bold animate-pulse">:</span>
        <span className="text-4xl md:text-5xl font-black tracking-tighter text-white">{String(time.minutes).padStart(2, "0")}</span>
        <span className="text-xl text-accent-cyan font-bold animate-pulse">:</span>
        <span className="text-4xl md:text-5xl font-black tracking-tighter text-white">{String(time.seconds).padStart(2, "0")}</span>
      </div>
      <div className="mt-2 text-accent-cyan text-xs font-bold tracking-widest uppercase">System Locked in T-Minus</div>
    </div>
  );
};

const SquadRoster = () => {
  const roster = [
    { id: 1, name: "Candidate", img: "/candidate.png", status: "online" },
    { id: 2, name: "Judge", img: "/judge.png", status: "typing" },
    { id: 3, name: "Admin", img: "https://i.pravatar.cc/150?u=a042581f4e29026704d", status: "offline" },
  ];

  return (
    <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 h-full flex flex-col justify-center">
      <div className="text-[10px] uppercase tracking-widest text-white/40 mb-4 font-bold flex justify-between">
        <span>Squad Roster</span>
        <span className="text-accent-purple">2/3 ONLINE</span>
      </div>
      <div className="flex gap-4">
        {roster.map(member => (
          <div key={member.id} className="relative group cursor-pointer">
            <div className={cn(
              "w-12 h-12 rounded-full overflow-hidden border-2 transition-all duration-300",
              member.status === "typing" ? "border-accent-cyan shadow-[0_0_15px_rgba(34,211,238,0.4)] scale-110" :
              member.status === "online" ? "border-accent-purple shadow-[0_0_15px_rgba(139,92,246,0.4)]" : "border-white/10 opacity-50 grayscale"
            )}>
              <img src={member.img} alt={member.name} className="w-full h-full object-cover" />
            </div>
            {member.status === "typing" && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-void rounded-full flex items-center justify-center border border-white/10">
                <div className="w-2 h-2 bg-accent-cyan rounded-full animate-ping" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const StagingTimeline = ({ step }: { step: number }) => {
  return (
    <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 w-full">
      <div className="flex justify-between items-center relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-white/5 -z-10" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-accent-purple to-accent-cyan -z-10 transition-all duration-1000" style={{ width: `${(step / 3) * 100}%` }} />
        
        {["Identity Minted", "Architecture", "Asset Layering", "Deployment"].map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-2 bg-[#0A0A0A] px-2">
            <div className={cn(
              "w-4 h-4 rounded-full border-2 transition-all duration-500",
              i <= step ? "border-accent-cyan bg-accent-cyan shadow-[0_0_10px_rgba(34,211,238,0.5)]" : "border-white/20 bg-void"
            )} />
            <span className={cn(
              "text-[10px] uppercase tracking-widest font-bold transition-colors duration-500",
              i <= step ? "text-white" : "text-white/30"
            )}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Submit() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: "",
    summary: "",
    track: "",
    stack: "",
    repo: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStep(3);
    try {
      await api.post("/projects", {
        title: form.title,
        summary: form.summary,
        trackId: form.track,
        repoUrl: form.repo,
        teamId: "tm_dummy_123"
      });
      // Delay navigation to show deployment sequence
      setTimeout(() => navigate("/"), 1500);
    } catch (err: any) {
      console.error(err);
      setIsSubmitting(false);
      setStep(1);
    }
  };

  return (
    <div className="min-h-screen bg-void text-white font-sans selection:bg-accent-cyan selection:text-black py-12 px-4 md:px-8">
      <div className="max-w-[1200px] mx-auto space-y-6">
        
        <header className="mb-8">
          <div className="text-[10px] uppercase tracking-[0.3em] text-accent-purple mb-2 font-bold">The Builder&#39;s Terminal</div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">Candidate Uplink</h1>
        </header>

        {/* TOP COMMAND CENTER */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CountdownMatrix />
          <SquadRoster />
        </div>

        {/* STAGING TIMELINE */}
        <StagingTimeline step={step} />

        {/* THE FORGE */}
        <form onSubmit={handleSubmit} className="bg-[#050505] border border-white/10 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-purple via-transparent to-accent-cyan" />
          
          <div className="text-sm uppercase tracking-[0.2em] text-white/40 mb-8 font-bold border-l-2 border-accent-purple pl-3">
            The Forge // Assembling the Payload
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left Col: Basics */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold ml-1">Project Identity</label>
                <input 
                  required type="text" value={form.title} onChange={e => { setForm({...form, title: e.target.value}); setStep(1); }}
                  placeholder="System Name"
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-5 py-4 text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold ml-1">Track</label>
                  <input 
                    required type="text" value={form.track} onChange={e => setForm({...form, track: e.target.value})}
                    placeholder="Classification"
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-5 py-4 text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-accent-cyan transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold ml-1">Tech Stack</label>
                  <input 
                    type="text" value={form.stack} onChange={e => setForm({...form, stack: e.target.value})}
                    placeholder="Next.js, Web3, Rust"
                    className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-5 py-4 text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-accent-cyan transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold ml-1">Source Repository</label>
                <input 
                  required type="url" value={form.repo} onChange={e => setForm({...form, repo: e.target.value})}
                  placeholder="https://github.com/..."
                  className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-5 py-4 text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-accent-cyan transition-all"
                />
              </div>
            </div>

            {/* Right Col: Code Injection */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold ml-1 flex justify-between">
                <span>Code Injection (Summary)</span>
                <span className="text-accent-cyan">syntax: markdown</span>
              </label>
              <div className="relative group h-[calc(100%-2rem)]">
                <div className="absolute -inset-0.5 bg-gradient-to-br from-accent-cyan to-accent-purple rounded-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 blur-sm" />
                <textarea 
                  required rows={10} value={form.summary} onChange={e => { setForm({...form, summary: e.target.value}); setStep(2); }}
                  placeholder="// Initialize core logic here...&#10;// Explain your architecture."
                  className="relative w-full h-full bg-[#0A0A0A] border border-white/10 rounded-xl p-6 text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-transparent resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>

          <div className="mt-12 flex justify-end">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className={cn(
                "relative group overflow-hidden rounded-xl font-bold text-white tracking-widest uppercase text-sm px-12 py-5 transition-all duration-300",
                "border border-accent-cyan bg-accent-cyan/10 hover:bg-accent-cyan hover:text-black",
                isSubmitting && "pointer-events-none scale-95"
              )}
            >
              <div className={cn(
                "absolute inset-0 bg-accent-cyan transition-transform duration-1000 origin-left scale-x-0",
                isSubmitting && "scale-x-100"
              )} />
              <span className="relative z-10 flex items-center gap-3">
                {isSubmitting ? "Locking Payload..." : "Deploy Submission"}
              </span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}


