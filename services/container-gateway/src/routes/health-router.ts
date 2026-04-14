import { Router } from "express";
export function createHealthRouter(): Router {
  const router = Router();
  router.get('/health', (_req, res) => { res.json({ service: 's8-container-gateway', status: 'ok', version: '0.1.0' }); });
  return router;
}
