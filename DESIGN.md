# The Ceiling Judge - Visual Law & Redesign Brief

This document serves as the absolute source of truth for the visual identity, motion physics, and architectural constraints of The Ceiling Judge (formerly Forge). **No UI is written without consulting this document.**

## 1. Core Doctrine & Anti-Slop Rules

*   **One Icon Family**: Strict adherence to a single weight of Lucide icons. No mixing flat, 3D, and animated icons unless strictly outlined (e.g., a single animated success check).
*   **No Rainbow Slop**: The palette is strictly restricted to Void (`#0D0B14`), Cyan (`#22D3EE`), and Violet (`#8B5CF6`). Gradients must only interpolate between these tokens.
*   **No Equal 3-Col Grids**: The Gallery and Dashboards must utilize asymmetric bento styling (e.g., `DESIGN_VARIANCE â‰ˆ 7`). A strict uniform grid says "archive"; asymmetry says "live arena".
*   **Reduced Motion Safe**: Every WebGL/Three.js context and heavy Framer Motion stagger must gracefully degrade to static mesh gradients when `prefers-reduced-motion` is active.
*   **Hierarchy of Density**: 
    *   **Organizer**: Dense, calm, data-rich (Visual Density: 8, Motion Intensity: 2).
    *   **Gallery**: Spatial, airy, explorative (Visual Density: 4, Motion Intensity: 5).
    *   **Arena**: Theatrical, focused, high-stakes (Visual Density: 3, Motion Intensity: 8).

## 2. Motion & Interaction Tokens

*   **Framer Motion Springs**: Short durations, interruptible. `bounce: 0` for utilitarian UI, `damping: 20, stiffness: 200` for theatrical entrances.
*   **Micro-interactions**: Magnetic CTAs (Sebadam style), smooth caret/kinetic inputs (Skiper UI). 
*   **Transitions (SSGOI inspired)**: Route changes must feel native. Drill/hero transitions from Gallery cards to Project details; sheets for modals/submissions; slides for Organizer tabs.

---

## 3. Redesign Brief: Route Execution Plan

### `/` (Gallery)
*   **Atmosphere**: Deep spatial exploration.
*   **Keep**: The underlying data fetching and project randomization.
*   **Replace**: The current grid with a layered, asymmetrical Bento layout (Watermelon style). The card hover states with Multilayered Card layouts (`translateZ` layers, GetLayers style).
*   **Add**: 
    *   Generative Tree (ThreeUI) restricted strictly to the background atmosphere, scaled to `projects.length`.
    *   Scroll Progress Bar (Sebadam) thin track under the sticky nav.
    *   Staggered Text Reveal / Kinetic Type (Componentry) for the hero title.

### `/judge` (Pair Arena)
*   **Atmosphere**: Theatrical, focused, soft-duel.
*   **Keep**: Pairwise ELO math and keyboard shortcuts.
*   **Replace**: Standard buttons with morphing/micro-interaction buttons (Watermelon/Skiper) for the 1â€“5 preference strip.
*   **Add**: 
    *   Procedural Duel Tokens (img2threejs) representing the two projects, reacting/leaning based on the judge's hover intent.
    *   Custom Tooltips (Skiper UI) explaining the judging criteria cleanly.
    *   Magnetic Play CTA (Sebadam) for the "Open the Arena" entry button.

### `/organizer` (Command Center)
*   **Atmosphere**: Dense, muted chrome, calm dark surfaces.
*   **Keep**: The Recharts area graphs (`Live Judge Velocity` and `Mu Score Curve`).
*   **Replace**: The rigid data table with a highly polished, sortable block (Componentry / Watermelon dashboard blocks).
*   **Add**: 
    *   Expandable Tabs (Skiper UI) to toggle between People / Rankings / Controls.
    *   Animated Numbers (Skiper UI) ticking up the `mu` scores and `n_obs` as live WebSockets/polling updates hit.

### `/submit` (Registration)
*   **Atmosphere**: Utility, high-polish, friction-free.
*   **Keep**: The single-page semantic HTML `<form>` structure to guarantee the `.dogfood.toml` checker passes.
*   **Replace**: Standard inputs with Smooth Caret / Kinetic Inputs (Skiper UI).
*   **Add**: 
    *   Sheet transition (SSGOI) on entry/exit.
    *   Magnetic Hover on the final submit CTA.

### `/results` (Closing Ceremony - *Phase 3 Addition*)
*   **Atmosphere**: Triumphant, highly polished.
*   **Add**: 
    *   3D Orb / Pixel Glass ceremonial object (GetLayers / Three.js).
    *   Animated Number / Split Flap (Componentry) for revealing the final scores.
    *   Cards Cascade / Carousel Spotlight (GetLayers) for the podium.

## 4. The Three Pillars (Architectural Narratives)

### Pillar I: The Overseer’s Bridge (Admin / Organizer)
*As an Admin, you do not participate in the hackathon; you maintain the physical laws of the platform. Your interface trades the gamified momentum of the public landing page for extreme data density and absolute control.*

1. **Ignition: The Master Uplink**
   Root Access and Role Verification. Your entry requires a multi-signature handshake. Once the .dogfood.toml script injects your root-level offline session cookie, the system instantly strips away all front-end abstractions. You are dropped into a hyper-dense, edge-to-edge Bento grid layout. The visual theme shifts from vibrant neon to a clinical, high-contrast monochrome, signaling that you are operating at the bare metal of the platform.
2. **The Command Center: Platform Health Diagnostics**
   Live Bento Grid Telemetry. Your primary viewport is a mosaic of live data tables and performance gauges built on the componentry.dev architecture.
   *   **The Ingestion Valve**: A real-time timeline tracks API payload sizes as candidates push their commits. If a team attempts to upload an oversized asset that threatens to bottleneck the server, the specific grid cell flashes a muted amber warning, allowing you to throttle their bandwidth with a single click.
   *   **Judge Calibration Tracking**: A dense matrix displays every judge's Z-score normalization curve. If a judge is scoring erratically or rapidly clicking through submissions without proper dwell time, their row physically elevates to the top of the table, flagged with a high-contrast CSS micro-interaction for immediate review.
3. **The Cryptographic Ledger: Auditing the Chain**
   Interactive 3D Security. Occupying the center of the Overseer’s Bridge is the Cryptographic Core—a massive, interactive 3D node graph powered by threejs.org. This is the immutable ledger where every normalized score is permanently minted. As an Admin, you can physically grab this 3D structure with your cursor and spin the lattice on its XYZ axes.
   *   **Node Inspection**: Hovering over any glowing sphere in the graph triggers a glassmorphic tooltip that unpacks the exact cryptographically signed transaction: which judge cast the score, the raw input, the Z-score delta, and the timestamp.
   *   **Anomaly Detection**: If the system detects a potential tampering attempt or a hash mismatch in the database, the compromised node breaks the unified color palette, pulsing in a harsh crimson red.
4. **The Intervention Matrix: Execution and Overrides**
   Tactile Master Controls. When an anomaly is confirmed or a dispute arises, you move to the Intervention Matrix. This is a row of heavy, tactile action buttons designed to prevent accidental clicks. If you need to invalidate a tampered score or disqualify a malicious payload, you engage the Override protocol. You must hold the click for two full seconds. A high-resolution CSS loading ring fills up around the button. Once complete, a heavy haptic visual feedback triggers—the compromised node is visually severed from the 3D graph, dropping into an archived state, and the system instantly recalculates the global leaderboard based on the newly sanitized dataset.

### Pillar II: The Public Spectacle (Landing Page / Spectator)
*For a spectator arriving at the landing page, the platform is not a static brochure—it is a living, kinetic visualization of the hackathon’s momentum. The entire interface is designed to translate the silent, unseen effort of hundreds of builders into a massive, public display of energy.*

1. **The Generative Tree: Visualizing Momentum**
   The Ecosystem Engine. Upon arriving at the root URL, the spectator's viewport is immediately anchored by a massive 3D Generative Tree, rendered against a deep, noise-textured dark-mode gradient. This is not a looping animation; it is a live, data-driven entity. When the platform is quiet, the tree breathes with a slow, idle sway. However, the moment a candidate on the Builder's Terminal hits "Deploy" and locks their final submission, a webhook fires into the public frontend. You can literally watch the impact: a pulse of neon light travels up the trunk of the 3D structure. A new geometric branch smoothly extrudes from the canopy, unfurling a cluster of low-poly leaves. If a spectator clicks on this newly formed branch, it triggers a sleek CSS micro-interaction, popping up a glassmorphic tooltip that proudly displays the newly submitted project's name and the team's 3D badge. As the deadline approaches and deployments flood the server, the tree rapidly expands into a dense, glowing canopy, creating a powerful sense of FOMO and scale.
2. **The Kinematic Fallback: Reduced Motion Protocol**
   Accessibility & Performance. The platform constantly monitors the spectator's device capabilities. If the browser flags prefers-reduced-motion or detects severe throttling, the heavy 3D rendering engine gracefully powers down. The Generative Tree dissolves into a static, high-resolution 2D mesh gradient. Instead of 3D branching, the momentum is visualized through a clean, typographical ticker that smoothly types out real-time deployment logs—maintaining the tactile, high-end feel without weaponizing the user's GPU.
3. **The Leaderboard: The Z-Score Shuffler**
   Fluid Ranks. Scrolling below the canopy reveals the global leaderboard—a modular Bento grid stack tracking the highest-rated case files. This is where the judges' normalized math becomes public reality. The leaderboard refuses to rely on abrupt, jarring page refreshes. Powered by fluid layout transitions, it behaves like a mechanical departures board at a high-speed rail station. When a judge finalizes a normalized score in the Adjudication Matrix, the leaderboard reacts instantly:
   *   **The Odometer Roll**: The point values on the board roll vertically into their new digits.
   *   **The Positional Glide**: If a new submission outranks an existing one, the rows do not snap. The ascending project card physically elevates on the Z-axis, casting a soft drop-shadow, and smoothly glides up the list, while the displaced projects slide downward to accommodate the new hierarchy.
4. **The Project Gallery: Multilayered Exploration**
   The Spectator Deep Dive. When a spectator clicks on a specific leaderboard row, they are not taken to a separate page. Instead, the row expands in place using a multilayered card layout. The project’s syntax-highlighted code snippets, UI mockups, and the team's rotating 3D coins fan out like a deck of cards spread across a table. The spectator can inspect the exact architecture that earned the team their rank, entirely within the context of the live event.

### Pillar III: The Builder's Terminal (Candidate)
*As a candidate, you are the primary catalyst of this platform; the architecture is designed to propel your code from staging to the cryptographic ledger with zero friction.*

1. **Ignition: The Candidate Uplink**
   Auth and Profile Minting. Your entry sequence begins via the streamlined authentication modals. Upon verifying your builder credentials, the system instantly mints your identity into the platform. Your 2D profile image is fed through the internal graphics engine, emerging as a 3D interactive badge that rotates fluidly on hover. You are now a verified node in the competition matrix.
2. **The Command Center: Workspace Calibration**
   Bento Grid Telemetry. The dashboard constructs itself around you using a modular Bento grid architecture.
   *   **The Countdown Matrix**: A high-contrast, neon-accented chronometer displaying the exact hours and minutes remaining in the sprint.
   *   **The Squad Roster**: Your team's 3D badges sit in a sleek dock. Glowing CSS micro-interactions on the borders indicate who is currently online and pushing commits.
   *   **The Staging Timeline**: A horizontal, interactive progress track mapping your journey from registration to final deployment, keeping your squad completely synchronized.
3. **The Forge: Assembling the Payload**
   Markdown and Code Integration. When you are ready to construct your project dossier, you enter The Forge. This is a distraction-free, deep-dark-mode environment.
   *   **Code Injection**: You drop your core logic or API endpoints into precision-milled snippet blocks. Syntax highlighting automatically engages, ensuring your architecture is immediately readable to the judging tier.
   *   **Asset Layering**: You upload UI mockups and demo graphics. The engine automatically stacks these into a multilayered card structure, giving your final presentation visual Z-axis depth.
4. **Deployment: Locking the Final Submission**
   Triggering the Global Visualization. Once your project is staged, you initiate the final deployment protocol by pressing the primary neon CTA, which depresses with a satisfying tactile click. The payload is locked and encrypted. Instantly, a critical visual feedback loop triggers: out on the public-facing landing page, the massive 3D Generative Tree physically expands, sprouting a new, glowing branch. Your submission has permanently altered the scale of the hackathon ecosystem, and your dossier is seamlessly routed to the Assembly Queue of the judges.
