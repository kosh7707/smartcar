import { contextBridge } from "electron";

const BACKEND_URL = "http://localhost:3000";

contextBridge.exposeInMainWorld("api", {
  backendUrl: BACKEND_URL,

  healthCheck: async () => {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.json();
  },
});
