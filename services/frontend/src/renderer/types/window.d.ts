declare const __APP_VERSION__: string;

interface AegisApi {
  backendUrl?: string;
  healthCheck?: () => Promise<unknown>;
}

interface Window {
  api?: AegisApi;
}
