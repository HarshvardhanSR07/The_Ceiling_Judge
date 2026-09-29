
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ReactLenis } from "@studio-freight/react-lenis";
import { CustomCursor } from "./components/CustomCursor";
import "./index.css";

import Entry from "./pages/Entry";
import Gallery from "./pages/Gallery";
import Submit from "./pages/Submit";
import Judge from "./pages/Judge";
import Organizer from "./pages/Organizer";
import Results from "./pages/Results";

const pageVariants = {
  initial: { opacity: 0, y: 40, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -40, scale: 0.98, filter: "blur(10px)" },
};

function AnimatedRoutes() {
  const location = useLocation();
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/*" element={
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : pageVariants.initial}
            animate={prefersReducedMotion ? { opacity: 1 } : pageVariants.animate}
            exit={prefersReducedMotion ? { opacity: 0 } : pageVariants.exit}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          >
            <Routes>
              <Route path="/" element={<Entry />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/submit" element={<Submit />} />
              <Route path="/judge" element={<Judge />} />
              <Route path="/organizer" element={<Organizer />} />
                            <Route path="/results" element={<Results />} />
            </Routes>
          </motion.div>
        } />
      </Routes>
    </AnimatePresence>
  );
}

function Shell() {
  const location = useLocation();
  
  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 1.5 }}>
      <CustomCursor />
      <div className="min-h-screen bg-void text-white font-sans selection:bg-accent-purple selection:text-white flex flex-col">
        {location.pathname !== "/" && (
          <header className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 bg-void/50 backdrop-blur-xl border-b border-white/10">
            <Link to="/" className="font-bold text-xl tracking-tight text-white/90">The Ceiling Judge</Link>
            <nav className="flex gap-6 text-sm font-medium text-white/60">
              <Link to="/gallery" className="hover:text-white transition-colors">Gallery</Link>
              <Link to="/submit" className="hover:text-white transition-colors">Submit</Link>
              <Link to="/judge" className="hover:text-white transition-colors">Judge</Link>
              <Link to="/organizer" className="hover:text-white transition-colors">Organizer</Link>
              <Link to="/ledger" className="hover:text-white transition-colors">Ledger</Link>
              <Link to="/results" className="hover:text-white transition-colors">Results</Link>
            </nav>
          </header>
        )}
        <main className="relative z-10 max-w-7xl mx-auto p-8 w-full flex-1">
          <AnimatedRoutes />
        </main>
      </div>
    </ReactLenis>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(<App />);




