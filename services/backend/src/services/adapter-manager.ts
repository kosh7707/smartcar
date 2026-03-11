import crypto from "crypto";
import type { Adapter } from "@smartcar/shared";
import { AdapterClient, type CanFrame } from "./adapter-client";
import { adapterDAO } from "../dao/adapter.dao";

export class AdapterManager {
  private clients = new Map<string, AdapterClient>();
  private canFrameHandler: ((adapterId: string, frame: CanFrame) => void) | null = null;

  setCanFrameHandler(handler: (adapterId: string, frame: CanFrame) => void): void {
    this.canFrameHandler = handler;
  }

  // --- CRUD ---

  create(name: string, url: string, projectId: string): Adapter {
    const id = `adapter-${crypto.randomUUID().slice(0, 8)}`;
    const createdAt = new Date().toISOString();
    adapterDAO.save({ id, name, url, projectId, createdAt });
    return { id, name, url, projectId, connected: false, ecuConnected: false, ecuMeta: [], createdAt };
  }

  findAll(): Adapter[] {
    const rows = adapterDAO.findAll();
    return rows.map((row) => {
      const client = this.clients.get(row.id);
      const ecuMeta = client?.getEcuMeta();
      return {
        ...row,
        connected: client?.isConnected() ?? false,
        ecuConnected: client?.isEcuConnected() ?? false,
        ecuMeta: ecuMeta ? [ecuMeta] : [],
      };
    });
  }

  findByProjectId(projectId: string): Adapter[] {
    const rows = adapterDAO.findByProjectId(projectId);
    return rows.map((row) => {
      const client = this.clients.get(row.id);
      const ecuMeta = client?.getEcuMeta();
      return {
        ...row,
        connected: client?.isConnected() ?? false,
        ecuConnected: client?.isEcuConnected() ?? false,
        ecuMeta: ecuMeta ? [ecuMeta] : [],
      };
    });
  }

  findById(id: string): Adapter | undefined {
    const row = adapterDAO.findById(id);
    if (!row) return undefined;
    const client = this.clients.get(id);
    const ecuMeta = client?.getEcuMeta();
    return {
      ...row,
      connected: client?.isConnected() ?? false,
      ecuConnected: client?.isEcuConnected() ?? false,
      ecuMeta: ecuMeta ? [ecuMeta] : [],
    };
  }

  update(id: string, fields: { name?: string; url?: string }): Adapter | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    // URL 변경 시 연결 해제
    if (fields.url && fields.url !== existing.url && existing.connected) {
      this.disconnect(id);
    }

    adapterDAO.update(id, fields);
    return this.findById(id);
  }

  delete(id: string): boolean {
    // 연결 중이면 먼저 해제
    const client = this.clients.get(id);
    if (client) {
      client.disconnect();
      this.clients.delete(id);
    }
    return adapterDAO.delete(id);
  }

  deleteByProjectId(projectId: string): void {
    const adapters = adapterDAO.findByProjectId(projectId);
    for (const adapter of adapters) {
      const client = this.clients.get(adapter.id);
      if (client) {
        client.disconnect();
        this.clients.delete(adapter.id);
      }
    }
    adapterDAO.deleteByProjectId(projectId);
  }

  // --- Connect / Disconnect ---

  async connect(id: string): Promise<Adapter> {
    const row = adapterDAO.findById(id);
    if (!row) throw new Error("Adapter not found");

    // 기존 연결 정리
    const existing = this.clients.get(id);
    if (existing) {
      existing.disconnect();
    }

    const client = new AdapterClient();

    // CAN 프레임 라우팅
    client.setCanFrameHandler((frame) => {
      this.canFrameHandler?.(id, frame);
    });

    const wsUrl = row.url.endsWith("/ws/backend")
      ? row.url
      : `${row.url.replace(/\/+$/, "")}/ws/backend`;

    await client.connectTo(wsUrl);
    this.clients.set(id, client);

    return this.findById(id)!;
  }

  disconnect(id: string): Adapter | undefined {
    const client = this.clients.get(id);
    if (client) {
      client.disconnect();
      this.clients.delete(id);
    }
    return this.findById(id);
  }

  // --- Client access ---

  getClient(id: string): AdapterClient | undefined {
    return this.clients.get(id);
  }
}
