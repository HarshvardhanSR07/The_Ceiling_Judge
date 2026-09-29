import { Router, Response, Request } from "express";
import { agentService } from "../services/agentService.js";
import { requireAuth } from "../middleware/auth.js"; // if it exists, or omit if not needed

const agentRouter = Router();

agentRouter.post("/api/agent/start", (req: Request, res: Response) => {
  try {
    agentService.startAgent();
    res.json({ success: true, message: "Agent started" });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

agentRouter.post("/api/agent/stop", (req: Request, res: Response) => {
  try {
    agentService.stopAgent();
    res.json({ success: true, message: "Agent stopped" });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

agentRouter.get("/api/agent/status", (req: Request, res: Response) => {
  res.json(agentService.status());
});

export default agentRouter;
