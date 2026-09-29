
import React from "react";
import styled from "styled-components";
import { motion, useReducedMotion } from "framer-motion";

export function ProjectCard({
  project,
  side,
  preference,
  state,
  onHover,
  onLeave,
  onClick,
}: {
  project: any;
  side: "A" | "B";
  preference: number;
  state: string;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const t = (preference - 3) / 2;
  const myWeight = side === "A" ? t : -t;

  const isWinner = state === "COMMIT_PREF" && myWeight > 0;
  const isLoser = state === "COMMIT_PREF" && myWeight < 0;
  const isForfeit = state === "COMMIT_ABSTAIN";

  const scale = shouldReduceMotion ? 1 : (isWinner ? 1.05 : isLoser ? 0.95 : 1 + myWeight * 0.05);
  const opacity = isLoser ? 0.4 : 1;
  const filter = isForfeit ? "grayscale(100%)" : `brightness(${1 + myWeight * 0.12})`;

  return (
    <motion.div
      layoutId={`card-${side}`}
      initial={{ opacity: 0, y: 50 }}
      animate={{ scale, opacity, filter, y: 0 }}
      exit={{ opacity: 0, y: -100, transition: { duration: 0.2, ease: "easeIn" } }}
      transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 25 }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      onClick={onClick}
      tabIndex={0}
      style={{ zIndex: myWeight > 0 ? 20 : 10, cursor: "pointer", outline: "none" }}
    >
      <StyledWrapper $isWinner={isWinner} $side={side} $reduced={!!shouldReduceMotion}>
        <div className="ticket-canvas">
          <div className="ticket-wrapper">
            <div className="ticket-inner">
              {/* Front Face */}
              <div className="ticket-face ticket-front">
                <div className="t-main">
                  <div className="t-content">
                    <div className="t-header">
                      <div className="t-logo">
                        <svg viewBox="0 0 24 24">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {side === "A" ? "SIDE A" : "SIDE B"}
                      </div>
                      <div className="t-type">{project.track}</div>
                    </div>
                    <div className="t-title">{project.title}</div>
                    <div className="t-subtitle">{project.summary}</div>
                  </div>
                  <div className="t-perforation">
                    <div className="t-perf-line" />
                  </div>
                </div>
                <div className="t-stub" style={{ justifyContent: "center" }}>
                  <div className="t-admit-text" style={{ fontSize: "1em", color: "var(--t-accent)", letterSpacing: "0.2em", fontWeight: "bold" }}>
                    {project.repo ? project.repo.replace("https://", "").replace("http://", "") : "NO REPOSITORY LINKED"}
                  </div>
                </div>
              </div>

              {/* Back Face */}
              <div className="ticket-face ticket-back">
                <div className="t-main">
                  <div className="t-content h-full flex flex-col justify-center">
                    <div className="t-header">
                      <div className="t-logo text-white/50">Progressive Disclosure</div>
                    </div>
                    <div className="t-subtitle" style={{ color: "var(--t-accent)", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5em" }}>
                      Team Name
                    </div>
                    <div className="t-title" style={{ fontSize: "1.5em", marginBottom: "1.5em" }}>
                      {project.team || "Anonymous Team"}
                    </div>
                    
                    <div className="t-subtitle" style={{ color: "var(--t-accent)", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5em" }}>
                      Tech Stack
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5em", marginBottom: "1em" }}>
                      {(project.stack || []).map((s: string) => (
                        <span key={s} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "4px 8px", fontSize: "0.9em", color: "white" }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="t-perforation">
                    <div className="t-perf-line" />
                  </div>
                </div>
                <div className="t-stub" style={{ justifyContent: "center" }}>
                  <div className="t-admit-text" style={{ fontSize: "1em", color: "var(--t-accent)", letterSpacing: "0.2em", fontWeight: "bold" }}>
                    &larr; &rarr; TO PICK A SIDE
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </StyledWrapper>
      
      {isWinner && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          className="absolute top-[2em] right-[2em] text-accent-cyan font-bold flex items-center gap-1.5 bg-void/80 px-2.5 py-1 rounded-md text-xs border border-accent-cyan/30 z-[100]"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          Preferred
        </motion.div>
      )}
    </motion.div>
  );
}

const StyledWrapper = styled.div<{ $isWinner: boolean; $side: string; $reduced: boolean }>`
  .ticket-canvas {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .ticket-wrapper {
    --t-bg: #1e1e24;
    --t-bg-light: #2b2b36;
    --t-accent: ${(props) => props.$side === "A" ? "#7c3aed" : "#22D3EE"};
    --t-accent-glow: ${(props) => props.$side === "A" ? "rgba(124, 58, 237, 0.5)" : "rgba(34, 211, 238, 0.5)"};
    --t-text-main: #f8fafc;
    --t-text-muted: #94a3b8;
    font-size: 14px;
    perspective: 1400px;
    display: inline-block;
    width: 100%;
  }

  .ticket-inner {
    position: relative;
    width: 100%;
    transform-style: preserve-3d;
    transition: transform 0.65s cubic-bezier(0.4, 0.1, 0.2, 1);
  }

  /* Only flip if not reduced motion */
  ${(props) => !props.$reduced && `
    .ticket-wrapper:hover .ticket-inner,
    .ticket-wrapper:focus-within .ticket-inner {
      transform: rotateY(180deg) scale(1.02);
    }
  `}

  .ticket-face {
    width: 100%;
    color: var(--t-text-main);
    font-family: "Space Grotesk", "Segoe UI", system-ui, sans-serif;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.8),
      0 0 0 ${(props) => props.$isWinner ? "2px var(--t-accent)" : "1px rgba(255, 255, 255, 0.05)"};
    background: transparent;
    filter: drop-shadow(0px 0px 10px rgba(0, 0, 0, 0.5));
    border-radius: 1em;
  }

  .ticket-front {
    transform: rotateY(0deg);
  }

  .ticket-back {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    transform: rotateY(180deg);
  }

  .ticket-face::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 1em;
    pointer-events: none;
    background: linear-gradient(
      115deg,
      transparent 0%,
      transparent 40%,
      rgba(255, 255, 255, 0.1) 45%,
      rgba(255, 255, 255, 0.3) 50%,
      rgba(255, 255, 255, 0.1) 55%,
      transparent 60%,
      transparent 100%
    );
    z-index: 10;
    background-size: 250% 250%;
    background-position: 100% 100%;
    transition: background-position 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    mix-blend-mode: overlay;
  }

  .ticket-wrapper:hover .ticket-face::after {
    background-position: 0% 0%;
  }

  .t-main {
    padding: 2em;
    position: relative;
    overflow: hidden;
    background: radial-gradient(circle at bottom left, transparent 1em, var(--t-bg) 1.05em),
                radial-gradient(circle at bottom right, transparent 1em, var(--t-bg) 1.05em);
    background-size: 51% 100%;
    background-position: bottom left, bottom right;
    background-repeat: no-repeat;
    border-top-left-radius: 1em;
    border-top-right-radius: 1em;
    min-height: 240px;
  }

  .t-main::after {
    content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 2em 2em; opacity: 0.6; z-index: 0; pointer-events: none;
    transform: perspective(500px) rotateX(20deg) scale(1.5);
    animation: grid-scroll 20s linear infinite;
  }

  @keyframes grid-scroll {
    0% { background-position: 0 0; }
    100% { background-position: 0 4em; }
  }

  .t-content { position: relative; z-index: 1; }
  .t-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2em; }
  .t-logo { display: flex; align-items: center; gap: 0.5em; font-weight: 900; font-size: 1.2em; letter-spacing: -0.05em; color: #fff; text-transform: uppercase; }
  .t-logo svg { width: 1.5em; height: 1.5em; fill: var(--t-accent); filter: drop-shadow(0 0 5px var(--t-accent)); animation: logo-pulse 3s ease-in-out infinite alternate; }

  @keyframes logo-pulse {
    0% { filter: drop-shadow(0 0 2px var(--t-accent)); }
    100% { filter: drop-shadow(0 0 10px var(--t-accent)) brightness(1.2); }
  }

  .t-type {
    font-size: 0.6em; text-transform: uppercase; letter-spacing: 0.2em; color: var(--t-accent);
    border: 1px solid var(--t-accent); padding: 0.4em 0.8em; border-radius: 99em; font-weight: 700;
  }

  .t-title {
    font-size: 2em; font-weight: 900; line-height: 1.1; margin-bottom: 0.2em; text-transform: uppercase;
    background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  }

  .t-subtitle { color: var(--t-text-muted); font-size: 0.9em; margin-bottom: 1.5em; line-height: 1.4; }
  
  .t-perforation { display: flex; justify-content: space-between; height: 1em; align-items: center; position: absolute; bottom: 0; left: 0; width: 100%; transform: translateY(50%); z-index: 2; }
  .t-perf-line { flex-grow: 1; height: 0; border-top: 2px dashed rgba(255, 255, 255, 0.2); margin: 0 1.5em; }

  .t-stub {
    padding: 1.5em 2em;
    background: radial-gradient(circle at top left, transparent 1em, var(--t-bg-light) 1.05em),
                radial-gradient(circle at top right, transparent 1em, var(--t-bg-light) 1.05em);
    background-size: 51% 100%; background-position: top left, top right; background-repeat: no-repeat;
    border-bottom-left-radius: 1em; border-bottom-right-radius: 1em;
    display: flex; justify-content: space-between; align-items: center; position: relative;
    min-height: 80px;
  }
`;

