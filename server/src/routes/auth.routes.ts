import { Router } from "express";
import { toNodeHandler } from "better-auth/node";

const router = Router();

// Pass Better Auth requests directly to the handler
// Handler will be attached by index.ts after auth initialization

export default router;

// Helper to mount auth routes
export const mountAuthRoutes = (auth: any) => {
  router.use(toNodeHandler(auth));
};
