import { Router } from "express";
import { auth } from "../auth";
import { toNodeHandler } from "better-auth/node";

const router = Router();

// Pass Better Auth requests directly to the handler
router.use(toNodeHandler(auth));

export default router;
