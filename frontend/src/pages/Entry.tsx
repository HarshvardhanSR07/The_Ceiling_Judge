
import React, { useState } from "react";
import styled from "styled-components";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function Entry() {
  const [phase, setPhase] = useState<"start" | "loading" | "login">("start");
  const navigate = useNavigate();

  const handleStart = () => {
    setPhase("loading");
    setTimeout(() => {
      setPhase("login");
    }, 4500); 
  };

  return (
    <>
      {/* Background that transitions from off-white to void */}
      <div 
        className={`fixed inset-0 -z-20 transition-colors duration-1000 ${phase === "start" ? "bg-[#f5f5f5]" : "bg-void"}`} 
      />
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <AnimatePresence mode="wait">
          {phase === "start" && (
            <motion.div key="start" exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }} transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}>
              <StartButton onClick={handleStart} />
            </motion.div>
          )}
          
          {phase === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }} transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}>
              <CoffeeLoader />
            </motion.div>
          )}

          {phase === "login" && (
            <motion.div 
              key="login" 
              initial={{ opacity: 0, y: 40, scale: 0.98, filter: "blur(10px)" }} 
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col items-center gap-12 w-full max-w-2xl"
            >
              <h1 className="text-4xl font-black tracking-tight text-white/90">Select Authorization</h1>
              
              <StyledRadioWrapper>
                <div className="radio-group">
                  <div className="flex flex-col items-center gap-4 group cursor-pointer" onClick={() => { setTimeout(() => navigate("/submit"), 400) }}>
                    <div className="radio-container info">
                      <label className="radio-button" />
                      <input type="radio" name="option" defaultValue="yes" className="radio-input-element" />
                      <img src="/candidate.png" alt="Candidate" className="radio-icon-element object-cover rounded-full" />
                      <div className="glow" />
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-lg group-hover:text-accent-cyan transition-colors">Candidate</div>
                      <div className="text-xs text-white/40 mt-1">Submit your project to the arena</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-4 group cursor-pointer" onClick={() => { setTimeout(() => navigate("/judge"), 400) }}>
                    <div className="radio-container danger">
                      <label className="radio-button" />
                      <input type="radio" name="option" defaultValue="no" className="radio-input-element" />
                      <img src="/judge.png" alt="Judge" className="radio-icon-element object-cover rounded-full" />
                      <div className="glow" />
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-lg group-hover:text-accent-purple transition-colors">Judge</div>
                      <div className="text-xs text-white/40 mt-1">Evaluate and vote on matches</div>
                    </div>
                  </div>
                </div>
              </StyledRadioWrapper>

              <Link to="/gallery" className="mt-4 text-sm text-white/50 hover:text-white transition-colors underline underline-offset-4">
                Or skip to the Public Gallery &rarr;
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

const StartButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <ButtonWrapper onClick={onClick}>
      <button>
        <span>GAME ON</span>
      </button>
    </ButtonWrapper>
  );
};

const CoffeeLoader = () => {
  return (
    <LoaderWrapper>
      <div className="loader">
        <div className="container">
          <div className="coffee-header">
            <div className="coffee-header__buttons" />
            <div className="coffee-header__display" />
            <div className="coffee-header__details" />
          </div>
          <div className="coffee-medium">
            <div className="coffe-medium__exit" />
            <div className="coffee-medium__arm" />
            <div className="coffee-medium__liquid" />
            <div className="smoke one" />
            <div className="smoke two" />
            <div className="smoke three" />
            <div className="smoke four" />
            <div className="coffee-medium__cup" />
          </div>
        </div>
      </div>
    </LoaderWrapper>
  );
};

const StyledRadioWrapper = styled.div`
  /* Radio group styles */
  .radio-group {
    --radio-size-total: 140px; /* Total size */
    --radio-border: 12px; /* Border thickness */

    --radio-bg-hue: 220; /* Background hue */
    --radio-border-hue: 210; /* Border hue */

    --transition-speed: 0.05s; /* Transition speed for hover effects */
    --glow-speed: 1.25s; /* Speed for glow animation */
    --glow-times: 3; /* Number of times the glow animation runs */

    display: flex;
    flex-wrap: wrap;
    gap: 4rem;
    align-items: center;
    justify-content: center;
  }

  /* Base */
  .radio-container {
    position: relative;
    width: var(--radio-size-total);
    height: var(--radio-size-total);
    border-radius: 50%;
    background-color: hsl(var(--radio-border-hue), 20%, 20%);
    box-shadow: 0 calc(var(--radio-border) / 3) 4px 0 #0007;
  }

  /* Base bevels */
  .radio-container::before {
    content: "";
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background-color: hsla(var(--radio-border-hue), 20%, 10%, 1);
    mask: radial-gradient(
      circle at 50% 50%,
      transparent calc(var(--radio-size-total) / 2 - var(--radio-border)),
      black calc(var(--radio-size-total) / 2 - var(--radio-border) + 1px),
      black calc(var(--radio-size-total) / 2 - var(--radio-border) + 3px),
      transparent calc(var(--radio-size-total) / 2 - var(--radio-border) + 5px),
      transparent calc(var(--radio-size-total) / 2 - 5px),
      black calc(var(--radio-size-total) / 2 - 3px)
    );
    z-index: 1;
  }

  .radio-button {
    position: absolute;
    top: calc(var(--radio-border) / 1);
    left: calc(var(--radio-border) / 1);
    width: calc(var(--radio-size-total) - var(--radio-border) * 2);
    height: calc(var(--radio-size-total) - var(--radio-border) * 2);
    border-radius: 50%;
    background-color: hsl(var(--radio-bg-hue), 100%, 50%);
    background-image: linear-gradient(
      to bottom,
      hsl(var(--radio-bg-hue), 100%, 60%) 0%,
      hsl(var(--radio-bg-hue), 100%, 50%) 70%,
      hsl(var(--radio-bg-hue), 100%, 30%) 100%
    );
    box-shadow: 0 calc(var(--radio-border) * 2) 6px 6px #0003;
    transition: box-shadow var(--transition-speed) ease-in-out;
  }

  /* Gloss effects 1 */
  .radio-button::before {
    content: "";
    position: absolute;
    pointer-events: none;
    top: calc(-1 * var(--radio-border));
    left: calc(-1 * var(--radio-border));
    width: var(--radio-size-total);
    height: var(--radio-size-total);
    border-radius: 50%;
    background-image: radial-gradient(
        circle at 50% 50%,
        transparent calc(var(--radio-size-total) / 2 - var(--radio-border)),
        hsla(var(--radio-border-hue), 100%, 0%, 0.5) 75%
      ),
      conic-gradient(
        from 20deg at 50% 50%,
        #fff 0%,
        transparent 1%,
        #fff4 20%,
        #0002 50%,
        #fff8 75%,
        transparent 85%,
        #fffa 86%,
        #fff6 87%,
        transparent 99%,
        #fff 100%
      );
    mask-image: radial-gradient(
      circle at 50% 50%,
      transparent 0,
      transparent 30%,
      black 35%,
      black calc(var(--radio-size-total) / 2),
      transparent calc(var(--radio-size-total) / 2 + 2px)
    );
  }

  /* Gloss effects 2 */
  .radio-button::after {
    content: "";
    position: absolute;
    pointer-events: none;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;

    background-image:
    /* Small reflection */
      radial-gradient(
        ellipse 6% 4% at 43% 29%,
        #fffe 35%,
        #fff8 55%,
        transparent 100%
      ),
      /* Repeating small reflections */
        radial-gradient(
          ellipse 3% 2% at 75% 20%,
          #fffd 45%,
          #fff8 50%,
          transparent 100%
        ),
      radial-gradient(
        ellipse 2% 1% at 70% 30%,
        #fffc 15%,
        #fff7 50%,
        transparent 100%
      ),
      radial-gradient(
        ellipse 2% 1% at 65% 40%,
        #fffa 15%,
        #fff5 50%,
        transparent 100%
      ),
      radial-gradient(
        ellipse 3% 2% at 25% 22%,
        #fffd 45%,
        #fff8 50%,
        transparent 100%
      ),
      radial-gradient(
        ellipse 2% 1% at 30% 32%,
        #fffc 15%,
        #fff7 50%,
        transparent 100%
      ),
      radial-gradient(
        ellipse 2% 1% at 35% 42%,
        #fffa 15%,
        #fff5 50%,
        transparent 100%
      ),
      /* Large reflection */
        radial-gradient(
          ellipse 70% 50% at 50% 37%,
          transparent 0%,
          #fff2 45%,
          #fff3 51%,
          transparent 57%
        ),
      radial-gradient(
        circle at 50% 50%,
        transparent 40%,
        #fff2 47%,
        #fff1 68%,
        transparent 59%,
        transparent 100%
      );

    box-shadow: 0 0 calc(var(--radio-border) / 3) 3px #000c inset;
    z-index: 1;
    transition:
      box-shadow var(--transition-speed) ease-in-out,
      background-image var(--transition-speed) ease-in-out;
  }

  /* Radio input (no appearance) */
  .radio-input-element {
    position: absolute;
    top: calc(var(--radio-border) / 1);
    left: calc(var(--radio-border) / 1);
    width: calc(var(--radio-size-total) - var(--radio-border) * 2);
    height: calc(var(--radio-size-total) - var(--radio-border) * 2);
    appearance: none;
    border-radius: 50%;
    background-color: transparent;
    opacity: 0;
    margin: 0;
    cursor: pointer;
  }

  /* Radio icon */
  .radio-icon-element {
    position: absolute;
    pointer-events: none;

    width: 75%;
    height: 75%;
    top: 12.5%;
    left: 12.5%;

    z-index: 0;
    transition:
      transform calc(var(--transition-speed) * 0.25) ease-in-out,
      filter calc(var(--transition-speed) * 0.25) ease-in-out;
  }

  .glow {
    pointer-events: none;
    position: absolute;
    top: -15%;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background-color: color-mix(
      in hsl,
      hsl(var(--radio-bg-hue), 100%, 60%),
      rgb(255, 225, 92) 15%
    );
    filter: blur(2em);
    opacity: 0.45;
    transform: perspective(100px) rotateX(10deg) scale(0.8);
    z-index: 1;
    opacity: 0;
  }

  /* Checked state styles */
  .radio-container:has(.radio-input-element:checked) {
    .radio-button {
      box-shadow: 0 calc(var(--radio-border) * 2) 12px 2px #0004;
    }

    .radio-button::after {
      box-shadow: 0 0 var(--radio-border) calc(var(--radio-border) / 2) #000c
        inset;
    }
    .glow {
      animation: pulse var(--glow-speed) ease-in-out var(--glow-times) forwards;
    }

    .radio-icon-element {
      filter: drop-shadow(0 12px 2px rgba(0, 0, 0, 0.5));
    }
  }

  .radio-container:has(.radio-input-element:checked):hover {
    .radio-icon-element {
      filter: drop-shadow(0 16px 4px rgba(0, 0, 0, 0.4));
    }
  }

  .radio-container:has(.radio-input-element:checked):active {
    .radio-icon-element {
      filter: drop-shadow(0 10px 2px rgba(0, 0, 0, 0.4));
    }
  }

  /* Hover effect */
  .radio-container:hover {
    .radio-button {
      box-shadow: 0 calc(var(--radio-border) * 2.5) 12px 2px #0003;
    }

    .radio-button::after {
      box-shadow: 0 0 calc(var(--radio-border) / 3) 3px #0005 inset;
      scale: 1.05;
    }

    .radio-icon-element {
      transform: scale(1.05);
      filter: drop-shadow(0 16px 4px rgba(0, 0, 0, 0.4));
    }
  }

  /* Active state styles */
  .radio-container:active {
    .radio-button {
      box-shadow: 0 calc(var(--radio-border) * 1.5) 6px 4px #0003;
    }

    .radio-button::after {
      box-shadow: 0 0 calc(var(--radio-border) / 1) var(--radio-border) #0009
        inset;
      scale: 1;
    }

    .radio-icon-element {
      transform: scale(0.95);
      filter: drop-shadow(0 10px 2px rgba(0, 0, 0, 0.4));
    }
  }

  /* Pulse animation for glow effect */
  @keyframes pulse {
    0% {
      transform: perspective(100px) rotateX(10deg) scale(0.8);
      opacity: 0.45;
    }
    50% {
      transform: perspective(100px) rotateX(10deg) scale(1);
      opacity: 0.75;
    }
    100% {
      transform: perspective(100px) rotateX(10deg) scale(0.8);
      opacity: 0.45;
    }
  }

  /* Color themes */
  .success { --radio-bg-hue: 145; }
  .warning { --radio-bg-hue: 40; }
  .danger { --radio-bg-hue: 355; }
  .info { --radio-bg-hue: 200; }
`;

const ButtonWrapper = styled.div`
  button {
   position: relative;
   height: 60px;
   padding: 0 40px;
   border: 2px solid #000;
   background: transparent;
   color: #000;
   user-select: none;
   white-space: nowrap;
   transition: all .05s linear;
   font-family: inherit;
  }

  button:before, button:after {
   content: "";
   position: absolute;
   background: #f5f5f5;
   border: 2px solid #000;
   transition: all .2s linear;
   z-index: -1;
  }

  button:before { width: calc(100% + 6px); height: calc(100% - 16px); top: 6px; left: -5px; }
  button:after { width: calc(100% - 16px); height: calc(100% + 6px); top: -5px; left: 6px; }

  button:hover { cursor: crosshair; background: #000; color: #fff; }
  button:hover:before, button:hover:after { background: #000; }
  button:active { transform: scale(0.95); }
  button:hover:before { height: calc(100% - 32px); top: 14px; }
  button:hover:after { width: calc(100% - 32px); left: 14px; }

  button span {
   font-size: 18px; z-index: 3; position: relative; font-weight: 900; letter-spacing: 0.1em;
  }
`;

const LoaderWrapper = styled.div`
  .loader { display: flex; justify-content: center; align-items: center; scale: 0.8; }
  .loader .container { width: 300px; height: fit-content; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .loader .container .coffee-header { padding: 10px; width: 100%; height: 80px; display: flex; justify-content: space-between; align-items: center; background-color: #ddcfcc; border-radius: 10px; }
  .loader .container .coffee-header__buttons { width: 25px; height: 25px; background-color: #282323; border-radius: 50%; box-shadow: 40px 0 0 0 #282323; }
  .loader .container .coffee-header__buttons::before { content: ""; width: 8px; height: 8px; display: block; transform: translate(100%, 25px); background-color: #615e5e; box-shadow: 40px 0 0 0 #615e5e; }
  .loader .container .coffee-header__display { width: 50px; height: 50px; display: block; border-radius: 50%; background-color: #9acfc5; border: 5px solid #43beae; box-sizing: border-box; }
  .loader .container .coffee-header__details { width: 8px; margin-left: 16px; height: 20px; align-self: flex-start; background-color: #9b9091; box-shadow: -12px 0 0 #9b9091, -24px 0 0 #9b9091; }
  .loader .container .coffee-medium { width: 90%; height: 160px; position: relative; background-color: #bcb0af; }
  .loader .container .coffee-medium:before { content: ""; width: 90%; height: 100px; background-color: #776f6e; position: absolute; bottom: 0; left: 5%; border-radius: 20px 20px 0 0; }
  .loader .container .coffe-medium__exit { width: 60px; height: 20px; position: absolute; top: 0; left: calc(50% - 30px); background-color: #231f20; }
  .loader .container .coffe-medium__exit::before { content: ""; width: 50px; height: 20px; border-radius: 0 0 50% 50%; position: absolute; bottom: -20px; left: calc(50% - 25px); background-color: #231f20; }
  .loader .container .coffe-medium__exit::after { content: ""; width: 10px; height: 10px; position: absolute; bottom: -30px; left: calc(50% - 5px); background-color: #231f20; }
  .loader .container .coffee-medium__arm { width: 70px; height: 20px; position: absolute; top: 15px; right: 25px; background-color: #231f20; }
  .loader .container .coffee-medium__arm::before { content: ""; width: 15px; height: 5px; position: absolute; top: 7px; left: -15px; background-color: #9e9495; }
  .loader .container .coffee-medium__cup { width: 80px; height: 47px; position: absolute; bottom: 0; left: calc(50% - 40px); background-color: #fff; border-radius: 0 0 70px 70px/0 0 110px 110px; }
  .loader .container .coffee-medium__cup::after { content: ""; width: 20px; height: 20px; position: absolute; top: 6px; right: -13px; border: 5px solid #fff; border-radius: 50%; }
  .loader .container .coffee-medium__liquid { width: 6px; height: 63px; position: absolute; top: 50px; left: calc(50% - 3px); background-color: transparent; overflow: hidden; }
  .loader .container .coffee-medium__liquid::before { transform: translateY(-100%); content: ""; width: 100%; height: 100%; display: block; background-color: #74372b; animation: liquid 5000ms linear 500ms infinite normal both; }
  .loader .container .smoke { opacity: 0; width: 8px; height: 20px; position: absolute; border-radius: 5px; background-color: #b3aeae; }
  .loader .container .smoke.one { bottom: 30px; left: 102px; animation: smoke 3s 1s linear infinite; }
  .loader .container .smoke.two { bottom: 40px; left: 118px; animation: smoke 3s 0.5s linear infinite; }
  .loader .container .smoke.three { bottom: 40px; right: 118px; animation: smoke 3s 2s linear infinite; }
  .loader .container .smoke.four { bottom: 30px; right: 102px; animation: smoke 3s 1.5s linear infinite; }
  .loader .container::after { content: ""; width: 95%; height: 15px; background-color: #41bdad; box-shadow: 0 15px 0 5px #000; border-radius: 10px; }
  @keyframes smoke { 0% { transform: translateY(0px); opacity: 0; } 40% { opacity: 0.5; } 50% { transform: translateY(-10px); opacity: 0.3; } 80% { opacity: 0.5; } 100% { transform: translateY(-30px); opacity: 0; } }
  @keyframes liquid { 10% { transform: translateY(0); } 90% { transform: translateY(0); } 100% { transform: translateY(100%); } }
`;

