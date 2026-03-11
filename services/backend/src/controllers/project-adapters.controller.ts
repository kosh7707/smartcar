import { Router } from "express";
import type { AdapterManager } from "../services/adapter-manager";

export function createProjectAdaptersRouter(adapterManager: AdapterManager): Router {
  const router = Router({ mergeParams: true });

  // 프로젝트 어댑터 목록
  router.get("/", (req, res) => {
    const pid = (req.params as any).pid as string;
    const adapters = adapterManager.findByProjectId(pid);
    res.json({ success: true, data: adapters });
  });

  // 어댑터 등록
  router.post("/", (req, res) => {
    const pid = (req.params as any).pid as string;
    const { name, url } = req.body as { name?: string; url?: string };
    if (!name || !url) {
      res.status(400).json({ success: false, error: "name and url are required" });
      return;
    }
    if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
      res.status(400).json({ success: false, error: "url must start with ws:// or wss://" });
      return;
    }
    const adapter = adapterManager.create(name, url, pid);
    res.status(201).json({ success: true, data: adapter });
  });

  // 어댑터 수정
  router.put("/:id", (req, res) => {
    const pid = (req.params as any).pid as string;
    const { id } = req.params;
    const adapter = adapterManager.findById(id);
    if (!adapter) {
      res.status(404).json({ success: false, error: "Adapter not found" });
      return;
    }
    if (adapter.projectId !== pid) {
      res.status(404).json({ success: false, error: "Adapter not found in this project" });
      return;
    }

    const { name, url } = req.body as { name?: string; url?: string };
    if (url && !url.startsWith("ws://") && !url.startsWith("wss://")) {
      res.status(400).json({ success: false, error: "url must start with ws:// or wss://" });
      return;
    }
    const updated = adapterManager.update(id, { name, url });
    res.json({ success: true, data: updated });
  });

  // 어댑터 삭제
  router.delete("/:id", (req, res) => {
    const pid = (req.params as any).pid as string;
    const { id } = req.params;
    const adapter = adapterManager.findById(id);
    if (!adapter || adapter.projectId !== pid) {
      res.status(404).json({ success: false, error: "Adapter not found" });
      return;
    }
    adapterManager.delete(id);
    res.json({ success: true });
  });

  // 연결
  router.post("/:id/connect", async (req, res) => {
    const pid = (req.params as any).pid as string;
    const { id } = req.params;
    const adapter = adapterManager.findById(id);
    if (!adapter || adapter.projectId !== pid) {
      res.status(404).json({ success: false, error: "Adapter not found" });
      return;
    }
    try {
      const connected = await adapterManager.connect(id);
      res.json({ success: true, data: connected });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      res.status(502).json({ success: false, error: message });
    }
  });

  // 연결 해제
  router.post("/:id/disconnect", (req, res) => {
    const pid = (req.params as any).pid as string;
    const { id } = req.params;
    const adapter = adapterManager.findById(id);
    if (!adapter || adapter.projectId !== pid) {
      res.status(404).json({ success: false, error: "Adapter not found" });
      return;
    }
    const disconnected = adapterManager.disconnect(id);
    res.json({ success: true, data: disconnected });
  });

  return router;
}
