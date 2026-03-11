export interface CanFrame {
  timestamp: string;
  id: string;
  dlc: number;
  data: string;
}

export interface EcuResponse {
  success: boolean;
  data?: string;
  error?: "no_response" | "malformed" | "reset" | "delayed";
  delayMs?: number;
}

// ECU Sim -> Adapter
export type EcuToAdapterMessage =
  | { type: "can-frame"; frame: CanFrame }
  | { type: "inject-response"; requestId: string; response: EcuResponse }
  | { type: "ecu-info"; ecu: { name: string; canIds: string[] } };

// Adapter -> ECU Sim
export type AdapterToEcuMessage =
  | { type: "inject-request"; requestId: string; frame: CanFrame };

// Adapter -> Backend (S2)
export type AdapterToBackendMessage =
  | { type: "can-frame"; frame: CanFrame }
  | { type: "inject-response"; requestId: string; response: EcuResponse }
  | { type: "ecu-status"; status: "connected" | "disconnected" }
  | { type: "ecu-info"; ecu: { name: string; canIds: string[] } };

// Backend (S2) -> Adapter
export type BackendToAdapterMessage =
  | { type: "inject-request"; requestId: string; frame: CanFrame };
